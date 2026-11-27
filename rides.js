(function(){
"use strict";
var KEY="ftRidesV1", ACT="ftRideActiveV1";
var view=document.getElementById("view");
document.getElementById("nav").innerHTML=FT.nav("rides");

function loadRides(){ try{ return JSON.parse(localStorage.getItem(KEY))||[]; }catch(e){ return []; } }
function saveRides(r){ localStorage.setItem(KEY,JSON.stringify(r)); }
function loadAct(){ try{ return JSON.parse(localStorage.getItem(ACT)); }catch(e){ return null; } }
function saveAct(a){ try{ if(a) localStorage.setItem(ACT,JSON.stringify(a)); else localStorage.removeItem(ACT); }catch(e){} }

function hav(a,b,c,d){
  var R=6371000,r=Math.PI/180,dLat=(c-a)*r,dLon=(d-b)*r;
  var x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return 2*R*Math.asin(Math.sqrt(x));
}
function kmh(ms){ return ms*3.6; }
function f1(n){ return (Math.round(n*10)/10).toFixed(1); }
function fmtT(sec){
  sec=Math.max(0,Math.round(sec));
  var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;
  function p(n){ return (n<10?"0":"")+n; }
  return h>0 ? h+":"+p(m)+":"+p(s) : m+":"+p(s);
}
function fmtDate(ts){
  var d=new Date(ts);
  return d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})+", "+
    d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
}
function colorFor(v,lo,hi){
  var t=hi>lo?Math.min(1,Math.max(0,(v-lo)/(hi-lo))):0.5;
  var a=[74,163,255],b=[255,209,102],c=[255,107,53],x,y,u;
  if(t<.5){ x=a; y=b; u=t*2; } else { x=b; y=c; u=(t-.5)*2; }
  return "rgb("+Math.round(x[0]+(y[0]-x[0])*u)+","+Math.round(x[1]+(y[1]-x[1])*u)+","+Math.round(x[2]+(y[2]-x[2])*u)+")";
}
function tiles(){
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19,className:"darktiles",attribution:"&copy; OpenStreetMap contributors"});
}


/* ---------- image store (IndexedDB, stays on the phone) ---------- */
function idb(){
  return new Promise(function(res,rej){
    var q=indexedDB.open("ftRideImages",1);
    q.onupgradeneeded=function(){ q.result.createObjectStore("img"); };
    q.onsuccess=function(){ res(q.result); }; q.onerror=function(){ rej(q.error); };
  });
}
function idbPut(id,blob){ return idb().then(function(db){ return new Promise(function(res,rej){ var t=db.transaction("img","readwrite"); t.objectStore("img").put(blob,id); t.oncomplete=res; t.onerror=function(){rej(t.error);}; }); }); }
function idbGet(id){ return idb().then(function(db){ return new Promise(function(res){ var q=db.transaction("img").objectStore("img").get(id); q.onsuccess=function(){ res(q.result); }; q.onerror=function(){ res(null); }; }); }); }
function idbDel(id){ return idb().then(function(db){ return new Promise(function(res){ var t=db.transaction("img","readwrite"); t.objectStore("img").delete(id); t.oncomplete=res; t.onerror=res; }); }).catch(function(){}); }
function shrink(file){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(file), im=new Image();
    im.onload=function(){
      var sc=Math.min(1,900/im.width,2400/im.height), c=document.createElement("canvas");
      c.width=Math.round(im.width*sc); c.height=Math.round(im.height*sc);
      c.getContext("2d").drawImage(im,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ b?res(b):rej(new Error("x")); },"image/jpeg",0.82);
    };
    im.onerror=function(){ URL.revokeObjectURL(url); rej(new Error("x")); };
    im.src=url;
  });
}
function parseDur(v){
  v=String(v||"").trim(); if(!v) return 0;
  var p=v.split(":").map(Number);
  if(p.some(function(n){return isNaN(n)||n<0;})) return 0;
  if(p.length===1) return Math.round(p[0]*60);
  if(p.length===2) return p[0]*60+p[1];
  return p[0]*3600+p[1]*60+p[2];
}
function todayISO(){ return FT.todayStr(); }
function avgOf(r){ return r.avgKmh!=null?r.avgKmh:(r.moving?kmh(r.dist/r.moving):0); }

