import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig, OWNER_EMAIL } from "./firebase-config.js";

export const APP_VERSION = "2.1.0";
const COMPANY = "ACEH MANDIRI UTAMA";
// Login kasir memakai username; di Firebase disimpan sebagai username@domain ini.
const USER_DOMAIN = "kasir.cashflow-amu.firebaseapp.com";
const DEFAULT_CATS = {
  in: ["Penjualan","Setoran modal","Pelunasan piutang","Lain-lain"],
  out: ["Operasional","Gaji & upah","Transport","ATK","Listrik & air","Sewa","Konsumsi","Pembelian barang","Setor ke pusat","Lain-lain"]
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { db = getFirestore(app); }

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rp = n => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const rpn = n => Math.round(n || 0).toLocaleString("id-ID");
const sgnRp = n => (n < 0 ? "−" : "") + rp(Math.abs(n));
const todayJkt = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date());
const fmtDate = d => { try { return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date(d+"T00:00:00")); } catch(e){ return d; } };
const fmtShort = d => { try { return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short"}).format(new Date(d+"T00:00:00")); } catch(e){ return d; } };
const fmtMonth = m => { try { return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(new Date(m+"-01T00:00:00")); } catch(e){ return m; } };
const fmtTime = ms => { try { return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(ms)); } catch(e){ return ""; } };
const prevMonth = m => { const [y,mo]=m.split("-").map(Number); const d=new Date(y,mo-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const daysIn = m => { const [y,mo]=m.split("-").map(Number); return new Date(y,mo,0).getDate(); };
const fmtDMY = d => String(d||"").split("-").reverse().join("-");
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const AUTOTABLE_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
const _scripts = {};
function loadScript(src){
  if(!_scripts[src]) _scripts[src] = new Promise((res,rej)=>{
    const el=document.createElement("script"); el.src=src; el.async=true;
    el.onload=()=>res(); el.onerror=()=>{ delete _scripts[src]; el.remove(); rej(new Error("Pustaka ekspor gagal dimuat. Periksa koneksi internet lalu coba lagi.")); };
    document.head.appendChild(el);
  });
  return _scripts[src];
}
const newId = () => doc(collection(db,"tx")).id;
const digits = s => String(s||"").replace(/\D/g,"");
const isOwnerEmail = email => !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase();
const toLoginEmail = id => { const v=String(id||"").trim().toLowerCase(); return v.includes("@") ? v : `${v}@${USER_DOMAIN}`; };
const displayLogin = email => String(email||"").endsWith("@"+USER_DOMAIN) ? email.split("@")[0] : (email||"");
const isUsernameAcct = email => String(email||"").endsWith("@"+USER_DOMAIN);

export function terbilang(n){
  const s=["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
  n=Math.floor(Math.abs(n));
  const t=x=>{
    if(x<12) return s[x];
    if(x<20) return t(x-10)+" belas";
    if(x<100) return t(Math.floor(x/10))+" puluh"+(x%10?" "+t(x%10):"");
    if(x<200) return "seratus"+(x-100?" "+t(x-100):"");
    if(x<1000) return t(Math.floor(x/100))+" ratus"+(x%100?" "+t(x%100):"");
    if(x<2000) return "seribu"+(x-1000?" "+t(x-1000):"");
    if(x<1e6) return t(Math.floor(x/1000))+" ribu"+(x%1000?" "+t(x%1000):"");
    if(x<1e9) return t(Math.floor(x/1e6))+" juta"+(x%1e6?" "+t(x%1e6):"");
    if(x<1e12) return t(Math.floor(x/1e9))+" miliar"+(x%1e9?" "+t(x%1e9):"");
    return t(Math.floor(x/1e12))+" triliun"+(x%1e12?" "+t(x%1e12):"");
  };
  const w = n===0 ? "nol" : t(n);
  return w.charAt(0).toUpperCase()+w.slice(1)+" rupiah";
}

function errText(e){
  const c = (e && e.code) || "";
  const map = {
    "permission-denied":"Anda tidak punya izin untuk tindakan ini. Hubungi owner.",
    "auth/invalid-credential":"Username/email atau password salah.",
    "auth/wrong-password":"Username/email atau password salah.",
    "auth/user-not-found":"Username/email atau password salah.",
    "auth/invalid-email":"Username atau email tidak valid.",
    "auth/too-many-requests":"Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.",
    "auth/email-already-in-use":"Username ini sudah dipakai. Pilih username lain.",
    "auth/weak-password":"Password minimal 6 karakter.",
    "auth/requires-recent-login":"Demi keamanan, keluar lalu masuk lagi sebelum mengubah password.",
    "auth/network-request-failed":"Tidak ada koneksi internet.",
    "unavailable":"Tidak ada koneksi ke server. Periksa internet lalu coba lagi.",
    "resource-exhausted":"Kuota Firebase habis untuk hari ini. Coba lagi besok.",
  };
  if(map[c]) return map[c];
  if(e instanceof Error && !c) return e.message;
  return "Terjadi kesalahan ("+(c||"tidak diketahui")+"). Coba lagi.";
}

let toastTimer;
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.hidden=true},3400);
}
function showErr(id,msg){ const e=$(id); if(!e) return; e.textContent=msg||""; e.hidden=!msg; }
function downloadBlob(filename, blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}

const I = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5.3 1.9A3 3 0 0 1 12 14a3 3 0 0 1-2.7-1.1A3 3 0 0 1 4 11z"/><path d="M5 14v6h14v-6"/></svg>',
  tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>'
};

/* ================= state ================= */
const S = {
  user:null, role:null, profile:null,
  branches:[], tx:[], users:[], cats:{in:[],out:[]}, logs:[],
  bReady:false, tReady:false, uReady:false, cReady:false, lReady:false,
  view:"login", detailId:null, month: todayJkt().slice(0,7), formType:"out", busy:false, kwTx:null, fatal:null,
  logo:null, logFilter:"", installEvt:null, logErr:null
};
let unsubs=[], logsUnsub=null, justLoggedIn=false, shellFor=null;
function stopAll(){ unsubs.forEach(u=>{try{u()}catch(e){}}); unsubs=[]; logsUnsub=null; }

const branchById = id => S.branches.find(b=>b.id===id);
const txOf = bid => S.tx.filter(t=>t.branchId===bid);
function sums(list, month){
  let saldo=0, inM=0, outM=0, n=0;
  for(const t of list){
    const a=+t.amount||0; saldo += t.type==="in"?a:-a;
    if(month && String(t.date).startsWith(month)){ n++; if(t.type==="in") inM+=a; else outM+=a; }
  }
  return {saldo,inM,outM,n};
}
const sortTx = (a,b)=> (a.date<b.date?-1:a.date>b.date?1:(a.createdAt||0)-(b.createdAt||0));
function actorName(){ return S.role==="owner" ? "Owner" : (S.profile?.name || displayLogin(S.user?.email)); }

async function logAct(action, detail, branchId){
  if(!S.user) return;
  try{
    await addDoc(collection(db,"logs"),{
      at:Date.now(), uid:S.user.uid, actor:actorName(), role:S.role||"",
      branchId: branchId!==undefined ? branchId : (S.role==="cabang" ? S.profile?.branchId||null : null),
      action, detail:detail||""
    });
  }catch(e){ /* log gagal tidak menghentikan pekerjaan */ }
}

/* ================= logo ================= */
function logoHtml(cls){
  return S.logo && S.logo.dataUrl
    ? `<img class="${cls}" src="${S.logo.dataUrl}" alt="Logo Aceh Mandiri Utama">`
    : `<span class="${cls} logo-default" aria-label="Logo Aceh Mandiri Utama">AMU</span>`;
}
function paintLogos(){
  document.querySelectorAll("[data-logo]").forEach(el=>{ el.innerHTML=logoHtml(el.dataset.logo); });
  const fav=$("#favicon");
  if(fav) fav.href = S.logo && S.logo.dataUrl ? S.logo.dataUrl : fav.dataset.default;
}
onSnapshot(doc(db,"settings","app"), d=>{
  const data=d.exists()?d.data():null;
  S.logo = data && data.logo && data.logo.dataUrl ? data.logo : null;
  paintLogos();
}, ()=>{});

async function readLogo(file){
  if(!file) return null;
  if(!file.type.startsWith("image/")) throw new Error("Logo harus berupa gambar (PNG, JPG, SVG, atau WEBP).");
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error("Gambar tidak bisa dibaca.")); i.src=url;});
    const iw=img.naturalWidth||512, ih=img.naturalHeight||512;
    const sc=Math.min(1,512/Math.max(iw,ih));
    const w=Math.max(1,Math.round(iw*sc)), h=Math.max(1,Math.round(ih*sc));
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    const g=c.getContext("2d"); g.drawImage(img,0,0,w,h);
    let d=c.toDataURL("image/png"), mime="image/png";
    if(d.length>500000){
      g.globalCompositeOperation="destination-over"; g.fillStyle="#fff"; g.fillRect(0,0,w,h);
      d=c.toDataURL("image/jpeg",0.85); mime="image/jpeg";
    }
    if(d.length>800000) throw new Error("Logo terlalu besar. Pakai gambar yang lebih kecil.");
    return {dataUrl:d,mime,w,h};
  } finally { URL.revokeObjectURL(url); }
}
async function saveLogo(input){
  const file=input.files[0]; if(!file) return;
  showErr("#logo-err","");
  try{
    const logo=await readLogo(file);
    await setDoc(doc(db,"settings","app"),{logo,updatedAt:Date.now()},{merge:true});
    toast("Logo diperbarui"); logAct("Ganti logo","Logo perusahaan diperbarui",null);
  }catch(err){ showErr("#logo-err",errText(err)); }
  finally{ input.value=""; }
}

