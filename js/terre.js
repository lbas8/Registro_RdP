let archivioRecords = [];
let codaPdfEstratti = [];
let indiceCodaAttivo = -1;
let templateWorkbookBase = null;

const STORAGE_KEY_RECORDS = "tv_registro_rdp_154_records_v1";

function inizializzaTerre() {
  const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
  if (raw) {
    try { archivioRecords = JSON.parse(raw); } catch (e) { archivioRecords = []; }
  }
  if (!archivioRecords || archivioRecords.length === 0) {
    archivioRecords = [
      {
        uid: "seed_15181", prog: 15181, data_prelievo: "09/09/2026", prod_wbs: "GN147", prod_cantiere: "COP5", prod_sito: "Vallemme",
        punto_prelievo: "Cumulo", denominazione: "RIBALTINA 3B - S1", laboratorio: "ARCADIA", certificato_num: "26LA12410",
        data_emissione: "14/09/2026", anno_lab_cert: "2026_ARCADIA_26LA12410", sottoprodotto: "1/A", autore: "Leone Bastiancich", autoreIniziali: "LB", analiti: { arsenico: "4,82", cromo: "68,5" }
      },
      {
        uid: "seed_15206", prog: 15206, data_prelievo: "14/09/2026", prod_wbs: "NV132", prod_cantiere: "COP1", prod_sito: "Libarna",
        punto_prelievo: "Fronte scavo", denominazione: "S1 - Lotto Libarna", laboratorio: "ARCADIA", certificato_num: "26LA13878",
        data_emissione: "23/10/2026", anno_lab_cert: "2026_ARCADIA_26LA13878", sottoprodotto: "1/B", autore: "Leone Bastiancich", autoreIniziali: "LB", analiti: { arsenico: "24,5", nichel: "74,1" }
      }
    ];
    salvaSuLocalStorage();
  }
  configuraDropzone();
  aggiornaTuttaUI();
}

function salvaSuLocalStorage() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(archivioRecords));
}

function calcolaProssimoProgressivo() {
  if (archivioRecords.length === 0) return 15207;
  return archivioRecords.reduce((max, r) => {
    const n = parseInt(r.prog, 10);
    return (!isNaN(n) && n > max) ? n : max;
  }, 15206) + 1;
}

function valutaStatoConformitaAnalita(valStr, colAStr, colBStr) {
  if (!valStr || valStr.trim() === "") return "VUOTO";
  const s = valStr.trim().toLowerCase();
  if (s === "n.r." || s === "nr" || s === "assente" || s === "-") return "OK_A";
  if (s.startsWith("<")) return "OK_A";

  const numMatch = s.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return "NEUTRO";

  const num = parseFloat(numMatch[1]);
  const limA = parseFloat(String(colAStr).replace(",", "."));
  const limB = parseFloat(String(colBStr).replace(",", "."));

  if (!isNaN(limA) && num <= limA) return "OK_A";
  if (!isNaN(limB) && num <= limB) return "SUPERA_A";
  return "SUPERA_B";
}

function getClassiInputAnalita(stato) {
  if (stato === "OK_A") return "bg-emerald-950/80 border-emerald-500 text-emerald-300 focus:border-emerald-400";
  if (stato === "SUPERA_A") return "bg-rose-950/75 border-rose-500 text-rose-300 focus:border-rose-400";
  if (stato === "SUPERA_B") return "bg-rose-900/80 border-rose-400 text-white focus:border-rose-300 ring-1 ring-rose-500/50";
  if (stato === "NEUTRO") return "bg-slate-950 border-sky-500/60 text-sky-300 focus:border-sky-400";
  return "bg-slate-950 border-slate-700 text-slate-300 focus:border-sky-400";
}

function aggiornaStileInputAnalita(inputEl, colAStr, colBStr) {
  const stato = valutaStatoConformitaAnalita(inputEl.value, colAStr, colBStr);
  inputEl.className = `w-full text-center border rounded px-2 py-1 font-bold outline-none transition-colors ${getClassiInputAnalita(stato)}`;
}

function estraiTestoSpazialePDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let testoCompleto = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const righeMappa = {};
          textContent.items.forEach(item => {
            const y = Math.round(item.transform[5] / 9) * 9;
            if (!righeMappa[y]) righeMappa[y] = [];
            righeMappa[y].push({ x: item.transform[4], str: item.str });
          });
          const yKeys = Object.keys(righeMappa).sort((a, b) => Number(b) - Number(a));
          yKeys.forEach(y => {
            const riga = righeMappa[y].sort((a, b) => a.x - b.x).map(e => e.str).join(" ").replace(/\s+/g, " ").trim();
            if (riga) testoCompleto += riga + "\n";
          });
        }
        resolve(testoCompleto);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function formattaValoreItaliano(val) {
  if (!val) return "";
  let s = String(val).trim();
  if (/^n\.?r\.?$/i.test(s)) return "n.r.";
  if (/^[<>]?\s*\d+[.,]\d+$/.test(s)) return s.replace(/\s+/g, "").replace(".", ",");
  return s;
}

function trovaValoreAnalitaInTesto(testo, analitaObj) {
  const righe = testo.split("\n");
  let rigaTrovataIdx = -1;
  let matchedAlias = "";

  for (let i = 0; i < righe.length; i++) {
    for (const alias of analitaObj.aliases) {
      if (analitaObj.key === "cromo" && /cromo\s*\(?vi\)?/i.test(righe[i])) continue;
      const regex = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const m = regex.exec(righe[i]);
      if (m) { rigaTrovataIdx = i; matchedAlias = m[0]; break; }
    }
    if (rigaTrovataIdx !== -1) break;
  }
  if (rigaTrovataIdx === -1) return "";

  const rigaCorrente = righe[rigaTrovataIdx];
  const posAlias = rigaCorrente.toLowerCase().indexOf(matchedAlias.toLowerCase());
  const dopoAlias = rigaCorrente.substring(posAlias + matchedAlias.length);
  const rigaSucc = righe[rigaTrovataIdx + 1] || "";
  const rigaPrec = righe[rigaTrovataIdx - 1] || "";
  const blocco = (dopoAlias + " | " + rigaSucc + " | " + rigaPrec).replace(/(?:UNI|EN|ISO|EPA)\s*[A-Z0-9\-\/:]+/gi, " ");

  if (/\bn\.?r\.?\b/i.test(blocco)) return "n.r.";
  const matchMinore = blocco.match(/([<>]\s*\d+(?:[.,]\d+)?)/);
  if (matchMinore) return formattaValoreItaliano(matchMinore[1]);
  const matchDecimale = blocco.match(/\b(\d+[.,]\d+)\b/);
  if (matchDecimale) return formattaValoreItaliano(matchDecimale[1]);

  return "";
}

function configuraDropzone() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInputPdf");
  if (!dropzone) return;
  dropzone.addEventListener("click", () => fileInput.click());
  ["dragenter", "dragover"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("dragover"); }));
  dropzone.addEventListener("drop", e => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) gestisciFileSelezionati(files);
  });
}

async function gestisciFileSelezionati(fileList) {
  const pdfFiles = Array.from(fileList).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length === 0) { mostraToast("Seleziona almeno un file PDF valido.", "error"); return; }
  mostraToast(`Estrazione di ${pdfFiles.length} PDF in corso...`, "info");
  codaPdfEstratti = [];
  let progCorrente = calcolaProssimoProgressivo();

  for (let i = 0; i < pdfFiles.length; i++) {
    try {
      const testo = await estraiTestoSpazialePDF(pdfFiles[i]);
      const rec = parseTestoCertificatoPDF(testo, pdfFiles[i].name, progCorrente + i);
      codaPdfEstratti.push({ fileName: pdfFiles[i].name, record: rec, salvato: false });
    } catch (err) { console.error(err); }
  }

  if (codaPdfEstratti.length > 0) {
    renderCodaPDF();
    selezionaDaCodaPDF(0);
    mostraToast("Estrazione completata!", "success");
  }
  document.getElementById("fileInputPdf").value = "";
}

