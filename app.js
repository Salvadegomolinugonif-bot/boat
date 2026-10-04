"use strict";
const el = id => document.getElementById(id);
const stato = { porto: null, barca: "vela", dati: null };

function disegnaBarche() {
  const box = el("barche");
  box.innerHTML = "";
  Object.keys(BASE).forEach(k => {
    const b = document.createElement("button");
    b.textContent = NOMI_BARCA[k];
    if (k === stato.barca) b.className = "attiva";
    b.addEventListener("click", () => {
      stato.barca = k;
      scrivi("barca", k);
      disegnaBarche();
      disegnaSoglie();
      render();
    });
    box.appendChild(b);
  });
}

function disegnaSoglie() {
  const k = stato.barca;
  const s = soglie(k);
  const campi = [
    ["ventoG", "Vento e raffiche: attenzione", 5, 40, 1, "nodi", s.vento[0]],
    ["ventoR", "Vento e raffiche: sconsigliato", 5, 50, 1, "nodi", s.vento[1]],
    ["ondaG", "Onda: attenzione", 0.2, 4, 0.1, "m", s.onda[0]],
    ["ondaR", "Onda: sconsigliato", 0.2, 5, 0.1, "m", s.onda[1]]
  ];
  el("soglie").innerHTML =
    `<details><summary>Soglie personali · ${NOMI_BARCA[k]}</summary>` +
    campi.map(c => `<div class="riga"><span>${c[1]}</span><input type="range" data-k="${c[0]}" min="${c[2]}" max="${c[3]}" step="${c[4]}" value="${c[6]}"><span>${c[6]} ${c[5]}</span></div>`).join("") +
    `<button class="pulsante" id="ripristina">Ripristina i valori di default</button>` +
    `<p class="nota">Alzare le soglie rende il semaforo meno prudente: regolale in base all'esperienza tua e dell'equipaggio e alla barca, non alla voglia di uscire.</p></details>`;
  el("soglie").querySelectorAll("input[type=range]").forEach(inp => {
    inp.addEventListener("input", () => {
      const salvate = leggi("soglie_" + k, {});
      salvate[inp.dataset.k] = parseFloat(inp.value);
      scrivi("soglie_" + k, salvate);
      inp.nextElementSibling.textContent = inp.value + (inp.dataset.k.startsWith("onda") ? " m" : " nodi");
      render();
    });
  });
  el("ripristina").addEventListener("click", () => {
    rimuovi("soglie_" + k);
    disegnaSoglie();
    render();
  });
}

function render() {
  const d = stato.dati;
  if (!d || !d.ore.length) return;
  const s = soglie(stato.barca);
  const ore = d.ore;
  const a = ore[0];
  const liv = verdetto(a, s);
  const peggiore = Math.max(...ore.slice(0, 12).map(o => verdetto(o, s)));
  const sub = peggiore > liv
    ? "Nelle prossime 12 ore peggiora: " + ETICHETTE[peggiore]
    : "Prossime 12 ore: " + ETICHETTE[peggiore];

  el("semaforo").innerHTML =
    `<div class="semaforo"><div class="pallino" style="background:${COLORI[liv]};color:${COLORI[liv]}"></div>` +
    `<div><div class="titolo">${ETICHETTE[liv]}</div><div class="sub">${sub}</div>` +
    `<div class="sub">${stato.porto.n} · ${NOMI_BARCA[stato.barca]} · aggiornato alle ${d.aggiornato}</div></div></div>`;

  const tile = (et, val, l) =>
    `<div class="tile" style="border-left-color:${l === null ? "transparent" : COLORI[l]}"><div class="val">${val}</div><div class="et">${et}</div></div>`;
  const ic = icona(a.codice, eNotte(a.t, d.daily));
  el("adesso").innerHTML = "<h2>Adesso</h2><div class=\"griglia\">" +
    tile("Vento" + (a.dir != null ? " da " + cardinale(a.dir) : ""), Math.round(a.vento) + " nodi", classifica(a.vento, s.vento)) +
    tile("Raffiche", Math.round(a.raffica) + " nodi", classifica(a.raffica, s.vento)) +
    tile("Onda" + (a.periodo ? " · periodo " + Math.round(a.periodo) + " s" : ""),
         a.onda == null ? "n.d." : a.onda.toFixed(1) + " m", a.onda == null ? null : classifica(a.onda, s.onda)) +
    tile(nomeTempo(a.codice) + (a.pioggia != null ? " · pioggia " + a.pioggia + "%" : ""),
         ic + " " + (a.temp == null ? "–" : Math.round(a.temp) + "°C"), null) +
    "</div>";

  el("ore").innerHTML = "<h2>Prossime 24 ore</h2><div class=\"ore\">" +
    ore.slice(0, 24).map(o => {
      const l = verdetto(o, s);
      return `<div class="ora" style="border-bottom-color:${COLORI[l]}"><div class="h">${o.t.slice(11, 13)}h</div>` +
        `<div class="ic">${icona(o.codice, eNotte(o.t, d.daily))}</div>` +
        `<div>${Math.round(o.vento)}/${Math.round(o.raffica)}</div>` +
        `<div class="h">${o.onda == null ? "–" : o.onda.toFixed(1) + " m"}</div></div>`;
    }).join("") + "</div><p class=\"nota\">Vento/raffiche in nodi e onda in metri, ora per ora.</p>";

  const i = Math.max(0, d.daily.time.indexOf(a.t.slice(0, 10)));
  const alba = d.daily.sunrise[i];
  const tram = d.daily.sunset[i];
  const min = Math.round((new Date(tram) - new Date(alba)) / 60000);
  const lu = luna(new Date());
  el("luce").innerHTML = "<h2>Luce e luna</h2><div class=\"luce\">" +
    `<div><div class="val">${alba.slice(11, 16)}</div><div class="et">Alba</div></div>` +
    `<div><div class="val">${tram.slice(11, 16)}</div><div class="et">Tramonto</div></div>` +
    `<div><div class="val">${Math.floor(min / 60)} h ${min % 60} min</div><div class="et">Ore di luce</div></div>` +
    `<div><div class="val">${lu.emoji} ${lu.perc}%</div><div class="et">${lu.nome}</div></div></div>`;
}

async function aggiorna() {
  const p = stato.porto;
  try {
    const d = await carica(p);
    if (p !== stato.porto) return;
    d.aggiornato = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    stato.dati = d;
    render();
  } catch (e) {
    const n = document.createElement("div");
    n.className = "errore";
    n.textContent = "Dati non disponibili: " + (e && e.message ? e.message : e);
    el("semaforo").innerHTML = "";
    el("semaforo").appendChild(n);
  }
}

function init() {
  const sel = el("porto");
  PORTI.forEach(p => {
    const o = document.createElement("option");
    o.value = p.n;
    o.textContent = p.n;
    sel.appendChild(o);
  });
  const salvato = leggi("porto", "Molfetta");
  stato.porto = PORTI.find(p => p.n === salvato) || PORTI[0];
  sel.value = stato.porto.n;
  const b = leggi("barca", "vela");
  stato.barca = BASE[b] ? b : "vela";
  sel.addEventListener("change", () => {
    stato.porto = PORTI.find(p => p.n === sel.value);
    scrivi("porto", sel.value);
    aggiorna();
  });
  disegnaBarche();
  disegnaSoglie();
  aggiorna();
  setInterval(aggiorna, 30 * 60 * 1000);
}

init();