var map=null, watchId=null, wake=null, tick=null, act=null, marker=null, trail=null;

function killMap(){ if(map){ map.remove(); map=null; marker=null; trail=null; } }

/* ---------- idle / home ---------- */
function weekChart(rides){
  var now=new Date(), dow=(now.getDay()+6)%7, mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow).getTime();
  var km=[0,0,0,0,0,0,0], names=["M","T","W","T","F","S","S"];
  rides.forEach(function(r){
    var d=new Date(r.start), day=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    var i=Math.round((day-mon)/86400000);
    if(i>=0&&i<7) km[i]+=r.dist/1000;
  });
  var mx=Math.max.apply(null,km.concat([5]));
  return '<div class="chart">'+km.map(function(v,i){
    return '<div class="col'+(i===dow?' today':'')+'"><div class="cv">'+(v?f1(v):'-')+'</div><div class="cb"><i style="height:'+Math.round(v/mx*100)+'%"></i></div><div class="cl">'+names[i]+'</div></div>';
  }).join("")+'</div>';
}

function weekMonthKm(rides){
  var now=new Date(), wk=FT.weekKey(), w=0, m=0;
  rides.forEach(function(r){
    var d=new Date(r.start), ds=d.getFullYear()+"-"+(d.getMonth()+1<10?"0":"")+(d.getMonth()+1)+"-"+(d.getDate()<10?"0":"")+d.getDate();
    if(FT.weekKey(ds)===wk) w+=r.dist;
    if(d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()) m+=r.dist;
  });
  return {w:w/1000,m:m/1000};
}
function renderHome(){
  killMap(); stopTick();
  var rides=loadRides(), wm=weekMonthKm(rides), a=loadAct();
  var totalKm=rides.reduce(function(s,r){return s+r.dist;},0)/1000;
  var tk=FT.todayDayKey(), cyc=(FT.PLAN[tk]&&FT.PLAN[tk].type==="cycle");
  var h='<div class="hero"><p class="dateline">'+(cyc?"Cycling day today":"Ride tracker")+'</p><h1>Your <em>rides</em></h1>'+
    '<p>Live GPS map, speed and analysis. Keep this page open and the screen on while you ride.</p></div>';
  h+='<div class="statgrid">'+
    '<div class="stat"><div class="n">'+f1(wm.w)+'</div><div class="l">km this week</div></div>'+
    '<div class="stat"><div class="n">'+f1(wm.m)+'</div><div class="l">km this month</div></div>'+
    '<div class="stat"><div class="n">'+rides.length+'</div><div class="l">rides ('+f1(totalKm)+' km)</div></div></div>';
  if(a){
    h+='<div class="card"><h2>Unfinished ride</h2><p class="sub">'+f1(a.dist/1000)+' km from '+FT.esc(fmtDate(a.start))+'.</p>'+
      '<div class="rrow"><button class="btn orange" id="resume">Resume</button><button class="btn ghost" id="finishOld">Finish and save</button></div>'+
      '<button class="btn ghost" id="discardOld" style="margin-top:10px">Discard</button></div>';
  } else {
    h+='<div class="rrow" style="margin-top:6px"><button class="btn orange" id="addm">Add a ride</button><button class="btn ghost" id="start">Live GPS ride</button></div>'+
      '<p class="gpsnote">Add a ride: type the numbers from your band report. Live GPS: the screen has to stay on.</p>';
  }
  h+='<div class="sec-title">This week</div><div class="card">'+weekChart(rides)+'</div>';
  h+='<div class="sec-title">Ride history</div><div class="card" id="hist"></div>';
  h+='<div class="foot">Rides save on this device. Tracking only runs while this page is open.</div>';
  view.innerHTML=h;
  var hist=document.getElementById("hist");
  if(!rides.length){ hist.innerHTML='<div class="empty">No rides yet. Hit Start ride when you roll out.</div>'; }
  else{
    hist.innerHTML=rides.slice().reverse().map(function(r){
      return '<div class="rlist-row" data-id="'+r.id+'"><div class="d"><b>'+FT.esc(fmtDate(r.start))+'</b><span>'+
        fmtT(r.moving)+' · avg '+f1(avgOf(r))+' km/h'+(r.cal?' · '+r.cal+' kcal':'')+'</span></div><div class="km">'+f1(r.dist/1000)+' km</div></div>';
    }).join("");
    Array.prototype.forEach.call(hist.querySelectorAll(".rlist-row"),function(el){
      el.onclick=function(){ renderAnalysis(+el.getAttribute("data-id")); };
    });
  }
  var s=document.getElementById("start"); if(s) s.onclick=function(){ beginRide(); };
  var am=document.getElementById("addm"); if(am) am.onclick=function(){ renderForm(null); };
  var rs=document.getElementById("resume"); if(rs) rs.onclick=function(){ act=a; act.paused=true; renderTrack(); };
  var fo=document.getElementById("finishOld"); if(fo) fo.onclick=function(){ act=a; finishRide(); };
  var dc=document.getElementById("discardOld"); if(dc) dc.onclick=function(){ if(confirm("Discard this unfinished ride?")){ saveAct(null); renderHome(); } };
}