function parseTestoCertificatoPDF(testo, nomeFile, progAssegnato) {
  const matchCert = testo.match(/Rapporto\s+di\s+[Pp]rova\s+n[°º.]?\s*([A-Z0-9\-\/]+)/i) || testo.match(/\b(\d{2}[A-Z]{2}\d{4,6})\b/);
  const certificatoNum = matchCert ? matchCert[1].trim() : nomeFile.replace(/\.pdf$/i, "");
  const matchWbs = testo.match(/\b(GN\d{2,4}|NV\d{2,4}|INVS|AL\d{2,4}|GE\d{2,4})\b/i);
  const matchCant = testo.match(/\b(COP\s*\d{1,2}|Galleria\s+[A-Za-z0-9]+)\b/i);

  const analitiEstratti = {};
  let superaA = false;
  let superaB = false;

  ANALITI_97.forEach(an => {
    const val = trovaValoreAnalitaInTesto(testo, an);
    analitiEstratti[an.key] = val;
    const stato = valutaStatoConformitaAnalita(val, an.colA, an.colB);
    if (stato === "SUPERA_A") superaA = true;
    if (stato === "SUPERA_B") superaB = true;
  });

  let sottoprodotto = "1/A";
  if (superaB) sottoprodotto = "";
  else if (superaA) sottoprodotto = "1/B";

  const anno = new Date().getFullYear();
  return {
    uid: "rdp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    prog: progAssegnato,
    data_prelievo: new Date().toLocaleDateString("it-IT"),
    prod_wbs: matchWbs ? matchWbs[1].toUpperCase() : "",
    prod_cantiere: matchCant ? matchCant[1].toUpperCase() : "",
    denominazione: nomeFile.replace(/\.pdf$/i, ""),
    laboratorio: "ARCADIA",
    certificato_num: certificatoNum,
    data_emissione: new Date().toLocaleDateString("it-IT"),
    anno_lab_cert: `${anno}_ARCADIA_${certificatoNum}`,
    sottoprodotto: sottoprodotto,
    autore: utenteCorrente ? utenteCorrente.nomeCompleto : "Operatore",
    autoreIniziali: utenteCorrente ? utenteCorrente.iniziali : "OP",
    analiti: analitiEstratti
  };
}

function renderCodaPDF() {
  const container = document.getElementById("coda-pdf-container");
  const list = document.getElementById("coda-pdf-list");
  document.getElementById("coda-count").innerText = codaPdfEstratti.length;
  if (codaPdfEstratti.length === 0) { container.classList.add("hidden"); return; }
  container.classList.remove("hidden");
  list.innerHTML = "";
  codaPdfEstratti.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 cursor-pointer ${idx === indiceCodaAttivo ? "bg-sky-500/20 border-sky-400 text-sky-300" : "bg-slate-900 border-slate-700 text-slate-300"}`;
    btn.innerHTML = `<i class="fa-solid fa-file-pdf text-rose-400"></i><span>${item.record.certificato_num}</span>`;
    btn.onclick = () => selezionaDaCodaPDF(idx);
    list.appendChild(btn);
  });
}

function selezionaDaCodaPDF(idx) {
  indiceCodaAttivo = idx;
  renderCodaPDF();
  compilaSchedaVerifica(codaPdfEstratti[idx].record, codaPdfEstratti[idx].fileName);
}

function svuotaCodaPDF() {
  codaPdfEstratti = [];
  indiceCodaAttivo = -1;
  document.getElementById("coda-pdf-container").classList.add("hidden");
  chiudiAnteprimaPDF();
}

function apriNuovoRecordManuale() {
  compilaSchedaVerifica({
    uid: "", prog: calcolaProssimoProgressivo(), data_prelievo: new Date().toLocaleDateString("it-IT"),
    prod_wbs: "", prod_cantiere: "", denominazione: "", laboratorio: "ARCADIA", certificato_num: "",
    data_emissione: new Date().toLocaleDateString("it-IT"), sottoprodotto: "1/A", analiti: {}
  }, "Inserimento Manuale RdP");
}

function modificaRecordEsistente(uid) {
  const rec = archivioRecords.find(r => r.uid === uid);
  if (rec) compilaSchedaVerifica(rec, `Modifica Record Prog. n° ${rec.prog}`);
}

function compilaSchedaVerifica(rec, titolo) {
  document.getElementById("nome-file-corrente").innerText = `Sorgente: ${titolo}`;
  document.getElementById("edit_record_uid").value = rec.uid || "";
  document.getElementById("f_prog").value = rec.prog || "";
  document.getElementById("f_data_prelievo").value = rec.data_prelievo || "";
  document.getElementById("f_prod_wbs").value = rec.prod_wbs || "";
  document.getElementById("f_prod_cantiere").value = rec.prod_cantiere || "";
  document.getElementById("f_denominazione").value = rec.denominazione || "";
  document.getElementById("f_laboratorio").value = rec.laboratorio || "";
  document.getElementById("f_certificato_num").value = rec.certificato_num || "";
  document.getElementById("f_data_emissione").value = rec.data_emissione || "";
  aggiornaAnnoLabCert();
  document.getElementById("f_sottoprodotto").value = rec.sottoprodotto !== undefined ? rec.sottoprodotto : "1/A";
  document.getElementById("f_note").value = rec.note || "";

  const tbody = document.getElementById("preview-analiti-tbody");
  tbody.innerHTML = "";
  ANALITI_97.forEach(an => {
    const val = (rec.analiti && rec.analiti[an.key]) ? rec.analiti[an.key] : "";
    const stato = valutaStatoConformitaAnalita(val, an.colA, an.colB);
    const tr = document.createElement("tr");
    tr.className = "analita-preview-row hover:bg-slate-800/60 transition";
    tr.dataset.label = an.excelHeader.toLowerCase();
    tr.dataset.cat = an.cat;
    tr.innerHTML = `
      <td class="p-2 text-center font-mono text-[10px] text-slate-500">${an.col}</td>
      <td class="p-2 font-semibold text-white">${an.excelHeader}</td>
      <td class="p-2 text-center text-[10px] text-slate-400">${an.um}</td>
      <td class="p-1.5 text-center">
        <input type="text" id="prev_an_${an.key}" value="${val}" oninput="aggiornaStileInputAnalita(this, '${an.colA}', '${an.colB}')" class="w-full text-center border rounded px-2 py-1 font-bold outline-none transition-colors ${getClassiInputAnalita(stato)}">
      </td>
      <td class="p-2 text-center text-[11px] font-bold text-emerald-400">${an.colA}</td>
      <td class="p-2 text-center text-[11px] font-bold text-rose-400">${an.colB}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById("form-estratto-container").classList.remove("hidden");
  document.getElementById("form-estratto-container").scrollIntoView({ behavior: "smooth", block: "start" });
}

