/* Cloud sync: Firebase Auth (Google) + Firestore. localStorage stays the working copy. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var app = initializeApp({
  apiKey: "AIzaSyAVkKFjBZBDKPmD1gB-xsXgWCnMOMLAgGg",
  authDomain: "fitness-tracker-51846.firebaseapp.com",
  projectId: "fitness-tracker-51846",
  storageBucket: "fitness-tracker-51846.firebasestorage.app",
  messagingSenderId: "457469591592",
  appId: "1:457469591592:web:2b346a16dc88a3b28d751d"
});
var auth = getAuth(app), db = getFirestore(app);

var STATE_KEY = "ftStateV1", RIDES_KEY = "ftRidesV1", META_KEY = "ftSyncMetaV1";
var guest = sessionStorage.getItem("byamGuest") === "1";
var user = null, status = "Not signed in", timer = null, busy = false, applying = false;

function jget(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
function meta(){ return jget(META_KEY, { ts: 0, synced: 0 }); }
function setMeta(m){ localStorage.setItem(META_KEY, JSON.stringify(m)); }

/* mark local changes */
var origSet = Storage.prototype.setItem;
Storage.prototype.setItem = function(k, v){
  origSet.call(this, k, v);
  if(this === localStorage && (k === STATE_KEY || k === RIDES_KEY) && !applying){
    var m = meta(); m.ts = Date.now(); origSet.call(localStorage, META_KEY, JSON.stringify(m));
    schedulePush();
  }
};

function schedulePush(){
  if(!user) return;
  setStatus("Saving…");
  clearTimeout(timer); timer = setTimeout(function(){ push().catch(fail); }, 1500);
}
function fail(e){ console.error(e); setStatus("Sync error: " + (e && e.code || e && e.message || e)); }

function userRef(p){ return doc(db, "users", user.uid, "data", p); }
function ridesCol(){ return collection(db, "users", user.uid, "rides"); }
function packRide(r){ var o = Object.assign({}, r); o.pts = JSON.stringify(r.pts || []); o.id = String(r.id); return o; }
function unpackRide(o){
  var r = Object.assign({}, o);
  try{ r.pts = JSON.parse(o.pts || "[]"); }catch(e){ r.pts = []; }
  var n = Number(o.id); r.id = isNaN(n) ? o.id : n;
  return r;
}

async function readCloud(){
  var s = await getDoc(userRef("state"));
  var rs = await getDocs(ridesCol());
  var rides = []; rs.forEach(function(d){ rides.push(unpackRide(d.data())); });
  return { state: s.exists() ? { obj: JSON.parse(s.data().json), updated: s.data().updated || 0 } : null, rides: rides };
}