/* ---------- tracking ---------- */
function beginRide(){
  if(!navigator.geolocation){ alert("This browser has no GPS support."); return; }
  act={id:Date.now(),start:Date.now(),pts:[],dist:0,moving:0,max:0,activeMs:0,resumeTs:Date.now(),paused:false,cur:0,acc:null};
  saveAct(act);
  renderTrack();
}
function renderTrack(){
  killMap();
  var h='<div class="hero"><p class="dateline" id="gstat">Waiting for GPS...</p><h1>Ride <em>live</em></h1></div>';
  h+='<div class="rmap" id="map"></div>';
  h+='<div class="rspeed"><div class="v" id="spd">0.0</div><div class="u">km/h</div></div>';
  h+='<div class="rbig">'+
    '<div class="stat"><div class="n" id="tDist">0.00</div><div class="l">km</div></div>'+
    '<div class="stat"><div class="n" id="tTime">0:00</div><div class="l">ride time</div></div>'+
    '<div class="stat"><div class="n" id="tAvg">0.0</div><div class="l">avg km/h</div></div>'+
    '<div class="stat"><div class="n" id="tMax">0.0</div><div class="l">max km/h</div></div></div>';
  h+='<div class="rrow"><button class="btn orange" id="pause"></button><button class="btn stop" id="finish">Finish</button></div>';
  h+='<p class="gpsnote" id="gnote"></p>';
  view.innerHTML=h;
  if(window.L){
    map=L.map("map",{zoomControl:false,attributionControl:true}).setView([20.5,78.9],4);
    tiles().addTo(map);
    trail=L.polyline([],{color:"#ff6b35",weight:5,opacity:.95}).addTo(map);
    if(act.pts.length){
      trail.setLatLngs(act.pts.map(function(p){return [p[0],p[1]];}));
      map.fitBounds(trail.getBounds(),{padding:[30,30],maxZoom:17});
    }
  } else { document.getElementById("map").innerHTML='<div class="empty" style="padding:30px">Map could not load. Check your connection. Tracking still works.</div>'; }
  document.getElementById("pause").onclick=function(){ act.paused?resumeRide():pauseRide(); };
  document.getElementById("finish").onclick=function(){ if(confirm("Finish this ride?")) finishRide(); };
  paintPause(); updateStats();
  if(!act.paused) startWatch();
  startTick();
  lockScreen();
}
function paintPause(){
  var b=document.getElementById("pause"); if(!b) return;
  b.textContent=act.paused?"Resume":"Pause";
  document.getElementById("gnote").textContent=act.paused?"Paused. Distance and time are not counting.":"Keep the screen on. The browser stops GPS when the screen locks.";
}
function activeSec(){ return (act.activeMs+(act.paused?0:Date.now()-act.resumeTs))/1000; }
function startWatch(){
  if(watchId!==null) return;
  watchId=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:0,timeout:20000});
}
function stopWatch(){ if(watchId!==null){ navigator.geolocation.clearWatch(watchId); watchId=null; } }
function pauseRide(){
  act.activeMs+=Date.now()-act.resumeTs; act.paused=true; act.last=null; act.cur=0;
  stopWatch(); saveAct(act); paintPause(); updateStats();
}
function resumeRide(){
  act.paused=false; act.resumeTs=Date.now(); act.last=null; saveAct(act);
  startWatch(); paintPause();
}
function onErr(e){
  var n=document.getElementById("gstat"), g=document.getElementById("gnote");
  var msg=e.code===1?"Location blocked. Allow location for this site in browser settings.":(e.code===3?"GPS timed out, still trying...":"No GPS signal.");
  if(n) n.textContent=msg; if(g&&e.code===1){ g.textContent=msg; g.className="gpsnote bad"; }
}
function onPos(pos){
  if(!act||act.paused) return;
  var c=pos.coords, t=pos.timestamp||Date.now(), n=document.getElementById("gstat");
  act.acc=c.accuracy;
  if(n) n.textContent=c.accuracy<=15?"GPS strong":(c.accuracy<=40?"GPS ok ("+Math.round(c.accuracy)+" m)":"GPS weak ("+Math.round(c.accuracy)+" m)");
  if(c.accuracy>40) return;
  var ll=[c.latitude,c.longitude];
  if(marker===null&&map){ marker=L.circleMarker(ll,{radius:8,color:"#fff",weight:3,fillColor:"#ff6b35",fillOpacity:1}).addTo(map); map.setView(ll,17); }
  var last=act.last;
  if(!last){ act.last={la:ll[0],lo:ll[1],t:t}; act.pts.push([ll[0],ll[1],t,0]); persist(); moveMarker(ll); return; }
  var d=hav(last.la,last.lo,ll[0],ll[1]), dt=(t-last.t)/1000;
  if(dt<=0) return;
  var jitter=Math.max(3,c.accuracy*0.35);
  if(d<jitter){ act.cur=0; updateStats(); return; }
  var sp=d/dt;
  if(sp>22) return; /* >79 km/h, GPS jump */
  act.dist+=d;
  if(sp>0.8) act.moving+=dt;
  var s=(c.speed!=null&&c.speed>=0)?c.speed:sp;
  act.cur=act.cur?act.cur*0.5+s*0.5:s;
  if(s>act.max&&s<20) act.max=s;
  act.last={la:ll[0],lo:ll[1],t:t};
  act.pts.push([ll[0],ll[1],t,Math.round(s*100)/100]);
  persist(); moveMarker(ll);
  if(trail) trail.addLatLng(ll);
  updateStats();
}
var lastSave=0;
function persist(){ if(Date.now()-lastSave>3000){ lastSave=Date.now(); saveAct(act); } }
function moveMarker(ll){ if(marker){ marker.setLatLng(ll); if(map&&!map.getBounds().pad(-0.25).contains(ll)) map.panTo(ll); } }
function updateStats(){
  if(!act||!document.getElementById("spd")) return;
  document.getElementById("spd").textContent=f1(kmh(act.paused?0:act.cur));
  document.getElementById("tDist").textContent=(act.dist/1000).toFixed(2);
  document.getElementById("tTime").textContent=fmtT(activeSec());
  document.getElementById("tAvg").textContent=f1(act.moving?kmh(act.dist/act.moving):0);
  document.getElementById("tMax").textContent=f1(kmh(act.max));
}
function startTick(){ stopTick(); tick=setInterval(function(){ updateStats(); if(act&&!act.paused) saveAct(act); },1000); }
function stopTick(){ if(tick){ clearInterval(tick); tick=null; } }
function lockScreen(){
  try{ if(navigator.wakeLock) navigator.wakeLock.request("screen").then(function(w){ wake=w; }).catch(function(){}); }catch(e){}
}
function unlockScreen(){ try{ if(wake){ wake.release(); wake=null; } }catch(e){} }
document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="visible"&&act&&!act.paused&&document.getElementById("spd")) lockScreen(); });