function aggiornaAnnoLabCert() {
  const lab = document.getElementById("f_laboratorio").value.trim().toUpperCase();
  const cert = document.getElementById("f_certificato_num").value.trim();
  const dataEm = document.getElementById("f_data_emissione").value.trim();
  const mAnno = dataEm.match(/(\d{4})/);
  const anno = mAnno ? mAnno[1] : new Date().getFullYear();
  document.getElementById("f_anno_lab_cert").value = (lab && cert) ? `${anno}_${lab}_${cert}` : "";
}

function filtraAnalitiPreview() {
  const testo = document.getElementById("filtro-analiti-preview").value.toLowerCase();
  const cat = document.getElementById("filtro-cat-preview").value;
  
  document.querySelectorAll(".analita-preview-row").forEach(row => {
    const inputEl = row.querySelector("input[type='text']");
    const val = inputEl ? inputEl.value.trim() : "";
    const matchText = row.dataset.label.includes(testo);
    
    let matchCat = true;
    if (cat === "COMPILATI") {
      matchCat = (val !== "" && val !== "-");
    } else if (cat !== "ALL") {
      matchCat = (row.dataset.cat === cat);
    }
    
    row.classList.toggle("hidden", !(matchText && matchCat));
  });
}

function chiudiAnteprimaPDF() {
  document.getElementById("form-estratto-container").classList.add("hidden");
}

