import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig, OWNER_EMAIL } from "./firebase-config.js";

const COMPANY = "ACEH MANDIRI UTAMA";
const CATS = ["Penjualan","Setoran modal","Pelunasan piutang","Operasional","Gaji & upah","Transport","ATK","Listrik & air","Sewa","Konsumsi","Pembelian barang","Setor ke pusat","Lain-lain"];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rp = n => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const rpn = n => Math.round(n || 0).toLocaleString("id-ID");
const todayJkt = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date());
const fmtDate = d => { try { return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date(d+"T00:00:00")); } catch(e){ return d; } };
const fmtShort = d => { try { return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short"}).format(new Date(d+"T00:00:00")); } catch(e){ return d; } };
const fmtMonth = m => { try { return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(new Date(m+"-01T00:00:00")); } catch(e){ return m; } };
const newId = () => doc(collection(db,"tx")).id;
const digits = s => String(s||"").replace(/\D/g,"");
const isOwnerEmail = email => !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase();

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
    "auth/invalid-credential":"Email atau password salah.",
    "auth/wrong-password":"Email atau password salah.",
    "auth/user-not-found":"Email atau password salah.",
    "auth/invalid-email":"Format email tidak valid.",
    "auth/too-many-requests":"Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.",
    "auth/email-already-in-use":"Email ini sudah dipakai akun lain.",
    "auth/weak-password":"Password minimal 6 karakter.",
    "auth/network-request-failed":"Tidak ada koneksi internet.",
    "unavailable":"Tidak ada koneksi ke server. Periksa internet lalu coba lagi.",
    "resource-exhausted":"Kuota Firebase habis untuk hari ini. Coba lagi besok atau naikkan paket.",
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
function dataUrlToBlob(d){
  const [h,b64]=d.split(","); const mime=(h.match(/data:([^;]+)/)||[])[1]||"application/octet-stream";
  const bin=atob(b64); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}

/* ---------- state ---------- */
const S = {
  user:null, role:null, profile:null,
  branches:[], tx:[], users:[], bReady:false, tReady:false, uReady:false,
  view:"login", detailId:null, month: todayJkt().slice(0,7), formType:"in", busy:false, kwTx:null, fatal:null
};
let unsubs=[];
function stopAll(){ unsubs.forEach(u=>{try{u()}catch(e){}}); unsubs=[]; }

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

/* ---------- auth flow ---------- */
onAuthStateChanged(auth, async user=>{
  stopAll(); shellFor=null;
  Object.assign(S,{user,role:null,profile:null,branches:[],tx:[],users:[],bReady:false,tReady:false,uReady:false,fatal:null});
  if(!user){ S.view="login"; renderView(); return; }
  renderView();
  const fail = e => { S.fatal = errText(e); renderView(); };

  if(isOwnerEmail(user.email)){
    S.role="owner"; S.view="dash";
    unsubs.push(onSnapshot(collection(db,"branches"), snap=>{
      S.branches=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
      S.bReady=true; onData();
    }, fail));
    unsubs.push(onSnapshot(collection(db,"tx"), snap=>{
      S.tx=snap.docs.map(d=>({id:d.id,...d.data()})); S.tReady=true; onData();
    }, fail));
    unsubs.push(onSnapshot(collection(db,"users"), snap=>{
      S.users=snap.docs.map(d=>({id:d.id,...d.data()})); S.uReady=true; onData();
    }, fail));
    return;
  }

  try{
    const p = await getDoc(doc(db,"users",user.uid));
    if(!p.exists() || p.data().role!=="cabang"){ S.fatal="Akun ini belum didaftarkan ke cabang mana pun. Minta owner menambahkan akun Anda di menu Kelola cabang."; renderView(); return; }
    S.profile={id:p.id,...p.data()};
    if(S.profile.active===false){ S.fatal="Akun kasir ini sedang dinonaktifkan. Hubungi owner."; renderView(); return; }
    S.role="cabang"; S.view="branch"; S.uReady=true;
    const bid=S.profile.branchId;
    unsubs.push(onSnapshot(doc(db,"users",user.uid), d=>{
      if(!d.exists() || d.data().active===false){ S.fatal="Akun kasir ini dinonaktifkan. Hubungi owner."; stopAll(); renderView(); }
    }, fail));
    unsubs.push(onSnapshot(doc(db,"branches",bid), d=>{
      if(!d.exists() || d.data().active===false){ S.fatal="Cabang Anda sedang tidak aktif. Hubungi owner."; stopAll(); renderView(); return; }
      S.branches=[{id:d.id,...d.data()}]; S.bReady=true; onData();
    }, fail));
    unsubs.push(onSnapshot(query(collection(db,"tx"),where("branchId","==",bid)), snap=>{
      S.tx=snap.docs.map(d=>({id:d.id,...d.data()})); S.tReady=true; onData();
    }, fail));
  }catch(e){ fail(e); }
});

let shellFor=null;
function onData(){
  if(!(S.bReady && S.tReady && S.uReady)) return;
  const key=S.user?.uid+S.role;
  if(shellFor!==key){ shellFor=key; renderView(); return; }
  fill();
}

/* ---------- top bar ---------- */
function renderTop(){
  let who="", tabs="";
  if(S.role==="owner"){
    who=`<span class="who">Owner</span>`;
    tabs=`<nav class="tabs"><button data-go="dash" class="${S.view==="dash"||S.view==="cabang"?"on":""}">Ringkasan</button><button data-go="kelola" class="${S.view==="kelola"?"on":""}">Kelola cabang</button></nav>`;
  } else if(S.role==="cabang"){
    const b=branchById(S.profile?.branchId);
    who=`<span class="who">Cabang ${esc(b?b.name:"")} · ${esc(S.profile?.name||"")}</span>`;
  }
  $("#topbar").innerHTML = `<div class="brand"><span class="brand-mark">AMU</span><span>Kas Aceh Mandiri Utama</span></div>${who}${tabs}${S.user?`<button class="btn ghost sm ${tabs?"":"spacer"}" id="logout">Keluar</button>`:""}`;
}

/* ---------- views ---------- */
function monthPicker(){ return `<label class="month" for="month">Bulan <input type="month" id="month" value="${S.month}" style="width:auto"></label>`; }

function txForm(withBranch){
  return `<form id="tx-form" data-wb="${withBranch?1:0}" novalidate>
    ${withBranch?`<label for="f-branch">Cabang<select id="f-branch"></select></label>`:""}
    <div class="seg" role="group" aria-label="Jenis transaksi">
      <button type="button" data-type="in">Uang masuk</button><button type="button" data-type="out">Uang keluar</button>
    </div>
    <div class="row2">
      <label for="f-date">Tanggal<input type="date" id="f-date" value="${todayJkt()}"></label>
      <label for="f-amount">Jumlah (Rp)<input id="f-amount" class="amount-in" inputmode="numeric" autocomplete="off" placeholder="0"></label>
    </div>
    <label for="f-cat">Kategori<input id="f-cat" list="cats" placeholder="Pilih atau ketik"></label>
    <datalist id="cats">${CATS.map(c=>`<option value="${esc(c)}">`).join("")}</datalist>
    <label for="f-desc">Keterangan<input id="f-desc" maxlength="500" placeholder="mis. Bayar listrik kantor September"></label>
    <label for="f-party"><span id="f-party-lbl">Diterima dari</span><input id="f-party" placeholder="Nama orang atau toko"></label>
    <div id="f-att-wrap" hidden style="display:grid;gap:4px">
      <label for="f-att">Lampiran kwitansi (foto atau PDF, opsional)<input type="file" id="f-att" accept="image/*,application/pdf"></label>
      <p class="hint">Foto dikecilkan otomatis. File PDF maksimal 500 KB.</p>
    </div>
    <p class="err" id="f-err" hidden></p>
    <button class="btn primary" id="f-submit" type="submit">Simpan uang masuk</button>
  </form>`;
}

function renderView(){
  renderTop();
  const appEl=$("#app");
  if(S.fatal){
    appEl.innerHTML=`<section class="login"><div class="login-head"><p class="eyebrow">Buku kas perusahaan</p><h1>Aceh Mandiri Utama</h1></div>
      <div class="panel"><p>${esc(S.fatal)}</p><button class="btn" id="logout2" style="justify-self:start">Keluar dan masuk dengan akun lain</button></div></section>`;
    return;
  }
  if(!S.user){
    appEl.innerHTML = `<section class="login">
      <div class="login-head"><p class="eyebrow">Buku kas perusahaan</p><h1>Aceh Mandiri Utama</h1>
      <p class="lede">Catat uang masuk dan keluar per cabang. Kasir hanya bisa membuka buku kas cabangnya sendiri; owner melihat semua cabang.</p></div>
      <div class="login-grid"><div class="panel"><h2>Masuk</h2>
        <form id="login-form" novalidate>
          <label for="login-email">Email<input id="login-email" type="email" autocomplete="username"></label>
          <label for="login-pw">Password<input id="login-pw" type="password" autocomplete="current-password"></label>
          <p class="err" id="login-err" hidden></p>
          <button class="btn primary" type="submit" id="login-btn">Masuk</button>
          <button class="link" type="button" id="forgot" style="justify-self:start">Lupa password?</button>
        </form></div></div></section>`;
    return;
  }
  if(!(S.bReady && S.tReady && S.uReady)){ appEl.innerHTML=`<div class="loading">Memuat buku kas…</div>`; return; }

  if(S.role==="owner" && S.view==="dash"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Semua cabang</p><h1>Ringkasan kas</h1></div>${monthPicker()}</div>
      <div id="stats" class="stats"></div>
      <div class="sec-head"><h2>Cabang</h2><button class="btn sm" data-go="kelola">+ Tambah cabang</button></div>
      <div id="cards" class="cards"></div>
      <div class="split">
        <div class="panel"><h2>Catat transaksi</h2>${txForm(true)}</div>
        <div class="panel"><h2>Transaksi terbaru</h2><div id="recent" class="recent"></div></div>
      </div>`;
  }
  else if(S.role==="owner" && S.view==="kelola"){
    appEl.innerHTML = `<div class="sec-head"><div><p class="eyebrow">Owner</p><h1>Kelola cabang</h1></div></div>
      <div class="split">
        <div class="panel"><h2>Tambah cabang</h2>
          <form id="branch-form" novalidate>
            <label for="b-name">Nama cabang<input id="b-name" placeholder="mis. Banda Aceh"></label>
            <label for="b-city">Kota / alamat singkat<input id="b-city" placeholder="mis. Jl. T. Nyak Arief, Banda Aceh"></label>
            <p class="err" id="b-err" hidden></p>
            <button class="btn primary" type="submit">Tambah cabang</button>
          </form>
          <p class="hint">Setelah cabang dibuat, tambahkan akun kasir untuk cabang itu di daftar sebelah. Kasir masuk dengan email dan password yang Anda buat.</p>
        </div>
        <div class="panel"><h2>Daftar cabang</h2><div id="manage-list" class="mlist"></div></div>
      </div>`;
  }
  else {
    const ownerDetail = S.role==="owner";
    appEl.innerHTML = `<div class="sec-head"><div style="display:grid;gap:4px">
        ${ownerDetail?`<button class="link" data-go="dash" style="justify-self:start">← Semua cabang</button>`:""}
        <p class="eyebrow">Buku kas cabang</p><h1 id="hdr-branch"></h1></div>${monthPicker()}</div>
      <div id="stats" class="stats"></div>
      <div class="split">
        <div class="panel"><h2>Catat transaksi</h2>${txForm(false)}</div>
        <div class="panel"><div class="panel-head"><h2>Buku kas <span class="muted" id="ledger-month" style="font-weight:500"></span></h2><button class="btn sm" id="csv">Unduh CSV</button></div><div id="ledger"></div></div>
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

function fill(){
  if(S.role==="owner" && S.view==="cabang" && !branchById(S.detailId)){ S.view="dash"; renderView(); return; }
  const fb=$("#f-branch");
  if(fb){
    const act=S.branches.filter(b=>b.active!==false); const v=fb.value;
    fb.innerHTML = act.length ? act.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("") : `<option value="">Belum ada cabang</option>`;
    if(act.some(b=>b.id===v)) fb.value=v;
  }
  const mm=fmtMonth(S.month);
  const st=$("#stats");
  if(st){
    const bid=currentBranchId();
    const s=sums(bid?txOf(bid):S.tx,S.month); const diff=s.inM-s.outM;
    st.innerHTML = `
      <div class="stat lead"><span class="l">Saldo kas saat ini</span><span class="v ${s.saldo<0?"out":""}">${s.saldo<0?"−":""}${rp(Math.abs(s.saldo))}</span></div>
      <div class="stat"><span class="l">Masuk · ${esc(mm)}</span><span class="v in">${rp(s.inM)}</span></div>
      <div class="stat"><span class="l">Keluar · ${esc(mm)}</span><span class="v out">${rp(s.outM)}</span></div>
      <div class="stat"><span class="l">Selisih · ${s.n} transaksi</span><span class="v ${diff<0?"out":""}">${diff<0?"−":""}${rp(Math.abs(diff))}</span></div>`;
  }
  const hb=$("#hdr-branch"); if(hb){ const b=branchById(currentBranchId()); hb.textContent = b? b.name : ""; }
  const lm=$("#ledger-month"); if(lm) lm.textContent="· "+mm;

  const cd=$("#cards");
  if(cd){
    cd.innerHTML = !S.branches.length
      ? `<div class="empty" style="grid-column:1/-1">Belum ada cabang. Tambahkan cabang pertama di <button class="link" data-go="kelola">Kelola cabang</button>.</div>`
      : S.branches.map(b=>{ const s=sums(txOf(b.id),S.month);
        return `<button class="card" data-open="${esc(b.id)}">
          <div class="card-top"><strong>${esc(b.name)}</strong>${b.active===false?`<span class="pill off">Nonaktif</span>`:`<span class="code">${esc(b.code||"")}</span>`}</div>
          <div><div class="hint">Saldo</div><div class="saldo ${s.saldo<0?"t-out":""}">${rp(s.saldo)}</div></div>
          <div class="mm"><span class="t-in">+${rpn(s.inM)}</span><span class="t-out">−${rpn(s.outM)}</span><span class="muted">${s.n} trx</span></div>
        </button>`; }).join("");
  }
  const rc=$("#recent");
  if(rc){
    const list=[...S.tx].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,12);
    rc.innerHTML = list.length ? list.map(t=>{ const b=branchById(t.branchId);
      return `<div class="rc"><span class="d">${esc(fmtShort(t.date))}</span>
        <span class="t">${esc(t.desc||t.category||"-")}<small>${esc(b?b.name:"Cabang terhapus")} · ${esc(t.no||"")}</small></span>
        <span class="a ${t.type==="in"?"t-in":"t-out"}">${t.type==="in"?"+":"−"}${rpn(t.amount)}</span>
        <span class="x"><button class="btn ghost sm" data-kw="${esc(t.id)}">Kwitansi</button>${t.hasAtt?`<button class="btn ghost sm" data-att="${esc(t.id)}">Lampiran</button>`:""}</span></div>`; }).join("")
      : `<div class="empty">Belum ada transaksi. Catat transaksi pertama lewat formulir di samping.</div>`;
  }
  const lg=$("#ledger"); if(lg) lg.innerHTML = ledgerHtml(currentBranchId());

  const ml=$("#manage-list");
  if(ml){
    ml.innerHTML = S.branches.length ? S.branches.map(b=>{
      const s=sums(txOf(b.id)); const cnt=txOf(b.id).length;
      const staff=S.users.filter(u=>u.branchId===b.id);
      return `<div class="mi">
        <div class="mi-top"><div><strong>${esc(b.name)}</strong> <span class="num hint">${esc(b.code||"")}</span><div class="hint">${esc(b.city||"")}</div></div>
          <div class="num">${rp(s.saldo)} <span class="hint">· ${cnt} transaksi</span></div></div>
        <div class="mi-inline">
          <button class="btn sm" data-open="${esc(b.id)}">Buka buku kas</button>
          <button class="btn sm" data-toggle="${esc(b.id)}">${b.active===false?"Aktifkan":"Nonaktifkan"}</button>
          ${cnt===0&&staff.length===0?`<button class="btn sm danger" data-delbranch="${esc(b.id)}">Hapus</button>`:""}
          ${b.active===false?`<span class="pill off">Nonaktif · kasir tidak bisa masuk</span>`:""}
        </div>
        <div class="staff">
          <div class="hint" style="font-weight:700">Akun kasir</div>
          ${staff.length? staff.map(u=>`<div class="staff-row"><span>${esc(u.name)} <span class="hint">${esc(u.email)}</span>${u.active===false?` <span class="pill off">Nonaktif</span>`:""}</span>
            <span class="mi-inline"><button class="btn ghost sm" data-reset="${esc(u.email)}">Kirim reset password</button><button class="btn ghost sm" data-staff="${esc(u.id)}">${u.active===false?"Aktifkan":"Nonaktifkan"}</button></span></div>`).join("")
            : `<div class="hint">Belum ada akun kasir.</div>`}
          <button class="link" data-staffform="${esc(b.id)}" style="justify-self:start">+ Tambah akun kasir</button>
          <form class="staff-form" data-staffsave="${esc(b.id)}" hidden novalidate>
            <div class="row3">
              <input name="name" placeholder="Nama kasir" aria-label="Nama kasir">
              <input name="email" type="email" placeholder="Email" aria-label="Email kasir" autocomplete="off">
              <input name="pw" type="text" placeholder="Password (min. 6)" aria-label="Password awal" autocomplete="new-password">
            </div>
            <p class="err" data-stafferr hidden></p>
            <button class="btn sm primary" type="submit" style="justify-self:start">Buat akun kasir</button>
          </form>
        </div>
      </div>`; }).join("") : `<div class="empty">Belum ada cabang. Isi formulir di samping untuk menambah cabang pertama.</div>`;
  }
}

function ledgerRows(bid){
  const all=txOf(bid).sort(sortTx);
  const start=S.month+"-01";
  let open=0; for(const t of all){ if(t.date<start) open += t.type==="in"?+t.amount:-t.amount; }
  let bal=open;
  const rows=all.filter(t=>String(t.date).startsWith(S.month)).map(t=>{ bal += t.type==="in"?+t.amount:-t.amount; return {t,bal}; });
  return {open,rows,close:bal};
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
      <td><div class="acts"><button class="btn ghost sm" data-kw="${esc(t.id)}">Kwitansi</button>${t.hasAtt?`<button class="btn ghost sm" data-att="${esc(t.id)}">Lampiran</button>`:""}${owner?`<button class="btn ghost sm danger" data-del="${esc(t.id)}">Hapus</button>`:""}</div></td>
    </tr>`).join("") : `<tr><td colspan="7" style="text-align:center;padding:26px" class="muted">Belum ada transaksi di bulan ini.</td></tr>`;
  return `<div class="ledger-wrap"><table>
    <thead><tr><th>Tgl</th><th>No.</th><th>Uraian</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th><th></th></tr></thead>
    <tbody><tr class="carry"><td colspan="5">Saldo awal bulan</td><td class="r num">${rpn(open)}</td><td></td></tr>${body}
    <tr class="carry"><td colspan="5">Saldo akhir bulan</td><td class="r num">${rpn(close)}</td><td></td></tr></tbody></table></div>`;
}

function setType(type){
  S.formType=type;
  document.querySelectorAll(".seg button").forEach(b=>b.classList.toggle("on",b.dataset.type===type));
  const l=$("#f-party-lbl"); if(l) l.textContent = type==="in"?"Diterima dari":"Dibayar kepada";
  const w=$("#f-att-wrap"); if(w) w.hidden = type!=="out";
  const s=$("#f-submit"); if(s && !S.busy) s.textContent = type==="in"?"Simpan uang masuk":"Simpan uang keluar";
}

/* ---------- actions ---------- */
async function doLogin(e){
  e.preventDefault();
  const email=$("#login-email").value.trim(), pw=$("#login-pw").value;
  if(!email||!pw){ showErr("#login-err","Isi email dan password."); return; }
  const btn=$("#login-btn"); btn.disabled=true; btn.textContent="Masuk…";
  try{ await signInWithEmailAndPassword(auth,email,pw); }
  catch(err){ showErr("#login-err",errText(err)); btn.disabled=false; btn.textContent="Masuk"; }
}

async function forgot(){
  const email=$("#login-email").value.trim();
  if(!email){ showErr("#login-err","Isi email Anda dulu, lalu tekan Lupa password."); return; }
  try{ await sendPasswordResetEmail(auth,email); showErr("#login-err",""); toast("Tautan reset password dikirim ke "+email); }
  catch(err){ showErr("#login-err",errText(err)); }
}

function makeCode(name){
  let base=name.replace(/cabang/i,"").replace(/[^A-Za-z]/g,"").toUpperCase().slice(0,3) || "CBG";
  if(base.length<3) base=(base+"XXX").slice(0,3);
  let code=base, i=2; while(S.branches.some(b=>b.code===code)){ code=base+i; i++; }
  return code;
}

async function addBranch(e){
  e.preventDefault();
  const name=$("#b-name").value.trim(), city=$("#b-city").value.trim();
  if(!name){ showErr("#b-err","Isi nama cabang."); return; }
  if(S.branches.some(b=>b.name.toLowerCase()===name.toLowerCase())){ showErr("#b-err","Nama cabang ini sudah ada."); return; }
  showErr("#b-err","");
  try{
    await setDoc(doc(collection(db,"branches")),{name,city,code:makeCode(name),active:true,createdAt:Date.now()});
    $("#b-name").value=""; $("#b-city").value="";
    toast("Cabang "+name+" ditambahkan. Sekarang buat akun kasirnya.");
  }catch(err){ showErr("#b-err",errText(err)); }
}

// Membuat akun kasir lewat instance Firebase kedua, supaya sesi owner tidak ikut berganti.
async function addStaff(form){
  const bid=form.dataset.staffsave;
  const name=form.name.value.trim(), email=form.email.value.trim(), pw=form.pw.value;
  const err=form.querySelector("[data-stafferr]");
  const show=m=>{ err.textContent=m||""; err.hidden=!m; };
  if(!name||!email){ show("Isi nama dan email kasir."); return; }
  if(pw.length<6){ show("Password minimal 6 karakter."); return; }
  if(isOwnerEmail(email)){ show("Email owner tidak bisa dipakai sebagai akun kasir."); return; }
  show("");
  const btn=form.querySelector("button[type=submit]"); btn.disabled=true; btn.textContent="Membuat akun…";
  const sec=initializeApp(firebaseConfig,"kasir-"+Date.now());
  try{
    const secAuth=initializeAuth(sec,{persistence:inMemoryPersistence});
    const cred=await createUserWithEmailAndPassword(secAuth,email,pw);
    await setDoc(doc(db,"users",cred.user.uid),{name,email,role:"cabang",branchId:bid,active:true,createdAt:Date.now()});
    await signOut(secAuth);
    toast(`Akun kasir ${name} dibuat. Berikan email dan password-nya ke kasir.`);
    form.reset(); form.hidden=true;
  }catch(e){ show(errText(e)); }
  finally{ btn.disabled=false; btn.textContent="Buat akun kasir"; deleteApp(sec).catch(()=>{}); }
}

async function readAttachment(file){
  if(!file) return null;
  if(file.type==="application/pdf"){
    if(file.size>500*1024) throw new Error("File PDF terlalu besar (maks 500 KB). Lampirkan foto kwitansi sebagai gantinya.");
    const dataUrl=await new Promise((res,rej)=>{const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(new Error("File tidak bisa dibaca.")); r.readAsDataURL(file);});
    return {name:file.name,mime:"application/pdf",dataUrl};
  }
  if(!file.type.startsWith("image/")) throw new Error("Lampiran harus berupa foto atau PDF.");
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error("Foto tidak bisa dibaca.")); i.src=url;});
    let max=1600,q=0.75;
    for(let k=0;k<8;k++){
      const sc=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.round(img.naturalWidth*sc), h=Math.round(img.naturalHeight*sc);
      const c=document.createElement("canvas"); c.width=w; c.height=h;
      const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,w,h); g.drawImage(img,0,0,w,h);
      const d=c.toDataURL("image/jpeg",q);
      if(d.length<650000) return {name:file.name,mime:"image/jpeg",dataUrl:d,w,h};
      max*=0.8; q=Math.max(0.45,q-0.06);
    }
    throw new Error("Foto terlalu besar untuk disimpan. Coba foto ulang dengan resolusi lebih kecil.");
  } finally { URL.revokeObjectURL(url); }
}

async function saveTx(e){
  e.preventDefault();
  if(S.busy) return;
  const f=e.target;
  const bid = f.dataset.wb==="1" ? $("#f-branch").value : currentBranchId();
  const b=branchById(bid);
  const amount=+digits($("#f-amount").value);
  const date=$("#f-date").value, category=$("#f-cat").value.trim(), desc=$("#f-desc").value.trim(), party=$("#f-party").value.trim();
  if(!b){ showErr("#f-err","Pilih cabang dulu."); return; }
  if(!date){ showErr("#f-err","Isi tanggal."); return; }
  if(!amount){ showErr("#f-err","Isi jumlah uang."); return; }
  if(!desc){ showErr("#f-err","Isi keterangan transaksi."); return; }
  showErr("#f-err","");
  S.busy=true; const btn=$("#f-submit"); btn.disabled=true; btn.textContent="Menyimpan…";
  try{
    const type=S.formType;
    const att = type==="out" ? await readAttachment($("#f-att").files[0]) : null;
    const seq=S.tx.filter(t=>t.branchId===bid && t.type===type && String(t.date).slice(0,7)===date.slice(0,7)).length+1;
    const no=`${type==="in"?"KM":"KK"}/${b.code||"CBG"}/${date.slice(0,7).replace("-","")}/${String(seq).padStart(3,"0")}`;
    const id=newId();
    if(att) await setDoc(doc(db,"att",id),{branchId:bid,...att});
    const rec={branchId:bid,type,amount,date,category,desc,party,no,hasAtt:!!att,by:S.role,createdBy:S.user.uid,createdAt:Date.now()};
    await setDoc(doc(db,"tx",id),rec);
    $("#f-amount").value=""; $("#f-desc").value=""; $("#f-party").value=""; $("#f-cat").value=""; const fa=$("#f-att"); if(fa) fa.value="";
    toast(`Tersimpan · ${no}`);
    if(type==="out") openKwitansi({id,...rec});
  }catch(err){ showErr("#f-err",errText(err)); }
  finally{ S.busy=false; btn.disabled=false; setType(S.formType); }
}

/* ---------- kwitansi ---------- */
function closeModal(){ $("#modal-root").innerHTML=""; }
function openModal(html){
  $("#modal-root").innerHTML=`<div class="overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const f=$("#modal-root .modal button"); if(f) f.focus();
}
const kwLabels = t => t.type==="in"
  ? {title:"Kwitansi Penerimaan",party:"Telah terima dari",left:"Penyetor",right:"Kasir"}
  : {title:"Kwitansi Pengeluaran",party:"Dibayarkan kepada",left:"Kasir",right:"Penerima"};
const placeOf = b => (b.city||b.name||"").split(",").pop().trim();

function openKwitansi(t){
  const b=branchById(t.branchId)||{name:"-",city:""};
  const L=kwLabels(t);
  openModal(`
    <div class="kw">
      <div class="kw-top"><div><strong>${COMPANY}</strong><span>Cabang ${esc(b.name)}${b.city?" · "+esc(b.city):""}</span></div>
        <div class="kw-title">${L.title}<span>No. ${esc(t.no)}</span></div></div>
      <dl>
        <dt>${L.party}</dt><dd>${esc(t.party||"-")}</dd>
        <dt>Uang sejumlah</dt><dd class="terbilang">${esc(terbilang(t.amount))}</dd>
        <dt>Untuk pembayaran</dt><dd>${esc(t.desc||"-")}</dd>
        ${t.category?`<dt>Kategori</dt><dd>${esc(t.category)}</dd>`:""}
      </dl>
      <div class="kw-foot"><div class="kw-amt">${rp(t.amount)}</div>
        <div class="kw-sign"><span class="place">${esc(placeOf(b))}, ${esc(fmtDate(t.date))}</span>
          <span>${L.left}<div class="line">&nbsp;</div></span><span>${L.right}<div class="line">${t.type==="out"?esc(t.party||" "):"&nbsp;"}</div></span></div></div>
    </div>
    <p class="err" id="kw-err" hidden></p>
    <div class="modal-acts">
      ${t.hasAtt?`<button class="btn" data-att="${esc(t.id)}">Lihat lampiran</button>`:""}
      <button class="btn" data-close>Tutup</button>
      <button class="btn primary" id="kw-pdf">Unduh PDF kwitansi</button>
    </div>`);
  S.kwTx=t;
}

async function getAtt(id){ const s=await getDoc(doc(db,"att",id)); return s.exists()? s.data(): null; }

async function downloadPdf(){
  const t=S.kwTx; if(!t) return;
  if(!window.jspdf){ showErr("#kw-err","Pembuat PDF belum termuat. Periksa koneksi lalu muat ulang halaman."); return; }
  const btn=$("#kw-pdf"); btn.disabled=true; btn.textContent="Menyiapkan PDF…";
  try{
    const b=branchById(t.branchId)||{name:"-",city:""};
    const L=kwLabels(t);
    const pdf=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a5"});
    pdf.setDrawColor(30); pdf.setLineWidth(0.5); pdf.rect(8,8,194,132);
    pdf.setFont("helvetica","bold"); pdf.setFontSize(14); pdf.text(COMPANY,14,19);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize("Cabang "+b.name+(b.city?" - "+b.city:""),110),14,24.5);
    pdf.setFont("helvetica","bold"); pdf.setFontSize(12); pdf.text(L.title.toUpperCase(),196,19,{align:"right"});
    pdf.setFont("courier","normal"); pdf.setFontSize(9.5); pdf.text("No. "+t.no,196,24.5,{align:"right"});
    pdf.setLineWidth(0.3); pdf.line(14,30,196,30);
    let y=40;
    const row=(label,val,opts={})=>{
      pdf.setFont("helvetica","normal"); pdf.setFontSize(10); pdf.setTextColor(90); pdf.text(label,14,y); pdf.text(":",56,y);
      pdf.setTextColor(20); pdf.setFont("helvetica",opts.italic?"italic":"normal");
      const lines=pdf.splitTextToSize(val||"-",134);
      if(opts.fill){ pdf.setFillColor(235,241,238); pdf.rect(59,y-4.6,137,lines.length*5+2.6,"F"); }
      pdf.text(lines,61,y); y+=Math.max(9,lines.length*5+4);
    };
    row(L.party,t.party);
    row("Uang sejumlah",terbilang(t.amount),{italic:true,fill:true});
    row("Untuk pembayaran",t.desc);
    if(t.category) row("Kategori",t.category);
    pdf.setLineWidth(0.6); pdf.rect(14,106,72,14);
    pdf.setFont("courier","bold"); pdf.setFontSize(14); pdf.setTextColor(20); pdf.text(rp(t.amount),18,115.5);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.setTextColor(60);
    pdf.text(placeOf(b)+", "+fmtDate(t.date),196,103,{align:"right"});
    pdf.text(L.left,128,109,{align:"center"}); pdf.text(L.right,172,109,{align:"center"});
    pdf.setLineWidth(0.3); pdf.line(108,128,148,128); pdf.line(152,128,192,128);
    if(t.type==="out" && t.party) pdf.text(pdf.splitTextToSize(t.party,40)[0],172,132.5,{align:"center"});
    pdf.setFontSize(7); pdf.setTextColor(130); pdf.text("Dicatat di Buku Kas Aceh Mandiri Utama"+(t.hasAtt?" - bukti terlampir":""),14,136);
    if(t.hasAtt){
      const a=await getAtt(t.id);
      if(a && a.mime && a.mime.startsWith("image/")){
        pdf.addPage("a5","landscape");
        pdf.setFont("helvetica","bold"); pdf.setFontSize(10); pdf.setTextColor(20); pdf.text("Lampiran bukti - No. "+t.no,14,16);
        let w=a.w||1000,h=a.h||750; const sc=Math.min(182/w,118/h); w*=sc; h*=sc;
        pdf.addImage(a.dataUrl,"JPEG",14+(182-w)/2,22,w,h);
      }
    }
    pdf.save(t.no.replace(/\//g,"-")+".pdf");
  }catch(e){ showErr("#kw-err","PDF gagal dibuat: "+errText(e)); }
  finally{ btn.disabled=false; btn.textContent="Unduh PDF kwitansi"; }
}

async function openAttachment(id){
  const t=S.tx.find(x=>x.id===id); if(!t) return;
  openModal(`<h2>Lampiran · ${esc(t.no)}</h2><div id="att-body" class="loading" style="padding:30px 0">Memuat lampiran…</div><div class="modal-acts"><button class="btn" data-kw="${esc(id)}">Kembali ke kwitansi</button><button class="btn" data-close>Tutup</button></div>`);
  let a=null; try{ a=await getAtt(id); }catch(e){}
  const body=$("#att-body"); if(!body) return;
  body.className="";
  if(!a){ body.textContent="Lampiran tidak ditemukan."; return; }
  if(a.mime.startsWith("image/")) body.innerHTML=`<img class="att-img" alt="Foto kwitansi ${esc(t.no)}" src="${a.dataUrl}">`;
  else { body.innerHTML=`<p>File PDF: <b>${esc(a.name)}</b></p><button class="btn primary" id="att-dl" style="margin-top:10px">Unduh lampiran PDF</button>`;
    $("#att-dl").onclick=()=>downloadBlob(a.name||"lampiran.pdf",dataUrlToBlob(a.dataUrl)); }
}

function exportCsv(){
  const bid=currentBranchId(); const b=branchById(bid); if(!b) return;
  const {open,rows,close}=ledgerRows(bid);
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const lines=[["Tanggal","No","Jenis","Kategori","Keterangan","Pihak","Masuk","Keluar","Saldo"].join(",")];
  lines.push(["","","","","Saldo awal bulan","","","",open].map(q).join(","));
  for(const {t,bal} of rows) lines.push([t.date,t.no,t.type==="in"?"Masuk":"Keluar",t.category,t.desc,t.party,t.type==="in"?t.amount:"",t.type==="out"?t.amount:"",bal].map(q).join(","));
  lines.push(["","","","","Saldo akhir bulan","","","",close].map(q).join(","));
  downloadBlob(`kas-${b.code||"cabang"}-${S.month}.csv`, new Blob(["﻿"+lines.join("\n")],{type:"text/csv"}));
}

const armed=new Map();
function arm(btn,key,label){
  if(armed.get(key)){ armed.delete(key); return true; }
  armed.set(key,true); const old=btn.textContent; btn.textContent=label;
  setTimeout(()=>{ armed.delete(key); if(btn.isConnected) btn.textContent=old; },3500);
  return false;
}

/* ---------- events ---------- */
document.addEventListener("click", async e=>{
  const el=e.target.closest("button,.overlay"); if(!el) return;
  if(el.id==="overlay"){ if(e.target===el) closeModal(); return; }
  const d=el.dataset;
  if(el.id==="logout"||el.id==="logout2"){ closeModal(); await signOut(auth); return; }
  if(el.id==="forgot") return forgot();
  if(d.go){ if(S.role!=="owner") return; S.view=d.go; return renderView(); }
  if(d.open){ if(S.role!=="owner") return; S.view="cabang"; S.detailId=d.open; window.scrollTo(0,0); return renderView(); }
  if(d.type) return setType(d.type);
  if(d.kw){ const t=S.tx.find(x=>x.id===d.kw); if(t) openKwitansi(t); return; }
  if(d.att) return openAttachment(d.att);
  if(el.id==="kw-pdf") return downloadPdf();
  if(d.close!==undefined) return closeModal();
  if(el.id==="csv") return exportCsv();
  if(S.role!=="owner") return;
  if(d.del){
    if(!arm(el,"del"+d.del,"Yakin hapus?")) return;
    try{ const t=S.tx.find(x=>x.id===d.del); await deleteDoc(doc(db,"tx",d.del)); if(t&&t.hasAtt) await deleteDoc(doc(db,"att",d.del)); toast("Transaksi dihapus"); }
    catch(err){ toast(errText(err)); }
    return;
  }
  if(d.toggle){ const b=branchById(d.toggle); if(!b) return;
    try{ await updateDoc(doc(db,"branches",b.id),{active:b.active===false}); toast(b.active===false?"Cabang diaktifkan":"Cabang dinonaktifkan"); }catch(err){ toast(errText(err)); } return; }
  if(d.delbranch){
    if(!arm(el,"db"+d.delbranch,"Yakin hapus cabang?")) return;
    try{ await deleteDoc(doc(db,"branches",d.delbranch)); toast("Cabang dihapus"); }catch(err){ toast(errText(err)); } return; }
  if(d.staffform){ const f=document.querySelector(`[data-staffsave="${CSS.escape(d.staffform)}"]`); if(f){ f.hidden=!f.hidden; if(!f.hidden) f.name.focus(); } return; }
  if(d.staff){ const u=S.users.find(x=>x.id===d.staff); if(!u) return;
    try{ await updateDoc(doc(db,"users",u.id),{active:u.active===false}); toast(u.active===false?"Akun kasir diaktifkan":"Akun kasir dinonaktifkan"); }catch(err){ toast(errText(err)); } return; }
  if(d.reset){ try{ await sendPasswordResetEmail(auth,d.reset); toast("Tautan reset password dikirim ke "+d.reset); }catch(err){ toast(errText(err)); } return; }
});

document.addEventListener("submit", e=>{
  const f=e.target;
  if(f.id==="login-form") return doLogin(e);
  if(f.id==="branch-form") return addBranch(e);
  if(f.id==="tx-form") return saveTx(e);
  if(f.dataset.staffsave){ e.preventDefault(); return addStaff(f); }
});
document.addEventListener("input", e=>{
  if(e.target.id==="f-amount"){ const v=digits(e.target.value); e.target.value = v ? (+v).toLocaleString("id-ID") : ""; }
});
document.addEventListener("change", e=>{
  if(e.target.id==="month" && e.target.value){ S.month=e.target.value; fill(); }
});
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });
