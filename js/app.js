pdfjsLib.disableWorker = true;
// PDF.js configurato per l'esecuzione locale senza Worker esterno
const STORAGE_KEY_SESSION = "tv_registro_rdp_session_v1";
let utenteCorrente = null;

document.addEventListener("DOMContentLoaded", () => {
  popolaListaUtentiDemo();
  verificaSessioneAttiva();
});

function popolaListaUtentiDemo() {
  const container = document.getElementById("lista-utenti-demo");
  if (!container) return;
  container.innerHTML = "";
  Object.keys(UTENTI_PREDEFINITI).forEach(user => {
    const info = UTENTI_PREDEFINITI[user];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between transition cursor-pointer";
    btn.innerHTML = `<div><span class="font-bold text-white">${user}</span> <span class="text-slate-500">(${info.nomeCompleto})</span></div><code class="text-[10px] text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded">${info.password}</code>`;
    btn.onclick = () => {
      document.getElementById("login-username").value = user;
      document.getElementById("login-password").value = info.password;
      document.getElementById("login-error").classList.add("hidden");
    };
    container.appendChild(btn);
  });
}

function controllaUsernameLeone(val) {
  const wrapper = document.getElementById("admin-credenziali-wrapper");
  if (val.trim().toLowerCase() === "leone") wrapper.classList.remove("hidden");
  else { wrapper.classList.add("hidden"); document.getElementById("credenziali-box").classList.add("hidden"); }
}

function controllaPasswordLeone() {
  if (document.getElementById("login-username").value.trim().toLowerCase() === "leone" && document.getElementById("login-password").value === "TerzoValico2026") {
    document.getElementById("admin-credenziali-wrapper").classList.remove("hidden");
  }
}

function toggleCredenzialiBox() {
  document.getElementById("credenziali-box").classList.toggle("hidden");
  document.getElementById("cred-chevron").classList.toggle("rotate-180");
}

function togglePasswordVisibility() {
  const input = document.getElementById("login-password");
  const icon = document.getElementById("eye-icon");
  if (input.type === "password") { input.type = "text"; icon.className = "fa-solid fa-eye-slash"; }
  else { input.type = "password"; icon.className = "fa-solid fa-eye"; }
}

function eseguiLogin(e) {
  e.preventDefault();
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value;
  const chiave = Object.keys(UTENTI_PREDEFINITI).find(k => k.toLowerCase() === u.toLowerCase());
  const utente = chiave ? UTENTI_PREDEFINITI[chiave] : null;

  if (utente && utente.password === p) {
    utenteCorrente = { username: chiave, ...utente };
    sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(utenteCorrente));
    avviaInterfacciaAutenticata();
    mostraToast(`Benvenuto, ${utente.nomeCompleto}`, "success");
  } else {
    document.getElementById("login-error").classList.remove("hidden");
  }
}

function verificaSessioneAttiva() {
  const saved = sessionStorage.getItem(STORAGE_KEY_SESSION);
  if (saved) {
    try {
      utenteCorrente = JSON.parse(saved);
      avviaInterfacciaAutenticata();
    } catch (e) { sessionStorage.removeItem(STORAGE_KEY_SESSION); }
  }
}

function avviaInterfacciaAutenticata() {
  document.getElementById("login-screen").classList.add("hidden");
  const wrapper = document.getElementById("app-wrapper");
  wrapper.classList.remove("hidden");
  wrapper.classList.add("flex");

  document.getElementById("user-avatar").innerText = utenteCorrente.iniziali;
  document.getElementById("user-fullname").innerText = utenteCorrente.nomeCompleto;
  document.getElementById("user-role").innerText = utenteCorrente.ruolo;

  inizializzaTerre();
  inizializzaRifiuti();
}

function eseguiLogout() {
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
  utenteCorrente = null;
  document.getElementById("app-wrapper").classList.add("hidden");
  document.getElementById("app-wrapper").classList.remove("flex");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("admin-credenziali-wrapper").classList.add("hidden");
  mostraToast("Sessione chiusa", "info");
}

function cambiaSezionePrincipale(sezione) {
  const btnT = document.getElementById("macro-btn-terre");
  const btnR = document.getElementById("macro-btn-rifiuti");
  const wrapT = document.getElementById("sezione-terre-wrapper");
  const wrapR = document.getElementById("sezione-rifiuti-wrapper");

  if (sezione === "terre") {
    btnT.className = "px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-sky-500/25 transition cursor-pointer flex items-center gap-2";
    btnR.className = "px-4 py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2";
    wrapT.classList.remove("hidden"); wrapR.classList.add("hidden");
  } else {
    btnR.className = "px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/25 transition cursor-pointer flex items-center gap-2";
    btnT.className = "px-4 py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2";
    wrapR.classList.remove("hidden"); wrapT.classList.add("hidden");
  }
}

function cambiaVista(tab) {
  ["tabella", "analiti", "cartelle"].forEach(t => {
    const btn = document.getElementById(`btn-${t}`);
    const view = document.getElementById(`vista-${t}`);
    if (t === tab) {
      btn.className = "pb-3 border-b-2 border-sky-400 text-sky-400 flex items-center gap-2 cursor-pointer whitespace-nowrap";
      view.classList.remove("hidden");
    } else {
      btn.className = "pb-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2 cursor-pointer whitespace-nowrap";
      view.classList.add("hidden");
    }
  });
}

function mostraToast(messaggio, tipo = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  const stili = {
    success: "bg-emerald-950/95 border-emerald-500/50 text-emerald-200",
    error: "bg-rose-950/95 border-rose-500/50 text-rose-200",
    info: "bg-slate-900/95 border-sky-500/50 text-sky-200"
  };
  toast.className = `pointer-events-auto border rounded-xl px-4 py-3 shadow-2xl text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md transition-all ${stili[tipo] || stili.info}`;
  toast.innerHTML = `<i class="fa-solid fa-circle-info text-sm"></i><span>${messaggio}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 3500);
}

function mostraConferma(titolo, messaggio, onConfirm) {
  document.getElementById("confirm-title").innerText = titolo;
  document.getElementById("confirm-message").innerText = messaggio;
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-ok-btn").onclick = () => { modal.classList.add("hidden"); onConfirm(); };
  document.getElementById("confirm-cancel-btn").onclick = () => modal.classList.add("hidden");
  modal.classList.remove("hidden");
}