function finishRide(){
  if(!act.paused) act.activeMs+=Date.now()-act.resumeTs;
  stopWatch(); stopTick(); unlockScreen();
  var r={id:act.id,start:act.start,end:Date.now(),dist:act.dist,moving:act.moving,elapsed:Math.round(act.activeMs/1000),max:act.max,pts:act.pts};
  saveAct(null); act=null;
  if(r.dist<50){ alert("Ride was under 50 m, so it was not saved."); renderHome(); return; }
  var all=loadRides(); all.push(r); saveRides(all);
  renderAnalysis(r.id);
}


/* ---------- manual ride form ---------- */
function renderForm(id){
  killMap(); stopTick();
  var r=id?loadRides().filter(function(x){return x.id===id;})[0]:null;
  var imgBlob=null, imgChanged=false, hadImg=!!(r&&r.img);
  function val(v){ return v==null||v===""?"":String(v); }
  var h='<div class="hero"><p class="dateline">'+(r?"Edit ride":"New ride")+'</p><h1>Add <em>ride</em></h1>'+
    '<p>Type the numbers from your band report. Only distance and time are needed.</p></div>';
  h+='<div class="card formcard">'+
    '<label class="flab">Date<input type="date" id="fDate" class="dateinput" value="'+(r?FT.todayStr().slice(0,0)+isoOf(r.start):todayISO())+'"></label>'+
    '<div class="frow"><label class="flab">Distance (km)<input type="number" inputmode="decimal" step="0.01" min="0" id="fKm" class="dateinput" placeholder="13.10" value="'+val(r?+(r.dist/1000).toFixed(2):"")+'"></label>'+
    '<label class="flab">Time (min:sec)<input type="text" inputmode="numeric" id="fTime" class="dateinput" placeholder="48:45" value="'+(r?fmtT(r.moving):"")+'"></label></div>'+
    '<div class="frow"><label class="flab">Avg speed (km/h)<input type="number" inputmode="decimal" step="0.01" min="0" id="fAvg" class="dateinput" placeholder="auto" value="'+val(r&&r.avgKmh!=null?+r.avgKmh.toFixed(2):"")+'"></label>'+
    '<label class="flab">Max speed (km/h)<input type="number" inputmode="decimal" step="0.01" min="0" id="fMax" class="dateinput" placeholder="29.76" value="'+val(r&&r.max?+kmh(r.max).toFixed(2):"")+'"></label></div>'+
    '<div class="frow"><label class="flab">Calories (kcal)<input type="number" inputmode="numeric" min="0" id="fCal" class="dateinput" placeholder="424" value="'+val(r&&r.cal)+'"></label>'+
    '<label class="flab">Avg heart rate<input type="number" inputmode="numeric" min="0" id="fHr" class="dateinput" placeholder="optional" value="'+val(r&&r.hr)+'"></label></div>'+
    '<label class="flab">Report image (optional)<input type="file" accept="image/*" id="fImg" class="dateinput"></label>'+
    '<div id="fPrev"></div>'+
    '<p class="gpsnote" style="text-align:left">The image stays on this phone only. It is not uploaded anywhere.</p>'+
    '<p class="gpsnote bad" id="fErr" style="text-align:left"></p>'+
    '<div class="rrow"><button class="btn orange" id="fSave">Save ride</button><button class="btn ghost" id="fCancel">Cancel</button></div></div>';
  view.innerHTML=h;
  var prev=document.getElementById("fPrev");
  function showPrev(b){ if(!b){ prev.innerHTML=""; return; } var u=URL.createObjectURL(b); prev.innerHTML='<img class="rimg" src="'+u+'" alt="Report preview">'; }
  if(hadImg) idbGet(r.id).then(function(b){ if(b&&!imgChanged) showPrev(b); });
  document.getElementById("fImg").onchange=function(){
    var f=this.files&&this.files[0]; if(!f) return;
    shrink(f).then(function(b){ imgBlob=b; imgChanged=true; showPrev(b); }).catch(function(){ document.getElementById("fErr").textContent="Could not read that image."; });
  };
  document.getElementById("fCancel").onclick=function(){ r?renderAnalysis(r.id):renderHome(); };
  document.getElementById("fSave").onclick=function(){
    var err=document.getElementById("fErr"); err.textContent="";
    var km=parseFloat(document.getElementById("fKm").value), sec=parseDur(document.getElementById("fTime").value);
    var ds=document.getElementById("fDate").value;
    if(!ds){ err.textContent="Pick a date."; return; }
    if(!(km>0)||km>500){ err.textContent="Enter the distance in km."; return; }
    if(!(sec>0)){ err.textContent="Enter the time like 48:45 (min:sec) or 1:05:30."; return; }
    var avg=parseFloat(document.getElementById("fAvg").value), mx=parseFloat(document.getElementById("fMax").value);
    var cal=parseInt(document.getElementById("fCal").value,10), hr=parseInt(document.getElementById("fHr").value,10);
    var p=ds.split("-"), start=new Date(+p[0],+p[1]-1,+p[2],12,0,0).getTime();
    if(r){ var t=new Date(r.start); start=new Date(+p[0],+p[1]-1,+p[2],t.getHours(),t.getMinutes(),0).getTime(); }
    var rec={id:r?r.id:Date.now(),manual:true,start:start,end:start+sec*1000,dist:km*1000,moving:sec,elapsed:sec,
      avgKmh:avg>0?avg:(km/(sec/3600)),max:mx>0?mx/3.6:0,cal:cal>0?cal:0,hr:hr>0?hr:0,img:hadImg||!!imgBlob,pts:[]};
    var all=loadRides();
    if(r){ all=all.map(function(x){ return x.id===r.id?rec:x; }); } else { all.push(rec); }
    saveRides(all);
    (imgChanged&&imgBlob?idbPut(rec.id,imgBlob):Promise.resolve()).then(function(){ renderAnalysis(rec.id); },function(){ renderAnalysis(rec.id); });
  };
}
function isoOf(ts){ var d=new Date(ts); function p(n){return (n<10?"0":"")+n;} return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }

