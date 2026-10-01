import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, addDoc, onSnapshot, query, where, orderBy, limit,
  runTransaction, increment, writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import * as CFG from "./firebase-config.js";
const { firebaseConfig, OWNER_EMAIL } = CFG;
const GOOGLE_CLIENT_ID = CFG.GOOGLE_CLIENT_ID || "";

export const APP_VERSION = "4.1.0";
const COMPANY = "PT ACEH MANDIRI UTAMA";
const APP_NAME = "Cashflow Management AMU";
// Logo diambil dari file di repo. Untuk mengganti logo, ganti file logo.jpg (dan ikon di folder icons/) di GitHub.
const LOGO_URL = "logo.jpg";
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
const yesterdayJkt = () => { const d=new Date(todayJkt()+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10); };
const ymKey = date => String(date).slice(0,4)+String(date).slice(5,7);   // "2026-10-01" -> "202610"
const amtField = type => type==="in" ? "inAmt" : "outAmt";
const fmtNo = (type,code,date,seq) => `${type==="in"?"KM":"KK"}/${code||"CBG"}/${ymKey(date)}/${String(seq).padStart(3,"0")}`;
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
    "failed-precondition":"Database belum siap (indeks belum dibuat atau koneksi offline). Owner: lihat bagian Indeks di README.",
    "aborted":"Ada yang menyimpan di saat bersamaan. Coba simpan sekali lagi.",
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
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>'
};

/* ================= state ================= */
const S = {
  user:null, role:null, profile:null,
  branches:[], tx:[], users:[], cats:{in:[],out:[]}, logs:[],
  bReady:false, tReady:false, uReady:false, cReady:false, lReady:false,
  view:"login", detailId:null, month: todayJkt().slice(0,7), formType:"out", busy:false, kwTx:null, fatal:null,
  logo:null, logFilter:"", installEvt:null, logErr:null,
  // Data dimuat per periode: transaksi sejak loadFrom (YYYY-MM); saldo dari ringkasan bulanan (sums)
  loadFrom: (()=>{ const m=todayJkt().slice(0,7); const [y,mo]=m.split("-").map(Number); const d=new Date(y,mo-3,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })(),
  sumsList:[], sReady:false, meta:null, q:"", rebuilding:false
};
let txUnsub=null;
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
// Saldo dari ringkasan bulanan
function balanceAll(bid){ let s=0; for(const x of S.sumsList){ if(!bid||x.branchId===bid) s+=(+x.inAmt||0)-(+x.outAmt||0); } return s; }
function balanceBefore(bid, month){ const k=month.replace("-",""); let s=0; for(const x of S.sumsList){ if((!bid||x.branchId===bid) && String(x.ym)<k) s+=(+x.inAmt||0)-(+x.outAmt||0); } return s; }
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
function logoHtml(cls){ return `<img class="${cls}" src="${LOGO_URL}" alt="Logo PT Aceh Mandiri Utama">`; }
// Logo untuk PDF (dimuat sekali dari file logo.jpg)
async function loadLogoData(){
  if(S.logo) return S.logo;
  try{
    const r=await fetch(LOGO_URL); if(!r.ok) throw new Error("logo");
    const blob=await r.blob();
    const dataUrl=await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(blob); });
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=dataUrl; });
    S.logo={dataUrl,w:img.naturalWidth,h:img.naturalHeight,mime:blob.type==="image/png"?"image/png":"image/jpeg"};
    // Watermark: latar dongker logo dibuat transparan, sisakan gambar logonya
    try{
      const c=document.createElement("canvas"); c.width=img.naturalWidth; c.height=img.naturalHeight;
      const g=c.getContext("2d"); g.drawImage(img,0,0);
      const d=g.getImageData(0,0,c.width,c.height), px=d.data;
      for(let i=0;i<px.length;i+=4){ const r=px[i],gg=px[i+1],b=px[i+2]; const bright=Math.max(r,gg); if(bright<95 && b>=r) px[i+3]=0; else if(bright<135 && b>r+20) px[i+3]=Math.round((bright-95)/40*255); }
      g.putImageData(d,0,0);
      S.wm=c.toDataURL("image/png");
      document.querySelectorAll(".kw-wm").forEach(el=>{ el.src=S.wm; el.hidden=false; });
    }catch(e){ S.wm=null; }
  }catch(e){ S.logo=null; }
  return S.logo;
}
loadLogoData();

/* ================= auth flow ================= */
onAuthStateChanged(auth, async user=>{
  stopAll(); shellFor=null;
  Object.assign(S,{user,role:null,profile:null,branches:[],tx:[],users:[],cats:{in:[],out:[]},logs:[],
    bReady:false,tReady:false,uReady:false,cReady:false,lReady:false,fatal:null,logErr:null,sumsList:[],sReady:false,meta:null,q:""});
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
    subscribeTx(fail);
    unsubs.push(onSnapshot(collection(db,"sums"), snap=>{ S.sumsList=snap.docs.map(d=>({id:d.id,...d.data()})); S.sReady=true; onData(); }, fail));
    unsubs.push(onSnapshot(doc(db,"settings","meta"), d=>{ S.meta=d.exists()?d.data():{}; maybeRebuild(); if(S.view==="dash") fill(); }, ()=>{}));
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
    S.role="cabang"; S.view="input"; S.uReady=true;
    const bid=S.profile.branchId;
    unsubs.push(onSnapshot(doc(db,"users",user.uid), d=>{
      if(!d.exists() || d.data().active===false){ S.fatal="Login kasir ini dinonaktifkan. Hubungi owner."; stopAll(); renderView(); }
      else S.profile={id:d.id,...d.data()};
    }, fail));
    unsubs.push(onSnapshot(doc(db,"branches",bid), d=>{
      if(!d.exists() || d.data().active===false){ S.fatal="Cabang Anda sedang tidak aktif. Hubungi owner."; stopAll(); renderView(); return; }
      S.branches=[{id:d.id,...d.data()}]; S.bReady=true; onData();
    }, fail));
    subscribeTx(fail);
    unsubs.push(onSnapshot(query(collection(db,"sums"),where("branchId","==",bid)), snap=>{ S.sumsList=snap.docs.map(d=>({id:d.id,...d.data()})); S.sReady=true; onData(); }, fail));
    unsubs.push(catsSub());
    if(justLoggedIn){ justLoggedIn=false; logAct("Masuk","Kasir masuk ke aplikasi"); }
  }catch(e){ fail(e); }
});

const allReady = () => S.bReady && S.tReady && S.uReady && S.cReady && S.sReady;
function onData(){
  if(!allReady()) return;
  const key=S.user?.uid+S.role;
  if(shellFor!==key){ shellFor=key; renderView(); setTimeout(flushQueue,500); fillQueueBar(); return; }
  fill();
}