function salvaRecordRdP() {
  const certNum = document.getElementById("f_certificato_num").value.trim();
  if (!certNum) { mostraToast("Inserisci il Numero Certificato.", "error"); return; }
  aggiornaAnnoLabCert();

  const analitiObj = {};
  ANALITI_97.forEach(an => {
    const el = document.getElementById(`prev_an_${an.key}`);
    analitiObj[an.key] = el ? formattaValoreItaliano(el.value.trim()) : "";
  });

  const existingUid = document.getElementById("edit_record_uid").value;
  const progVal = parseInt(document.getElementById("f_prog").value, 10) || calcolaProssimoProgressivo();

  const recordCompleto = {
    uid: existingUid || ("rdp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6)),
    prog: progVal,
    data_prelievo: document.getElementById("f_data_prelievo").value.trim(),
    prod_wbs: document.getElementById("f_prod_wbs").value.trim(),
    prod_cantiere: document.getElementById("f_prod_cantiere").value.trim(),
    denominazione: document.getElementById("f_denominazione").value.trim(),
    laboratorio: document.getElementById("f_laboratorio").value.trim().toUpperCase(),
    certificato_num: certNum,
    data_emissione: document.getElementById("f_data_emissione").value.trim(),
    anno_lab_cert: document.getElementById("f_anno_lab_cert").value.trim(),
    sottoprodotto: document.getElementById("f_sottoprodotto").value,
    note: document.getElementById("f_note").value.trim(),
    autore: utenteCorrente ? utenteCorrente.nomeCompleto : "Operatore",
    autoreIniziali: utenteCorrente ? utenteCorrente.iniziali : "OP",
    analiti: analitiObj
  };

  const idx = archivioRecords.findIndex(r => r.uid === existingUid);
  if (idx !== -1) {
    archivioRecords[idx] = recordCompleto;
    mostraToast("Record aggiornato!", "success");
  } else {
    archivioRecords.unshift(recordCompleto);
    mostraToast("RdP archiviato!", "success");
  }

  salvaSuLocalStorage();
  aggiornaTuttaUI();
  chiudiAnteprimaPDF();
}

function eliminaRecordRdP(uid) {
  mostraConferma("Elimina RdP", "Vuoi eliminare questo record?", () => {
    archivioRecords = archivioRecords.filter(r => r.uid !== uid);
    salvaSuLocalStorage();
    aggiornaTuttaUI();
    mostraToast("Record eliminato.", "info");
  });
}

function aggiornaTuttaUI() {
  document.getElementById("kpi-totale").innerText = archivioRecords.length;
  document.getElementById("kpi-1a").innerText = archivioRecords.filter(r => r.sottoprodotto === "1/A").length;
  document.getElementById("kpi-1b").innerText = archivioRecords.filter(r => r.sottoprodotto === "1/B").length;
  document.getElementById("kpi-prog").innerText = archivioRecords.length > 0 ? Math.max(...archivioRecords.map(r => parseInt(r.prog, 10) || 0)) : "-";
  filtraTabellaRdP();
  renderMatriceAnaliti();
  renderAlberoCartelle();
}

function filtraTabellaRdP() {
  const testo = document.getElementById("filtroTesto").value.toLowerCase();
  const qualifica = document.getElementById("filtroQualifica").value;
  const filtrati = archivioRecords.filter(r => {
    const blob = `${r.prog} ${r.certificato_num} ${r.denominazione}`.toLowerCase();
    const matchTesto = blob.includes(testo);
    let matchQual = true;
    if (qualifica === "1/A") matchQual = r.sottoprodotto === "1/A";
    else if (qualifica === "1/B") matchQual = r.sottoprodotto === "1/B";
    else if (qualifica === "RIFIUTO") matchQual = !r.sottoprodotto;
    return matchTesto && matchQual;
  });
  renderTabellaGenerale(filtrati);
}

function renderTabellaGenerale(lista) {
  const tbody = document.getElementById("rdp-table-tbody");
  tbody.innerHTML = "";
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">Nessun Rapporto di Prova trovato.</td></tr>`;
    return;
  }
  lista.forEach(r => {
    let badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-400">RIFIUTO</span>`;
    if (r.sottoprodotto === "1/A") badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400">1/A</span>`;
    else if (r.sottoprodotto === "1/B") badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-300">1/B</span>`;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-800/50 transition";
    tr.innerHTML = `
      <td class="p-3 font-black text-amber-400">${r.prog}</td>
      <td class="p-3 text-slate-300">${r.data_prelievo || "-"}</td>
      <td class="p-3 font-bold text-white">${r.prod_wbs || "-"}</td>
      <td class="p-3 text-slate-200">${r.denominazione || "-"}</td>
      <td class="p-3 font-bold text-sky-400">${r.certificato_num}</td>
      <td class="p-3 font-mono text-[10px] text-emerald-300">${r.anno_lab_cert || "-"}</td>
      <td class="p-3 text-center">${badge}</td>
      <td class="p-3 text-center">
        <div class="inline-flex items-center gap-1.5">
          <button onclick="modificaRecordEsistente('${r.uid}')" class="p-1.5 rounded-lg bg-slate-800 text-sky-400 cursor-pointer"><i class="fa-solid fa-pen"></i></button>
          <button onclick="eliminaRecordRdP('${r.uid}')" class="p-1.5 rounded-lg bg-slate-800 text-rose-400 cursor-pointer"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMatriceAnaliti() {
  const thead = document.getElementById("thead-analiti-97");
  const tbody = document.getElementById("tbody-analiti-97");
  let headHtml = `<tr class="bg-slate-800 text-slate-200 border-b border-slate-700"><th class="p-2.5 sticky left-0 bg-slate-800 z-20 min-w-[170px]">Prog. / Certificato</th>`;
  ANALITI_97.forEach(an => { headHtml += `<th class="p-2 text-center min-w-[110px]">${an.excelHeader}</th>`; });
  headHtml += `</tr>`;
  thead.innerHTML = headHtml;

  tbody.innerHTML = "";
  archivioRecords.forEach(r => {
    let row = `<tr class="hover:bg-slate-800/40"><td class="p-2.5 sticky left-0 bg-slate-900 z-10 font-black text-amber-400">${r.prog} — ${r.certificato_num}</td>`;
    ANALITI_97.forEach(an => {
      const val = (r.analiti && r.analiti[an.key]) ? r.analiti[an.key] : "-";
      const stato = val === "-" ? "VUOTO" : valutaStatoConformitaAnalita(val, an.colA, an.colB);
      let st = "text-slate-500";
      if (stato === "OK_A") st = "bg-emerald-950/60 text-emerald-300 font-bold";
      else if (stato === "SUPERA_A") st = "bg-rose-950/70 text-rose-300 font-bold";
      else if (stato === "SUPERA_B") st = "bg-rose-900/80 text-white font-black";
      row += `<td class="p-2 text-center font-mono ${st}">${val}</td>`;
    });
    row += `</tr>`;
    tbody.innerHTML += row;
  });
}

function renderAlberoCartelle() {
  const container = document.getElementById("albero-cartelle-container");
  const tree = {};
  archivioRecords.forEach(r => {
    const area = r.prod_wbs || "Cantiere Generale";
    if (!tree[area]) tree[area] = [];
    tree[area].push(r);
  });
  let html = "";
  Object.keys(tree).sort().forEach(area => {
    html += `<div class="border border-slate-800 rounded-xl p-4 bg-slate-950/60 space-y-2"><div class="text-sky-400 font-bold text-xs">${area} (${tree[area].length} RdP)</div><div class="pl-4 space-y-1">`;
    tree[area].forEach(r => {
      html += `<div class="text-xs text-slate-300 flex justify-between bg-slate-900 p-2 rounded-lg"><span><b>#${r.prog}</b> • Cert. ${r.certificato_num}</span><button onclick="modificaRecordEsistente('${r.uid}')" class="text-sky-400 font-bold cursor-pointer">Apri ➔</button></div>`;
    });
    html += `</div></div>`;
  });
  container.innerHTML = html || `<p class="text-xs text-slate-500">Nessun record.</p>`;
}