function renderManual(r){
  var h='<div class="hero"><p class="dateline">'+FT.esc(fmtDate(r.start).split(",")[0]+" "+(new Date(r.start)).getDate()+" "+(new Date(r.start)).toLocaleDateString(undefined,{month:"short"}))+'</p><h1>Ride <em>report</em></h1></div>';
  h+='<div class="rbig">'+
    '<div class="stat"><div class="n">'+(r.dist/1000).toFixed(2)+'</div><div class="l">km</div></div>'+
    '<div class="stat"><div class="n">'+fmtT(r.moving)+'</div><div class="l">time</div></div>'+
    '<div class="stat"><div class="n">'+f1(avgOf(r))+'</div><div class="l">avg km/h</div></div>'+
    '<div class="stat"><div class="n">'+(r.max?f1(kmh(r.max)):"-")+'</div><div class="l">max km/h</div></div>'+
    '<div class="stat"><div class="n">'+(r.cal||"-")+'</div><div class="l">kcal</div></div>'+
    '<div class="stat"><div class="n">'+(r.hr||"-")+'</div><div class="l">avg heart rate</div></div></div>';
  h+='<div id="mImg"></div>';
  h+='<div class="rrow" style="margin-top:16px"><button class="btn ghost" id="back">Back</button><button class="btn ghost" id="edit">Edit</button><button class="btn ghost" id="del">Delete</button></div>';
  view.innerHTML=h;
  if(r.img) idbGet(r.id).then(function(b){ if(b){ document.getElementById("mImg").innerHTML='<div class="sec-title">Report</div><img class="rimg" src="'+URL.createObjectURL(b)+'" alt="Ride report">'; } });
  document.getElementById("back").onclick=renderHome;
  document.getElementById("edit").onclick=function(){ renderForm(r.id); };
  document.getElementById("del").onclick=function(){ if(confirm("Delete this ride?")){ saveRides(loadRides().filter(function(x){return x.id!==r.id;})); idbDel(r.id); renderHome(); } };
}

