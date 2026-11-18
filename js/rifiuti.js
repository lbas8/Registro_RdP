let archivioRifiuti = [];
const STORAGE_KEY_RIFIUTI = "tv_registro_rdp_rifiuti_v1";

function inizializzaRifiuti() {
  const raw = localStorage.getItem(STORAGE_KEY_RIFIUTI);
  if (raw) { try { archivioRifiuti = JSON.parse(raw); } catch (e) { archivioRifiuti = []; } }
  if (!archivioRifiuti || archivioRifiuti.length === 0) {
    archivioRifiuti = [{
      uid: "rif_seed_1", prog: 101, data_prelievo: "15/10/2026", cer: "17 05 04",
      pericolosita: "Non Pericoloso", cantiere: "GN147 / COP5 Vallemme", certificato: "26LA13910"
    }];
    salvaRifiutiSuLocalStorage();
  }
  configuraDropzoneRifiuti();
  aggiornaUIRifiuti();
}

function salvaRifiutiSuLocalStorage() {
  localStorage.setItem(STORAGE_KEY_RIFIUTI, JSON.stringify(archivioRifiuti));
}

function calcolaProssimoProgressivoRifiuti() {
  if (archivioRifiuti.length === 0) return 101;
  return archivioRifiuti.reduce((max, r) => Math.max(max, parseInt(r.prog, 10) || 100), 100) + 1;
}

function configuraDropzoneRifiuti() {
  const dz = document.getElementById("dropzone-rifiuti");
  const fi = document.getElementById("fileInputRifiutiPdf");
  if (!dz) return;
  
  dz.addEventListener("click", () => fi.click());
  
  ["dragenter", "dragover", "dragleave", "drop"].forEach(ev => {
    dz.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, () => dz.classList.add("dragover"), false));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove("dragover"), false));
  
  dz.addEventListener("drop", e => {
    if (e.dataTransfer.files?.length > 0) gestisciFileRifiutiSelezionati(e.dataTransfer.files);
  }, false);
}

async function gestisciFileRifiutiSelezionati(files) {
  const pdfs = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  if (pdfs.length === 0) return;
  const testo = await estraiTestoSpazialePDF(pdfs[0]);
  const matchCer = testo.match(/(?:EER|CER)[:\s]*(\d{2}\s*\d{2}\s*\d{2}\s*\*?)/i) || ["", "17 05 04"];
  const matchCert = testo.match(/Certificato\s+n[°º.]?\s*([A-Z0-9\-\/]+)/i) || ["", pdfs[0].name.replace(/\.pdf$/i, "")];

  compilaSchedaRifiuto({
    uid: "", prog: calcolaProssimoProgressivoRifiuti(), data_prelievo: new Date().toLocaleDateString("it-IT"),
    cer: matchCer[1].trim(), pericolosita: matchCer[1].includes("*") ? "Pericoloso" : "Non Pericoloso",
    certificato: matchCert[1].trim(), cantiere: "Terzo Valico"
  }, pdfs[0].name);
}

function compilaSchedaRifiuto(rec, titolo) {
  document.getElementById("edit_rifiuto_uid").value = rec.uid || "";
  document.getElementById("r_prog").value = rec.prog || "";
  document.getElementById("r_data_prelievo").value = rec.data_prelievo || "";
  document.getElementById("r_cer").value = rec.cer || "";
  document.getElementById("r_pericolosita").value = rec.pericolosita || "Non Pericoloso";
  document.getElementById("r_cantiere").value = rec.cantiere || "";
  document.getElementById("r_certificato").value = rec.certificato || "";
  document.getElementById("form-rifiuti-container").classList.remove("hidden");
}

function chiudiAnteprimaRifiuto() {
  document.getElementById("form-rifiuti-container").classList.add("hidden");
}

function salvaRecordRifiuto() {
  const cert = document.getElementById("r_certificato").value.trim();
  const cer = document.getElementById("r_cer").value.trim();
  if (!cert || !cer) { mostraToast("Inserisci CER e Certificato.", "error"); return; }

  const rec = {
    uid: document.getElementById("edit_rifiuto_uid").value || ("rif_" + Date.now()),
    prog: parseInt(document.getElementById("r_prog").value, 10) || calcolaProssimoProgressivoRifiuti(),
    data_prelievo: document.getElementById("r_data_prelievo").value.trim(),
    cer: cer, pericolosita: document.getElementById("r_pericolosita").value,
    cantiere: document.getElementById("r_cantiere").value.trim(),
    certificato: cert, autore: utenteCorrente ? utenteCorrente.nomeCompleto : "Operatore"
  };

  const idx = archivioRifiuti.findIndex(r => r.uid === rec.uid);
  if (idx !== -1) archivioRifiuti[idx] = rec;
  else archivioRifiuti.unshift(rec);

  salvaRifiutiSuLocalStorage();
  aggiornaUIRifiuti();
  chiudiAnteprimaRifiuto();
  mostraToast("Rifiuto salvato!", "success");
}

function aggiornaUIRifiuti() {
  document.getElementById("badge-count-rifiuti").innerText = archivioRifiuti.length;
  document.getElementById("kpi-rif-totale").innerText = archivioRifiuti.length;
  const peric = archivioRifiuti.filter(r => r.pericolosita?.startsWith("Pericoloso") || r.cer?.includes("*")).length;
  document.getElementById("kpi-rif-per").innerText = peric;
  document.getElementById("kpi-rif-nonper").innerText = archivioRifiuti.length - peric;

  const tbody = document.getElementById("rifiuti-table-tbody");
  tbody.innerHTML = "";
  if (archivioRifiuti.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">Nessun rifiuto archiviato.</td></tr>`;
    return;
  }
  archivioRifiuti.forEach(r => {
    tbody.innerHTML += `
      <tr class="hover:bg-slate-800/50 transition">
        <td class="p-3 font-black text-rose-400">${r.prog}</td>
        <td class="p-3 text-slate-300">${r.data_prelievo || "-"}</td>
        <td class="p-3 text-center font-mono font-bold text-rose-300">${r.cer}</td>
        <td class="p-3">${r.pericolosita}</td>
        <td class="p-3 font-bold text-white">${r.cantiere || "-"}</td>
        <td class="p-3 font-bold text-sky-400">${r.certificato}</td>
        <td class="p-3 text-center"><button onclick="eliminaRifiuto('${r.uid}')" class="p-1.5 rounded-lg bg-slate-800 text-rose-400 cursor-pointer"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`;
  });
}

function eliminaRifiuto(uid) {
  mostraConferma("Elimina Rifiuto", "Vuoi eliminare questo record?", () => {
    archivioRifiuti = archivioRifiuti.filter(r => r.uid !== uid);
    salvaRifiutiSuLocalStorage();
    aggiornaUIRifiuti();
    mostraToast("Eliminato.", "info");
  });
}

function esportaRegistroRifiutiExcel() {
  if (archivioRifiuti.length === 0) { mostraToast("Nessun dato.", "error"); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(archivioRifiuti);
  XLSX.utils.book_append_sheet(wb, ws, "Rifiuti");
  XLSX.writeFile(wb, "Registro_Rifiuti.xlsx");
  mostraToast("Export Rifiuti completato!", "success");
}