/* ---- muat transaksi per periode ---- */
let txFail=null;
function subscribeTx(fail){
  if(fail) txFail=fail;
  if(txUnsub){ try{ txUnsub(); }catch(e){} }
  const from=S.loadFrom+"-01";
  // Kasir butuh indeks (branchId + date). Jika indeks belum ada/masih dibangun, pakai cara cadangan:
  // ambil transaksi cabang tanpa filter tanggal, lalu saring di HP. Tetap jalan, hanya sedikit lebih boros.
  const bid=S.profile?.branchId||"-";
  const q = S.role==="owner"
    ? query(collection(db,"tx"),where("date",">=",from))
    : S.noIndex ? query(collection(db,"tx"),where("branchId","==",bid))
    : query(collection(db,"tx"),where("branchId","==",bid),where("date",">=",from));
  txUnsub=onSnapshot(q, snap=>{
    S.tx=snap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>S.role==="owner"||!S.noIndex||String(t.date)>=from);
    S.tReady=true; onData(); fillQueueBar();
  }, e=>{
    if(e && e.code==="failed-precondition" && S.role!=="owner" && !S.noIndex){
      console.warn("Indeks Firestore belum siap, memakai cara cadangan.", e.message);
      S.noIndex=true; subscribeTx(); return;
    }
    txFail&&txFail(e);
  });
  unsubs.push(txUnsub);
}
// Pastikan data sejak bulan `ym` (YYYY-MM) sudah dimuat
function ensureLoaded(ym){
  if(!S.user || !ym || ym>=S.loadFrom) return false;
  S.loadFrom=ym; subscribeTx(); toast("Memuat data sejak "+fmtMonth(ym)+"…"); return true;
}
// Owner: bangun ulang ringkasan saldo dari semua transaksi (sekali di awal, atau lewat menu Akun)
async function maybeRebuild(){
  if(S.role!=="owner" || !S.meta || S.meta.sumsBuilt || S.rebuilding) return;
  await rebuildSums(true);
}
async function rebuildSums(auto){
  if(S.role!=="owner" || S.rebuilding) return;
  S.rebuilding=true;
  try{
    if(!auto) toast("Menghitung ulang saldo dari semua transaksi…");
    const snap=await getDocs(collection(db,"tx"));
    const agg={};
    snap.forEach(d=>{ const t=d.data(); if(!t.branchId||!t.date) return; const k=t.branchId+"_"+ymKey(t.date);
      const a=agg[k]||(agg[k]={branchId:t.branchId,ym:ymKey(t.date),inAmt:0,outAmt:0,n:0}); a[amtField(t.type)]+=(+t.amount||0); a.n++; });
    const ops=[];
    for(const [k,v] of Object.entries(agg)) ops.push(["set",k,{...v,rebuiltAt:Date.now()}]);
    for(const x of S.sumsList) if(!agg[x.id]) ops.push(["del",x.id]);
    for(let i=0;i<ops.length;i+=400){
      const b=writeBatch(db);
      for(const [op,k,v] of ops.slice(i,i+400)){ if(op==="set") b.set(doc(db,"sums",k),v); else b.delete(doc(db,"sums",k)); }
      await b.commit();
    }
    await setDoc(doc(db,"settings","meta"),{sumsBuilt:true,sumsBuiltAt:Date.now()},{merge:true});
    if(!auto){ toast("Saldo selesai dihitung ulang"); logAct("Hitung ulang saldo",`${snap.size} transaksi diproses`,null); }
  }catch(e){ toast("Gagal menghitung ulang saldo: "+errText(e)); }
  finally{ S.rebuilding=false; }
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
  document.body.classList.toggle("has-tabs", !!S.role && !onAuth);
  if(onAuth){ $("#topbar").innerHTML=""; return; }
  let who="", items=[];
  if(S.role==="owner"){
    who=`<span class="who">Owner</span>`;
    items=[["dash","Ringkasan",I.home],["input","Input",I.plus],["analisis","Analisis",I.chart],["kelola","Cabang",I.store],["kategori","Kategori",I.tag],["aktivitas","Aktivitas",I.clock]];
  } else if(S.role==="cabang"){
    const b=branchById(S.profile?.branchId);
    who=`<span class="who">${esc(b?b.name:"Cabang")}</span>`;
    items=[["input","Input",I.plus],["buku","Buku kas",I.book],["ringkasan","Ringkasan",I.home]];
  }
  const cur = S.view==="cabang" ? "dash" : S.view;
  const tabs = items.length ? `<nav class="tabs" aria-label="Menu">${items.map(([v,l,ic])=>`<button data-go="${v}" class="${cur===v?"on":""} ${v==="input"?"tab-input":""}" ${cur===v?'aria-current="page"':""}>${ic}<span>${l}</span></button>`).join("")}</nav>` : "";
  const nm=actorName();
  $("#topbar").innerHTML = `<div class="brand">${logoHtml("brand-logo")}<span class="brand-name">Cashflow AMU</span>${who}</div>
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
      <label for="f-date">Tanggal<input type="date" id="f-date" value="${todayJkt()}" ${S.role==="cabang"?`min="${yesterdayJkt()}" max="${todayJkt()}"`:""}></label>
      <label for="f-party"><span><span id="f-party-lbl">Dibayar kepada</span> <b class="req">*wajib</b></span><input id="f-party" placeholder="Nama orang atau toko" required></label>
    </div>
    ${S.role==="cabang"?`<p class="hint">Tanggal hanya bisa hari ini atau kemarin. Transaksi lebih lama dicatat oleh owner.</p>`:""}
    <p class="err" id="f-err" hidden></p>
    <button class="btn primary btn-block" id="f-submit" type="submit">Simpan uang keluar</button>
  </form>`;
}

function authPage(){
  const body = S.fatal
    ? `<p class="lede">${esc(S.fatal)}</p>
       <button class="btn" id="logout" style="justify-self:start">Keluar dan masuk dengan akun lain</button>`
    : `<form id="login-form" novalidate>
         <label for="login-id">Username atau email<input id="login-id" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
         <label for="login-pw">Password<input id="login-pw" type="password" autocomplete="current-password"></label>
         <p class="err" id="login-err" hidden></p>
         <button class="btn primary btn-block" type="submit" id="login-btn">Masuk</button>
         <button class="link" type="button" id="forgot" style="justify-self:center">Lupa password?</button>
       </form>
       <button class="btn ghost sm" data-install ${S.installEvt?"":"hidden"} style="justify-self:center">Pasang aplikasi</button>`;
  return `<section class="auth">
    <div class="auth-form"><div class="auth-form-in">
      <h1 class="app-name">${APP_NAME}</h1>
      ${body}
    </div></div>
    <aside class="auth-brand" aria-label="PT Aceh Mandiri Utama">${logoHtml("auth-logo")}</aside>
  </section>`;
}

function searchBox(){
  return `<div class="search"><input id="q" type="search" value="${esc(S.q)}" autocomplete="off" placeholder="Cari keterangan, no. bukti, kategori, nominal${S.role==="owner"&&!currentBranchId()?", cabang":""}…" aria-label="Cari transaksi">
    <p class="hint">Mencari di data sejak ${esc(fmtMonth(S.loadFrom))}. <button class="link" data-loadall>Muat semua data</button></p>
    <div id="search-results" class="recent" hidden></div></div>`;
}
function renderSearch(){
  const box=$("#search-results"); if(!box) return;
  const q=S.q.trim().toLowerCase(); const recent=$("#recent");
  if(!q){ box.hidden=true; box.innerHTML=""; if(recent) recent.hidden=false; return; }
  if(recent) recent.hidden=true;
  const bid=currentBranchId(); const scope=bid?txOf(bid):S.tx;
  const toks=q.split(/\s+/).filter(Boolean);
  const hits=scope.filter(t=>{
    const b=branchById(t.branchId);
    const hay=[t.desc,t.no,t.category,t.party,b?b.name:"",rpn(t.amount),String(t.amount),fmtDMY(t.date)].join(" ").toLowerCase();
    return toks.every(k=>hay.includes(k) || (/^[\d.]+$/.test(k) && String(t.amount).includes(k.replace(/\./g,""))));
  }).sort((a,b)=>-sortTx(a,b));
  box.hidden=false;
  box.innerHTML = hits.length
    ? `<p class="hint">${hits.length} transaksi ditemukan${hits.length>100?" · menampilkan 100 terbaru":""}</p>`+hits.slice(0,100).map(t=>txRow(t,!bid)).join("")
    : `<div class="empty">Tidak ada transaksi yang cocok dengan “${esc(S.q.trim())}”.</div>`;
}
function headTools(scope){ return `<div class="head-tools">${monthPicker()}${exportButtons(scope)}</div>`; }