function esportaRegistroExcelCompleto() {
  if (archivioRecords.length === 0) { mostraToast("Nessun record.", "error"); return; }
  const wb = XLSX.utils.book_new();
  const header = new Array(154).fill("");
  header[1] = "Prog."; header[3] = "Data"; header[20] = "Certificato"; header[36] = "Sottoprodotto";
  ANALITI_97.forEach((an, i) => { header[57 + i] = an.excelHeader; });

  const aoa = [new Array(154).fill(""), header];
  archivioRecords.forEach(r => {
    const row = new Array(154).fill("");
    row[1] = r.prog; row[3] = r.data_prelievo; row[20] = r.certificato_num; row[36] = r.sottoprodotto;
    ANALITI_97.forEach((an, i) => { row[57 + i] = r.analiti?.[an.key] || ""; });
    aoa.push(row);
  });
  XLSX.writeFile(XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Foglio1"), "Registro_RdP_Terre.xlsx");
  mostraToast("Export completato!", "success");
}

function caricaTemplateExcelEsistente(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      templateWorkbookBase = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      document.getElementById("template-status").innerHTML = `<span class="text-emerald-400 font-bold">Caricato:</span> ${file.name}`;
      mostraToast("Template caricato!", "success");
    } catch (err) { mostraToast("Errore file Excel.", "error"); }
  };
  reader.readAsArrayBuffer(file);
}