/* ---------- analysis ---------- */
function splitsOf(r){
  var out=[],acc=0,t0=r.pts.length?r.pts[0][2]:0,next=1000,prevT=t0,prevD=0,sd=0;
  for(var i=1;i<r.pts.length;i++){
    var a=r.pts[i-1],b=r.pts[i];
    sd+=hav(a[0],a[1],b[0],b[1]);
    while(sd>=next){
      var frac=(next-(sd-hav(a[0],a[1],b[0],b[1])))/hav(a[0],a[1],b[0],b[1]);
      var tt=a[2]+(b[2]-a[2])*frac;
      out.push({km:out.length+1,sec:(tt-prevT)/1000}); prevT=tt; next+=1000;
    }
  }
  return out;
}
function chartSvg(r){
  var W=320,H=130,P=22,pts=r.pts,xs=[],ys=[],d=0;
  for(var i=1;i<pts.length;i++){ d+=hav(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]); xs.push(d); ys.push(kmh(pts[i][3])); }
  if(xs.length<3) return "";
  /* smooth */
  var sm=ys.map(function(_,i){ var s=0,c=0; for(var j=Math.max(0,i-3);j<=Math.min(ys.length-1,i+3);j++){ s+=ys[j]; c++; } return s/c; });
  var maxY=Math.max.apply(null,sm)*1.1||10, maxX=xs[xs.length-1];
  var path="",area="";
  sm.forEach(function(v,i){
    var x=P+(xs[i]/maxX)*(W-P-6), y=H-18-(v/maxY)*(H-30);
    path+=(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
  });
  var x0=P, x1=P+(xs[xs.length-1]/maxX)*(W-P-6);
  area=path+"L"+x1.toFixed(1)+" "+(H-18)+"L"+x0+" "+(H-18)+"Z";
  var avgY=H-18-(kmh(r.moving?r.dist/r.moving:0)/maxY)*(H-30);
  return '<svg class="chartsvg" viewBox="0 0 '+W+' '+H+'">'+
    '<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b35" stop-opacity=".45"/><stop offset="1" stop-color="#ff6b35" stop-opacity="0"/></linearGradient></defs>'+
    '<line x1="'+P+'" y1="'+(H-18)+'" x2="'+(W-6)+'" y2="'+(H-18)+'" stroke="rgba(255,255,255,.18)"/>'+
    '<line x1="'+P+'" y1="'+avgY.toFixed(1)+'" x2="'+(W-6)+'" y2="'+avgY.toFixed(1)+'" stroke="rgba(255,255,255,.35)" stroke-dasharray="4 4"/>'+
    '<path d="'+area+'" fill="url(#g1)"/><path d="'+path+'" fill="none" stroke="#ff6b35" stroke-width="2.4" stroke-linejoin="round"/>'+
    '<text x="'+P+'" y="'+(H-4)+'" fill="#9aa0a8" font-size="10">0 km</text>'+
    '<text x="'+(W-6)+'" y="'+(H-4)+'" fill="#9aa0a8" font-size="10" text-anchor="end">'+(maxX/1000).toFixed(1)+' km</text>'+
    '<text x="2" y="12" fill="#9aa0a8" font-size="10">'+Math.round(maxY)+'</text></svg>';
}
function renderAnalysis(id){
  killMap(); stopTick();
  var r=loadRides().filter(function(x){return x.id===id;})[0];
  if(!r){ renderHome(); return; }
  if(r.manual){ renderManual(r); return; }
  var avg=r.moving?kmh(r.dist/r.moving):0, pace=r.dist?(r.moving/(r.dist/1000)):0, sp=splitsOf(r);
  var h='<div class="hero"><p class="dateline">'+FT.esc(fmtDate(r.start))+'</p><h1>Ride <em>analysis</em></h1></div>';
  h+='<div class="rmap tall" id="map"></div><div class="legend"><span>slow</span><i></i><span>fast</span></div>';
  h+='<div class="rbig">'+
    '<div class="stat"><div class="n">'+(r.dist/1000).toFixed(2)+'</div><div class="l">km</div></div>'+
    '<div class="stat"><div class="n">'+fmtT(r.moving)+'</div><div class="l">moving time</div></div>'+
    '<div class="stat"><div class="n">'+f1(avg)+'</div><div class="l">avg km/h</div></div>'+
    '<div class="stat"><div class="n">'+f1(kmh(r.max))+'</div><div class="l">max km/h</div></div>'+
    '<div class="stat"><div class="n">'+fmtT(r.elapsed||0)+'</div><div class="l">total time</div></div>'+
    '<div class="stat"><div class="n">'+fmtT(pace)+'</div><div class="l">min per km</div></div></div>';
  var ch=chartSvg(r);
  if(ch) h+='<div class="sec-title">Speed</div><div class="card"><p class="sub">Speed over distance. Dashed line is your average.</p>'+ch+'</div>';
  if(sp.length){
    var best=0; sp.forEach(function(s,i){ if(s.sec<sp[best].sec) best=i; });
    h+='<div class="sec-title">Kilometre splits</div><div class="card"><table class="splits"><tr><th>Km</th><th>Time</th><th>Speed</th></tr>'+
      sp.map(function(s,i){ return '<tr'+(i===best&&sp.length>1?' class="best"':'')+'><td>'+s.km+'</td><td>'+fmtT(s.sec)+'</td><td>'+f1(3600/s.sec)+' km/h</td></tr>'; }).join("")+
      '</table>'+(sp.length>1?'<p class="sub" style="margin-top:8px">Fastest km: '+sp[best].km+' at '+f1(3600/sp[best].sec)+' km/h.</p>':'')+'</div>';
  }
  var stops=r.elapsed?Math.max(0,Math.round(r.elapsed-r.moving)):0;
  h+='<div class="notebox verdict"><b>Summary:</b> '+(r.dist/1000).toFixed(1)+' km in '+fmtT(r.elapsed||r.moving)+', '+f1(avg)+' km/h while moving'+(stops>20?', about '+fmtT(stops)+' stopped':'')+'.</div>';
  h+='<div class="rrow" style="margin-top:16px"><button class="btn ghost" id="back">Back</button><button class="btn ghost" id="del">Delete</button></div>';
  view.innerHTML=h;
  document.getElementById("back").onclick=renderHome;
  document.getElementById("del").onclick=function(){ if(confirm("Delete this ride?")){ saveRides(loadRides().filter(function(x){return x.id!==id;})); renderHome(); } };
  if(window.L&&r.pts.length>1){
    map=L.map("map",{zoomControl:false}).setView([r.pts[0][0],r.pts[0][1]],15);
    tiles().addTo(map);
    var sps=r.pts.map(function(p){return p[3];}), lo=Math.min.apply(null,sps), hi=Math.max.apply(null,sps), line=[];
    for(var i=1;i<r.pts.length;i++){
      var a=r.pts[i-1],b=r.pts[i];
      L.polyline([[a[0],a[1]],[b[0],b[1]]],{color:colorFor(b[3],lo,hi),weight:5,opacity:.95,lineCap:"round"}).addTo(map);
      line.push([b[0],b[1]]);
    }
    L.circleMarker([r.pts[0][0],r.pts[0][1]],{radius:7,color:"#fff",weight:2,fillColor:"#3ddc84",fillOpacity:1}).addTo(map);
    var e=r.pts[r.pts.length-1];
    L.circleMarker([e[0],e[1]],{radius:7,color:"#fff",weight:2,fillColor:"#e0574a",fillOpacity:1}).addTo(map);
    map.fitBounds(L.latLngBounds(line),{padding:[24,24]});
  }
}

renderHome();
})();
