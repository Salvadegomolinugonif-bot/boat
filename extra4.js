"use strict";
const pianif = { giorno: null, ora: 9, durata: 6 };

function risultatoPianifica(ore, daily, s) {
  const out = document.getElementById("pRis");
  const inizio = pianif.giorno + "T" + String(pianif.ora).padStart(2, "0") + ":00";
  const i = ore.findIndex(o => o.t === inizio);
  if (i < 0) {
    out.innerHTML = `<p class="sub">Questo orario è già passato o fuori dalla previsione.</p>`;
    return;
  }
  const fin = ore.slice(i, i + pianif.durata);
  const liv = fin.map(o => verdetto(o, s));
  const forza = o => Math.max(o.vento, o.raffica);
  let k0 = 0;
  fin.forEach((o, k) => {
    if (liv[k] > liv[k0] || (liv[k] === liv[k0] && forza(o) > forza(fin[k0]))) k0 = k;
  });
  const w = fin[k0];
  const peggio = liv[k0];
  const titoli = ["Nessun superamento delle tue soglie", "Attenzione", "Sconsigliato"];
  const onda = w.onda == null ? "n.d." : w.onda.toFixed(1) + " m";
  const note = [];
  if (fin.length < pianif.durata) note.push(`La previsione copre solo ${fin.length} h di questa finestra.`);
  const notte = fin.filter(o => eNotte(o.t, daily)).length;
  if (notte) note.push(`${notte} ore su ${fin.length} cadono di notte (dopo il tramonto o prima dell'alba).`);
  out.innerHTML =
    `<div class="allerta" style="border-left-color:${COLORI[peggio]}"><strong>${titoli[peggio]}</strong><br>` +
    `<span class="sub">Momento peggiore alle ${w.t.slice(11, 13)}h: vento ${Math.round(w.vento)} nodi, raffiche ${Math.round(w.raffica)} nodi, onda ${onda}.</span></div>` +
    `<div class="ore">` + fin.map((o, k) =>
      `<div class="ora" style="border-bottom-color:${COLORI[liv[k]]}"><div class="h">${o.t.slice(11, 13)}h</div><div>${Math.round(o.vento)}/${Math.round(o.raffica)}</div></div>`).join("") + `</div>` +
    note.map(n => `<p class="sub">${n}</p>`).join("") +
    `<p class="nota">Secondo le tue soglie e una previsione da modello: più l'orario è lontano, meno è affidabile. Non è un permesso di uscire.</p>`;
}

function renderPianifica(ore, daily, s) {
  const giorni = Array.from(new Set(ore.map(o => o.t.slice(0, 10)))).slice(0, 7);
  if (!giorni.includes(pianif.giorno)) pianif.giorno = giorni[0];
  const opz = (vals, sel, fmt) =>
    vals.map(v => `<option value="${v}"${v == sel ? " selected" : ""}>${fmt(v)}</option>`).join("");
  const ore24 = Array.from({ length: 24 }, (_, i) => i);
  const durate = Array.from({ length: 12 }, (_, i) => i + 1);
  document.getElementById("pianifica").innerHTML = `<h2>Pianifica uscita</h2><div class="pian">` +
    `<label>Giorno <select id="pGiorno">${opz(giorni, pianif.giorno, etichettaGiorno)}</select></label>` +
    `<label>Partenza <select id="pOra">${opz(ore24, pianif.ora, h => String(h).padStart(2, "0") + ":00")}</select></label>` +
    `<label>Durata <select id="pDurata">${opz(durate, pianif.durata, h => h + " h")}</select></label>` +
    `</div><div id="pRis"></div>`;
  [["pGiorno", "giorno", String], ["pOra", "ora", Number], ["pDurata", "durata", Number]].forEach(([id, k, conv]) => {
    document.getElementById(id).addEventListener("change", e => {
      pianif[k] = conv(e.target.value);
      risultatoPianifica(ore, daily, s);
    });
  });
  risultatoPianifica(ore, daily, s);
}
