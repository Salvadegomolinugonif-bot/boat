"use strict";

// Soglie (attenzione, sconsigliato) come nell'app Mac: vento e raffiche in nodi, onda in metri
const BASE = {
  vela:    { vento: [20, 28], onda: [1.5, 2.5] },
  motore:  { vento: [16, 22], onda: [0.8, 1.5] },
  gommone: { vento: [12, 18], onda: [0.5, 1.0] }
};
const NOMI_BARCA = { vela: "Vela", motore: "Motore", gommone: "Gommone" };
const COLORI = ["#34c759", "#ffcc00", "#ff453a"];
const ETICHETTE = ["Condizioni buone", "Attenzione", "Sconsigliato"];

function leggi(chiave, predefinito) {
  try {
    const v = localStorage.getItem(chiave);
    return v === null ? predefinito : JSON.parse(v);
  } catch (e) { return predefinito; }
}
function scrivi(chiave, valore) {
  try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch (e) {}
}
function rimuovi(chiave) {
  try { localStorage.removeItem(chiave); } catch (e) {}
}

// Soglie effettive: quelle personali se impostate. Il rosso non scende mai sotto il giallo.
function soglie(barca) {
  const b = BASE[barca];
  const p = leggi("soglie_" + barca, {});
  const num = (x, d) => (typeof x === "number" ? x : d);
  const vg = num(p.ventoG, b.vento[0]);
  const og = num(p.ondaG, b.onda[0]);
  return {
    vento: [vg, Math.max(num(p.ventoR, b.vento[1]), vg)],
    onda: [og, Math.max(num(p.ondaR, b.onda[1]), og)]
  };
}

function classifica(v, s) { return v >= s[1] ? 2 : (v >= s[0] ? 1 : 0); }

function verdetto(o, s) {
  return Math.max(classifica(o.vento, s.vento), classifica(o.raffica, s.vento), classifica(o.onda || 0, s.onda));
}

function cardinale(g) {
  const n = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return n[Math.floor(((g + 22.5) % 360) / 45)];
}

const TEMPO = [
  [[0], "Sereno", "☀️", "🌙"],
  [[1, 2], "Poco nuvoloso", "⛅", "☁️"],
  [[3], "Coperto", "☁️", "☁️"],
  [[45, 48], "Nebbia", "🌫️", "🌫️"],
  [[51, 53, 55, 56, 57], "Pioviggine", "🌦️", "🌧️"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Pioggia", "🌧️", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Neve", "❄️", "❄️"],
  [[95, 96, 99], "Temporale", "⛈️", "⛈️"]
];
function tempo(c) { return TEMPO.find(t => t[0].includes(c)) || [[], "–", "❔", "❔"]; }
function nomeTempo(c) { return tempo(c)[1]; }
function icona(c, notte) { const t = tempo(c); return notte ? t[3] : t[2]; }

// Notte = prima dell'alba o dopo il tramonto di quel giorno nel porto
function eNotte(t, daily) {
  const i = daily.time.indexOf(t.slice(0, 10));
  if (i < 0) return false;
  return t < daily.sunrise[i] || t > daily.sunset[i];
}

function luna(d) {
  const ciclo = 29.530588853;
  const eta = ((((d.getTime() / 1000 - 947182440) / 86400) % ciclo) + ciclo) % ciclo;
  const perc = Math.round(((1 - Math.cos(2 * Math.PI * eta / ciclo)) / 2) * 100);
  const f = [[1.85, "Luna nuova", "🌑"], [5.54, "Luna crescente", "🌒"], [9.22, "Primo quarto", "🌓"],
    [12.91, "Gibbosa crescente", "🌔"], [16.61, "Luna piena", "🌕"], [20.30, "Gibbosa calante", "🌖"],
    [23.99, "Ultimo quarto", "🌗"], [27.68, "Luna calante", "🌘"]];
  for (const [lim, nome, emoji] of f) if (eta < lim) return { nome, emoji, perc };
  return { nome: "Luna nuova", emoji: "🌑", perc };
}

async function json(url) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.reason || ("Errore " + r.status));
    return d;
  } finally {
    clearTimeout(to);
  }
}

async function carica(porto) {
  const q = "latitude=" + porto.lat + "&longitude=" + porto.lon + "&timezone=auto&forecast_days=7";
  const meteo = json("https://api.open-meteo.com/v1/forecast?" + q +
    "&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,weather_code,precipitation_probability,pressure_msl,visibility" +
    "&daily=sunrise,sunset&wind_speed_unit=kn");
  const mare = json("https://marine-api.open-meteo.com/v1/marine?" + q +
    "&hourly=wave_height,wave_period,sea_level_height_msl,sea_surface_temperature").catch(() => null);
  const [m, o] = await Promise.all([meteo, mare]);

  const onde = {};
  if (o && o.hourly && o.hourly.time) {
    o.hourly.time.forEach((t, i) => {
      onde[t] = { h: o.hourly.wave_height[i], p: o.hourly.wave_period ? o.hourly.wave_period[i] : null,
                  lm: o.hourly.sea_level_height_msl ? o.hourly.sea_level_height_msl[i] : null,
                  st: o.hourly.sea_surface_temperature ? o.hourly.sea_surface_temperature[i] : null };
    });
  }
  const adesso = new Date(Date.now() + m.utc_offset_seconds * 1000).toISOString().slice(0, 13) + ":00";
  const h = m.hourly;
  const ore = [];
  for (let i = 0; i < h.time.length; i++) {
    if (h.time[i] < adesso) continue;
    const w = onde[h.time[i]];
    ore.push({
      t: h.time[i],
      vento: h.wind_speed_10m[i] ?? 0,
      raffica: h.wind_gusts_10m[i] ?? 0,
      dir: h.wind_direction_10m[i],
      temp: h.temperature_2m[i],
      codice: h.weather_code[i],
      pioggia: h.precipitation_probability[i],
      onda: w && w.h != null ? w.h : null,
      periodo: w && w.p != null ? w.p : null,
      pressione: h.pressure_msl ? h.pressure_msl[i] : null,
      vis: h.visibility ? h.visibility[i] : null,
      mare: w && w.lm != null ? w.lm : null,
      tmare: w && w.st != null ? w.st : null
    });
  }
  return { ore, daily: m.daily, utc: m.utc_offset_seconds };
}
