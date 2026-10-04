"use strict";
const SETTORI = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

// ---------- Maree ----------
function estremiMarea(p) {
  const r = [];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1].mare, b = p[i].mare, c = p[i + 1].mare;
    if (b >= a && b > c) r.push({ t: p[i].t, v: b, alta: true });
    else if (b <= a && b < c) r.push({ t: p[i].t, v: b, alta: false });
  }
  return r;
}

function renderMaree(ore) {
  const box = qs("maree");
  const p = ore.filter(o => o.mare != null).slice(0, 36);
  if (p.length < 3) {
    box.innerHTML = "<h2>Maree</h2><p class=\"nota\">Dati di marea non disponibili per questo porto.</p>";
    return;
  }
  const segno = x => (x >= 0 ? "+" : "") + x.toFixed(2) + " m";
  const v = p.map(o => o.mare);
  const lo = Math.min(...v), hi = Math.max(...v), span = Math.max(hi - lo, 0.05);
  const W = 300, H = 80;
  const pt = i => [(W * i / (v.length - 1)).toFixed(1), (H - 6 - (H - 12) * (v[i] - lo) / span).toFixed(1)];
  const linea = v.map((_, i) => pt(i).join(",")).join(" ");
  const [x0, y0] = pt(0);
  const estremi = estremiMarea(p).map(e =>
    `<div class="riga-m"><span>${e.alta ? "⬆️ Alta" : "⬇️ Bassa"}</span><span>${e.t.slice(11, 16)}</span><span>${segno(e.v)}</span></div>`).join("");
  box.innerHTML = `<h2>Maree, prossime ore</h2>` +
    `<div class="mareaora"><span class="val">${segno(v[0])}</span> <span class="sub">${v[1] > v[0] ? "in salita" : "in discesa"}</span></div>` +
    `<svg viewBox="0 0 ${W} ${H}" class="curva"><polyline points="${linea}" fill="none" stroke="#5ac8fa" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x0}" cy="${y0}" r="4" fill="#fff"/></svg>` +
    estremi +
    `<p class="nota">Altezza rispetto al livello medio del mare. Stima da modello, non sostituisce le tavole di marea ufficiali.</p>`;
}

// ---------- Riparo dai venti ----------
function disegnaRiparo(ore, porto) {
  const box = qs("riparo");
  const chiave = "riparo_" + porto.n;
  const salvato = leggi(chiave, null);
  const sel = Array.isArray(salvato) ? salvato : null;
  const esposti = new Set(sel || []);
  const p24 = ore.slice(0, 24);
  const campioni = p24.filter((_, i) => i % 3 === 0);
  const picco = o => Math.max(o.vento, o.raffica);
  const forti = p24.filter(o => o.dir != null && esposti.has(cardinale(o.dir)) && picco(o) >= 15);

  let esito;
  if (sel === null) {
    esito = `<p class="sub">Nessuna direzione impostata per questo porto: finché non le segni, non c'è nessun verdetto.</p>`;
  } else if (forti.length) {
    const m = forti.reduce((a, o) => (picco(o) > picco(a) ? o : a));
    const dirs = SETTORI.filter(x => forti.some(o => cardinale(o.dir) === x)).join(", ");
    esito = `<div class="allerta" style="border-left-color:${COLORI[1]}">Esposto: ${forti.length} ore con vento forte da ${dirs}. Picco ${Math.round(picco(m))} nodi da ${cardinale(m.dir)} alle ${m.t.slice(11, 16)}.</div>`;
  } else {
    esito = `<div class="allerta" style="border-left-color:${COLORI[0]}">Nelle prossime 24 ore nessun vento forte dalle direzioni esposte che hai segnato.</div>`;
  }

  box.innerHTML = `<h2>Riparo dai venti · ${porto.n}</h2><p class="sub">Segna le direzioni da cui il vento entra nel tuo ormeggio.</p>` +
    `<div class="settori">` +
    SETTORI.map(x => `<button class="sett${esposti.has(x) ? " attiva" : ""}" data-s="${x}">${x}</button>`).join("") +
    (sel !== null ? `<button class="pulsante" id="cancRip">Cancella</button>` : "") + `</div>` +
    `<div class="ore">` + campioni.map(o => {
      const x = o.dir != null ? cardinale(o.dir) : "-";
      return `<div class="ora${esposti.has(x) ? " espo" : ""}"><div class="h">${o.t.slice(11, 13)}h</div><div><strong>${x}</strong></div><div class="h">${Math.round(picco(o))} kn</div></div>`;
    }).join("") + `</div>` + esito +
    `<p class="nota">Indicazione da verificare: dipende da come ormeggi e dai ripari reali del posto, non sostituisce il tuo giudizio. Conta il vento forte da 15 nodi.</p>`;

  box.querySelectorAll(".sett").forEach(b => b.addEventListener("click", () => {
    const n = new Set(sel || []);
    if (n.has(b.dataset.s)) n.delete(b.dataset.s); else n.add(b.dataset.s);
    scrivi(chiave, SETTORI.filter(x => n.has(x)));
    disegnaRiparo(ore, porto);
  }));
  const c = qs("cancRip");
  if (c) c.addEventListener("click", () => { rimuovi(chiave); disegnaRiparo(ore, porto); });
}
