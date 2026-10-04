"use strict";
let MAPPA = null;
const MS = { liv: "vento", ora: 0, simboli: true, fondali: false, barbette: true, op: 0.45,
             strato: null, barbe: [], sim: null, fon: null, marca: null, timer: null };

function caricaScript(src) {
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => no(new Error("Libreria della mappa non caricata"));
    document.head.appendChild(s);
  });
}

function portoScelto() {
  const n = document.getElementById("porto").value;
  return PORTI.find(p => p.n === n) || PORTI[0];
}

function aggiornaLegenda() {
  const box = document.getElementById("mLegenda");
  if (MS.liv === "nessuno") { box.innerHTML = ""; return; }
  const g = gradienteCSS(MS.liv);
  box.innerHTML = '<div class="legenda" style="background:' + g.css + '"></div>' +
    '<div class="legTxt"><span>' + g.min + "</span><span>" + UNITA_L[MS.liv] + "</span><span>" + g.max + "</span></div>";
}

function etichettaOra() {
  if (!MG.t0) return "";
  const d = new Date(MG.t0 + ":00");
  d.setHours(d.getHours() + MS.ora);
  return d.toLocaleString("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function ridisegnaMeteo() {
  if (MS.strato) { MAPPA.removeLayer(MS.strato); MS.strato = null; }
  MS.barbe.forEach(m => MAPPA.removeLayer(m));
  MS.barbe = [];
  document.getElementById("mOraTxt").textContent = etichettaOra();
  if (!MG.punti.length) return;
  if (MS.liv !== "nessuno") {
    const c = campoImmagine(MS.liv, MS.ora);
    if (c) MS.strato = L.imageOverlay(c.url, c.bounds, { opacity: MS.op }).addTo(MAPPA);
  }
  if (MS.barbette) {
    const i = MG.i0 + MS.ora;
    MG.punti.forEach(p => {
      if (!p.dir || p.dir[i] == null || p.nodi[i] == null) return;
      const v = p.nodi[i], d = p.dir[i], r = p.raff && p.raff[i] != null ? p.raff[i] : v;
      const m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ html: barbetta(v, d), className: "barba", iconSize: [46, 46], iconAnchor: [23, 23] }),
        keyboard: false
      }).addTo(MAPPA);
      m.bindTooltip("da " + cardinale(d) + " · " + Math.round(v) + " nodi, raffiche " + Math.round(r));
      MS.barbe.push(m);
    });
  }
}

function aggiornaStrati() {
  if (MS.simboli && !MS.sim) {
    MS.sim = L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
      { maxZoom: 18, pane: "simboli", attribution: "Simboli: OpenSeaMap" }).addTo(MAPPA);
  }
  if (!MS.simboli && MS.sim) { MAPPA.removeLayer(MS.sim); MS.sim = null; }
  if (MS.fondali && !MS.fon) {
    MS.fon = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
      layers: "emodnet:mean_multicolour,emodnet:contours", format: "image/png", transparent: true,
      version: "1.1.1", opacity: 0.6, attribution: "Fondali: EMODnet Bathymetry" }).addTo(MAPPA);
  }
  if (!MS.fondali && MS.fon) { MAPPA.removeLayer(MS.fon); MS.fon = null; }
}

async function ricaricaMeteo() {
  const st = document.getElementById("mStato");
  const b = MAPPA.getBounds(), c = MAPPA.getCenter();
  try {
    const nuovo = await caricaGriglia({ lat: c.lat, lon: c.lng },
      { lat: b.getNorth() - b.getSouth(), lon: b.getEast() - b.getWest() });
    st.textContent = "Dati: Open-Meteo.com, " + MG.punti.length + " punti (modello, non osservazioni).";
    if (nuovo) ridisegnaMeteo();
  } catch (e) {
    st.textContent = "Dati del vento non disponibili: " + (e && e.message ? e.message : e);
  }
}

