"use strict";
// Griglia di punti meteo per la mappa (7 colonne x 5 righe) e campo colorato

const MG = { nx: 7, ny: 5, punti: [], lat0: 0, lon0: 0, dLat: 1, dLon: 1, chiave: "", quando: 0, i0: 0, t0: "" };

const SCALE = {
  vento: [[0, .65, .86, .96], [5, .36, .75, .87], [10, .30, .76, .54], [15, .95, .82, .23],
          [20, .95, .61, .24], [25, .90, .33, .24], [35, .69, .20, .55], [45, .42, .18, .61]],
  aria: [[-5, .23, .36, .66], [0, .36, .61, .84], [10, .49, .79, .65], [18, .95, .89, .41],
         [25, .95, .61, .24], [32, .90, .33, .24], [40, .61, .12, .23]],
  mare: [[8, .17, .30, .61], [13, .24, .53, .78], [17, .35, .76, .79], [20, .42, .78, .55],
         [24, .90, .85, .29], [28, .94, .54, .24], [32, .85, .26, .23]]
};
SCALE.raffiche = SCALE.vento;
const UNITA_L = { vento: "nodi", raffiche: "nodi", aria: "°C", mare: "°C" };

function rgbScala(sc, v) {
  if (v <= sc[0][0]) return sc[0].slice(1);
  for (let i = 1; i < sc.length; i++) {
    if (v <= sc[i][0]) {
      const a = sc[i - 1], b = sc[i], t = (v - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  return sc[sc.length - 1].slice(1);
}

function gradienteCSS(liv) {
  const sc = SCALE[liv], min = sc[0][0], max = sc[sc.length - 1][0];
  const stops = sc.map(t => "rgb(" + Math.round(t[1] * 255) + "," + Math.round(t[2] * 255) + "," +
    Math.round(t[3] * 255) + ") " + ((t[0] - min) / (max - min) * 100).toFixed(0) + "%");
  return { css: "linear-gradient(90deg," + stops.join(",") + ")", min: min, max: max };
}

// Ritorna true se ha caricato dati nuovi. Ricarica solo se la zona cambia davvero o dopo 30 minuti.
async function caricaGriglia(centro, span) {
  const sLat = Math.max(Math.round(span.lat * 4) / 4, 0.5);
  const sLon = Math.max(Math.round(span.lon * 4) / 4, 0.5);
  const c0 = Math.round(centro.lat / (sLat / 4)) * (sLat / 4);
  const c1 = Math.round(centro.lon / (sLon / 4)) * (sLon / 4);
  const chiave = [c0, c1, sLat, sLon].map(x => x.toFixed(3)).join("|");
  if (chiave === MG.chiave && MG.punti.length && Date.now() - MG.quando < 1800000) return false;

  const cop = 1.3;
  const dla = sLat * cop / (MG.ny - 1), dlo = sLon * cop / (MG.nx - 1);
  const la0 = c0 - sLat * cop / 2, lo0 = c1 - sLon * cop / 2;
  const lats = [], lons = [];
  for (let iy = 0; iy < MG.ny; iy++) {
    for (let ix = 0; ix < MG.nx; ix++) {
      lats.push((la0 + iy * dla).toFixed(3));
      lons.push((lo0 + ix * dlo).toFixed(3));
    }
  }
  const q = "latitude=" + lats.join(",") + "&longitude=" + lons.join(",") + "&forecast_days=2&timezone=auto";
  const meteo = json("https://api.open-meteo.com/v1/forecast?" + q +
    "&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m&wind_speed_unit=kn");
  const mare = json("https://marine-api.open-meteo.com/v1/marine?" + q +
    "&hourly=sea_surface_temperature").catch(() => null);
  const r = await Promise.all([meteo, mare]);
  const arr = Array.isArray(r[0]) ? r[0] : [r[0]];
  const arrM = r[1] ? (Array.isArray(r[1]) ? r[1] : [r[1]]) : [];
  const n = MG.nx * MG.ny;
  if (arr.length < n) throw new Error("Dati incompleti");

  const nuovi = [];
  for (let k = 0; k < n; k++) {
    const h = arr[k].hourly;
    nuovi.push({
      lat: la0 + Math.floor(k / MG.nx) * dla, lon: lo0 + (k % MG.nx) * dlo,
      quota: arr[k].elevation || 0,
      nodi: h.wind_speed_10m, raff: h.wind_gusts_10m, dir: h.wind_direction_10m, aria: h.temperature_2m,
      mare: arrM[k] && arrM[k].hourly ? arrM[k].hourly.sea_surface_temperature : null
    });
  }
  const tempi = arr[0].hourly.time;
  const adesso = new Date(Date.now() + arr[0].utc_offset_seconds * 1000).toISOString().slice(0, 13) + ":00";
  const i0 = Math.max(0, tempi.findIndex(t => t >= adesso));
  Object.assign(MG, { punti: nuovi, lat0: la0, lon0: lo0, dLat: dla, dLon: dlo, chiave: chiave,
                      quando: Date.now(), i0: i0, t0: tempi[i0] });
  return true;
}

function interpola(v, fx, fy) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  if (x0 < 0 || y0 < 0 || x0 >= MG.nx - 1 || y0 >= MG.ny - 1) return null;
  const tx = fx - x0, ty = fy - y0;
  let s = 0, w = 0;
  [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]].forEach(e => {
    const a = v[(y0 + e[1]) * MG.nx + x0 + e[0]];
    if (a != null) { s += a * e[2]; w += e[2]; }
  });
  return w > 1e-4 ? s / w : null;
}

// Immagine del campo: righe corrette per la proiezione della mappa (Mercatore)
function campoImmagine(liv, ora) {
  if (!MG.punti.length) return null;
  const i = MG.i0 + ora;
  const val = MG.punti.map(p => {
    if (liv === "mare" && p.quota > 3) return null;
    const s = liv === "vento" ? p.nodi : liv === "raffiche" ? p.raff : liv === "aria" ? p.aria : p.mare;
    return s && s[i] != null ? s[i] : null;
  });
  const lat1 = MG.lat0 + (MG.ny - 1) * MG.dLat, lon1 = MG.lon0 + (MG.nx - 1) * MG.dLon;
  const my = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const ly = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
  const yT = my(lat1), yB = my(MG.lat0);
  const W = 140, H = 100;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext("2d");
  const im = cx.createImageData(W, H);
  const sc = SCALE[liv];
  let qualcuno = false;
  for (let py = 0; py < H; py++) {
    const fy = (ly(yT + (yB - yT) * (py + 0.5) / H) - MG.lat0) / MG.dLat;
    for (let px = 0; px < W; px++) {
      const v = interpola(val, (px + 0.5) / W * (MG.nx - 1), fy);
      if (v === null) continue;
      const c = rgbScala(sc, v), k = (py * W + px) * 4;
      im.data[k] = c[0] * 255;
      im.data[k + 1] = c[1] * 255;
      im.data[k + 2] = c[2] * 255;
      im.data[k + 3] = 255;
      qualcuno = true;
    }
  }
  if (!qualcuno) return null;
  cx.putImageData(im, 0, 0);
  return { url: cv.toDataURL("image/png"), bounds: [[MG.lat0, MG.lon0], [lat1, lon1]] };
}

// Barbetta del vento in SVG: l'asta punta verso la provenienza del vento
function barbetta(kn, dir) {
  const n = Math.round(kn / 5) * 5, c = 23;
  if (n < 5) {
    return '<svg width="46" height="46"><circle cx="23" cy="23" r="3" fill="none" stroke="#fff" stroke-width="3.8"/>' +
      '<circle cx="23" cy="23" r="3" fill="none" stroke="#000" stroke-width="1.6"/></svg>';
  }
  let d = "M" + c + "," + c + " L" + c + "," + (c - 20) + " ";
  let pos = 20, resto = n;
  const tri = Math.floor(resto / 50); resto -= tri * 50;
  const intere = Math.floor(resto / 10); resto -= intere * 10;
  const mezza = Math.floor(resto / 5);
  for (let i = 0; i < tri; i++) {
    d += "M" + c + "," + (c - pos) + " L" + (c + 9) + "," + (c - pos) + " L" + c + "," + (c - pos + 5) + " Z ";
    pos -= 6;
  }
  for (let i = 0; i < intere; i++) {
    d += "M" + c + "," + (c - pos) + " L" + (c + 9) + "," + (c - pos - 3) + " ";
    pos -= 4;
  }
  if (mezza) {
    if (n === 5) pos -= 4;
    d += "M" + c + "," + (c - pos) + " L" + (c + 4.5) + "," + (c - pos - 1.5) + " ";
  }
  const st = ' stroke-linejoin="round" stroke-linecap="round"/>';
  return '<svg width="46" height="46" viewBox="0 0 46 46"><g transform="rotate(' + dir + " " + c + " " + c + ')">' +
    '<path d="' + d + '" fill="#fff" stroke="#fff" stroke-width="3.8"' + st +
    '<path d="' + d + '" fill="#000" stroke="#000" stroke-width="1.6"' + st + "</g></svg>";
}
