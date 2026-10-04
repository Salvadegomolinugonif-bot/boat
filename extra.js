"use strict";
const qs = id => document.getElementById(id);

// ---------- Allerte ----------
function calcolaAllerte(ore) {
  const l = [];
  const p24 = ore.slice(0, 24);
  const temp = p24.filter(o => [95, 96, 99].includes(o.codice));
  if (temp.length) {
    l.push({ livello: 2, titolo: "Temporali", dettaglio: `previsti dalle ${temp[0].t.slice(11, 13)}h (${temp.length} ore nelle prossime 24)` });
  }
  const neb = p24.filter(o => (o.vis != null && o.vis < 1000) || [45, 48].includes(o.codice));
  if (neb.length) {
    l.push({ livello: 1, titolo: "Nebbia", dettaglio: `visibilità ridotta dalle ${neb[0].t.slice(11, 13)}h (${neb.length} ore)` });
  }
  let calo = 0, quando = null;
  for (let i = 3; i < p24.length; i++) {
    const a = p24[i - 3].pressione, b = p24[i].pressione;
    if (a != null && b != null && a - b > calo) { calo = a - b; quando = p24[i].t; }
  }
  if (calo >= 4) {
    l.push({ livello: calo >= 6 ? 2 : 1, titolo: "Calo di pressione", dettaglio: `${calo.toFixed(1)} hPa in 3 ore, entro le ${quando.slice(11, 13)}h: possibile peggioramento` });
  }
  return l;
}

function renderAllerte(ore) {
  const box = qs("allerte");
  const l = calcolaAllerte(ore);
  if (!l.length) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  box.innerHTML = "<h2>Allerte</h2>" + l.map(a =>
    `<div class="allerta" style="border-left-color:${COLORI[a.livello]}"><strong>${a.titolo}</strong> <span class="sub">${a.dettaglio}</span></div>`).join("");
}

// ---------- Quando partire ----------
function trovaFinestre(ore, daily, s) {
  const giorni = {};
  ore.forEach(o => {
    const g = o.t.slice(0, 10);
    (giorni[g] = giorni[g] || []).push(o);
  });
  return Object.keys(giorni).sort().slice(0, 7).map(g => {
    const i = daily.time.indexOf(g);
    const alba = i >= 0 ? daily.sunrise[i] : g + "T06:00";
    const tram = i >= 0 ? daily.sunset[i] : g + "T20:00";
    let migliore = { n: 0, da: null, a: null };
    let corrente = { n: 0, da: null, a: null };
    giorni[g].forEach(o => {
      const ok = o.t >= alba && o.t <= tram && verdetto(o, s) === 0;
      if (ok) {
        corrente = corrente.n === 0 ? { n: 1, da: o.t, a: o.t } : { n: corrente.n + 1, da: corrente.da, a: o.t };
        if (corrente.n > migliore.n) migliore = { n: corrente.n, da: corrente.da, a: corrente.a };
      } else {
        corrente = { n: 0, da: null, a: null };
      }
    });
    return { g, n: migliore.n, da: migliore.da, a: migliore.a };
  });
}

function etichettaGiorno(g) {
  const [y, m, d] = g.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

function renderPartire(ore, daily, s) {
  const f = trovaFinestre(ore, daily, s);
  const best = Math.max(0, ...f.map(x => x.n));
  qs("partire").innerHTML = "<h2>Quando partire · prossimi giorni</h2>" + f.map(x => {
    const fine = x.n ? String(parseInt(x.a.slice(11, 13), 10) + 1).padStart(2, "0") : "";
    const testo = x.n ? `${x.da.slice(11, 13)}–${fine} · ${x.n} h` : "nessuna finestra buona";
    const colore = x.n ? COLORI[0] : "var(--tenue)";
    return `<div class="giorno${x.n && x.n === best ? " migliore" : ""}"><span>${etichettaGiorno(x.g)}</span><span style="color:${colore}">${testo}</span></div>`;
  }).join("") +
    `<p class="nota">Finestra = ore consecutive tra alba e tramonto con semaforo verde, secondo le tue soglie. Previsione da modello: oltre 2-3 giorni è molto meno affidabile.</p>`;
}

function renderExtra(d, s, ore, porto) {
  renderAllerte(ore);
  renderPartire(ore, d.daily, s);
  renderMaree(ore);
  disegnaRiparo(ore, porto);
}