function renderView(){
  renderTop();
  const appEl=$("#app");
  if(S.fatal || !S.user){ appEl.innerHTML = authPage(); return; }
  if(!allReady()){ appEl.innerHTML=`<div class="loading"><span class="spinner"></span>Memuat buku kas…</div>`; return; }
  const v=S.view, owner=S.role==="owner";
  const myBranch = !owner ? branchById(S.profile?.branchId) : null;

  if(owner && v==="dash"){
    appEl.innerHTML = `<div id="bk-remind"></div><div class="sec-head"><div><p class="eyebrow">Semua cabang</p><h1>Ringkasan kas</h1></div>${headTools("all")}</div>
      <div id="stats" class="stats"></div>
      <div id="insights" class="insights"></div>
      <div class="sec-head"><h2>Cabang</h2><button class="btn sm" data-go="kelola">Kelola cabang</button></div>
      <div id="cards" class="cards"></div>
      <div class="panel"><div class="panel-head"><h2>Transaksi</h2><button class="btn sm primary" data-go="input">+ Catat transaksi</button></div>${searchBox()}<div id="recent" class="recent"></div></div>`;
  }
  else if(v==="input"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">${owner?"Owner · semua cabang":"Cabang "+esc(myBranch?myBranch.name:"")}</p><h1>Catat transaksi</h1></div></div>
      <div class="input-wrap">
        <div class="panel input-panel">${txForm(owner)}</div>
        <div class="panel"><h2>Terakhir dicatat</h2><div id="recent" class="recent"></div></div>
      </div>`;
  }
  else if(owner && v==="analisis"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner · semua cabang</p><h1>Analisis</h1></div></div>
      <div id="analysis" class="analysis"></div>`;
  }
  else if(owner && v==="kelola"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Cabang dan login kasir</h1></div></div>
      <div class="split">
        <div class="panel"><h2>Tambah cabang</h2>
          <form id="branch-form" novalidate>
            <label for="b-name">Nama cabang<input id="b-name" placeholder="mis. Pantonlabu"></label>
            <label for="b-addr">Alamat<input id="b-addr" placeholder="mis. Jl. Medan–Banda Aceh No. 12"></label>
            <label for="b-kota">Kota / kabupaten (dipakai di kwitansi)<input id="b-kota" placeholder="mis. Pantonlabu"></label>
            <fieldset class="fs"><legend>Login kasir cabang</legend>
              <label for="b-staff">Nama kasir<input id="b-staff" placeholder="mis. Rahmat"></label>
              <label for="b-user">Username<input id="b-user" autocapitalize="none" spellcheck="false" placeholder="mis. kasir.pantonlabu"></label>
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
  else if(owner && v==="kategori"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Kategori transaksi</h1></div></div>
      <p class="muted" style="max-width:62ch">Kasir hanya bisa memilih kategori dari daftar ini. Menghapus kategori tidak mengubah transaksi yang sudah tercatat.</p>
      <div class="split even">
        ${["in","out"].map(t=>`<div class="panel"><h2 class="${t==="in"?"t-in":"t-out"}">${t==="in"?"↓ Kategori uang masuk":"↑ Kategori uang keluar"}</h2>
          <div id="cats-${t}" class="chips"></div>
          <form class="cat-form" data-cattype="${t}" novalidate><input name="cat" maxlength="40" placeholder="Nama kategori baru" aria-label="Kategori baru ${t==="in"?"uang masuk":"uang keluar"}"><button class="btn primary" type="submit">Tambah</button></form>
        </div>`).join("")}
      </div>`;
  }
  else if(owner && v==="aktivitas"){
    ensureLogs();
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Log aktivitas</h1></div>
        <label class="month" for="log-filter">Tampilkan <select id="log-filter"><option value="">Semua</option><option value="owner">Owner</option>${S.branches.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("")}</select></label></div>
      <div class="panel"><div id="logs" class="logs"></div><p class="hint">Menampilkan 300 aktivitas terakhir.</p></div>`;
    $("#log-filter").value=S.logFilter;
  }
  else if(!owner && v==="buku"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Buku kas cabang</p><h1 id="hdr-branch"></h1></div>${headTools("branch")}</div>
      <div class="panel"><h2>Cari transaksi</h2>${searchBox()}</div>
      <div class="panel"><h2>Buku kas <span class="muted" id="ledger-month" style="font-weight:500"></span></h2><div id="ledger"></div></div>`;
  }
  else if(!owner && v==="ringkasan"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Ringkasan cabang</p><h1 id="hdr-branch"></h1></div>${headTools("branch")}</div>
      <div id="stats" class="stats"></div>
      <div id="insights" class="insights"></div>`;
  }
  else {
    // owner: detail satu cabang
    appEl.innerHTML = `<div class="sec-head"><div style="display:grid;gap:4px">
        <button class="link" data-go="dash" style="justify-self:start">← Semua cabang</button>
        <p class="eyebrow">Buku kas cabang</p><h1 id="hdr-branch"></h1></div>${headTools("branch")}</div>
      <div id="stats" class="stats"></div>
      <div id="insights" class="insights"></div>
      <div class="panel"><h2>Cari transaksi di cabang ini</h2>${searchBox()}</div>
      <div class="panel"><div class="panel-head"><h2>Buku kas <span class="muted" id="ledger-month" style="font-weight:500"></span></h2><button class="btn sm primary" data-inputfor="${esc(S.detailId)}">+ Catat untuk cabang ini</button></div><div id="ledger"></div></div>`;
  }
  setType(S.formType);
  fill();
  if(v==="input" && owner && S.inputBranch){ const fb=$("#f-branch"); if(fb && [...fb.options].some(o=>o.value===S.inputBranch)) fb.value=S.inputBranch; }
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
    <button class="stat lead" ${drillAttr({f:S.loadFrom+"-01"}, "Transaksi sejak "+fmtMonth(S.loadFrom))}><span class="l">Saldo kas saat ini</span><span class="v">${sgnRp(balanceAll(currentBranchId()))}</span><span class="go">Lihat transaksi →</span></button>
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
      : S.branches.map(b=>{ const s=sums(txOf(b.id),S.month); s.saldo=balanceAll(b.id);
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
  const an=$("#analysis"); if(an) an.innerHTML = analysisHtml();
  renderSearch();
  const rm=$("#bk-remind");
  if(rm){
    const last=S.meta&&S.meta.lastBackup; const days=last?Math.floor((Date.now()-last)/864e5):null;
    rm.innerHTML = (S.tx.length && (days===null || days>=7)) ? `<div class="remind">${days===null?"Data belum pernah di-backup.":`Backup terakhir ${days} hari lalu.`} <button class="link" data-backup>Backup sekarang</button></div>` : "";
  }
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
  let open=balanceBefore(bid, month);
  let bal=open;
  let totIn=0, totOut=0;
  const rows=all.filter(t=>String(t.date).startsWith(month)).map(t=>{ const a=+t.amount||0; if(t.type==="in"){ bal+=a; totIn+=a; } else { bal-=a; totOut+=a; } return {t,bal}; });
  return {open,rows,close:bal,totIn,totOut};
}
function ledgerHtml(bid){
  if(!bid) return "";
  const {open,rows,close}=ledgerRows(bid);
  const owner=S.role==="owner";
  const body = rows.length ? rows.map(({t,bal})=>`<tr class="${t.type==="in"?"r-in":"r-out"}">
      <td class="num c-date">${esc(fmtShort(t.date))}</td>
      <td class="num hint c-no">${esc(t.no||"")}</td>
      <td class="desc c-desc"><b>${esc(t.desc||"-")}</b><small>${esc(t.category||"")}${t.party?` · ${t.type==="in"?"dari":"kepada"} ${esc(t.party)}`:""}${t.by==="owner"?" · dicatat owner":""}${t.editedAt?" · diedit owner":""}</small></td>
      <td class="r num t-in c-in">${t.type==="in"?rpn(t.amount):""}</td>
      <td class="r num t-out c-out">${t.type==="out"?rpn(t.amount):""}</td>
      <td class="r num c-bal">${rpn(bal)}</td>
      <td class="c-act"><div class="acts"><button class="btn ghost sm" data-kw="${esc(t.id)}">Kwitansi</button>${owner?`<button class="btn ghost sm" data-edit="${esc(t.id)}">Edit</button><button class="btn ghost sm danger" data-del="${esc(t.id)}">Hapus</button>`:""}</div></td>
    </tr>`).join("") : `<tr class="none"><td colspan="7" style="text-align:center;padding:26px" class="muted">Belum ada transaksi di bulan ini.</td></tr>`;
  return `<div class="ledger-wrap"><table>
    <thead><tr><th>Tgl</th><th>No.</th><th>Uraian</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th><th></th></tr></thead>
    <tbody><tr class="carry"><td colspan="5" class="c-label">Saldo awal bulan</td><td class="r num c-bal">${rpn(open)}</td><td class="c-act"></td></tr>${body}
    <tr class="carry"><td colspan="5" class="c-label">Saldo akhir bulan</td><td class="r num c-bal">${rpn(close)}</td><td class="c-act"></td></tr></tbody></table></div>`;
}

function manageHtml(){
  if(!S.branches.length) return `<div class="empty">Belum ada cabang. Isi formulir di samping untuk menambah cabang pertama beserta login kasirnya.</div>`;
  return S.branches.map(b=>{
    const s={saldo:balanceAll(b.id)}; const cnt=S.sumsList.filter(x=>x.branchId===b.id).reduce((a,x)=>a+(+x.n||0),0) || txOf(b.id).length;
    const staff=S.users.filter(u=>u.branchId===b.id && !u.replacedBy);
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
        <div class="warn"><b>Perhatian:</b> nama dan alamat baru langsung tampil di aplikasi, kwitansi, dan laporan berikutnya. Kwitansi yang sudah dicetak atau diunduh tidak ikut berubah, dan nomor bukti tetap memakai kode <b>${esc(b.code||"")}</b>.</div>
        <label>Password owner (wajib, untuk konfirmasi)<input name="ownerpw" type="password" autocomplete="current-password"></label>
        <p class="err" data-editerr hidden></p>
        <div class="mi-inline"><button class="btn sm primary" type="submit">Simpan perubahan</button><button class="btn sm ghost" type="button" data-editform="${esc(b.id)}">Batal</button></div>
      </form>
      <div class="staff">
        <div class="hint" style="font-weight:700">Login kasir</div>
        ${staff.length? staff.map(u=>`<div class="staff-item"><div class="staff-row"><span><b>${esc(u.name)}</b> <span class="hint num">${esc(displayLogin(u.email))}</span>${u.active===false?` <span class="pill off">Nonaktif</span>`:""}</span>
          <span class="mi-inline"><button class="btn ghost sm" data-staffedit="${esc(u.id)}">Edit</button>${isUsernameAcct(u.email)?"":`<button class="btn ghost sm" data-reset="${esc(u.email)}">Kirim reset password</button>`}<button class="btn ghost sm" data-staff="${esc(u.id)}">${u.active===false?"Aktifkan":"Nonaktifkan"}</button></span></div>
          <form class="edit-form" data-staffeditsave="${esc(u.id)}" hidden novalidate>
            <label>Nama kasir<input name="name" value="${esc(u.name)}"></label>
            <label>Username login<input name="login" value="${esc(displayLogin(u.email))}" autocapitalize="none" spellcheck="false" autocomplete="off"></label>
            <label>Password baru kasir (wajib jika username diganti)<input name="pw" type="text" autocomplete="new-password" placeholder="Kosongkan jika hanya mengganti nama"></label>
            <p class="hint">Kasir lupa password? Ganti username-nya (mis. tambahkan angka) dan isi password baru.</p>
            <div class="warn"><b>Perhatian sebelum menyimpan:</b>
              <ul>
                <li>Mengganti <b>nama</b> hanya mengubah nama yang tampil di aplikasi dan log. Login tetap sama.</li>
                <li>Mengganti <b>username atau password</b> membuat login baru. Login lama <b>langsung tidak bisa dipakai</b>, dan kasir yang sedang masuk akan keluar otomatis.</li>
                <li>Berikan username dan password baru ke kasir. Username lama tidak bisa dipakai lagi.</li>
                <li>Transaksi yang sudah dicatat tetap aman dan tidak berubah.</li>
              </ul></div>
            <label>Password owner (wajib, untuk konfirmasi)<input name="ownerpw" type="password" autocomplete="current-password"></label>
            <p class="err" data-staffediterr hidden></p>
            <div class="mi-inline"><button class="btn sm primary" type="submit">Simpan perubahan</button><button class="btn sm ghost" type="button" data-staffedit="${esc(u.id)}">Batal</button></div>
          </form></div>`).join("")
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

// Membuat akun login lewat instance Firebase kedua, supaya sesi owner tidak ikut berganti.
async function createAuthUser(email,pw){
  const sec=initializeApp(firebaseConfig,"kasir-"+Date.now());
  try{
    const secAuth=initializeAuth(sec,{persistence:inMemoryPersistence});
    const cred=await createUserWithEmailAndPassword(secAuth,email,pw);
    await signOut(secAuth);
    return cred.user.uid;
  } finally { deleteApp(sec).catch(()=>{}); }
}
// Konfirmasi password owner sebelum perubahan penting
async function confirmOwner(pw){
  if(!pw) throw new Error("Masukkan password owner untuk konfirmasi.");
  try{ await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw)); }
  catch(e){ const c=e&&e.code; if(c==="auth/invalid-credential"||c==="auth/wrong-password") throw new Error("Password owner salah."); throw e; }
}
async function saveStaffEdit(form){
  const u=S.users.find(x=>x.id===form.dataset.staffeditsave); if(!u) return;
  const err=form.querySelector("[data-staffediterr]"); const show=m=>{ err.textContent=m||""; err.hidden=!m; };
  const name=form.name.value.trim(), login=form.login.value.trim().toLowerCase(), pw=form.pw.value, ownerpw=form.ownerpw.value;
  const oldLogin=displayLogin(u.email).toLowerCase();
  const loginChanged = login!==oldLogin, pwChanged = !!pw, nameChanged = name!==u.name;
  if(!name){ show("Nama kasir tidak boleh kosong."); return; }
  if(!login){ show("Username tidak boleh kosong."); return; }
  if(loginChanged && !login.includes("@") && !validUsername(login)){ show("Username hanya boleh huruf kecil, angka, titik, strip; 3–30 karakter."); return; }
  if(loginChanged && !pw){ show("Username diganti: isi password baru untuk kasir."); return; }
  if(pw && pw.length<6){ show("Password baru kasir minimal 6 karakter."); return; }
  if(!loginChanged && pwChanged){ show("Password kasir tidak bisa diganti tanpa mengganti username. Kasir bisa mengganti password sendiri lewat menu Akun; jika lupa, ganti username-nya lalu isi password baru."); return; }
  if(!loginChanged && !pwChanged && !nameChanged){ show("Belum ada yang diubah."); return; }
  if(!ownerpw){ show("Masukkan password owner untuk konfirmasi."); return; }
  show("");
  const btn=form.querySelector("button[type=submit]"); btn.disabled=true; btn.textContent="Menyimpan…";
  try{
    await confirmOwner(ownerpw);
    if(loginChanged || pwChanged){
      const email=toLoginEmail(login);
      if(isOwnerEmail(email)) throw new Error("Email owner tidak bisa dipakai sebagai login kasir.");
      let newUid;
      if(loginChanged) newUid=await createAuthUser(email,pw);
      else {
        // username sama, password baru: akun lama tidak bisa diubah dari aplikasi, jadi dibuat ulang dengan akhiran
        throw new Error("Untuk mengganti password saja, kasir bisa menggantinya sendiri lewat menu Akun. Jika kasir lupa password, ganti username-nya (mis. tambahkan angka) lalu isi password baru.");
      }
      await setDoc(doc(db,"users",newUid),{name,email,role:"cabang",branchId:u.branchId,active:true,createdAt:Date.now(),replaces:u.id});
      await updateDoc(doc(db,"users",u.id),{active:false,replacedBy:newUid,replacedAt:Date.now()});
      logAct("Ganti login kasir",`${u.name} (${displayLogin(u.email)}) → ${name} (${displayLogin(email)}). Login lama dinonaktifkan.`,u.branchId);
      toast(`Login baru ${displayLogin(email)} aktif. Berikan username dan password ke kasir.`);
    } else {
      await updateDoc(doc(db,"users",u.id),{name});
      logAct("Ubah nama kasir",`${u.name} → ${name} (${displayLogin(u.email)})`,u.branchId);
      toast("Nama kasir disimpan");
    }
    form.hidden=true;
  }catch(e){ show(errText(e)); }
  finally{ btn.disabled=false; btn.textContent="Simpan perubahan"; }
}

// Membuat login kasir lewat instance Firebase kedua, supaya sesi owner tidak ikut berganti.
async function createStaffLogin(branchId, name, login, pw){
  const email=toLoginEmail(login);
  if(!login.includes("@") && !validUsername(login.toLowerCase())) throw new Error("Username hanya boleh huruf kecil, angka, titik, strip; 3–30 karakter.");
  if(pw.length<6) throw new Error("Password minimal 6 karakter.");
  if(isOwnerEmail(email)) throw new Error("Email owner tidak bisa dipakai sebagai login kasir.");
  const uid=await createAuthUser(email,pw);
  await setDoc(doc(db,"users",uid),{name,email,role:"cabang",branchId,active:true,createdAt:Date.now()});
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

// Simpan transaksi dalam satu transaksi Firestore: naikkan penghitung nomor bukti, tambah ringkasan bulanan, tulis transaksi.
function initialSeq(bid,type,date){
  const k=ymKey(date); let mx=0;
  for(const t of S.tx){ if(t.branchId!==bid||t.type!==type||ymKey(t.date)!==k) continue;
    const n=+t.seq || +(String(t.no||"").split("/").pop()) || 0; if(n>mx) mx=n; }
  return mx+1;
}
async function commitTx(rec){
  const b=branchById(rec.branchId); if(!b) throw new Error("Cabang tidak ditemukan.");
  const id=rec.id || newId();
  const k=ymKey(rec.date);
  const cRef=doc(db,"counters",`${rec.branchId}_${rec.type}_${k}`), sRef=doc(db,"sums",`${rec.branchId}_${k}`), tRef=doc(db,"tx",id);
  const out=await runTransaction(db, async tr=>{
    const c=await tr.get(cRef);
    let n;
    if(c.exists()){ n=(+c.data().n||0)+1; tr.update(cRef,{n}); }
    else { n=initialSeq(rec.branchId,rec.type,rec.date); tr.set(cRef,{n,branchId:rec.branchId}); }
    const no=fmtNo(rec.type,b.code,rec.date,n);
    tr.set(sRef,{branchId:rec.branchId,ym:k,[amtField(rec.type)]:increment(rec.amount),n:increment(1)},{merge:true});
    const data={branchId:rec.branchId,type:rec.type,amount:rec.amount,date:rec.date,category:rec.category,desc:rec.desc,party:rec.party||"",
      no,seq:n,by:S.role,createdBy:S.user.uid,createdAt:rec.createdAt||Date.now()};
    tr.set(tRef,data);
    return {id,...data};
  });
  logAct(rec.type==="in"?"Catat uang masuk":"Catat uang keluar",`${out.no} · ${rec.category} · ${rp(rec.amount)} · ${rec.desc}${rec.queued?" (dikirim dari antrean offline)":""}`,rec.branchId);
  return out;
}
const isOfflineErr = e => !navigator.onLine || (e && (e.code==="unavailable" || /offline/i.test(e.message||"")));

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
  if(!party){ showErr("#f-err",S.formType==="in"?"Isi nama pihak yang menyerahkan uang (Diterima dari).":"Isi nama penerima uang (Dibayar kepada)."); $("#f-party").focus(); return; }
  if(S.role==="cabang" && (date<yesterdayJkt() || date>todayJkt())){ showErr("#f-err","Kasir hanya bisa mencatat tanggal hari ini atau kemarin. Minta owner untuk tanggal lain."); return; }
  showErr("#f-err","");
  const rec={branchId:bid,type:S.formType,amount,date,category,desc,party,createdAt:Date.now()};
  const clear=()=>{ $("#f-amount").value=""; $("#f-desc").value=""; $("#f-party").value=""; $("#f-cat").value=""; };
  if(!navigator.onLine){ enqueue(rec); clear(); return; }
  S.busy=true; const btn=$("#f-submit"); btn.disabled=true; btn.textContent="Menyimpan…";
  try{
    const out=await commitTx(rec);
    clear();
    toast(`Tersimpan · ${out.no}`);
    if(out.type==="out") openKwitansi(out);
  }catch(err){
    if(isOfflineErr(err)){ enqueue(rec); clear(); }
    else showErr("#f-err",errText(err));
  }
  finally{ S.busy=false; btn.disabled=false; setType(S.formType); }
}

/* ---- antrean offline: transaksi disimpan di HP lalu dikirim otomatis saat online ---- */
const qKey = () => "amu-queue-"+(S.user?.uid||"x");
function qGet(){ try{ return JSON.parse(localStorage.getItem(qKey())||"[]"); }catch(e){ return []; } }
function qSet(v){ try{ localStorage.setItem(qKey(),JSON.stringify(v)); }catch(e){} fillQueueBar(); }
function enqueue(rec){
  const q=qGet(); q.push({...rec,qid:Date.now()+"-"+Math.random().toString(36).slice(2,6)}); qSet(q);
  toast("Tidak ada sinyal. Transaksi disimpan di HP dan dikirim otomatis saat online.");
}
let flushing=false;
async function flushQueue(){
  if(flushing || !navigator.onLine || !S.user || !allReady()) return;
  let q=qGet(); if(!q.some(x=>!x.err)) return;
  flushing=true;
  try{
    for(const item of q.filter(x=>!x.err)){
      try{ await commitTx({...item,queued:true}); q=qGet().filter(x=>x.qid!==item.qid); qSet(q); }
      catch(e){ if(isOfflineErr(e)) break; q=qGet().map(x=>x.qid===item.qid?{...x,err:errText(e)}:x); qSet(q); }
    }
    const left=qGet(); if(!left.length) toast("Semua transaksi dari antrean sudah terkirim");
  } finally { flushing=false; fillQueueBar(); }
}
function fillQueueBar(){
  const bar=$("#net"); if(!bar) return;
  const q=S.user?qGet():[]; const pend=q.filter(x=>!x.err).length, bad=q.filter(x=>x.err).length;
  let html="";
  if(!navigator.onLine) html+=`<b>Offline.</b> Data yang tampil dari simpanan HP. `;
  if(pend) html+=`${pend} transaksi menunggu dikirim${navigator.onLine?" <button class=\"link\" data-flush>Kirim sekarang</button>":" saat online"}. `;
  if(bad) html+=`${bad} transaksi gagal dikirim (${esc(q.find(x=>x.err).err)}) <button class="link" data-qclear>Hapus dari antrean</button>`;
  bar.innerHTML=html; bar.hidden=!html;
}
window.addEventListener("online",()=>{ fillQueueBar(); flushQueue(); });
window.addEventListener("offline",fillQueueBar);

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
  if(S.role==="owner" && GOOGLE_CLIENT_ID) loadScript(GIS_URL).catch(()=>{});
  openModal(`<div class="modal-head"><h2>Akun saya</h2><button class="btn ghost sm" data-close>Tutup</button></div>
    <dl class="kv"><dt>Nama</dt><dd>${esc(actorName())}</dd><dt>Login</dt><dd class="num">${esc(displayLogin(S.user?.email))}</dd>
      ${S.role==="cabang"?`<dt>Cabang</dt><dd>${esc(b?b.name:"-")}</dd>`:""}<dt>Aplikasi</dt><dd>${APP_NAME} <span class="num">v${APP_VERSION}</span></dd></dl>
    <button class="btn" data-install ${S.installEvt?"":"hidden"} style="justify-self:start">Pasang aplikasi di perangkat ini</button>
    ${S.role==="owner"?`<div class="acct-sec"><h3>Backup data</h3>
        <p class="hint">${S.meta&&S.meta.lastBackup?"Backup terakhir: "+esc(fmtTime(S.meta.lastBackup))+(S.meta.lastBackupKind==="drive"?" (Google Drive)":" (diunduh)"):"Belum pernah backup."} Berisi semua transaksi, cabang, login kasir, kategori, dan saldo bulanan dalam satu file Excel.</p>
        <div class="mi-inline"><button class="btn" id="bk-xlsx">Unduh backup (Excel)</button>${GOOGLE_CLIENT_ID?`<button class="btn primary" id="bk-drive">Simpan ke Google Drive</button>`:`<span class="hint">Google Drive belum diatur. Lihat README bagian Backup.</span>`}</div></div>
      <div class="acct-sec"><h3>Saldo</h3><p class="hint">Saldo dihitung dari ringkasan bulanan agar aplikasi tetap cepat. Jika saldo terasa tidak cocok, hitung ulang dari semua transaksi.</p>
        <button class="btn sm" id="rebuild" style="justify-self:start">Hitung ulang saldo</button></div>`:""}
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
  const list=S.tx.filter(t=>(!spec.f||t.date>=spec.f)&&(!spec.u||t.date<=spec.u)&&(!spec.k||normDesc(t.desc)===spec.k)&&(!spec.b||t.branchId===spec.b)&&(!spec.m||String(t.date).startsWith(spec.m))&&(!spec.d||t.date===spec.d)&&(!spec.t||t.type===spec.t)&&(!spec.c||(t.category||"Tanpa kategori")===spec.c))
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
    <div class="kw"><img class="kw-wm" alt="" ${S.wm?`src="${S.wm}"`:"hidden"}>
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
    ${t.editedAt?`<p class="hint">Diedit owner ${esc(fmtTime(t.editedAt))}.</p>`:""}
    ${S.role==="owner"?`<p class="hint">Owner dapat mengedit atau menghapus transaksi ini, termasuk yang dicatat kasir.</p>`:""}
    <p class="err" id="kw-err" hidden></p>
    <div class="modal-acts">
      ${S.role==="owner"?`<button class="btn danger" data-del="${esc(t.id)}">Hapus</button><button class="btn" data-edit="${esc(t.id)}">Edit</button>`:""}
      <button class="btn" data-close>Tutup</button>
      <button class="btn primary" id="kw-pdf">Unduh PDF kwitansi</button>
    </div>`);
  S.kwTx=t;
}

async function downloadPdf(){
  const t=S.kwTx; if(!t) return;
  await loadLogoData();
  if(!window.jspdf){ showErr("#kw-err","Pembuat PDF belum termuat. Periksa koneksi lalu muat ulang halaman."); return; }
  const btn=$("#kw-pdf"); btn.disabled=true; btn.textContent="Menyiapkan PDF…";
  try{
    const b=branchById(t.branchId)||{name:"-",city:""};
    const L=kwLabels(t);
    const pdf=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a5"});
    pdf.setDrawColor(30); pdf.setLineWidth(0.5); pdf.rect(8,8,194,132);
    if(S.wm){ try{ pdf.setGState(new pdf.GState({opacity:0.09})); pdf.addImage(S.wm,"PNG",62,31,86,86); pdf.setGState(new pdf.GState({opacity:1})); }catch(e){} }
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
      if(opts.fill){ pdf.setFillColor(232,238,250); pdf.rect(59,y-4.6,137,lines.length*5+2.6,"F"); }
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
    pdf.setFontSize(7); pdf.setTextColor(130); pdf.text("Dicatat di "+APP_NAME,14,136);
    pdf.save(t.no.replace(/\//g,"-")+".pdf");
    logAct("Unduh kwitansi",t.no,t.branchId);
  }catch(e){ showErr("#kw-err","PDF gagal dibuat: "+errText(e)); }
  finally{ btn.disabled=false; btn.textContent="Unduh PDF kwitansi"; }
}

/* ================= edit transaksi (owner) ================= */
function openEdit(t){
  if(S.role!=="owner") return;
  S.editTx=t; S.editType=t.type;
  const branches=S.branches.filter(b=>b.active!==false || b.id===t.branchId);
  openModal(`<div class="modal-head"><h2>Edit transaksi</h2><button class="btn ghost sm" data-close>Tutup</button></div>
    <p class="hint">No. <span class="num">${esc(t.no||"")}</span> · dicatat ${t.by==="owner"?"owner":"kasir"}${t.createdAt?" "+esc(fmtTime(t.createdAt)):""}${t.editedAt?" · terakhir diedit "+esc(fmtTime(t.editedAt)):""}</p>
    <form id="edit-tx" novalidate>
      <div class="seg" role="group" aria-label="Jenis transaksi">
        <button type="button" data-etype="in">↓ Uang masuk</button><button type="button" data-etype="out">↑ Uang keluar</button>
      </div>
      <label for="e-branch">Cabang<select id="e-branch">${branches.map(b=>`<option value="${esc(b.id)}" ${b.id===t.branchId?"selected":""}>${esc(b.name)}</option>`).join("")}</select></label>
      <label for="e-cat"><span><b class="step">1</b> Kategori</span><select id="e-cat"></select></label>
      <label for="e-amount"><span><b class="step">2</b> Nominal (Rp)</span><input id="e-amount" class="amount-in" inputmode="numeric" autocomplete="off" value="${rpn(t.amount)}"></label>
      <label for="e-desc"><span><b class="step">3</b> Keterangan / catatan</span><textarea id="e-desc" rows="2" maxlength="500">${esc(t.desc||"")}</textarea></label>
      <div class="row2">
        <label for="e-date">Tanggal<input type="date" id="e-date" value="${esc(t.date)}"></label>
        <label for="e-party"><span><span id="e-party-lbl">Pihak</span> <b class="req">*wajib</b></span><input id="e-party" value="${esc(t.party||"")}" placeholder="Nama orang atau toko" required></label>
      </div>
      <p class="hint" id="e-no-hint" hidden>Nomor bukti akan dibuat ulang karena jenis, cabang, atau bulan berubah.</p>
      <p class="err" id="e-err" hidden></p>
      <div class="modal-acts"><button class="btn" type="button" data-kw="${esc(t.id)}">Batal</button><button class="btn primary" type="submit" id="e-submit">Simpan perubahan</button></div>
    </form>`);
  paintEditType();
  ["#e-branch","#e-date"].forEach(sel=>$(sel).addEventListener("change",noHint));
}
function paintEditType(){
  const t=S.editTx; if(!t) return; const type=S.editType;
  document.querySelectorAll("[data-etype]").forEach(b=>b.classList.toggle("on",b.dataset.etype===type));
  const f=$("#edit-tx"); if(f) f.dataset.type=type;
  const lbl=$("#e-party-lbl"); if(lbl) lbl.textContent = type==="in"?"Diterima dari":"Dibayar kepada";
  const sel=$("#e-cat"); if(sel){
    const list=[...(S.cats[type]||[])];
    if(type===t.type && t.category && !list.includes(t.category)) list.unshift(t.category);
    const v = sel.value || (type===t.type ? t.category : "");
    sel.innerHTML=`<option value="">Pilih kategori…</option>`+list.map(c=>`<option value="${esc(c)}">${esc(c)}${type===t.type&&c===t.category&&!(S.cats[type]||[]).includes(c)?" (sudah dihapus dari daftar)":""}</option>`).join("");
    if(list.includes(v)) sel.value=v;
  }
  noHint();
}
function noHint(){
  const t=S.editTx, h=$("#e-no-hint"); if(!t||!h) return;
  const bid=$("#e-branch")?.value, date=$("#e-date")?.value||"";
  h.hidden = !(S.editType!==t.type || bid!==t.branchId || date.slice(0,7)!==String(t.date).slice(0,7));
}
async function saveEdit(f){
  const t=S.editTx; if(!t) return;
  const type=S.editType, bid=$("#e-branch").value, b=branchById(bid);
  const category=$("#e-cat").value, amount=+digits($("#e-amount").value), desc=$("#e-desc").value.trim();
  const date=$("#e-date").value, party=$("#e-party").value.trim();
  if(!b){ showErr("#e-err","Pilih cabang."); return; }
  if(!category){ showErr("#e-err","Pilih kategori."); return; }
  if(!amount){ showErr("#e-err","Isi nominal."); return; }
  if(!desc){ showErr("#e-err","Isi keterangan transaksi."); return; }
  if(!date){ showErr("#e-err","Isi tanggal."); return; }
  if(!party){ showErr("#e-err",type==="in"?"Isi nama pihak yang menyerahkan uang (Diterima dari).":"Isi nama penerima uang (Dibayar kepada)."); return; }
  showErr("#e-err","");
  const renumber = type!==t.type || bid!==t.branchId || ymKey(date)!==ymKey(t.date);
  let no=t.no;
  if(renumber) no="(nomor baru)";
  const upd={type,branchId:bid,category,amount,desc,date,party,editedAt:Date.now(),editedBy:S.user.uid};
  const ch=[];
  if(t.type!==type) ch.push(`jenis ${t.type==="in"?"masuk":"keluar"} → ${type==="in"?"masuk":"keluar"}`);
  if(t.branchId!==bid) ch.push(`cabang ${branchById(t.branchId)?.name||"-"} → ${b.name}`);
  if((t.category||"")!==category) ch.push(`kategori ${t.category||"-"} → ${category}`);
  if(+t.amount!==amount) ch.push(`nominal ${rp(t.amount)} → ${rp(amount)}`);
  if((t.desc||"")!==desc) ch.push(`keterangan "${t.desc||""}" → "${desc}"`);
  if(t.date!==date) ch.push(`tanggal ${fmtDMY(t.date)} → ${fmtDMY(date)}`);
  if((t.party||"")!==party) ch.push(`pihak "${t.party||""}" → "${party}"`);
  if(renumber) ch.push(`nomor bukti dibuat ulang`);
  if(!ch.length){ showErr("#e-err","Belum ada yang diubah."); return; }
  const btn=$("#e-submit"); btn.disabled=true; btn.textContent="Menyimpan…";
  try{
    const res=await runTransaction(db, async tr=>{
      let newNo=t.no, seq=t.seq||null;
      if(renumber){
        const cRef=doc(db,"counters",`${bid}_${type}_${ymKey(date)}`); const c=await tr.get(cRef);
        if(c.exists()){ seq=(+c.data().n||0)+1; tr.update(cRef,{n:seq}); } else { seq=initialSeq(bid,type,date); tr.set(cRef,{n:seq,branchId:bid}); }
        newNo=fmtNo(type,b.code,date,seq);
      }
      // sesuaikan ringkasan bulanan: kurangi nilai lama, tambah nilai baru
      const adj={};
      const add=(br,dt,tp,v,dn)=>{ const k=br+"_"+ymKey(dt); const a=adj[k]||(adj[k]={branchId:br,ym:ymKey(dt),inAmt:0,outAmt:0,n:0}); a[amtField(tp)]+=v; a.n+=dn; };
      add(t.branchId,t.date,t.type,-(+t.amount||0),-1); add(bid,date,type,amount,1);
      for(const [k,a] of Object.entries(adj)){
        if(!a.inAmt && !a.outAmt && !a.n) continue;
        tr.set(doc(db,"sums",k),{branchId:a.branchId,ym:a.ym,inAmt:increment(a.inAmt),outAmt:increment(a.outAmt),n:increment(a.n)},{merge:true});
      }
      const full={...upd,no:newNo}; if(seq!=null) full.seq=seq;
      tr.update(doc(db,"tx",t.id),full);
      return full;
    });
    logAct("Edit transaksi",`${t.no}: ${ch.join("; ")}${res.no!==t.no?" → "+res.no:""}`.slice(0,900),bid);
    toast("Transaksi diperbarui");
    openKwitansi({...t,...res});
  }catch(err){ showErr("#e-err",errText(err)); btn.disabled=false; btn.textContent="Simpan perubahan"; }
}

/* ================= analisis (owner) ================= */
S.an={period:"month",type:"out",branch:"",cat:"",bsort:"desc",csort:"desc"};
const normDesc = s => String(s||"").toLowerCase().replace(/\s+/g," ").trim();
function anRange(p){
  const today=todayJkt(), ym=today.slice(0,7), y=today.slice(0,4);
  if(p==="month") return {f:ym+"-01",u:ym+"-31",label:fmtMonth(ym)};
  if(p==="prev"){ const pm=prevMonth(ym); return {f:pm+"-01",u:pm+"-31",label:fmtMonth(pm)}; }
  if(p==="3m"){ const a=prevMonth(prevMonth(ym)); return {f:a+"-01",u:ym+"-31",label:fmtMonth(a)+" – "+fmtMonth(ym)}; }
  if(p==="year") return {f:y+"-01-01",u:y+"-12-31",label:"Tahun "+y};
  return {f:"",u:"",label:"Semua waktu"};
}
function analysisHtml(){
  const A=S.an, R=anRange(A.period), typeLbl=A.type==="in"?"pemasukan":"pengeluaran";
  const base=t=>(!R.f||t.date>=R.f)&&(!R.u||t.date<=R.u)&&t.type===A.type;
  const inScope=S.tx.filter(t=>base(t)&&(!A.branch||t.branchId===A.branch)&&(!A.cat||(t.category||"Tanpa kategori")===A.cat));
  const total=inScope.reduce((s,t)=>s+(+t.amount||0),0);
  const spec=extra=>{ const o={t:A.type,...extra}; if(R.f){o.f=R.f;o.u=R.u;} if(A.branch&&!("b" in extra)) o.b=A.branch; if(A.cat&&!("c" in extra)) o.c=A.cat; return o; };
  const dAttr=(extra,title)=>`data-drill="${esc(JSON.stringify(spec(extra)))}" data-title="${esc(title)}"`;
  const chip=(k,v,l)=>`<button class="fchip ${A[k]===v?"on":""}" data-an="${k}:${v}">${l}</button>`;
  const cats=[...new Set([...(S.cats[A.type]||[]), ...S.tx.filter(t=>t.type===A.type).map(t=>t.category||"Tanpa kategori")])];
  const filters=`<div class="panel filters">
      <div class="frow"><span class="flabel">Jenis</span>${chip("type","out","↑ Pengeluaran")}${chip("type","in","↓ Pemasukan")}</div>
      <div class="frow"><span class="flabel">Periode</span>${chip("period","month","Bulan ini")}${chip("period","prev","Bulan lalu")}${chip("period","3m","3 bulan")}${chip("period","year","Tahun ini")}${chip("period","all","Semua")}</div>
      <div class="frow selects">
        <label for="an-branch">Cabang<select id="an-branch"><option value="">Semua cabang</option>${S.branches.map(b=>`<option value="${esc(b.id)}" ${A.branch===b.id?"selected":""}>${esc(b.name)}</option>`).join("")}</select></label>
        <label for="an-cat">Kategori<select id="an-cat"><option value="">Semua kategori</option>${cats.map(c=>`<option value="${esc(c)}" ${A.cat===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label>
      </div>
      <button class="an-total" ${dAttr({},"Semua "+typeLbl+" · "+R.label)}><span class="l">Total ${typeLbl} · ${esc(R.label)}${A.branch?" · "+esc(branchById(A.branch)?.name||""):""}${A.cat?" · "+esc(A.cat):""}</span>
        <span class="v num ${A.type==="in"?"t-in":"t-out"}">${rp(total)}</span><span class="hint">${inScope.length} transaksi${inScope.length?" · rata-rata "+rp(total/inScope.length):""} · ketuk untuk rincian</span></button>
    </div>`;

  const sortBtns=(k)=>`<div class="sortsw">${chip(k,"desc","Terbanyak")}${chip(k,"asc","Tersedikit")}</div>`;
  const bars=(rows,dir,mk)=>{ const arr=rows.slice().sort((a,b)=>dir==="asc"?a.v-b.v:b.v-a.v); const max=Math.max(1,...arr.map(r=>r.v));
    return arr.length? arr.map((r,i)=>`<button class="rank" ${mk(r)}><span class="rk">${i+1}</span><span class="rn">${esc(r.n)}${r.sub?`<small>${esc(r.sub)}</small>`:""}</span><span class="rv num">${rpn(r.v)}</span><span class="track"><span class="fill ${A.type}" style="width:${r.v?Math.max(2,r.v/max*100).toFixed(1):0}%"></span></span></button>`).join("")
      : `<p class="hint">Belum ada data.</p>`; };

  // Peringkat cabang (abaikan filter cabang supaya bisa dibandingkan)
  const byB=S.branches.map(b=>{ const l=S.tx.filter(t=>base(t)&&t.branchId===b.id&&(!A.cat||(t.category||"Tanpa kategori")===A.cat)); return {id:b.id,n:b.name,v:l.reduce((s,t)=>s+(+t.amount||0),0),sub:l.length+" transaksi"}; });
  const branchRank=`<div class="panel"><div class="panel-head"><h2>Peringkat cabang${A.cat?" · "+esc(A.cat):""}</h2>${sortBtns("bsort")}</div>
    <div class="ranks">${bars(byB,A.bsort,r=>dAttr({b:r.id},r.n+" · "+typeLbl+" · "+R.label))}</div></div>`;

  // Peringkat kategori (abaikan filter kategori)
  const catRows=cats.map(c=>{ const l=S.tx.filter(t=>base(t)&&(!A.branch||t.branchId===A.branch)&&(t.category||"Tanpa kategori")===c); return {n:c,v:l.reduce((s,t)=>s+(+t.amount||0),0),sub:l.length+" transaksi"}; });
  const catRank=`<div class="panel"><div class="panel-head"><h2>Peringkat kategori${A.branch?" · "+esc(branchById(A.branch)?.name||""):""}</h2>${sortBtns("csort")}</div>
    <div class="ranks">${bars(catRows,A.csort,r=>dAttr({c:r.n},r.n+" · "+typeLbl+" · "+R.label))}</div></div>`;

  // Matriks kategori × cabang
  const mCats=catRows.filter(r=>r.v>0).sort((a,b)=>b.v-a.v).map(r=>r.n);
  const cell={}; let cmax=1;
  for(const t of S.tx){ if(!base(t)) continue; const k=(t.category||"Tanpa kategori")+"|"+t.branchId; cell[k]=(cell[k]||0)+(+t.amount||0); cmax=Math.max(cmax,cell[k]); }
  const rgb=A.type==="in"?"18,149,90":"21,70,160";
  const matrix = mCats.length && S.branches.length ? `<div class="matrix-wrap"><table class="matrix">
      <thead><tr><th>Kategori</th>${S.branches.map(b=>`<th class="r">${esc(b.name)}</th>`).join("")}<th class="r">Total</th></tr></thead>
      <tbody>${mCats.map(c=>`<tr><th>${esc(c)}</th>${S.branches.map(b=>{ const v=cell[c+"|"+b.id]||0; const a=v?0.08+0.62*v/cmax:0;
          return v?`<td class="r num hc" style="background:rgba(${rgb},${a.toFixed(2)});color:${a>0.45?"#fff":"inherit"}" ${dAttr({c,b:b.id},c+" · "+b.name+" · "+R.label)}>${rpn(v)}</td>`:`<td class="r num zero">–</td>`; }).join("")}
        <td class="r num tot" ${dAttr({c},c+" · semua cabang · "+R.label)}>${rpn(catRows.find(r=>r.n===c).v)}</td></tr>`).join("")}</tbody>
    </table></div><p class="hint">Warna makin pekat = nominal makin besar. Ketuk kotak untuk melihat transaksinya.</p>`
    : `<p class="hint">Belum ada data untuk periode ini.</p>`;
  const matrixPanel=`<div class="panel span-all"><h2>Kategori × cabang · ${typeLbl}</h2>${matrix}</div>`;

  // Keterangan paling sering
  const g={}; for(const t of inScope){ const k=normDesc(t.desc); if(!k) continue; (g[k]=g[k]||{n:t.desc,v:0,c:0}); g[k].v+=+t.amount||0; g[k].c++; }
  const top=Object.entries(g).sort((a,b)=>b[1].v-a[1].v).slice(0,10);
  const descPanel=`<div class="panel span-all"><h2>Keterangan dengan nominal terbesar</h2><p class="hint">Dikelompokkan dari teks keterangan yang ditulis kasir, jadi hanya akurat bila tulisannya sama.</p>
    <div class="ranks">${top.length? top.map(([k,o],i)=>`<button class="rank" ${dAttr({k},"Keterangan: "+o.n)}><span class="rk">${i+1}</span><span class="rn">${esc(o.n)}<small>${o.c} kali</small></span><span class="rv num">${rpn(o.v)}</span></button>`).join("") : `<p class="hint">Belum ada data.</p>`}</div></div>`;

  return filters+`<div class="an-grid">${branchRank}${catRank}${matrixPanel}${descPanel}</div>`;
}

/* ================= backup (owner) ================= */
const GIS_URL="https://accounts.google.com/gsi/client";
async function buildBackup(){
  await loadScript(XLSX_URL); const X=window.XLSX;
  const snap=await getDocs(collection(db,"tx"));
  const iso=ms=>ms?new Date(ms).toISOString():"";
  const txRows=snap.docs.map(d=>{ const t=d.data(); const b=branchById(t.branchId);
    return [t.date||"",t.no||"",b?b.name:t.branchId,t.type==="in"?"Masuk":"Keluar",t.category||"",t.desc||"",t.party||"",+t.amount||0,t.by||"",iso(t.createdAt),iso(t.editedAt),d.id,t.branchId]; })
    .sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  const sheet=(aoa,w)=>{ const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=w.map(x=>({wch:x})); for(const k of Object.keys(ws)) if(k[0]!=="!"&&ws[k].t==="n") ws[k].z="#,##0"; return ws; };
  const wb=X.utils.book_new();
  X.utils.book_append_sheet(wb,sheet([["Tanggal","No. bukti","Cabang","Jenis","Kategori","Keterangan","Pihak","Nominal","Dicatat oleh","Dibuat","Diedit","ID","ID cabang"],...txRows],[12,20,16,8,18,40,18,14,10,24,24,22,22]),"Transaksi");
  X.utils.book_append_sheet(wb,sheet([["Nama cabang","Kode","Alamat","Kota/kab.","Aktif","ID"],...S.branches.map(b=>[b.name,b.code||"",b.address||"",b.kota||b.city||"",b.active===false?"Tidak":"Ya",b.id])],[20,8,36,18,8,22]),"Cabang");
  X.utils.book_append_sheet(wb,sheet([["Nama kasir","Username","Cabang","Aktif","Diganti oleh login","ID"],...S.users.map(u=>[u.name,displayLogin(u.email),branchById(u.branchId)?.name||u.branchId,u.active===false?"Tidak":"Ya",u.replacedBy||"",u.id])],[20,24,18,8,22,30]),"Kasir");
  X.utils.book_append_sheet(wb,sheet([["Jenis","Kategori"],...S.cats.in.map(c=>["Masuk",c]),...S.cats.out.map(c=>["Keluar",c])],[10,30]),"Kategori");
  X.utils.book_append_sheet(wb,sheet([["Cabang","Bulan (YYYYMM)","Masuk","Keluar","Jumlah transaksi"],...S.sumsList.map(x=>[branchById(x.branchId)?.name||x.branchId,x.ym,+x.inAmt||0,+x.outAmt||0,+x.n||0])],[18,14,16,16,16]),"Saldo bulanan");
  const out=X.write(wb,{bookType:"xlsx",type:"array"});
  return {blob:new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),count:txRows.length};
}
let driveToken=null, driveExp=0;
async function getDriveToken(){
  if(driveToken && Date.now()<driveExp-60000) return driveToken;
  await loadScript(GIS_URL);
  return new Promise((res,rej)=>{
    const tc=window.google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:"https://www.googleapis.com/auth/drive.file",
      callback:r=>{ if(r.error){ rej(new Error("Izin Google Drive tidak diberikan.")); return; } driveToken=r.access_token; driveExp=Date.now()+(+r.expires_in||3600)*1000; res(driveToken); },
      error_callback:()=>rej(new Error("Jendela login Google ditutup atau diblokir. Izinkan pop-up lalu coba lagi."))});
    tc.requestAccessToken();
  });
}
async function driveFolder(token){
  const H={Authorization:"Bearer "+token};
  const saved=S.meta&&S.meta.driveFolderId;
  if(saved){ const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(saved)}?fields=id,trashed`,{headers:H}); if(r.ok){ const j=await r.json(); if(!j.trashed) return saved; } }
  const r=await fetch("https://www.googleapis.com/drive/v3/files?fields=id",{method:"POST",headers:{...H,"Content-Type":"application/json"},body:JSON.stringify({name:"Backup Cashflow AMU",mimeType:"application/vnd.google-apps.folder"})});
  if(!r.ok) throw new Error("Gagal membuat folder backup di Google Drive ("+r.status+").");
  const j=await r.json(); await setDoc(doc(db,"settings","meta"),{driveFolderId:j.id},{merge:true}); return j.id;
}
async function uploadDrive(token,name,blob){
  const folder=await driveFolder(token);
  const form=new FormData();
  form.append("metadata",new Blob([JSON.stringify({name,parents:[folder]})],{type:"application/json"}));
  form.append("file",blob);
  const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
  if(!r.ok) throw new Error("Upload ke Google Drive gagal ("+r.status+"). Coba lagi.");
}
async function runBackup(kind,btn){
  if(S.role!=="owner") return;
  const old=btn.textContent; btn.disabled=true; btn.textContent="Menyiapkan…";
  try{
    const token = kind==="drive" ? await getDriveToken() : null;   // minta izin dulu, selagi masih dalam ketukan pengguna
    const {blob,count}=await buildBackup();
    const name=`Backup-Cashflow-AMU-${todayJkt()}.xlsx`;
    if(kind==="drive"){ btn.textContent="Mengunggah…"; await uploadDrive(token,name,blob); toast("Backup tersimpan di Google Drive, folder “Backup Cashflow AMU”"); }
    else { downloadBlob(name,blob); toast("File backup diunduh"); }
    await setDoc(doc(db,"settings","meta"),{lastBackup:Date.now(),lastBackupKind:kind},{merge:true});
    logAct("Backup data",`${kind==="drive"?"Google Drive":"Unduh Excel"} · ${count} transaksi`,null);
  }catch(e){ toast(errText(e)); }
  finally{ btn.disabled=false; btn.textContent=old; }
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
  await loadLogoData();
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
    pdf.setDrawColor(21,70,160); pdf.setLineWidth(0.6); pdf.line(14,26,W-14,26);
    return 32;
  };
  const base={theme:"grid",styles:{fontSize:8.5,cellPadding:2,lineColor:[219,227,241],lineWidth:0.1,textColor:[20,40,35]},
    headStyles:{fillColor:[21,70,160],textColor:255,fontStyle:"bold"},alternateRowStyles:{fillColor:[246,249,254]},margin:{left:14,right:14,bottom:18}};
  const mark=d=>{ if(d.section==="body" && d.row.raw && d.row.raw._carry){ d.cell.styles.fontStyle="bold"; d.cell.styles.fillColor=[232,238,249]; } };
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
    pdf.text("Dicetak "+fmtDMY(today)+" · "+APP_NAME,14,290); pdf.text("Halaman "+i+" dari "+n,W-14,290,{align:"right"}); }
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
  if(!form.ownerpw.value){ show("Masukkan password owner untuk konfirmasi."); return; }
  show("");
  try{
    await confirmOwner(form.ownerpw.value);
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
  if(el.id==="acct" || d.backup!==undefined) return openAccount();
  if(el.id==="forgot") return forgot();
  if(d.install!==undefined){ if(S.installEvt){ S.installEvt.prompt(); S.installEvt=null; document.querySelectorAll("[data-install]").forEach(b=>b.hidden=true); } return; }
  if(d.an){ const [k,val]=d.an.split(":"); S.an[k]=val; if(k==="type") S.an.cat="";
    if(k==="period"){ const R=anRange(val); ensureLoaded(R.f?R.f.slice(0,7):"2000-01"); }
    fill(); return; }
  if(d.flush!==undefined){ flushQueue(); return; }
  if(d.qclear!==undefined){ qSet(qGet().filter(x=>!x.err)); return; }
  if(d.loadall!==undefined){ ensureLoaded("2000-01"); return; }
  if(el.id==="bk-xlsx") return runBackup("xlsx",el);
  if(el.id==="bk-drive") return runBackup("drive",el);
  if(el.id==="rebuild"){ if(S.role==="owner") rebuildSums(false); return; }
  if(d.drill){ try{ openDrill(JSON.parse(d.drill), d.title||"Transaksi"); }catch(err){} return; }
  if(d.go){
    const ok = S.role==="owner" ? ["dash","input","analisis","kelola","kategori","aktivitas"] : ["input","buku","ringkasan"];
    if(!ok.includes(d.go)) return;
    closeModal(); if(d.go==="input" && S.role==="owner" && !d.keep) S.inputBranch=null;
    S.view=d.go; window.scrollTo(0,0); return renderView(); }
  if(d.inputfor){ if(S.role!=="owner") return; S.inputBranch=d.inputfor; S.view="input"; window.scrollTo(0,0); return renderView(); }
  if(d.open){ if(S.role!=="owner") return; S.view="cabang"; S.detailId=d.open; window.scrollTo(0,0); return renderView(); }
  if(d.type) return setType(d.type);
  if(d.kw){ const t=S.tx.find(x=>x.id===d.kw); if(t) openKwitansi(t); return; }
  if(el.id==="kw-pdf") return downloadPdf();
  if(d.close!==undefined) return closeModal();
  if(d.export) return runExport(el);
  if(S.role!=="owner") return;
  if(d.staffedit){ const f=document.querySelector(`[data-staffeditsave="${CSS.escape(d.staffedit)}"]`); if(f){ f.hidden=!f.hidden; if(!f.hidden) f.name.focus(); } return; }
  if(d.del){
    if(!arm(el,"del"+d.del,"Yakin hapus?")) return;
    const t=S.tx.find(x=>x.id===d.del);
    try{
      await runTransaction(db, async tr=>{
        tr.delete(doc(db,"tx",d.del));
        if(t) tr.set(doc(db,"sums",t.branchId+"_"+ymKey(t.date)),{branchId:t.branchId,ym:ymKey(t.date),[amtField(t.type)]:increment(-(+t.amount||0)),n:increment(-1)},{merge:true});
      });
      if(el.closest("#modal-root")) closeModal(); toast("Transaksi dihapus"); if(t) logAct("Hapus transaksi",`${t.no} · ${t.category||""} · ${rp(t.amount)} · ${t.desc||""}${t.by==="cabang"?" (dicatat kasir)":""}`,t.branchId); }
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
  if(f.id==="edit-tx"){ e.preventDefault(); if(S.role==="owner") return saveEdit(f); return; }
  if(f.dataset.staffsave){ e.preventDefault(); return addStaff(f); }
  if(f.dataset.staffeditsave){ e.preventDefault(); if(S.role==="owner") return saveStaffEdit(f); return; }
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
  if(e.target.id==="q"){ S.q=e.target.value; renderSearch(); return; }
  if(e.target.id==="f-amount"||e.target.id==="e-amount"){ const v=digits(e.target.value); e.target.value = v ? (+v).toLocaleString("id-ID") : ""; }
});
document.addEventListener("change", e=>{
  if(e.target.id==="month" && e.target.value){ S.month=e.target.value; ensureLoaded(prevMonth(S.month)); fill(); }
  if(e.target.id==="log-filter"){ S.logFilter=e.target.value; fill(); }
  if(e.target.id==="an-branch"){ S.an.branch=e.target.value; fill(); }
  if(e.target.id==="an-cat"){ S.an.cat=e.target.value; fill(); }
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
