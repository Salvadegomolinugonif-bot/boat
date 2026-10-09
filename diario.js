"use strict";
(function () {
  const CHIAVE = "diario_v1";
  const ULTIMO = "diario_export_v1";
  const NOMI = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const el = id => document.getElementById(id);
  const vir = x => String(x).replace(".", ",");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cardinale = g => (g === "" || g == null || isNaN(g)) ? "" : NOMI[Math.round((((Number(g) % 360) + 360) % 360) / 45) % 8];
  let voci = [];
  let inModifica = null;
  let timer = null;
  let tokCond = 0;

  function leggi() {
    try {
      const v = JSON.parse(localStorage.getItem(CHIAVE) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function salva() {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(voci));
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      return true;
    } catch (e) {
      alert("Non riesco a salvare il diario su questo dispositivo. Esporta subito una copia.");
      return false;
    }
  }
  function minuti(t) {
    const m = /^(\d{1,2})[:.](\d{2})/.exec(t || "");
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function norma(t) {
    const s = String(t || "").trim();
    let m = /^(\d{1,2})\s*[:.,hH]\s*(\d{1,2})/.exec(s), h = null, mi = null;
    if (m) { h = +m[1]; mi = +m[2]; }
    else if ((m = /^(\d{1,2})(\d{2})$/.exec(s))) { h = +m[1]; mi = +m[2]; }
    else if ((m = /^(\d{1,2})$/.exec(s))) { h = +m[1]; mi = 0; }
    if (h == null || h > 23 || mi > 59) return "";
    return String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
  }
  function dataDaTesto(t) {
    const s = String(t || "").trim();
    let g, me, a;
    let m = /^(\d{1,2})\s*[\/.\-\s]\s*(\d{1,2})(?:\s*[\/.\-\s]\s*(\d{2,4}))?$/.exec(s);
    if (m) { g = +m[1]; me = +m[2]; a = m[3]; }
    else if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(s))) { g = +m[1]; me = +m[2]; a = m[3]; }
    else return "";
    let y = a == null ? new Date().getFullYear() : +a;
    if (a != null && a.length <= 2) y = 2000 + y;
    if (y < 1990 || y > 2100) return "";
    const d = new Date(y, me - 1, g);
    if (d.getFullYear() !== y || d.getMonth() !== me - 1 || d.getDate() !== g) return "";
    return y + "-" + String(me).padStart(2, "0") + "-" + String(g).padStart(2, "0");
  }
  function itDaIso(iso) {
    const p = String(iso || "").split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
  }
  function durataMin(v) {
    const a = minuti(v.partenza), b = minuti(v.rientro);
    if (a == null || b == null) return 0;
    return b >= a ? b - a : b + 1440 - a;
  }
  function dataIt(iso) {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return iso || "";
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  }
  function oggiIso() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function livello(c) {
    try {
      if (typeof verdetto !== "function" || typeof soglie !== "function" || typeof stato === "undefined") return null;
      const vento = Number(c.vento);
      if (c.vento === "" || !isFinite(vento)) return null;
      const raff = c.raffica === "" ? vento : Number(c.raffica);
      const onda = c.onda === "" ? null : Number(c.onda);
      const r = verdetto({ vento: vento, raffica: isFinite(raff) ? raff : vento, onda: (onda != null && isFinite(onda)) ? onda : null }, soglie(stato.barca));
      return (r === 0 || r === 1 || r === 2) ? r : null;
    } catch (e) { return null; }
  }

  function costruisci() {
    el("diario").innerHTML = `
      <h2>Diario di bordo</h2>
      <p class="sub">Le uscite restano solo su questo dispositivo. Ogni tanto esporta una copia.</p>
      <div class="dz-tot" id="dzTot"></div>
      <div class="dz-barra">
        <button class="pulsante" id="dzNuova" type="button">Nuova uscita</button>
        <button class="pulsante" id="dzExpJ" type="button">Esporta copia</button>
        <button class="pulsante" id="dzExpC" type="button">Esporta CSV</button>
        <button class="pulsante" id="dzImp" type="button">Importa</button>
        <input type="file" id="dzFile" accept=".json,application/json" hidden>
      </div>
      <p class="sub" id="dzUltimo"></p>
      <div class="dz-form" id="dzForm" hidden>
        <label class="dz-campo">Data<input type="text" inputmode="numeric" placeholder="05/10/2026" maxlength="10" id="dzData"></label>
        <label class="dz-campo">Porto<select id="dzPorto"></select></label>
        <label class="dz-campo">Partenza<input type="text" inputmode="numeric" placeholder="09:30" maxlength="5" id="dzPart"></label>
        <label class="dz-campo">Rientro<input type="text" inputmode="numeric" placeholder="09:30" maxlength="5" id="dzRient"></label>
        <label class="dz-campo">Da<input type="text" id="dzDa" placeholder="Molfetta"></label>
        <label class="dz-campo">A<input type="text" id="dzA" placeholder="Bari"></label>
        <div class="dz-cond">
          <div class="dz-condTit">Condizioni del giorno, modificabili</div>
          <div class="dz-condGriglia">
            <label class="dz-campo">Vento (nodi)<input type="number" step="0.1" inputmode="decimal" id="dzVento"></label>
            <label class="dz-campo">Direzione (°)<input type="number" step="1" inputmode="numeric" id="dzDir"></label>
            <label class="dz-campo">Raffica (nodi)<input type="number" step="0.1" inputmode="decimal" id="dzRaff"></label>
            <label class="dz-campo">Onda (m)<input type="number" step="0.1" inputmode="decimal" id="dzOnda"></label>
            <label class="dz-campo">Mare (°C)<input type="number" step="0.1" inputmode="decimal" id="dzMare"></label>
          </div>
          <div class="dz-stato" id="dzStato"></div>
          <button class="pulsante" type="button" id="dzCarica">Carica condizioni</button>
        </div>
        <label class="dz-campo dz-largo">Equipaggio<input type="text" id="dzEquip"></label>
        <label class="dz-campo">Miglia<input type="number" step="0.1" inputmode="decimal" id="dzMiglia"></label>
        <label class="dz-campo">Rotta (gradi)<input type="number" step="1" min="0" max="360" inputmode="numeric" id="dzRotta" placeholder="045"></label>
        <label class="dz-campo dz-largo">Note<textarea rows="3" id="dzNote"></textarea></label>
        <div class="dz-barra dz-largo">
          <button class="pulsante" type="button" id="dzSalva">Salva uscita</button>
          <button class="pulsante" type="button" id="dzAnnulla">Annulla</button>
        </div>
      </div>
      <div id="dzLista"></div>`;
  }

  function apri(v) {
    inModifica = v ? v.id : null;
    const sel = el("dzPorto");
    if (!sel.options.length && typeof PORTI !== "undefined") PORTI.forEach(p => sel.add(new Option(p.n, p.n)));
    const porto = v ? v.porto : ((el("porto") && el("porto").value) || "Molfetta");
    if (![...sel.options].some(o => o.value === porto)) sel.add(new Option(porto, porto));
    sel.value = porto;
    const c = (v && v.cond) || {};
    el("dzData").value = itDaIso(v ? v.data : oggiIso());
    el("dzPart").value = (v && v.partenza) || "";
    el("dzRient").value = (v && v.rientro) || "";
    el("dzVento").value = c.vento == null ? "" : c.vento;
    el("dzDir").value = c.dir == null ? "" : c.dir;
    el("dzRaff").value = c.raffica == null ? "" : c.raffica;
    el("dzOnda").value = c.onda == null ? "" : c.onda;
    el("dzMare").value = c.mare == null ? "" : c.mare;
    el("dzEquip").value = (v && v.equipaggio) || "";
    el("dzMiglia").value = (v && v.miglia) || "";
    el("dzDa").value = (v && v.da) || "";
    el("dzA").value = (v && v.a) || "";
    el("dzRotta").value = (v && v.rotta) || "";
    el("dzNote").value = (v && v.note) || "";
    el("dzStato").textContent = "";
    el("dzForm").hidden = false;
    el("dzForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function chiudi() { el("dzForm").hidden = true; inModifica = null; }

  async function caricaCondizioni() {
    const tok = ++tokCond;
    const st = el("dzStato");
    const data = dataDaTesto(el("dzData").value), porto = el("dzPorto").value;
    const a = minuti(el("dzPart").value), b = minuti(el("dzRient").value);
    const p = (typeof PORTI !== "undefined" ? PORTI : []).find(x => x.n === porto);
    if (!data || !p) { st.textContent = "Scegli data e porto."; return; }
    st.textContent = "Carico le condizioni…";
    const base = "&latitude=" + p.lat + "&longitude=" + p.lon + "&timezone=Europe%2FRome&start_date=" + data + "&end_date=" + data;
    try {
      const [v, m] = await Promise.all([
        fetch("https://archive-api.open-meteo.com/v1/archive?hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn" + base).then(r => r.json()),
        fetch("https://marine-api.open-meteo.com/v1/marine?hourly=wave_height,sea_surface_temperature" + base).then(r => r.json())
      ]);
      if (tok !== tokCond) return;
      if (!v.hourly || !m.hourly) throw new Error("dati assenti");
      const h0 = a == null ? 8 : Math.floor(a / 60);
      const h1 = b == null ? 18 : ((a != null && b < a) ? 23 : Math.floor(b / 60));
      const idx = [];
      for (let h = h0; h <= h1; h++) idx.push(h);
      const num = x => typeof x === "number" && isFinite(x);
      const col = (o, k) => idx.map(i => o.hourly[k][i]).filter(num);
      const media = arr => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null;
      const mass = arr => arr.length ? Math.max(...arr) : null;
      const r1 = x => x == null ? "" : Math.round(x * 10) / 10;
      let sx = 0, sy = 0;
      idx.forEach(i => {
        const s = v.hourly.wind_speed_10m[i], dg = v.hourly.wind_direction_10m[i];
        if (num(s) && num(dg)) { sx += s * Math.sin(dg * Math.PI / 180); sy += s * Math.cos(dg * Math.PI / 180); }
      });
      const dir = (sx || sy) ? Math.round((Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360) : "";
      el("dzVento").value = r1(media(col(v, "wind_speed_10m")));
      el("dzDir").value = dir;
      el("dzRaff").value = r1(mass(col(v, "wind_gusts_10m")));
      el("dzOnda").value = r1(mass(col(m, "wave_height")));
      el("dzMare").value = r1(media(col(m, "sea_surface_temperature")));
      st.textContent = "Condizioni caricate (modelli Open-Meteo, non osservazioni). Controlla e correggi se serve.";
    } catch (e) {
      if (tok !== tokCond) return;
      st.textContent = "Non riesco a caricare le condizioni (senza rete o dati non disponibili per questa data). Scrivile tu.";
    }
  }
  function ricaricaDopo() {
    if (inModifica !== null) return;
    clearTimeout(timer);
    timer = setTimeout(caricaCondizioni, 400);
  }

  function salvaVoce() {
    const f = id => el(id).value.trim();
    ["dzPart", "dzRient"].forEach(id => { el(id).value = norma(el(id).value); });
    if (!dataDaTesto(f("dzData"))) { el("dzStato").textContent = "Scrivi la data, per esempio 5/10/2026."; return; }
    if ((!f("dzPart") || !f("dzRient")) && !confirm("Senza partenza e rientro le ore non vengono contate. Salvare lo stesso?")) return;
    let rt = f("dzRotta");
    if (rt !== "") {
      const n = Number(rt.replace(",", "."));
      if (!isFinite(n) || n < 0 || n > 360) { el("dzStato").textContent = "La rotta va da 0 a 360 gradi."; return; }
      rt = String(Math.round(n) % 360);
    }
    const cond = { vento: f("dzVento"), dir: f("dzDir"), raffica: f("dzRaff"), onda: f("dzOnda"), mare: f("dzMare") };
    const v = {
      id: inModifica || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      data: dataDaTesto(f("dzData")), porto: f("dzPorto"), partenza: f("dzPart"), rientro: f("dzRient"),
      equipaggio: f("dzEquip"), miglia: f("dzMiglia"), da: f("dzDa"), a: f("dzA"), rotta: rt, note: f("dzNote"), cond: cond, liv: livello(cond)
    };
    const i = voci.findIndex(x => x.id === v.id);
    if (i >= 0) voci[i] = v; else voci.push(v);
    if (salva()) { chiudi(); render(); }
  }

  function condTxt(c) {
    const p = [];
    if (c.vento !== "" && c.vento != null) p.push(vir(c.vento) + " nodi" + (cardinale(c.dir) ? " " + cardinale(c.dir) : ""));
    if (c.raffica !== "" && c.raffica != null) p.push("raffiche " + vir(c.raffica));
    if (c.onda !== "" && c.onda != null) p.push("onda " + vir(c.onda) + " m");
    if (c.mare !== "" && c.mare != null) p.push("mare " + vir(c.mare) + " °C");
    return p.join(" · ");
  }
  function voceHtml(v) {
    const c = v.cond || {};
    const liv = (v.liv === 0 || v.liv === 1 || v.liv === 2) ? v.liv : null;
    const pill = liv == null ? "" : '<span class="dz-pill dz-l' + liv + '">' + ["Verde", "Giallo", "Rosso"][liv] + "</span>";
    const orario = (v.partenza || v.rientro) ? (v.partenza || "?") + "–" + (v.rientro || "?") : "";
    const riga1 = [v.porto, orario, (v.miglia !== "" && v.miglia != null) ? vir(v.miglia) + " miglia" : ""].filter(Boolean).join(" · ");
    const cond = condTxt(c);
    const tratta = [(v.da || v.a) ? (v.da || "?") + " → " + (v.a || "?") : "", (v.rotta !== "" && v.rotta != null) ? "rotta " + String(v.rotta).padStart(3, "0") + "°" : ""].filter(Boolean).join(" · ");
    return '<div class="dz-voce"><div class="dz-riga"><b>' + esc(dataIt(v.data)) + "</b>" + pill + "</div>" +
      '<div class="sub">' + esc(riga1) + "</div>" +
      (tratta ? '<div class="sub">' + esc(tratta) + "</div>" : "") +
      (cond ? '<div class="sub">' + esc(cond) + "</div>" : "") +
      (v.equipaggio ? '<div class="sub">Equipaggio: ' + esc(v.equipaggio) + "</div>" : "") +
      (v.note ? '<div class="dz-note">' + esc(v.note) + "</div>" : "") +
      '<div class="dz-azioni"><button class="pulsante" type="button" data-azione="mod" data-id="' + esc(v.id) + '">Modifica</button>' +
      '<button class="pulsante" type="button" data-azione="del" data-id="' + esc(v.id) + '">Elimina</button></div></div>';
  }
  function render() {
    const ord = voci.slice().sort((a, b) => ((b.data || "") + (b.partenza || "")).localeCompare((a.data || "") + (a.partenza || "")));
    const min = voci.reduce((s, v) => s + durataMin(v), 0);
    const mi = voci.reduce((s, v) => s + (Number(String(v.miglia).replace(",", ".")) || 0), 0);
    el("dzTot").innerHTML = "<div><small>Uscite</small><b>" + voci.length + "</b></div><div><small>Ore</small><b>" + vir(Math.round(min / 6) / 10) + "</b></div><div><small>Miglia</small><b>" + vir(Math.round(mi * 10) / 10) + "</b></div>";
    el("dzLista").innerHTML = ord.length ? ord.map(voceHtml).join("") : '<p class="sub">Ancora nessuna uscita. Tocca "Nuova uscita".</p>';
    let u = null;
    try { u = localStorage.getItem(ULTIMO); } catch (e) {}
    el("dzUltimo").textContent = u ? "Ultima copia esportata: " + dataIt(u.slice(0, 10)) : "Non hai ancora esportato nessuna copia.";
  }

  function scarica(nome, tipo, testo) {
    const url = URL.createObjectURL(new Blob([testo], { type: tipo }));
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    try { localStorage.setItem(ULTIMO, new Date().toISOString()); } catch (e) {}
    render();
  }
  function esportaJson() {
    scarica("diario-boat-" + oggiIso() + ".json", "application/json", JSON.stringify({ versione: 1, esportato: new Date().toISOString(), voci: voci }, null, 1));
  }
  function esportaCsv() {
    const q = x => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"';
    const righe = [["data", "porto", "partenza", "rientro", "miglia", "equipaggio", "vento_nodi", "direzione_gradi", "raffica_nodi", "onda_m", "mare_C", "semaforo", "da", "a", "rotta_gradi", "note"].join(";")];
    voci.slice().sort((a, b) => (a.data || "").localeCompare(b.data || "")).forEach(v => {
      const c = v.cond || {};
      righe.push([v.data, v.porto, v.partenza, v.rientro, v.miglia, v.equipaggio, c.vento, c.dir, c.raffica, c.onda, c.mare,
        (v.liv === 0 || v.liv === 1 || v.liv === 2) ? ["verde", "giallo", "rosso"][v.liv] : "", v.da, v.a, v.rotta, v.note].map(q).join(";"));
    });
    scarica("diario-boat-" + oggiIso() + ".csv", "text/csv", "\ufeff" + righe.join("\n"));
  }
  function importa(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        const arr = Array.isArray(j) ? j : j.voci;
        if (!Array.isArray(arr)) throw new Error("formato");
        const ids = new Set(voci.map(v => v.id));
        let n = 0;
        arr.forEach(v => { if (v && v.id && v.data && !ids.has(v.id)) { voci.push(v); ids.add(v.id); n++; } });
        salva(); render();
        alert(n + " uscite importate.");
      } catch (e) { alert("File non valido: scegli un file esportato dal diario."); }
    };
    rd.readAsText(file);
  }

  if (!el("diario")) return;
  costruisci();
  voci = leggi();
  render();
  el("dzNuova").addEventListener("click", () => apri(null));
  el("dzAnnulla").addEventListener("click", chiudi);
  el("dzSalva").addEventListener("click", salvaVoce);
  el("dzCarica").addEventListener("click", caricaCondizioni);
  el("dzData").addEventListener("change", () => { const d = dataDaTesto(el("dzData").value); if (d) el("dzData").value = itDaIso(d); });
  ["dzPart", "dzRient"].forEach(id => el(id).addEventListener("change", () => { el(id).value = norma(el(id).value); }));
  ["dzData", "dzPorto", "dzPart", "dzRient"].forEach(id => el(id).addEventListener("change", ricaricaDopo));
  el("dzExpJ").addEventListener("click", esportaJson);
  el("dzExpC").addEventListener("click", esportaCsv);
  el("dzImp").addEventListener("click", () => el("dzFile").click());
  el("dzFile").addEventListener("change", e => { if (e.target.files[0]) importa(e.target.files[0]); e.target.value = ""; });
  el("dzLista").addEventListener("click", e => {
    const b = e.target.closest("button[data-azione]");
    if (!b) return;
    const v = voci.find(x => x.id === b.dataset.id);
    if (!v) return;
    if (b.dataset.azione === "mod") apri(v);
    if (b.dataset.azione === "del" && confirm("Eliminare questa uscita?")) { voci = voci.filter(x => x.id !== v.id); salva(); render(); }
  });
})();