async function apriMappa(porto) {
  const box = document.getElementById("mappa");
  if (navigator.onLine === false) {
    box.innerHTML = '<h2>Mappa</h2><p class="sub">Serve la connessione: la mappa non è disponibile senza rete.</p>';
    return;
  }
  box.innerHTML = '<h2>Mappa</h2><p class="sub">Carico la mappa...</p>';
  try {
    if (typeof L === "undefined") await caricaScript("vendor/leaflet.js");
  } catch (e) {
    box.innerHTML = '<h2>Mappa</h2><p class="errore">' + e.message + "</p>";
    return;
  }
  box.innerHTML = '<h2>Mappa</h2><div class="mappaCtl">' +
    '<select id="mLiv"><option value="vento">Vento</option><option value="raffiche">Raffiche</option>' +
    '<option value="aria">Aria</option><option value="mare">Mare</option><option value="nessuno">Nessun colore</option></select>' +
    '<label><input type="checkbox" id="mSim" checked> Simboli nautici</label>' +
    '<label><input type="checkbox" id="mFon"> Fondali</label>' +
    '<label><input type="checkbox" id="mBar" checked> Barbette</label></div>' +
    '<div id="mappaBox"></div>' +
    '<div class="mappaOra"><span id="mOraTxt"></span><input type="range" id="mOra" min="0" max="24" step="1" value="0"></div>' +
    '<div class="mappaOra"><span>Colori</span><input type="range" id="mOp" min="0" max="80" step="5" value="45"></div>' +
    '<div id="mLegenda"></div><div class="sub" id="mStato">Carico il vento...</div>' +
    '<p class="nota">Mappa © OpenStreetMap contributors. Simboli OpenSeaMap (dati volontari) e fondali EMODnet (dati scientifici di insieme, circa 125 m, curve da 50 m): ausili, non carte nautiche ufficiali, non adatti a navigare sotto costa. Vento, aria e mare sono un modello su 35 punti, interpolato: valgono anche sulla terraferma. Barbette: l\'asta punta verso la provenienza del vento; tacca lunga 10 nodi, corta 5, triangolo 50.</p>';

  MAPPA = L.map("mappaBox").setView([porto.lat, porto.lon], 9);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(MAPPA);
  MAPPA.createPane("simboli");
  MAPPA.getPane("simboli").style.zIndex = 450;
  MAPPA.getPane("simboli").style.pointerEvents = "none";
  MS.marca = L.marker([porto.lat, porto.lon], {
    icon: L.divIcon({ html: "⚓", className: "portoIcona", iconSize: [28, 28], iconAnchor: [14, 14] })
  }).addTo(MAPPA).bindTooltip(porto.n);

  const q = id => document.getElementById(id);
  q("mLiv").addEventListener("change", e => { MS.liv = e.target.value; aggiornaLegenda(); ridisegnaMeteo(); });
  q("mSim").addEventListener("change", e => { MS.simboli = e.target.checked; aggiornaStrati(); });
  q("mFon").addEventListener("change", e => { MS.fondali = e.target.checked; aggiornaStrati(); });
  q("mBar").addEventListener("change", e => { MS.barbette = e.target.checked; ridisegnaMeteo(); });
  q("mOra").addEventListener("input", e => { MS.ora = parseInt(e.target.value, 10); ridisegnaMeteo(); });
  q("mOp").addEventListener("input", e => {
    MS.op = parseInt(e.target.value, 10) / 100;
    if (MS.strato) MS.strato.setOpacity(MS.op);
  });
  MAPPA.on("moveend", () => {
    clearTimeout(MS.timer);
    MS.timer = setTimeout(ricaricaMeteo, 700);
  });
  MS.simboli = true;
  MS.fondali = false;
  aggiornaStrati();
  aggiornaLegenda();
  ricaricaMeteo();
}

document.getElementById("apriMappa").addEventListener("click", () => apriMappa(portoScelto()));
document.getElementById("porto").addEventListener("change", () => {
  if (!MAPPA) return;
  const p = portoScelto();
  MAPPA.setView([p.lat, p.lon], MAPPA.getZoom());
  MS.marca.setLatLng([p.lat, p.lon]);
  MS.marca.setTooltipContent(p.n);
});