/* ================= auth flow ================= */
onAuthStateChanged(auth, async user=>{
  stopAll(); shellFor=null;
  Object.assign(S,{user,role:null,profile:null,branches:[],tx:[],users:[],cats:{in:[],out:[]},logs:[],
    bReady:false,tReady:false,uReady:false,cReady:false,lReady:false,fatal:null,logErr:null});
  closeModal();
  if(!user){ S.view="login"; renderView(); return; }
  renderView();
  const fail = e => { S.fatal = errText(e); stopAll(); renderView(); };
  const catsSub = () => onSnapshot(doc(db,"settings","categories"), async d=>{
    if(!d.exists()){
      if(S.role==="owner"){ try{ await setDoc(doc(db,"settings","categories"),{...DEFAULT_CATS,updatedAt:Date.now()}); }catch(e){} }
      S.cats={in:[],out:[]};
    } else {
      const x=d.data(); S.cats={in:Array.isArray(x.in)?x.in:[], out:Array.isArray(x.out)?x.out:[]};
    }
    S.cReady=true; onData();
  }, fail);

  if(isOwnerEmail(user.email)){
    S.role="owner"; S.view="dash";
    unsubs.push(onSnapshot(collection(db,"branches"), snap=>{
      S.branches=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
      S.bReady=true; onData();
    }, fail));
    unsubs.push(onSnapshot(collection(db,"tx"), snap=>{ S.tx=snap.docs.map(d=>({id:d.id,...d.data()})); S.tReady=true; onData(); }, fail));
    unsubs.push(onSnapshot(collection(db,"users"), snap=>{ S.users=snap.docs.map(d=>({id:d.id,...d.data()})); S.uReady=true; onData(); }, fail));
    unsubs.push(catsSub());
    if(justLoggedIn){ justLoggedIn=false; logAct("Masuk","Owner masuk ke aplikasi",null); }
    return;
  }

  try{
    const p = await getDoc(doc(db,"users",user.uid));
    if(!p.exists() || p.data().role!=="cabang"){ S.fatal="Akun ini belum didaftarkan ke cabang mana pun. Minta owner mendaftarkan login Anda di menu Cabang."; renderView(); return; }
    S.profile={id:p.id,...p.data()};
    if(S.profile.active===false){ S.fatal="Login kasir ini sedang dinonaktifkan. Hubungi owner."; renderView(); return; }
    S.role="cabang"; S.view="branch"; S.uReady=true;
    const bid=S.profile.branchId;
    unsubs.push(onSnapshot(doc(db,"users",user.uid), d=>{
      if(!d.exists() || d.data().active===false){ S.fatal="Login kasir ini dinonaktifkan. Hubungi owner."; stopAll(); renderView(); }
      else S.profile={id:d.id,...d.data()};
    }, fail));
    unsubs.push(onSnapshot(doc(db,"branches",bid), d=>{
      if(!d.exists() || d.data().active===false){ S.fatal="Cabang Anda sedang tidak aktif. Hubungi owner."; stopAll(); renderView(); return; }
      S.branches=[{id:d.id,...d.data()}]; S.bReady=true; onData();
    }, fail));
    unsubs.push(onSnapshot(query(collection(db,"tx"),where("branchId","==",bid)), snap=>{
      S.tx=snap.docs.map(d=>({id:d.id,...d.data()})); S.tReady=true; onData();
    }, fail));
    unsubs.push(catsSub());
    if(justLoggedIn){ justLoggedIn=false; logAct("Masuk","Kasir masuk ke aplikasi"); }
  }catch(e){ fail(e); }
});

const allReady = () => S.bReady && S.tReady && S.uReady && S.cReady;
function onData(){
  if(!allReady()) return;
  const key=S.user?.uid+S.role;
  if(shellFor!==key){ shellFor=key; renderView(); return; }
  fill();
}

function ensureLogs(){
  if(logsUnsub || S.role!=="owner") return;
  logsUnsub = onSnapshot(query(collection(db,"logs"),orderBy("at","desc"),limit(300)), snap=>{
    S.logs=snap.docs.map(d=>({id:d.id,...d.data()})); S.lReady=true; S.logErr=null;
    if(S.view==="aktivitas") fill();
  }, e=>{ S.logErr=errText(e); S.lReady=true; if(S.view==="aktivitas") fill(); });
  unsubs.push(logsUnsub);
}

/* ================= top bar ================= */
function renderTop(){
  const onAuth = !S.user || !!S.fatal;
  document.querySelector(".topbar").hidden = onAuth;
  document.body.classList.toggle("is-auth", onAuth);
  document.body.classList.toggle("has-tabs", S.role==="owner" && !onAuth);
  if(onAuth){ $("#topbar").innerHTML=""; return; }
  let who="", tabs="";
  if(S.role==="owner"){
    who=`<span class="who">Owner</span>`;
    const items=[["dash","Ringkasan",I.home],["kelola","Cabang",I.store],["kategori","Kategori",I.tag],["aktivitas","Aktivitas",I.clock],["pengaturan","Pengaturan",I.gear]];
    const cur = S.view==="cabang" ? "dash" : S.view;
    tabs=`<nav class="tabs" aria-label="Menu owner">${items.map(([v,l,ic])=>`<button data-go="${v}" class="${cur===v?"on":""}" ${cur===v?'aria-current="page"':""}>${ic}<span>${l}</span></button>`).join("")}</nav>`;
  } else if(S.role==="cabang"){
    const b=branchById(S.profile?.branchId);
    who=`<span class="who">${esc(b?b.name:"Cabang")}</span>`;
  }
  const nm=actorName();
  $("#topbar").innerHTML = `<div class="brand"><span data-logo="brand-logo">${logoHtml("brand-logo")}</span><span class="brand-name">Kas AMU</span>${who}</div>
    ${tabs}
    <button class="acct" id="acct" aria-label="Akun saya"><span class="av">${esc((nm||"?").charAt(0).toUpperCase())}</span><span class="acct-name">${esc(nm)}</span></button>`;
}

/* ================= views ================= */
function exportButtons(scope){
  return `<div class="exp" role="group" aria-label="Unduh laporan"><span class="exp-l">Unduh</span><button class="btn sm" data-export="xlsx" data-scope="${scope}">Excel</button><button class="btn sm" data-export="pdf" data-scope="${scope}">PDF</button></div>`;
}
function monthPicker(){ return `<label class="month" for="month">Bulan <input type="month" id="month" value="${S.month}"></label>`; }

function txForm(withBranch){
  return `<form id="tx-form" data-wb="${withBranch?1:0}" novalidate>
    <div class="seg" role="group" aria-label="Jenis transaksi">
      <button type="button" data-type="in">↓ Uang masuk</button><button type="button" data-type="out">↑ Uang keluar</button>
    </div>
    ${withBranch?`<label for="f-branch">Cabang<select id="f-branch"></select></label>`:""}
    <label for="f-cat"><span><b class="step">1</b> Kategori</span><select id="f-cat"></select></label>
    <p class="hint" id="f-cat-hint" hidden>Belum ada kategori untuk jenis ini. ${S.role==="owner"?`Tambahkan di menu <button class="link" type="button" data-go="kategori">Kategori</button>.`:"Minta owner menambahkan kategori."}</p>
    <label for="f-amount"><span><b class="step">2</b> Nominal (Rp)</span><input id="f-amount" class="amount-in" inputmode="numeric" autocomplete="off" placeholder="0"></label>
    <label for="f-desc"><span><b class="step">3</b> Keterangan / catatan</span><textarea id="f-desc" rows="2" maxlength="500" placeholder="mis. Bayar listrik kantor bulan September"></textarea></label>
    <div class="row2">
      <label for="f-date">Tanggal<input type="date" id="f-date" value="${todayJkt()}"></label>
      <label for="f-party"><span id="f-party-lbl">Dibayar kepada</span><input id="f-party" placeholder="Opsional"></label>
    </div>
    <p class="err" id="f-err" hidden></p>
    <button class="btn primary btn-block" id="f-submit" type="submit">Simpan uang keluar</button>
  </form>`;
}

function authPage(){
  const formSide = S.fatal
    ? `<p class="eyebrow">Akses belum tersedia</p><h1>Belum bisa membuka buku kas</h1>
       <p class="lede">${esc(S.fatal)}</p>
       <button class="btn" id="logout" style="justify-self:start">Keluar dan masuk dengan akun lain</button>`
    : `<p class="eyebrow">Buku kas perusahaan</p><h1>Masuk ke akun Anda</h1>
       <p class="lede">Kasir masuk dengan username dari owner. Owner masuk dengan email.</p>
       <form id="login-form" novalidate>
         <label for="login-id">Username atau email<input id="login-id" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="mis. kasir.bandaaceh"></label>
         <label for="login-pw">Password<input id="login-pw" type="password" autocomplete="current-password"></label>
         <p class="err" id="login-err" hidden></p>
         <button class="btn primary btn-block" type="submit" id="login-btn">Masuk</button>
         <button class="link" type="button" id="forgot" style="justify-self:start">Lupa password?</button>
       </form>
       <button class="btn ghost sm" data-install ${S.installEvt?"":"hidden"} style="justify-self:start">Pasang aplikasi di perangkat ini</button>
       <p class="hint">Versi ${APP_VERSION}</p>`;
  return `<section class="auth">
    <div class="auth-form"><div class="auth-form-in">${formSide}</div></div>
    <aside class="auth-brand" aria-label="Aceh Mandiri Utama">
      <div class="logo-tile"><span data-logo="logo-big">${logoHtml("logo-big")}</span></div>
      <div class="auth-brand-text"><h2>Aceh Mandiri Utama</h2><p>Kas masuk dan keluar seluruh cabang, tercatat rapi dalam satu buku.</p></div>
      <ul class="auth-points"><li>Buku kas per cabang dengan saldo berjalan</li><li>Kwitansi PDF lengkap dengan terbilang</li><li>Owner memantau semua cabang sekaligus</li></ul>
    </aside></section>`;
}

