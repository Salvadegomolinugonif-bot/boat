"use strict";

// ---------- Scala Beaufort ----------
const BF_LIMITI = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
const BF_NOMI = ["Calma", "Bava di vento", "Brezza leggera", "Brezza tesa", "Vento moderato", "Vento teso",
  "Vento fresco", "Vento forte", "Burrasca", "Burrasca forte", "Tempesta", "Tempesta violenta", "Uragano"];
function beaufort(kn) {
  const f = BF_LIMITI.filter(l => kn >= l).length;
  return { f: f, nome: BF_NOMI[f] };
}

// ---------- Grafici ----------
function disegnaGrafico(titolo, tempi, serie, soglia, minimo) {
  const W = 320, H = 130, L = 30, R = 6, T = 8, B = 18;
  const n = tempi.length;
  const tutti = [].concat(...serie.map(s => s.v)).filter(x => x != null);
  const max = Math.max(minimo, soglia[1] * 1.15, ...tutti);
  const x = i => L + (W - L - R) * i / Math.max(n - 1, 1);
  const y = v => T + (H - T - B) * (1 - v / max);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="grafico">`;
  [[soglia[0], COLORI[1]], [soglia[1], COLORI[2]]].forEach(([v, c]) => {
    const yy = y(v).toFixed(1);
    svg += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${c}" stroke-width="1" stroke-dasharray="4 3"/>`;
  });
  svg += `<text x="${L - 4}" y="${y(0) + 3}" class="asse" text-anchor="end">0</text>`;
  svg += `<text x="${L - 4}" y="${y(max) + 9}" class="asse" text-anchor="end">${Math.round(max)}</text>`;
  serie.forEach(s => {
    let d = "";
    let prec = false;
    s.v.forEach((v, i) => {
      if (v == null) { prec = false; return; }
      d += (prec ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1) + " ";
      prec = true;
    });
    svg += `<path d="${d}" fill="none" stroke="${s.colore}" stroke-width="${s.spessore}" stroke-linejoin="round" stroke-linecap="round" opacity="${s.opacita}"/>`;
  });
  tempi.forEach((t, i) => {
    const h = parseInt(t.slice(11, 13), 10);
    if (h % 6 === 0) {
      const et = h === 0 ? t.slice(8, 10) + "/" + t.slice(5, 7) : h + "h";
      svg += `<text x="${x(i).toFixed(1)}" y="${H - 4}" class="asse" text-anchor="middle">${et}</text>`;
    }
  });
  return `<h2>${titolo}</h2>` + svg + "</svg>";
}

function renderGrafici(ore, s) {
  const p = ore.slice(0, 48);
  const t = p.map(o => o.t);
  let h = disegnaGrafico("Vento e raffiche · nodi, prossime 48 ore", t, [
    { v: p.map(o => o.raffica), colore: "#5ac8fa", spessore: 1.5, opacita: 0.7 },
    { v: p.map(o => o.vento), colore: "#ffffff", spessore: 2.5, opacita: 1 }
  ], s.vento, 20);
  if (p.some(o => o.onda != null)) {
    h += disegnaGrafico("Onda · metri", t, [
      { v: p.map(o => o.onda), colore: "#5ac8fa", spessore: 2.5, opacita: 1 }
    ], s.onda, 1);
  }
  document.getElementById("grafico").innerHTML = h +
    `<p class="nota">Linea bianca: vento. Azzurra sottile: raffiche. Tratteggio giallo e rosso: le tue soglie di attenzione e di sconsigliato.</p>`;
}