async function push(){
  if(!user || busy) return; busy = true;
  try{
    var now = Date.now();
    var st = jget(STATE_KEY, null), rides = jget(RIDES_KEY, []);
    if(st) await setDoc(userRef("state"), { json: JSON.stringify(st), updated: now });
    var cloud = await getDocs(ridesCol()), have = {};
    cloud.forEach(function(d){ have[d.id] = d.data(); });
    var ids = {};
    for(var i = 0; i < rides.length; i++){
      var p = packRide(rides[i]); ids[p.id] = 1;
      var old = have[p.id];
      if(!old || JSON.stringify(old) !== JSON.stringify(p)) await setDoc(doc(db, "users", user.uid, "rides", p.id), p);
    }
    for(var id in have){ if(!ids[id]) await deleteDoc(doc(db, "users", user.uid, "rides", id)); }
    var m = meta(); m.synced = now; m.ts = Math.min(m.ts, now); setMetaQuiet(m);
    setStatus("Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  } finally { busy = false; }
}
function setMetaQuiet(m){ origSet.call(localStorage, META_KEY, JSON.stringify(m)); }

function mergeStates(c, l){
  var o = Object.assign({}, c);
  ["ticks", "habits", "meals", "football"].forEach(function(k){ o[k] = Object.assign({}, l[k] || {}, c[k] || {}); });
  var seen = {}; (c.weights || []).forEach(function(w){ seen[w.date] = 1; });
  o.weights = (c.weights || []).concat((l.weights || []).filter(function(w){ return !seen[w.date]; })).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  var ts = {}; (c.sessions || []).forEach(function(s){ ts[s.ts] = 1; });
  o.sessions = (c.sessions || []).concat((l.sessions || []).filter(function(s){ return !ts[s.ts]; }));
  return o;
}

function applyLocal(state, rides){
  applying = true;
  try{
    if(state) origSet.call(localStorage, STATE_KEY, JSON.stringify(state));
    origSet.call(localStorage, RIDES_KEY, JSON.stringify(rides));
  } finally { applying = false; }
}

async function reconcile(){
  if(!user) return;
  setStatus("Syncing…");
  var cloud = await readCloud(), m = meta();
  var lState = jget(STATE_KEY, null), lRides = jget(RIDES_KEY, []);
  var localHas = !!lState || lRides.length > 0;
  if(!cloud.state && cloud.rides.length === 0){
    if(localHas){ await push(); } else setStatus("Signed in");
    return;
  }
  if(m.synced === 0){
    /* first time on this device: merge phone data into cloud data */
    var byId = {}; lRides.forEach(function(r){ byId[r.id] = r; }); cloud.rides.forEach(function(r){ byId[r.id] = r; });
    var rides = Object.keys(byId).map(function(k){ return byId[k]; });
    var state = cloud.state ? (lState ? mergeStates(cloud.state.obj, lState) : cloud.state.obj) : lState;
    applyLocal(state, rides);
    await push();
    location.reload();
    return;
  }
  var cloudTs = cloud.state ? cloud.state.updated : 0;
  if(cloudTs > m.ts && cloudTs > m.synced){
    applyLocal(cloud.state ? cloud.state.obj : lState, cloud.rides);
    m.synced = Date.now(); m.ts = m.synced; setMetaQuiet(m);
    location.reload();
    return;
  }
  if(m.ts > m.synced) await push();
  else setStatus("Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
}

/* ---------- UI ---------- */
var btn, sheet;
function el(h){ var d = document.createElement("div"); d.innerHTML = h; return d.firstChild; }
function setStatus(s){
  status = s;
  if(btn) btn.textContent = user ? (/error/i.test(s) ? "⚠ Sync" : /Sav|Sync…/.test(s) ? "⟳ Sync" : "☁ Synced") : (guest ? "Guest" : "Sign in");
  var t = document.getElementById("ftSyncStatus"); if(t) t.textContent = (user ? user.email + " · " : "") + s;
}
function buildUI(){
  var css = document.createElement("style");
  css.textContent = "#ftSyncBtn{position:fixed;right:10px;bottom:92px;z-index:9999;background:#ff7a1a;color:#fff;border:0;border-radius:20px;padding:9px 14px;font:600 13px Barlow,system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.5)}" +
    "#ftSyncSheet{position:fixed;left:0;right:0;bottom:0;z-index:10000;background:#121c28;color:#fff;border-top:1px solid #2a3a4c;padding:16px;font:15px Barlow,system-ui,sans-serif;display:none}" +
    "#ftSyncSheet button{display:block;width:100%;margin:8px 0 0;padding:12px;border-radius:12px;border:1px solid #2a3a4c;background:#1b2a3a;color:#fff;font:600 15px Barlow,system-ui,sans-serif}" +
    "#ftSyncSheet button.pri{background:#ff7a1a;border-color:#ff7a1a}#ftSyncSheet p{margin:0 0 4px;color:#9fb0c3;font-size:13px}";
  document.head.appendChild(css);
  btn = el('<button id="ftSyncBtn">Sign in</button>');
  sheet = el('<div id="ftSyncSheet"><p id="ftSyncStatus"></p><div id="ftSyncBody"></div><button id="ftClose">Close</button></div>');
  document.body.appendChild(btn); document.body.appendChild(sheet);
  btn.onclick = function(){ sheet.style.display = sheet.style.display === "block" ? "none" : "block"; renderSheet(); };
  sheet.querySelector("#ftClose").onclick = function(){ sheet.style.display = "none"; };
  setStatus(status);
}
function renderSheet(){
  var b = document.getElementById("ftSyncBody");
  b.innerHTML = (user ? '<button id="ftNow" class="pri">Sync now</button><button id="ftProf">Edit profile</button><button id="ftOut">Sign out</button>' : (guest ? '<p>Guest mode: records are not saved.</p><button id="ftIn" class="pri">Sign in with Google</button><button id="ftExitG">Exit guest</button>' : '<button id="ftIn" class="pri">Sign in with Google</button>')) +
    '<button id="ftExp">Export backup</button><label><button id="ftImpB" type="button">Import backup</button><input id="ftImp" type="file" accept="application/json" style="display:none"></label>';
  var q = function(i){ return b.querySelector(i); };
  if(q("#ftIn")) q("#ftIn").onclick = function(){
    googleSignIn();
  };
  if(q("#ftExitG")) q("#ftExitG").onclick = function(){ sessionStorage.clear(); location.reload(); };
  if(q("#ftProf")) q("#ftProf").onclick = function(){ sheet.style.display = "none"; showProfile(true); };
  if(q("#ftOut")) q("#ftOut").onclick = function(){ doSignOut(); };
  if(q("#ftNow")) q("#ftNow").onclick = function(){ reconcile().catch(fail); };
  q("#ftExp").onclick = function(){
    var data = { app: "fitness-tracker", exported: new Date().toISOString(), state: jget(STATE_KEY, null), rides: jget(RIDES_KEY, []) };
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = "fitness-backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
  };
  q("#ftImpB").onclick = function(){ q("#ftImp").click(); };
  q("#ftImp").onchange = function(){
    var f = this.files[0]; if(!f) return;
    f.text().then(function(t){
      var d = JSON.parse(t);
      if(d.app !== "fitness-tracker" || !Array.isArray(d.rides)) throw new Error("bad file");
      if(!confirm("Replace the data on this device with this backup?")) return;
      origSet.call(localStorage, RIDES_KEY, JSON.stringify(d.rides));
      if(d.state) origSet.call(localStorage, STATE_KEY, JSON.stringify(d.state));
      var m = meta(); m.ts = Date.now(); setMetaQuiet(m);
      if(user) push().then(function(){ location.reload(); }, fail); else location.reload();
    }).catch(function(){ setStatus("Import error: not a valid backup file"); });
  };
}

if(document.body) buildUI(); else document.addEventListener("DOMContentLoaded", buildUI);
function googleSignIn(){
  var wasGuest = guest;
  return signInWithPopup(auth, new GoogleAuthProvider()).then(function(){
    if(wasGuest){ sessionStorage.clear(); location.reload(); }
  }).catch(function(e){ setStatus("Sign-in error: " + (e.code || e.message)); var m = document.getElementById("byamGateMsg"); if(m) m.textContent = "Sign-in failed: " + (e.code || e.message); });
}
async function doSignOut(){
  try{ if(user && meta().ts > meta().synced) await push(); }catch(e){}
  await signOut(auth);
  var ks = []; for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(k && k.indexOf("ft") === 0) ks.push(k); }
  ks.forEach(function(k){ localStorage.removeItem(k); });
  localStorage.removeItem("byamSeen");
  location.reload();
}

/* ---------- gate: sign-in screen, guest, first-time profile ---------- */
var BTN = "display:block;width:100%;margin:10px 0 0;padding:14px;border-radius:14px;border:1px solid #2a3a4c;background:#1b2a3a;color:#fff;font:600 16px Barlow,system-ui,sans-serif";
var INP = "display:block;width:100%;box-sizing:border-box;margin:4px 0 12px;padding:12px;border-radius:12px;border:1px solid #2a3a4c;background:#121c28;color:#fff;font:500 16px Barlow,system-ui,sans-serif";
function gateBox(){ var g = document.getElementById("byamGate"); if(!g) return null; g.setAttribute("data-ready", "1"); return document.getElementById("byamGateBox"); }
function hideGate(){ var g = document.getElementById("byamGate"); if(g) g.remove(); }
function showSignIn(){
  var b = gateBox(); if(!b) return;
  b.style.cssText = "width:100%;max-width:340px;padding:24px;text-align:center;font-weight:500";
  b.innerHTML = '<div style="font:700 44px Barlow Condensed,Barlow,sans-serif;letter-spacing:.25em;color:#ff7a1a;margin-bottom:6px">BYAM</div>' +
    '<p style="margin:0 0 22px;color:#9fb0c3;font-size:15px">Sign in to save your workouts, rides and weight.</p>' +
    '<button id="gIn" style="' + BTN + ';background:#ff7a1a;border-color:#ff7a1a">Continue with Google</button>' +
    '<button id="gGuest" style="' + BTN + '">Continue as guest</button>' +
    '<p style="margin:12px 0 0;color:#9fb0c3;font-size:13px">Guest records are not saved. They disappear when you close the app.</p>' +
    '<p id="byamGateMsg" style="margin:10px 0 0;color:#ff8a8a;font-size:13px"></p>';
  b.querySelector("#gIn").onclick = function(){ googleSignIn(); };
  b.querySelector("#gGuest").onclick = function(){ sessionStorage.setItem("byamGuest", "1"); location.reload(); };
}
function showProfile(edit){
  var S = FT.load(), P = S.profile || {};
  var g = document.getElementById("byamGate");
  if(!g){
    g = document.createElement("div"); g.id = "byamGate";
    g.style.cssText = "position:fixed;inset:0;z-index:20000;background:#0a1119;color:#fff;display:flex;align-items:center;justify-content:center;font:600 18px Barlow,system-ui,sans-serif;overflow:auto";
    g.innerHTML = '<div id="byamGateBox"></div>'; document.body.appendChild(g);
  }
  var b = gateBox();
  var f = function(id, label, val, type, ph){ return '<label style="display:block;text-align:left;font-size:13px;color:#9fb0c3">' + label + '<input id="' + id + '" type="' + type + '" value="' + (val == null ? "" : String(val).replace(/"/g, "&quot;")) + '" placeholder="' + (ph || "") + '" style="' + INP + '"></label>'; };
  b.style.cssText = "width:100%;max-width:340px;padding:24px;font-weight:500";
  b.innerHTML = '<div style="font:700 30px Barlow Condensed,Barlow,sans-serif;letter-spacing:.2em;color:#ff7a1a;text-align:center;margin-bottom:4px">' + (edit ? "YOUR PROFILE" : "WELCOME TO BYAM") + '</div>' +
    '<p style="margin:0 0 16px;color:#9fb0c3;font-size:14px;text-align:center">' + (edit ? "Update your details." : "Tell us about you once. Only your login can see this.") + '</p>' +
    f("pName", "Name", P.name || (user && user.displayName) || "", "text") +
    f("pAge", "Age", P.age, "number") +
    f("pH", "Height (cm)", P.heightCm, "number") +
    f("pW", "Current weight (kg)", P.weightKg, "number") +
    f("pG", "Goal weight (kg), optional", P.goalKg, "number") +
    '<p id="pErr" style="margin:0;color:#ff8a8a;font-size:13px;min-height:16px"></p>' +
    '<button id="pSave" style="' + BTN + ';background:#ff7a1a;border-color:#ff7a1a">' + (edit ? "Save" : "Start") + '</button>' +
    (edit ? '<button id="pCancel" style="' + BTN + '">Cancel</button>' : "");
  var v = function(id){ return b.querySelector("#" + id).value.trim(); };
  if(edit) b.querySelector("#pCancel").onclick = hideGate;
  b.querySelector("#pSave").onclick = async function(){
    var name = v("pName"), h = parseFloat(v("pH")), w = parseFloat(v("pW")), a = parseFloat(v("pAge")), gl = parseFloat(v("pG"));
    var err = b.querySelector("#pErr");
    if(!name){ err.textContent = "Enter your name."; return; }
    if(!(h >= 100 && h <= 250)){ err.textContent = "Height should be 100 to 250 cm."; return; }
    if(!(w >= 30 && w <= 250)){ err.textContent = "Weight should be 30 to 250 kg."; return; }
    if(v("pAge") && !(a >= 10 && a <= 100)){ err.textContent = "Age should be 10 to 100."; return; }
    var S2 = FT.load();
    S2.profile = { name: name, age: isNaN(a) ? null : a, heightCm: h, weightKg: w, goalKg: isNaN(gl) ? null : gl };
    if(!S2.startKg || !edit) S2.startKg = w;
    FT.save(S2);
    this.disabled = true; this.textContent = "Saving...";
    try{ await push(); }catch(e){}
    location.reload();
  };
}

var authSeen = false;
setTimeout(function(){ if(!authSeen && !guest) showSignIn(); }, 3500);
onAuthStateChanged(auth, function(u){
  authSeen = true; user = u;
  if(u){
    setStatus("Signed in");
    localStorage.setItem("byamSeen", "1");
    reconcile().then(function(){
      var st = jget(STATE_KEY, null);
      if(!st || !st.profile) showProfile(false); else hideGate();
    }).catch(function(e){ fail(e); hideGate(); });
  } else {
    setStatus("Not signed in");
    if(guest) hideGate(); else showSignIn();
  }
  var s = document.getElementById("ftSyncBody"); if(s) renderSheet();
});
document.addEventListener("visibilitychange", function(){ if(!document.hidden && user && !busy) reconcile().catch(fail); });