function renderView(){
  renderTop();
  const appEl=$("#app");
  if(S.fatal || !S.user){ appEl.innerHTML = authPage(); return; }
  if(!allReady()){ appEl.innerHTML=`<div class="loading"><span class="spinner"></span>Memuat buku kas…</div>`; return; }

  if(S.role==="owner" && S.view==="dash"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Semua cabang</p><h1>Ringkasan kas</h1></div><div class="head-tools">${monthPicker()}${exportButtons("all")}</div></div>
      <div id="stats" class="stats"></div>
      <div id="insights" class="insights"></div>
      <div class="sec-head"><h2>Cabang</h2><button class="btn sm" data-go="kelola">Kelola cabang</button></div>
      <div id="cards" class="cards"></div>
      <div class="split">
        <div class="panel"><h2>Catat transaksi</h2>${txForm(true)}</div>
        <div class="panel"><h2>Transaksi terbaru</h2><div id="recent" class="recent"></div></div>
      </div>`;
  }
  else if(S.role==="owner" && S.view==="kelola"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Cabang dan login kasir</h1></div></div>
      <div class="split">
        <div class="panel"><h2>Tambah cabang</h2>
          <form id="branch-form" novalidate>
            <label for="b-name">Nama cabang<input id="b-name" placeholder="mis. Banda Aceh"></label>
            <label for="b-addr">Alamat<input id="b-addr" placeholder="mis. Jl. Medan–Banda Aceh No. 12"></label>
            <label for="b-kota">Kota / kabupaten (dipakai di kwitansi)<input id="b-kota" placeholder="mis. Pantonlabu"></label>
            <fieldset class="fs"><legend>Login kasir cabang</legend>
              <label for="b-staff">Nama kasir<input id="b-staff" placeholder="mis. Rahmat"></label>
              <label for="b-user">Username<input id="b-user" autocapitalize="none" spellcheck="false" placeholder="mis. kasir.bandaaceh"></label>
              <label for="b-pw">Password awal<input id="b-pw" type="text" autocomplete="new-password" placeholder="Minimal 6 karakter"></label>
              <p class="hint">Username: huruf kecil, angka, titik, strip; 3–30 karakter. Kasir bisa mengganti password sendiri setelah masuk.</p>
            </fieldset>
            <p class="err" id="b-err" hidden></p>
            <button class="btn primary btn-block" type="submit" id="b-submit">Tambah cabang dan login</button>
          </form>
        </div>
        <div class="panel"><h2>Daftar cabang</h2><div id="manage-list" class="mlist"></div></div>
      </div>`;
  }
  else if(S.role==="owner" && S.view==="kategori"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Kategori transaksi</h1></div></div>
      <p class="muted" style="max-width:62ch">Kasir hanya bisa memilih kategori dari daftar ini. Menghapus kategori tidak mengubah transaksi yang sudah tercatat.</p>
      <div class="split even">
        ${["in","out"].map(t=>`<div class="panel"><h2 class="${t==="in"?"t-in":"t-out"}">${t==="in"?"↓ Kategori uang masuk":"↑ Kategori uang keluar"}</h2>
          <div id="cats-${t}" class="chips"></div>
          <form class="cat-form" data-cattype="${t}" novalidate><input name="cat" maxlength="40" placeholder="Nama kategori baru" aria-label="Kategori baru ${t==="in"?"uang masuk":"uang keluar"}"><button class="btn primary" type="submit">Tambah</button></form>
        </div>`).join("")}
      </div>`;
  }
  else if(S.role==="owner" && S.view==="aktivitas"){
    ensureLogs();
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Log aktivitas</h1></div>
        <label class="month" for="log-filter">Tampilkan <select id="log-filter"><option value="">Semua</option><option value="owner">Owner</option>${S.branches.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("")}</select></label></div>
      <div class="panel"><div id="logs" class="logs"></div><p class="hint">Menampilkan 300 aktivitas terakhir.</p></div>`;
    $("#log-filter").value=S.logFilter;
  }
  else if(S.role==="owner" && S.view==="pengaturan"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Pengaturan</h1></div></div>
      <div class="split even">
        <div class="panel">
          <h2>Logo perusahaan</h2>
          <p class="hint">Tampil di halaman masuk, bilah atas, dan kwitansi PDF. PNG berlatar transparan hasilnya paling rapi.</p>
          <div class="logo-preview"><div class="logo-tile sm"><span data-logo="logo-big">${logoHtml("logo-big")}</span></div></div>
          <label for="logo-file">Pilih gambar logo baru<input type="file" id="logo-file" accept="image/*"></label>
          <p class="err" id="logo-err" hidden></p>
          <button class="btn sm" id="logo-reset" style="justify-self:start">Pakai logo bawaan</button>
        </div>
        <div class="panel">
          <h2>Aplikasi</h2>
          <dl class="kv"><dt>Versi</dt><dd class="num">${APP_VERSION}</dd><dt>Proyek</dt><dd>${esc(firebaseConfig.projectId)}</dd></dl>
          <button class="btn primary" data-install ${S.installEvt?"":"hidden"} style="justify-self:start">Pasang di perangkat ini</button>
          <p class="hint">Android (Chrome): menu ⋮ → <b>Instal aplikasi</b>. iPhone (Safari): tombol Bagikan → <b>Tambah ke Layar Utama</b>. Setelah dipasang, aplikasi terbuka layar penuh seperti aplikasi biasa.</p>
        </div>
      </div>`;
  }
  else {
    const ownerDetail = S.role==="owner";
    appEl.innerHTML = `<div class="sec-head"><div style="display:grid;gap:4px">
        ${ownerDetail?`<button class="link" data-go="dash" style="justify-self:start">← Semua cabang</button>`:""}
        <p class="eyebrow">Buku kas cabang</p><h1 id="hdr-branch"></h1></div><div class="head-tools">${monthPicker()}${exportButtons("branch")}</div></div>
      <div id="stats" class="stats"></div>
      <div id="insights" class="insights"></div>
      <div class="split">
        <div class="panel"><h2>Catat transaksi</h2>${txForm(false)}</div>
        <div class="panel"><div class="panel-head"><h2>Buku kas <span class="muted" id="ledger-month" style="font-weight:500"></span></h2><span class="hint">Unduh laporan lewat tombol Excel / PDF di atas</span></div><div id="ledger"></div></div>
      </div>`;
  }
  setType(S.formType);
  fill();
}

function currentBranchId(){
  if(S.role==="cabang") return S.profile?.branchId;
  if(S.role==="owner" && S.view==="cabang") return S.detailId;
  return null;
}
const drillAttr = (spec,title) => { const b=currentBranchId(); return `data-drill="${esc(JSON.stringify(b?{...spec,b}:spec))}" data-title="${esc(title)}"`; };

function statsHtml(scope){
  const s=sums(scope,S.month), diff=s.inM-s.outM, mm=fmtMonth(S.month);
  return `
    <button class="stat lead" ${drillAttr({}, "Semua transaksi")}><span class="l">Saldo kas saat ini</span><span class="v">${sgnRp(s.saldo)}</span><span class="go">Lihat semua transaksi →</span></button>
    <button class="stat" ${drillAttr({m:S.month,t:"in"}, "Uang masuk · "+mm)}><span class="l">↓ Masuk<span class="lm"> · ${esc(mm)}</span></span><span class="v in">${rp(s.inM)}</span><span class="go">Rincian →</span></button>
    <button class="stat" ${drillAttr({m:S.month,t:"out"}, "Uang keluar · "+mm)}><span class="l">↑ Keluar<span class="lm"> · ${esc(mm)}</span></span><span class="v out">${rp(s.outM)}</span><span class="go">Rincian →</span></button>
    <button class="stat" ${drillAttr({m:S.month}, "Semua transaksi · "+mm)}><span class="l">Selisih · ${s.n} transaksi</span><span class="v ${diff<0?"out":""}">${sgnRp(diff)}</span><span class="go">Rincian →</span></button>`;
}

function insightsHtml(scope){
  const m=S.month, pm=prevMonth(m), mm=fmtMonth(m), pmm=fmtMonth(pm);
  const cur=sums(scope,m), prev=sums(scope,pm);
  const monthTx=scope.filter(t=>String(t.date).startsWith(m));
  // arus kas harian
  const nd=daysIn(m), din=Array(nd).fill(0), dout=Array(nd).fill(0);
  for(const t of monthTx){ const i=+String(t.date).slice(8,10)-1; if(i>=0&&i<nd) (t.type==="in"?din:dout)[i]+=+t.amount||0; }
  const max=Math.max(1,...din,...dout);
  const W=640, H=190, top=18, base=160, ph=base-top, slot=(W-16)/nd, bw=Math.max(2,slot*0.34);
  let bars="";
  for(let i=0;i<nd;i++){
    const x=8+i*slot, day=`${m}-${String(i+1).padStart(2,"0")}`;
    const hi=din[i]?Math.max(2,din[i]/max*ph):0, ho=dout[i]?Math.max(2,dout[i]/max*ph):0;
    const has=din[i]||dout[i];
    bars+=`<g class="day ${has?"has":""}" ${has?drillAttr({d:day},"Transaksi "+fmtDate(day)):""}>
      <rect x="${x.toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${ph+4}" class="hit"></rect>
      ${hi?`<rect x="${(x+slot/2-bw).toFixed(1)}" y="${(base-hi).toFixed(1)}" width="${bw.toFixed(1)}" height="${hi.toFixed(1)}" rx="1.5" class="b-in"></rect>`:""}
      ${ho?`<rect x="${(x+slot/2).toFixed(1)}" y="${(base-ho).toFixed(1)}" width="${bw.toFixed(1)}" height="${ho.toFixed(1)}" rx="1.5" class="b-out"></rect>`:""}
      ${(i===0||(i+1)%5===0)?`<text x="${(x+slot/2).toFixed(1)}" y="${base+18}" text-anchor="middle" class="ax">${i+1}</text>`:""}
    </g>`;
  }
  const chart = monthTx.length
    ? `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Arus kas harian ${esc(mm)}">
        <line x1="8" y1="${top}" x2="${W-8}" y2="${top}" class="grid"></line>
        <line x1="8" y1="${(top+base)/2}" x2="${W-8}" y2="${(top+base)/2}" class="grid"></line>
        <text x="8" y="${top-5}" class="ax">${esc(rpn(max))}</text>
        ${bars}
        <line x1="8" y1="${base}" x2="${W-8}" y2="${base}" class="baseline"></line>
      </svg>`
    : `<div class="empty">Belum ada transaksi di ${esc(mm)}.</div>`;

  const group = type => { const g={}; for(const t of monthTx) if(t.type===type){ const k=t.category||"Tanpa kategori"; g[k]=(g[k]||0)+(+t.amount||0); } return Object.entries(g).sort((a,b)=>b[1]-a[1]); };
  const catList = type => { const arr=group(type); const top1=arr[0]?arr[0][1]:1; const tot=arr.reduce((s,x)=>s+x[1],0)||1;
    return arr.length ? arr.slice(0,6).map(([c,v])=>`<button class="cbar" ${drillAttr({m,t:type,c},c+" · "+mm)}>
        <span class="cn">${esc(c)}</span><span class="cv num">${rpn(v)} <small>${Math.round(v/tot*100)}%</small></span>
        <span class="track"><span class="fill ${type}" style="width:${Math.max(3,v/top1*100).toFixed(1)}%"></span></span></button>`).join("")
      : `<p class="hint">Belum ada ${type==="in"?"pemasukan":"pengeluaran"} di ${esc(mm)}.</p>`; };

  const delta = (a,b,goodUp) => {
    if(!b) return a ? `<span class="delta ${goodUp?"good":"bad"}">baru</span>` : `<span class="delta">—</span>`;
    const p=Math.round((a-b)/b*100); const up=p>0; const good = p===0 ? "" : (up===goodUp ? "good" : "bad");
    return `<span class="delta ${good}">${up?"▲":p<0?"▼":"="} ${Math.abs(p)}%</span>`;
  };
  const big = monthTx.filter(t=>t.type==="out").sort((a,b)=>b.amount-a.amount)[0];
  const showBranch = S.role==="owner" && !currentBranchId();

  return `
    <div class="panel span2"><div class="panel-head"><h2>Arus kas harian</h2><span class="legend"><i class="lg in"></i>Masuk <i class="lg out"></i>Keluar</span></div>
      <div class="chart-wrap">${chart}</div><p class="hint">Ketuk batang untuk melihat transaksi hari itu.</p></div>
    <div class="panel"><h2>Dibanding ${esc(pmm)}</h2>
      <div class="cmp">
        <button class="cmp-i" ${drillAttr({m:pm,t:"in"},"Uang masuk · "+pmm)}><span class="l">Masuk</span><span class="v num t-in">${rpn(cur.inM)}</span>${delta(cur.inM,prev.inM,true)}<span class="hint">lalu ${rpn(prev.inM)}</span></button>
        <button class="cmp-i" ${drillAttr({m:pm,t:"out"},"Uang keluar · "+pmm)}><span class="l">Keluar</span><span class="v num t-out">${rpn(cur.outM)}</span>${delta(cur.outM,prev.outM,false)}<span class="hint">lalu ${rpn(prev.outM)}</span></button>
      </div>
      ${big?`<button class="bigtx" data-kw="${esc(big.id)}"><span class="l">Pengeluaran terbesar bulan ini</span><span class="v num t-out">${rp(big.amount)}</span><span class="hint">${esc(big.category||"")} · ${esc(big.desc||"")}${showBranch&&branchById(big.branchId)?" · "+esc(branchById(big.branchId).name):""}</span></button>`:""}
    </div>
    <div class="panel"><h2>↑ Pengeluaran per kategori</h2><div class="cbars">${catList("out")}</div></div>
    <div class="panel"><h2>↓ Pemasukan per kategori</h2><div class="cbars">${catList("in")}</div></div>`;
}

function fill(){
  if(!allReady()) return;
  if(S.role==="owner" && S.view==="cabang" && !branchById(S.detailId)){ S.view="dash"; renderView(); return; }
  const fb=$("#f-branch");
  if(fb){
    const act=S.branches.filter(b=>b.active!==false); const v=fb.value;
    fb.innerHTML = act.length ? act.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("") : `<option value="">Belum ada cabang</option>`;
    if(act.some(b=>b.id===v)) fb.value=v;
  }
  fillCatSelect();
  const bid=currentBranchId(); const scope = bid ? txOf(bid) : S.tx;
  const st=$("#stats"); if(st) st.innerHTML=statsHtml(scope);
  const ins=$("#insights"); if(ins) ins.innerHTML=insightsHtml(scope);
  const hb=$("#hdr-branch"); if(hb){ const b=branchById(bid); hb.textContent = b? b.name : ""; }
  const lm=$("#ledger-month"); if(lm) lm.textContent="· "+fmtMonth(S.month);

  const cd=$("#cards");
  if(cd){
    cd.innerHTML = !S.branches.length
      ? `<div class="empty" style="grid-column:1/-1">Belum ada cabang. Tambahkan cabang pertama di <button class="link" data-go="kelola">menu Cabang</button>.</div>`
      : S.branches.map(b=>{ const s=sums(txOf(b.id),S.month);
        return `<button class="card" data-open="${esc(b.id)}">
          <div class="card-top"><strong>${esc(b.name)}</strong>${b.active===false?`<span class="pill off">Nonaktif</span>`:`<span class="code">${esc(b.code||"")}</span>`}</div>
          <div><div class="hint">Saldo</div><div class="saldo ${s.saldo<0?"t-out":""}">${sgnRp(s.saldo)}</div></div>
          <div class="mm"><span class="t-in">↓ ${rpn(s.inM)}</span><span class="t-out">↑ ${rpn(s.outM)}</span><span class="muted">${s.n} trx</span></div>
        </button>`; }).join("");
  }
  const rc=$("#recent");
  if(rc){
    const list=[...S.tx].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,12);
    rc.innerHTML = list.length ? list.map(t=>txRow(t,true)).join("") : `<div class="empty">Belum ada transaksi. Catat transaksi pertama lewat formulir di samping.</div>`;
  }
  const lg=$("#ledger"); if(lg) lg.innerHTML = ledgerHtml(bid);
  const ml=$("#manage-list"); if(ml) ml.innerHTML = manageHtml();
  for(const t of ["in","out"]){
    const el=$("#cats-"+t);
    if(el) el.innerHTML = S.cats[t].length
      ? S.cats[t].map((c,i)=>`<span class="chip">${esc(c)}<button type="button" data-catdel="${t}" data-idx="${i}" aria-label="Hapus kategori ${esc(c)}">×</button></span>`).join("")
      : `<p class="hint">Belum ada kategori.</p>`;
  }
  const lgs=$("#logs"); if(lgs) lgs.innerHTML = logsHtml();
}

function fillCatSelect(){
  const sel=$("#f-cat"); if(!sel) return;
  const list=S.cats[S.formType]||[]; const v=sel.value;
  sel.innerHTML = list.length ? `<option value="">Pilih kategori…</option>`+list.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("") : `<option value="">Belum ada kategori</option>`;
  if(list.includes(v)) sel.value=v;
  sel.disabled=!list.length;
  const h=$("#f-cat-hint"); if(h) h.hidden=!!list.length;
  const btn=$("#f-submit"); if(btn && !S.busy) btn.disabled=!list.length;
}

function txRow(t, showBranch){
  const b=branchById(t.branchId);
  return `<button class="rc" data-kw="${esc(t.id)}"><span class="d">${esc(fmtShort(t.date))}</span>
    <span class="t">${esc(t.desc||t.category||"-")}<small>${esc(t.category||"")}${showBranch&&S.role==="owner"?" · "+esc(b?b.name:"Cabang terhapus"):""} · ${esc(t.no||"")}</small></span>
    <span class="a ${t.type==="in"?"t-in":"t-out"}">${t.type==="in"?"+":"−"}${rpn(t.amount)}</span></button>`;
}

function ledgerRows(bid){ return ledgerData(bid,S.month); }
function ledgerData(bid, month){
  const all=txOf(bid).sort(sortTx);
  const start=month+"-01";
  let open=0; for(const t of all){ if(t.date<start) open += t.type==="in"?+t.amount:-t.amount; }
  let bal=open;
  let totIn=0, totOut=0;
  const rows=all.filter(t=>String(t.date).startsWith(month)).map(t=>{ const a=+t.amount||0; if(t.type==="in"){ bal+=a; totIn+=a; } else { bal-=a; totOut+=a; } return {t,bal}; });
  return {open,rows,close:bal,totIn,totOut};
}
function ledgerHtml(bid){
  if(!bid) return "";
  const {open,rows,close}=ledgerRows(bid);
  const owner=S.role==="owner";
  const body = rows.length ? rows.map(({t,bal})=>`<tr>
      <td class="num">${esc(fmtShort(t.date))}</td>
      <td class="num hint">${esc(t.no||"")}</td>
      <td class="desc"><b>${esc(t.desc||"-")}</b><small>${esc(t.category||"")}${t.party?` · ${t.type==="in"?"dari":"kepada"} ${esc(t.party)}`:""}${t.by==="owner"?" · dicatat owner":""}</small></td>
      <td class="r num t-in">${t.type==="in"?rpn(t.amount):""}</td>
      <td class="r num t-out">${t.type==="out"?rpn(t.amount):""}</td>
      <td class="r num">${rpn(bal)}</td>
      <td><div class="acts"><button class="btn ghost sm" data-kw="${esc(t.id)}">Kwitansi</button>${owner?`<button class="btn ghost sm danger" data-del="${esc(t.id)}">Hapus</button>`:""}</div></td>
    </tr>`).join("") : `<tr><td colspan="7" style="text-align:center;padding:26px" class="muted">Belum ada transaksi di bulan ini.</td></tr>`;
  return `<div class="ledger-wrap"><table>
    <thead><tr><th>Tgl</th><th>No.</th><th>Uraian</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th><th></th></tr></thead>
    <tbody><tr class="carry"><td colspan="5">Saldo awal bulan</td><td class="r num">${rpn(open)}</td><td></td></tr>${body}
    <tr class="carry"><td colspan="5">Saldo akhir bulan</td><td class="r num">${rpn(close)}</td><td></td></tr></tbody></table></div>`;
}

function manageHtml(){
  if(!S.branches.length) return `<div class="empty">Belum ada cabang. Isi formulir di samping untuk menambah cabang pertama beserta login kasirnya.</div>`;
  return S.branches.map(b=>{
    const s=sums(txOf(b.id)); const cnt=txOf(b.id).length;
    const staff=S.users.filter(u=>u.branchId===b.id);
    return `<div class="mi">
      <div class="mi-top"><div><strong>${esc(b.name)}</strong> <span class="num hint">${esc(b.code||"")}</span><div class="hint">${esc(addrLine(b))}</div></div>
        <div class="num">${sgnRp(s.saldo)} <span class="hint">· ${cnt} transaksi</span></div></div>
      <div class="mi-inline">
        <button class="btn sm" data-open="${esc(b.id)}">Buka buku kas</button>
        <button class="btn sm" data-editform="${esc(b.id)}">Edit</button>
        <button class="btn sm" data-toggle="${esc(b.id)}">${b.active===false?"Aktifkan":"Nonaktifkan"}</button>
        ${cnt===0&&staff.length===0?`<button class="btn sm danger" data-delbranch="${esc(b.id)}">Hapus</button>`:""}
        ${b.active===false?`<span class="pill off">Nonaktif · kasir tidak bisa masuk</span>`:""}
      </div>
      <form class="edit-form" data-editsave="${esc(b.id)}" hidden novalidate>
        <label>Nama cabang<input name="name" value="${esc(b.name)}"></label>
        <label>Alamat<input name="address" value="${esc(b.address||(!b.kota?b.city||"":""))}"></label>
        <label>Kota / kabupaten (dipakai di kwitansi)<input name="kota" value="${esc(b.kota||"")}" placeholder="mis. Pantonlabu"></label>
        <p class="err" data-editerr hidden></p>
        <div class="mi-inline"><button class="btn sm primary" type="submit">Simpan perubahan</button><button class="btn sm ghost" type="button" data-editform="${esc(b.id)}">Batal</button></div>
      </form>
      <div class="staff">
        <div class="hint" style="font-weight:700">Login kasir</div>
        ${staff.length? staff.map(u=>`<div class="staff-row"><span><b>${esc(u.name)}</b> <span class="hint num">${esc(displayLogin(u.email))}</span>${u.active===false?` <span class="pill off">Nonaktif</span>`:""}</span>
          <span class="mi-inline">${isUsernameAcct(u.email)?"":`<button class="btn ghost sm" data-reset="${esc(u.email)}">Kirim reset password</button>`}<button class="btn ghost sm" data-staff="${esc(u.id)}">${u.active===false?"Aktifkan":"Nonaktifkan"}</button></span></div>`).join("")
          : `<div class="hint">Belum ada login kasir.</div>`}
        <button class="link" data-staffform="${esc(b.id)}" style="justify-self:start">+ Tambah login kasir</button>
        <form class="staff-form" data-staffsave="${esc(b.id)}" hidden novalidate>
          <div class="row3">
            <input name="name" placeholder="Nama kasir" aria-label="Nama kasir">
            <input name="login" placeholder="Username" autocapitalize="none" spellcheck="false" aria-label="Username kasir" autocomplete="off">
            <input name="pw" type="text" placeholder="Password (min. 6)" aria-label="Password awal" autocomplete="new-password">
          </div>
          <p class="err" data-stafferr hidden></p>
          <button class="btn sm primary" type="submit" style="justify-self:start">Buat login</button>
        </form>
      </div>
    </div>`; }).join("");
}

function logsHtml(){
  if(!S.lReady) return `<div class="loading" style="padding:24px 0"><span class="spinner"></span>Memuat aktivitas…</div>`;
  if(S.logErr) return `<p class="err">${esc(S.logErr)}</p>`;
  const f=S.logFilter;
  const list=S.logs.filter(l=> !f ? true : f==="owner" ? l.role==="owner" : l.branchId===f);
  if(!list.length) return `<div class="empty">Belum ada aktivitas${f?" untuk pilihan ini":""}.</div>`;
  return list.map(l=>{ const b=l.branchId?branchById(l.branchId):null;
    return `<div class="log"><span class="lt num">${esc(fmtTime(l.at))}</span>
      <div class="lx"><span><b>${esc(l.actor||"-")}</b> · ${esc(l.action||"")}</span><small>${b?"Cabang "+esc(b.name)+" · ":""}${esc(l.detail||"")}</small></div>
      <span class="pill ${l.role==="owner"?"own":""}">${l.role==="owner"?"Owner":"Kasir"}</span></div>`; }).join("");
}

function setType(type){
  S.formType=type;
  document.querySelectorAll(".seg button").forEach(b=>b.classList.toggle("on",b.dataset.type===type));
  const l=$("#f-party-lbl"); if(l) l.textContent = type==="in"?"Diterima dari":"Dibayar kepada";
  const s=$("#f-submit"); if(s && !S.busy) s.textContent = type==="in"?"Simpan uang masuk":"Simpan uang keluar";
  const f=$("#tx-form"); if(f) f.dataset.type=type;
  fillCatSelect();
}

/* ================= actions ================= */
async function doLogin(e){
  e.preventDefault();
  const id=$("#login-id").value.trim(), pw=$("#login-pw").value;
  if(!id||!pw){ showErr("#login-err","Isi username/email dan password."); return; }
  const btn=$("#login-btn"); btn.disabled=true; btn.textContent="Masuk…";
  try{ justLoggedIn=true; await signInWithEmailAndPassword(auth,toLoginEmail(id),pw); }
  catch(err){ justLoggedIn=false; showErr("#login-err",errText(err)); btn.disabled=false; btn.textContent="Masuk"; }
}
async function forgot(){
  const id=$("#login-id").value.trim();
  if(!id){ showErr("#login-err","Isi email owner dulu, lalu tekan Lupa password."); return; }
  if(!id.includes("@")){ showErr("#login-err","Kasir yang lupa password: minta owner membuatkan login baru di menu Cabang."); return; }
  try{ await sendPasswordResetEmail(auth,id); showErr("#login-err",""); toast("Tautan reset password dikirim ke "+id); }
  catch(err){ showErr("#login-err",errText(err)); }
}

function makeCode(name){
  let base=name.replace(/cabang/i,"").replace(/[^A-Za-z]/g,"").toUpperCase().slice(0,3) || "CBG";
  if(base.length<3) base=(base+"XXX").slice(0,3);
  let code=base, i=2; while(S.branches.some(b=>b.code===code)){ code=base+i; i++; }
  return code;
}
const validUsername = u => /^[a-z0-9._-]{3,30}$/.test(u);

// Membuat login kasir lewat instance Firebase kedua, supaya sesi owner tidak ikut berganti.
async function createStaffLogin(branchId, name, login, pw){
  const email=toLoginEmail(login);
  if(!login.includes("@") && !validUsername(login.toLowerCase())) throw new Error("Username hanya boleh huruf kecil, angka, titik, strip; 3–30 karakter.");
  if(pw.length<6) throw new Error("Password minimal 6 karakter.");
  if(isOwnerEmail(email)) throw new Error("Email owner tidak bisa dipakai sebagai login kasir.");
  const sec=initializeApp(firebaseConfig,"kasir-"+Date.now());
  try{
    const secAuth=initializeAuth(sec,{persistence:inMemoryPersistence});
    const cred=await createUserWithEmailAndPassword(secAuth,email,pw);
    await setDoc(doc(db,"users",cred.user.uid),{name,email,role:"cabang",branchId,active:true,createdAt:Date.now()});
    await signOut(secAuth);
  } finally { deleteApp(sec).catch(()=>{}); }
  const b=branchById(branchId);
  logAct("Buat login kasir",`${name} (${displayLogin(email)})${b?" untuk "+b.name:""}`,branchId);
}

async function addBranch(e){
  e.preventDefault();
  const name=$("#b-name").value.trim(), address=$("#b-addr").value.trim(), kota=$("#b-kota").value.trim();
  const staff=$("#b-staff").value.trim(), login=$("#b-user").value.trim().toLowerCase(), pw=$("#b-pw").value;
  if(!name){ showErr("#b-err","Isi nama cabang."); return; }
  if(S.branches.some(b=>b.name.toLowerCase()===name.toLowerCase())){ showErr("#b-err","Nama cabang ini sudah ada."); return; }
  if(login || pw){
    if(!login.includes("@") && !validUsername(login)){ showErr("#b-err","Username hanya boleh huruf kecil, angka, titik, strip; 3–30 karakter."); return; }
    if(pw.length<6){ showErr("#b-err","Password awal minimal 6 karakter."); return; }
  }
  showErr("#b-err","");
  const btn=$("#b-submit"); btn.disabled=true; btn.textContent="Menyimpan…";
  const ref=doc(collection(db,"branches"));
  try{
    if(!kota){ throw Object.assign(new Error("Isi kota / kabupaten cabang (dipakai di kwitansi)."),{code:""}); }
    await setDoc(ref,{name,address,kota,city:kota,code:makeCode(name),active:true,createdAt:Date.now()});
    logAct("Tambah cabang",name+" · "+[address,kota].filter(Boolean).join(", "),ref.id);
  }catch(err){ showErr("#b-err",errText(err)); btn.disabled=false; btn.textContent="Tambah cabang dan login"; return; }
  try{
    if(login){ await createStaffLogin(ref.id, staff||("Kasir "+name), login, pw); toast(`Cabang ${name} dan login ${displayLogin(toLoginEmail(login))} dibuat`); }
    else toast(`Cabang ${name} ditambahkan. Tambahkan login kasirnya di daftar.`);
    ["#b-name","#b-addr","#b-kota","#b-staff","#b-user","#b-pw"].forEach(s=>{ const el=$(s); if(el) el.value=""; });
  }catch(err){ showErr("#b-err","Cabang dibuat, tetapi login kasir gagal: "+errText(err)+" Tambahkan login lewat daftar cabang."); }
  finally{ btn.disabled=false; btn.textContent="Tambah cabang dan login"; }
}

async function addStaff(form){
  const bid=form.dataset.staffsave;
  const name=form.name.value.trim(), login=form.login.value.trim(), pw=form.pw.value;
  const err=form.querySelector("[data-stafferr]");
  const show=m=>{ err.textContent=m||""; err.hidden=!m; };
  if(!name||!login){ show("Isi nama dan username kasir."); return; }
  show("");
  const btn=form.querySelector("button[type=submit]"); btn.disabled=true; btn.textContent="Membuat login…";
  try{ await createStaffLogin(bid,name,login,pw); toast(`Login ${displayLogin(toLoginEmail(login))} dibuat. Berikan username dan password ke kasir.`); form.reset(); form.hidden=true; }
  catch(e){ show(errText(e)); }
  finally{ btn.disabled=false; btn.textContent="Buat login"; }
}

async function saveTx(e){
  e.preventDefault();
  if(S.busy) return;
  const f=e.target;
  const bid = f.dataset.wb==="1" ? $("#f-branch").value : currentBranchId();
  const b=branchById(bid);
  const category=$("#f-cat").value, amount=+digits($("#f-amount").value), desc=$("#f-desc").value.trim();
  const date=$("#f-date").value, party=$("#f-party").value.trim();
  if(!b){ showErr("#f-err","Pilih cabang dulu."); return; }
  if(!category){ showErr("#f-err","Pilih kategori."); $("#f-cat").focus(); return; }
  if(!amount){ showErr("#f-err","Isi nominal."); $("#f-amount").focus(); return; }
  if(!desc){ showErr("#f-err","Isi keterangan transaksi."); $("#f-desc").focus(); return; }
  if(!date){ showErr("#f-err","Isi tanggal."); return; }
  showErr("#f-err","");
  S.busy=true; const btn=$("#f-submit"); btn.disabled=true; btn.textContent="Menyimpan…";
  try{
    const type=S.formType;
    const seq=S.tx.filter(t=>t.branchId===bid && t.type===type && String(t.date).slice(0,7)===date.slice(0,7)).length+1;
    const no=`${type==="in"?"KM":"KK"}/${b.code||"CBG"}/${date.slice(0,7).replace("-","")}/${String(seq).padStart(3,"0")}`;
    const id=newId();
    const rec={branchId:bid,type,amount,date,category,desc,party,no,by:S.role,createdBy:S.user.uid,createdAt:Date.now()};
    await setDoc(doc(db,"tx",id),rec);
    logAct(type==="in"?"Catat uang masuk":"Catat uang keluar",`${no} · ${category} · ${rp(amount)} · ${desc}`,bid);
    $("#f-amount").value=""; $("#f-desc").value=""; $("#f-party").value=""; $("#f-cat").value="";
    toast(`Tersimpan · ${no}`);
    if(type==="out") openKwitansi({id,...rec});
  }catch(err){ showErr("#f-err",errText(err)); }
  finally{ S.busy=false; btn.disabled=false; setType(S.formType); }
}

async function saveCats(type,list,what){
  try{
    await setDoc(doc(db,"settings","categories"),{[type]:list,updatedAt:Date.now()},{merge:true});
    return true;
  }catch(err){ toast(errText(err)); return false; }
}

async function changePw(e){
  e.preventDefault();
  const oldPw=$("#pw-old").value, n1=$("#pw-new").value, n2=$("#pw-new2").value;
  if(!oldPw||!n1){ showErr("#pw-err","Isi password lama dan password baru."); return; }
  if(n1.length<6){ showErr("#pw-err","Password baru minimal 6 karakter."); return; }
  if(n1!==n2){ showErr("#pw-err","Ulangi password baru dengan sama persis."); return; }
  if(n1===oldPw){ showErr("#pw-err","Password baru harus berbeda dari yang lama."); return; }
  showErr("#pw-err","");
  const btn=$("#pw-btn"); btn.disabled=true; btn.textContent="Menyimpan…";
  try{
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, oldPw));
    await updatePassword(auth.currentUser, n1);
    logAct("Ubah password","Password akun diganti");
    closeModal(); toast("Password berhasil diganti");
  }catch(err){
    const c=err&&err.code;
    showErr("#pw-err", (c==="auth/invalid-credential"||c==="auth/wrong-password") ? "Password lama salah." : errText(err));
    btn.disabled=false; btn.textContent="Simpan password baru";
  }
}

/* ================= modals ================= */
function closeModal(){ const r=$("#modal-root"); if(r) r.innerHTML=""; document.body.classList.remove("modal-open"); }
function openModal(html){
  $("#modal-root").innerHTML=`<div class="overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.classList.add("modal-open");
  const f=$("#modal-root .modal button, #modal-root .modal input"); if(f) f.focus({preventScroll:true});
}
function openAccount(){
  const b=branchById(S.profile?.branchId);
  openModal(`<div class="modal-head"><h2>Akun saya</h2><button class="btn ghost sm" data-close>Tutup</button></div>
    <dl class="kv"><dt>Nama</dt><dd>${esc(actorName())}</dd><dt>Login</dt><dd class="num">${esc(displayLogin(S.user?.email))}</dd>
      ${S.role==="cabang"?`<dt>Cabang</dt><dd>${esc(b?b.name:"-")}</dd>`:""}<dt>Versi aplikasi</dt><dd class="num">${APP_VERSION}</dd></dl>
    <form id="pw-form" novalidate><h3>Ubah password</h3>
      <label for="pw-old">Password lama<input type="password" id="pw-old" autocomplete="current-password"></label>
      <label for="pw-new">Password baru<input type="password" id="pw-new" autocomplete="new-password" placeholder="Minimal 6 karakter"></label>
      <label for="pw-new2">Ulangi password baru<input type="password" id="pw-new2" autocomplete="new-password"></label>
      <p class="err" id="pw-err" hidden></p>
      <button class="btn primary" id="pw-btn" type="submit">Simpan password baru</button>
    </form>
    <button class="btn danger" id="logout">Keluar dari aplikasi</button>`);
}

function openDrill(spec,title){
  const list=S.tx.filter(t=>(!spec.b||t.branchId===spec.b)&&(!spec.m||String(t.date).startsWith(spec.m))&&(!spec.d||t.date===spec.d)&&(!spec.t||t.type===spec.t)&&(!spec.c||(t.category||"Tanpa kategori")===spec.c))
    .sort((a,b)=>-sortTx(a,b));
  let inS=0,outS=0; for(const t of list){ if(t.type==="in") inS+=+t.amount; else outS+=+t.amount; }
  const showBranch = S.role==="owner" && !spec.b;
  openModal(`<div class="modal-head"><h2>${esc(title)}</h2><button class="btn ghost sm" data-close>Tutup</button></div>
    <div class="drill-sum"><span>${list.length} transaksi</span>${inS?`<span class="t-in num">↓ ${rpn(inS)}</span>`:""}${outS?`<span class="t-out num">↑ ${rpn(outS)}</span>`:""}</div>
    <div class="recent drill-list">${list.length? list.slice(0,300).map(t=>txRow(t,showBranch)).join("") : `<div class="empty">Tidak ada transaksi.</div>`}</div>
    ${list.length>300?`<p class="hint">Menampilkan 300 transaksi terbaru.</p>`:""}
    <p class="hint">Ketuk transaksi untuk membuka kwitansinya.</p>`);
}

const kwLabels = t => t.type==="in"
  ? {title:"Kwitansi Penerimaan",party:"Telah terima dari",left:"Penyetor",right:"Kasir"}
  : {title:"Kwitansi Pengeluaran",party:"Dibayarkan kepada",left:"Kasir",right:"Penerima"};
const placeOf = b => (b.kota || String(b.city||"").split(",").pop().trim() || b.name || "").trim();
function addrLine(b){ if(!b) return ""; if(b.kota||b.address) return [b.address,b.kota].filter(Boolean).join(", "); return b.city||""; }

function openKwitansi(t){
  const b=branchById(t.branchId)||{name:"-",city:""};
  const L=kwLabels(t);
  openModal(`
    <div class="kw">
      <div class="kw-top"><div class="kw-co"><span data-logo="kw-logo">${logoHtml("kw-logo")}</span><div><strong>${COMPANY}</strong><span>Cabang ${esc(b.name)}${addrLine(b)?" · "+esc(addrLine(b)):""}</span></div></div>
        <div class="kw-title">${L.title}<span>No. ${esc(t.no)}</span></div></div>
      <dl>
        <dt>${L.party}</dt><dd>${esc(t.party||"-")}</dd>
        <dt>Uang sejumlah</dt><dd class="terbilang">${esc(terbilang(t.amount))}</dd>
        <dt>Untuk pembayaran</dt><dd>${esc(t.desc||"-")}</dd>
        ${t.category?`<dt>Kategori</dt><dd>${esc(t.category)}</dd>`:""}
      </dl>
      <div class="kw-foot"><div class="kw-amt">${rp(t.amount)}</div>
        <div class="kw-sign"><span class="place">${esc(placeOf(b))}, ${esc(fmtDMY(t.date))}</span>
          <span>${L.left}<div class="line">&nbsp;</div></span><span>${L.right}<div class="line">${t.type==="out"?esc(t.party||" "):"&nbsp;"}</div></span></div></div>
    </div>
    <p class="err" id="kw-err" hidden></p>
    <div class="modal-acts">
      <button class="btn" data-close>Tutup</button>
      <button class="btn primary" id="kw-pdf">Unduh PDF kwitansi</button>
    </div>`);
  S.kwTx=t;
}

async function downloadPdf(){
  const t=S.kwTx; if(!t) return;
  if(!window.jspdf){ showErr("#kw-err","Pembuat PDF belum termuat. Periksa koneksi lalu muat ulang halaman."); return; }
  const btn=$("#kw-pdf"); btn.disabled=true; btn.textContent="Menyiapkan PDF…";
  try{
    const b=branchById(t.branchId)||{name:"-",city:""};
    const L=kwLabels(t);
    const pdf=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a5"});
    pdf.setDrawColor(30); pdf.setLineWidth(0.5); pdf.rect(8,8,194,132);
    let hx=14;
    if(S.logo && S.logo.dataUrl){
      try{
        let lh=16, lw=lh*(S.logo.w||1)/(S.logo.h||1); if(lw>34){ lw=34; lh=lw*(S.logo.h||1)/(S.logo.w||1); }
        pdf.addImage(S.logo.dataUrl, S.logo.mime==="image/jpeg"?"JPEG":"PNG", 14, 11+(16-lh)/2, lw, lh);
        hx=14+lw+4;
      }catch(e){}
    }
    pdf.setFont("helvetica","bold"); pdf.setFontSize(14); pdf.setTextColor(20); pdf.text(COMPANY,hx,19);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize("Cabang "+b.name+(addrLine(b)?" - "+addrLine(b):""),120-hx).slice(0,2),hx,24.5);
    pdf.setFont("helvetica","bold"); pdf.setFontSize(12); pdf.text(L.title.toUpperCase(),196,19,{align:"right"});
    pdf.setFont("courier","normal"); pdf.setFontSize(9.5); pdf.text("No. "+t.no,196,24.5,{align:"right"});
    pdf.setLineWidth(0.3); pdf.line(14,30,196,30);
    let y=40;
    const row=(label,val,opts={})=>{
      pdf.setFont("helvetica","normal"); pdf.setFontSize(10); pdf.setTextColor(90); pdf.text(label,14,y); pdf.text(":",56,y);
      pdf.setTextColor(20); pdf.setFont("helvetica",opts.italic?"italic":"normal");
      const lines=pdf.splitTextToSize(val||"-",134).slice(0,opts.max||3);
      if(opts.fill){ pdf.setFillColor(228,246,239); pdf.rect(59,y-4.6,137,lines.length*5+2.6,"F"); }
      pdf.text(lines,61,y); y+=Math.max(9,lines.length*5+4);
    };
    row(L.party,t.party);
    row("Uang sejumlah",terbilang(t.amount),{italic:true,fill:true});
    row("Untuk pembayaran",t.desc);
    if(t.category) row("Kategori",t.category);
    pdf.setLineWidth(0.6); pdf.rect(14,106,70,14);
    pdf.setFont("courier","bold"); pdf.setFontSize(13); pdf.setTextColor(20); pdf.text(rp(t.amount),18,115.5);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.setTextColor(60);
    // Tanda tangan: dua kolom berjarak lebar, ruang tanda tangan ±20 mm
    const xL=110, xR=170;
    pdf.text(placeOf(b)+", "+fmtDMY(t.date),xR,101,{align:"center"});
    pdf.text(L.left+",",xL,107,{align:"center"}); pdf.text(L.right+",",xR,107,{align:"center"});
    pdf.setLineWidth(0.3); pdf.line(xL-21,128,xL+21,128); pdf.line(xR-21,128,xR+21,128);
    if(t.type==="out" && t.party) pdf.text(pdf.splitTextToSize(t.party,40)[0],xR,132.5,{align:"center"});
    pdf.setFontSize(7); pdf.setTextColor(130); pdf.text("Dicatat di Kas Aceh Mandiri Utama",14,136);
    pdf.save(t.no.replace(/\//g,"-")+".pdf");
    logAct("Unduh kwitansi",t.no,t.branchId);
  }catch(e){ showErr("#kw-err","PDF gagal dibuat: "+errText(e)); }
  finally{ btn.disabled=false; btn.textContent="Unduh PDF kwitansi"; }
}

/* ================= ekspor laporan (Excel & PDF) ================= */
function exportTargets(scope){
  if(scope==="branch"){ const b=branchById(currentBranchId()); return b?[b]:[]; }
  return S.role==="owner" ? S.branches.slice() : [];
}
const sheetName = (name, used) => { let n=String(name).replace(/[\\/?*\[\]:]/g,"").slice(0,31)||"Cabang"; let k=n, i=2; while(used.has(k)){ k=(n.slice(0,28)+" "+i); i++; } used.add(k); return k; };

async function exportExcel(scope){
  const list=exportTargets(scope); if(!list.length){ toast("Belum ada cabang untuk dilaporkan."); return; }
  await loadScript(XLSX_URL);
  const X=window.XLSX, m=S.month, wb=X.utils.book_new(), used=new Set();
  const mkSheet=(aoa,widths)=>{ const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=widths.map(w=>({wch:w}));
    for(const k of Object.keys(ws)){ if(k[0]!=="!" && ws[k].t==="n") ws[k].z="#,##0"; } return ws; };
  if(list.length>1){
    const rows=list.map(b=>{ const d=ledgerData(b.id,m); return [b.name, placeOf(b), d.open, d.totIn, d.totOut, d.close, d.rows.length]; });
    const tot=rows.reduce((a,r)=>a.map((v,i)=>i>=2?v+r[i]:v),["Total","",0,0,0,0,0]);
    X.utils.book_append_sheet(wb, mkSheet([[COMPANY],["Rekap kas semua cabang"],["Periode: "+fmtMonth(m)],[],
      ["Cabang","Kota / kabupaten","Saldo awal (Rp)","Masuk (Rp)","Keluar (Rp)","Saldo akhir (Rp)","Jumlah transaksi"], ...rows, tot],
      [22,20,16,16,16,16,16]), sheetName("Rekap",used));
  }
  for(const b of list){
    const d=ledgerData(b.id,m);
    const aoa=[[COMPANY],["Buku kas cabang "+b.name],[addrLine(b)],["Periode: "+fmtMonth(m)],[],
      ["Tanggal","No. bukti","Kategori","Keterangan","Pihak","Masuk (Rp)","Keluar (Rp)","Saldo (Rp)"],
      ["","","","Saldo awal bulan","","","",d.open],
      ...d.rows.map(({t,bal})=>[fmtDMY(t.date),t.no||"",t.category||"",t.desc||"",t.party||"",t.type==="in"?+t.amount:"",t.type==="out"?+t.amount:"",bal]),
      ["","","","Jumlah / saldo akhir","",d.totIn,d.totOut,d.close]];
    X.utils.book_append_sheet(wb, mkSheet(aoa,[12,20,18,42,20,14,14,16]), sheetName(b.name,used));
  }
  const fname = list.length>1 ? `Rekap-Kas-AMU-${m}.xlsx` : `Kas-${list[0].code||"cabang"}-${m}.xlsx`;
  X.writeFile(wb, fname);
  logAct("Unduh laporan Excel", `${list.length>1?"Semua cabang":list[0].name} · ${fmtMonth(m)}`, list.length>1?null:list[0].id);
}

async function exportPdfReport(scope){
  const list=exportTargets(scope); if(!list.length){ toast("Belum ada cabang untuk dilaporkan."); return; }
  if(!window.jspdf) throw new Error("Pembuat PDF belum termuat. Periksa koneksi lalu muat ulang halaman.");
  await loadScript(AUTOTABLE_URL);
  const m=S.month, pdf=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
  const W=210, today=todayJkt();
  const table=opts=>{ if(typeof pdf.autoTable==="function") pdf.autoTable(opts); else if(window.jspdf_autotable) (window.jspdf_autotable.autoTable||window.jspdf_autotable.default)(pdf,opts); else throw new Error("Pustaka tabel PDF tidak tersedia."); };
  const header=(title,sub)=>{
    let hx=14;
    if(S.logo && S.logo.dataUrl){ try{ let lh=13, lw=lh*(S.logo.w||1)/(S.logo.h||1); if(lw>30){ lw=30; lh=lw*(S.logo.h||1)/(S.logo.w||1); }
      pdf.addImage(S.logo.dataUrl,S.logo.mime==="image/jpeg"?"JPEG":"PNG",14,10+(13-lh)/2,lw,lh); hx=14+lw+4; }catch(e){} }
    pdf.setTextColor(20); pdf.setFont("helvetica","bold"); pdf.setFontSize(13); pdf.text(COMPANY,hx,15);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9.5); pdf.setTextColor(70); pdf.text(sub,hx,20.5);
    pdf.setFont("helvetica","bold"); pdf.setFontSize(12); pdf.setTextColor(20); pdf.text(title,W-14,15,{align:"right"});
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9.5); pdf.setTextColor(70); pdf.text("Periode: "+fmtMonth(m),W-14,20.5,{align:"right"});
    pdf.setDrawColor(14,164,125); pdf.setLineWidth(0.6); pdf.line(14,26,W-14,26);
    return 32;
  };
  const base={theme:"grid",styles:{fontSize:8.5,cellPadding:2,lineColor:[212,234,225],lineWidth:0.1,textColor:[20,40,35]},
    headStyles:{fillColor:[14,164,125],textColor:255,fontStyle:"bold"},alternateRowStyles:{fillColor:[246,252,249]},margin:{left:14,right:14,bottom:18}};
  const mark=d=>{ if(d.section==="body" && d.row.raw && d.row.raw._carry){ d.cell.styles.fontStyle="bold"; d.cell.styles.fillColor=[228,245,238]; } };
  const signBlock=(b)=>{
    let y=(pdf.lastAutoTable?pdf.lastAutoTable.finalY:40)+12;
    if(y>297-55){ pdf.addPage(); y=24; }
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9.5); pdf.setTextColor(40);
    const xL=55, xR=155;
    pdf.text(placeOf(b)+", "+fmtDMY(today),xR,y,{align:"center"});
    pdf.text("Dibuat oleh,",xL,y+6,{align:"center"}); pdf.text("Mengetahui,",xR,y+6,{align:"center"});
    pdf.setDrawColor(80); pdf.setLineWidth(0.3); pdf.line(xL-25,y+30,xL+25,y+30); pdf.line(xR-25,y+30,xR+25,y+30);
    pdf.setFontSize(8.5); pdf.setTextColor(90); pdf.text("Kasir cabang",xL,y+35,{align:"center"}); pdf.text("Owner",xR,y+35,{align:"center"});
  };
  const ledgerSection=b=>{
    const d=ledgerData(b.id,m);
    const startY=header("Buku Kas Cabang "+b.name, addrLine(b)||("Cabang "+b.name));
    pdf.setFontSize(9); pdf.setTextColor(40);
    pdf.text(`Saldo awal ${rp(d.open)}   ·   Masuk ${rp(d.totIn)}   ·   Keluar ${rp(d.totOut)}   ·   Saldo akhir ${rp(d.close)}`,14,startY);
    const open=["","","","Saldo awal bulan","","",rpn(d.open)]; open._carry=true;
    const close=["","","","Jumlah / saldo akhir",rpn(d.totIn),rpn(d.totOut),rpn(d.close)]; close._carry=true;
    const body=[open,...d.rows.map(({t,bal})=>[fmtDMY(t.date),t.no||"",t.category||"",(t.desc||"")+(t.party?` (${t.type==="in"?"dari":"kepada"} ${t.party})`:""),t.type==="in"?rpn(t.amount):"",t.type==="out"?rpn(t.amount):"",rpn(bal)]),close];
    table({...base,startY:startY+4,head:[["Tanggal","No. bukti","Kategori","Keterangan","Masuk","Keluar","Saldo"]],body,
      columnStyles:{0:{cellWidth:19},1:{cellWidth:34,fontSize:7.8},2:{cellWidth:23},4:{halign:"right",cellWidth:21},5:{halign:"right",cellWidth:21},6:{halign:"right",cellWidth:23}},
      didParseCell:d2=>{ mark(d2); if(d2.section==="body"){ if(d2.column.index===4) d2.cell.styles.textColor=[15,140,80]; if(d2.column.index===5) d2.cell.styles.textColor=[210,70,50]; } }});
    signBlock(b);
  };
  if(list.length>1){
    const startY=header("Rekap Kas Semua Cabang","Laporan gabungan "+list.length+" cabang");
    let t0=0,t1=0,t2=0,t3=0,tn=0;
    const body=list.map(b=>{ const d=ledgerData(b.id,m); t0+=d.open; t1+=d.totIn; t2+=d.totOut; t3+=d.close; tn+=d.rows.length;
      return [b.name,placeOf(b),rpn(d.open),rpn(d.totIn),rpn(d.totOut),rpn(d.close),String(d.rows.length)]; });
    const tot=["Total","",rpn(t0),rpn(t1),rpn(t2),rpn(t3),String(tn)]; tot._carry=true;
    table({...base,startY,head:[["Cabang","Kota / kab.","Saldo awal","Masuk","Keluar","Saldo akhir","Trx"]],body:[...body,tot],
      columnStyles:{2:{halign:"right"},3:{halign:"right"},4:{halign:"right"},5:{halign:"right"},6:{halign:"right",cellWidth:12}},didParseCell:mark});
    for(const b of list){ pdf.addPage(); ledgerSection(b); }
  } else ledgerSection(list[0]);
  const n=pdf.getNumberOfPages();
  for(let i=1;i<=n;i++){ pdf.setPage(i); pdf.setFont("helvetica","normal"); pdf.setFontSize(7.5); pdf.setTextColor(130);
    pdf.text("Dicetak "+fmtDMY(today)+" · Kas Aceh Mandiri Utama",14,290); pdf.text("Halaman "+i+" dari "+n,W-14,290,{align:"right"}); }
  const fname = list.length>1 ? `Rekap-Kas-AMU-${m}.pdf` : `Kas-${list[0].code||"cabang"}-${m}.pdf`;
  pdf.save(fname);
  logAct("Unduh laporan PDF", `${list.length>1?"Semua cabang":list[0].name} · ${fmtMonth(m)}`, list.length>1?null:list[0].id);
}

async function runExport(btn){
  const kind=btn.dataset.export, scope=btn.dataset.scope;
  const old=btn.textContent; btn.disabled=true; btn.textContent="Menyiapkan…";
  try{ if(kind==="xlsx") await exportExcel(scope); else await exportPdfReport(scope); }
  catch(err){ toast(errText(err)); }
  finally{ btn.disabled=false; btn.textContent=old; }
}

async function saveBranchEdit(form){
  const b=branchById(form.dataset.editsave); if(!b) return;
  const err=form.querySelector("[data-editerr]"); const show=m=>{ err.textContent=m||""; err.hidden=!m; };
  const name=form.name.value.trim(), address=form.address.value.trim(), kota=form.kota.value.trim();
  if(!name){ show("Nama cabang tidak boleh kosong."); return; }
  if(!kota){ show("Isi kota / kabupaten (dipakai di kwitansi)."); return; }
  if(S.branches.some(x=>x.id!==b.id && x.name.toLowerCase()===name.toLowerCase())){ show("Nama cabang ini sudah dipakai cabang lain."); return; }
  show("");
  try{
    await updateDoc(doc(db,"branches",b.id),{name,address,kota,city:kota,updatedAt:Date.now()});
    const changes=[]; if(b.name!==name) changes.push(`nama "${b.name}" → "${name}"`); if((b.address||"")!==address) changes.push("alamat"); if((b.kota||"")!==kota) changes.push(`kota/kab. → ${kota}`);
    logAct("Edit cabang", changes.join(", ")||"Tanpa perubahan", b.id);
    toast("Data cabang disimpan"); form.hidden=true;
  }catch(e){ show(errText(e)); }
}

const armed=new Map();
function arm(btn,key,label){
  if(armed.get(key)){ armed.delete(key); return true; }
  armed.set(key,true); const old=btn.textContent; btn.textContent=label; btn.classList.add("armed");
  setTimeout(()=>{ armed.delete(key); if(btn.isConnected){ btn.textContent=old; btn.classList.remove("armed"); } },3500);
  return false;
}

/* ================= events ================= */
document.addEventListener("click", async e=>{
  const el=e.target.closest("button,[data-drill],.overlay"); if(!el) return;
  if(el.id==="overlay"){ if(e.target===el) closeModal(); return; }
  const d=el.dataset;
  if(el.id==="logout"){ closeModal(); await signOut(auth); return; }
  if(el.id==="acct") return openAccount();
  if(el.id==="forgot") return forgot();
  if(d.install!==undefined){ if(S.installEvt){ S.installEvt.prompt(); S.installEvt=null; document.querySelectorAll("[data-install]").forEach(b=>b.hidden=true); } return; }
  if(d.drill){ try{ openDrill(JSON.parse(d.drill), d.title||"Transaksi"); }catch(err){} return; }
  if(d.go){ if(S.role!=="owner") return; closeModal(); S.view=d.go; window.scrollTo(0,0); return renderView(); }
  if(d.open){ if(S.role!=="owner") return; S.view="cabang"; S.detailId=d.open; window.scrollTo(0,0); return renderView(); }
  if(d.type) return setType(d.type);
  if(d.kw){ const t=S.tx.find(x=>x.id===d.kw); if(t) openKwitansi(t); return; }
  if(el.id==="kw-pdf") return downloadPdf();
  if(d.close!==undefined) return closeModal();
  if(d.export) return runExport(el);
  if(S.role!=="owner") return;
  if(el.id==="logo-reset"){
    try{ await setDoc(doc(db,"settings","app"),{logo:null,updatedAt:Date.now()},{merge:true}); toast("Kembali ke logo bawaan"); logAct("Ganti logo","Kembali ke logo bawaan",null); }catch(err){ toast(errText(err)); }
    return;
  }
  if(d.del){
    if(!arm(el,"del"+d.del,"Yakin hapus?")) return;
    const t=S.tx.find(x=>x.id===d.del);
    try{ await deleteDoc(doc(db,"tx",d.del)); toast("Transaksi dihapus"); if(t) logAct("Hapus transaksi",`${t.no} · ${t.category||""} · ${rp(t.amount)}`,t.branchId); }
    catch(err){ toast(errText(err)); }
    return;
  }
  if(d.toggle){ const b=branchById(d.toggle); if(!b) return;
    try{ await updateDoc(doc(db,"branches",b.id),{active:b.active===false}); toast(b.active===false?"Cabang diaktifkan":"Cabang dinonaktifkan"); logAct(b.active===false?"Aktifkan cabang":"Nonaktifkan cabang",b.name,b.id); }catch(err){ toast(errText(err)); } return; }
  if(d.delbranch){
    if(!arm(el,"db"+d.delbranch,"Yakin hapus cabang?")) return;
    const b=branchById(d.delbranch);
    try{ await deleteDoc(doc(db,"branches",d.delbranch)); toast("Cabang dihapus"); logAct("Hapus cabang",b?b.name:"",null); }catch(err){ toast(errText(err)); } return; }
  if(d.editform){ const f=document.querySelector(`[data-editsave="${CSS.escape(d.editform)}"]`); if(f){ f.hidden=!f.hidden; if(!f.hidden) f.name.focus(); } return; }
  if(d.staffform){ const f=document.querySelector(`[data-staffsave="${CSS.escape(d.staffform)}"]`); if(f){ f.hidden=!f.hidden; if(!f.hidden) f.name.focus(); } return; }
  if(d.staff){ const u=S.users.find(x=>x.id===d.staff); if(!u) return;
    try{ await updateDoc(doc(db,"users",u.id),{active:u.active===false}); toast(u.active===false?"Login kasir diaktifkan":"Login kasir dinonaktifkan"); logAct(u.active===false?"Aktifkan login kasir":"Nonaktifkan login kasir",`${u.name} (${displayLogin(u.email)})`,u.branchId); }catch(err){ toast(errText(err)); } return; }
  if(d.reset){ try{ await sendPasswordResetEmail(auth,d.reset); toast("Tautan reset password dikirim ke "+d.reset); }catch(err){ toast(errText(err)); } return; }
  if(d.catdel){
    const type=d.catdel, idx=+d.idx, name=S.cats[type][idx]; if(name===undefined) return;
    if(!arm(el,"cat"+type+name,"Hapus?")) return;
    const list=S.cats[type].filter((_,i)=>i!==idx);
    if(await saveCats(type,list)){ toast(`Kategori "${name}" dihapus`); logAct("Hapus kategori",`${type==="in"?"Masuk":"Keluar"}: ${name}`,null); }
    return;
  }
});

document.addEventListener("submit", async e=>{
  const f=e.target;
  if(f.id==="login-form") return doLogin(e);
  if(f.id==="branch-form") return addBranch(e);
  if(f.id==="tx-form") return saveTx(e);
  if(f.id==="pw-form") return changePw(e);
  if(f.dataset.staffsave){ e.preventDefault(); return addStaff(f); }
  if(f.dataset.editsave){ e.preventDefault(); if(S.role==="owner") return saveBranchEdit(f); return; }
  if(f.dataset.cattype){
    e.preventDefault();
    const type=f.dataset.cattype, name=f.cat.value.trim().replace(/\s+/g," ");
    if(!name) return;
    if(S.cats[type].some(c=>c.toLowerCase()===name.toLowerCase())){ toast("Kategori itu sudah ada"); return; }
    if(await saveCats(type,[...S.cats[type],name])){ f.reset(); toast(`Kategori "${name}" ditambahkan`); logAct("Tambah kategori",`${type==="in"?"Masuk":"Keluar"}: ${name}`,null); }
  }
});
document.addEventListener("input", e=>{
  if(e.target.id==="f-amount"){ const v=digits(e.target.value); e.target.value = v ? (+v).toLocaleString("id-ID") : ""; }
});
document.addEventListener("change", e=>{
  if(e.target.id==="month" && e.target.value){ S.month=e.target.value; fill(); }
  if(e.target.id==="log-filter"){ S.logFilter=e.target.value; fill(); }
  if(e.target.id==="logo-file" && S.role==="owner") saveLogo(e.target);
});
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

/* ================= versi aplikasi (PWA) ================= */
window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault(); S.installEvt=e;
  document.querySelectorAll("[data-install]").forEach(b=>b.hidden=false);
});
if("serviceWorker" in navigator){
  let updating=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(updating) location.reload(); });
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./sw.js").then(reg=>{
      const offer = w => { const bar=$("#update"); if(!bar) return; bar.hidden=false; bar.onclick=()=>{ updating=true; w.postMessage("skip"); }; };
      if(reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound",()=>{ const nw=reg.installing; if(!nw) return;
        nw.addEventListener("statechange",()=>{ if(nw.state==="installed" && navigator.serviceWorker.controller) offer(nw); }); });
    }).catch(()=>{});
  });
}
