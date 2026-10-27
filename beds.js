"use strict";
(function (root) {
  const PAGE_MS = 30000, REFRESH_MS = 60000, MAX_AGE_MS = 45 * 60000;
  const FEED_URL = "https://afb-internal.co.uk/api/tv-feed";
  const londonDate = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/London", year:"numeric", month:"2-digit", day:"2-digit" }).format(now);
  const validDay = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0,10) === value;
  function fresh(feed, now = Date.now()) {
    const generated = Date.parse(feed?.generatedAt);
    return feed?.state === "ready" && feed.date === londonDate(new Date(now)) && Number.isFinite(generated) && generated <= now + 60000 && generated >= now - MAX_AGE_MS;
  }
  function complete(row) {
    const beds = row?.bedPreferences;
    return row?.state === "booking" && row.needsCheck === false && Number.isInteger(row.expectedBedrooms) && row.expectedBedrooms >= 1 && row.expectedBedrooms <= 5
      && Array.isArray(beds) && beds.length === row.expectedBedrooms
      && new Set(beds.map(b=>b?.bedroom)).size === beds.length
      && beds.every(b=>Number.isInteger(b?.bedroom) && b.bedroom >= 1 && b.bedroom <= row.expectedBedrooms && ["Superking","Twin beds"].includes(b.selection));
  }
  function summarise(rows) {
    const totals = { superkings:0, singles:0, checks:0, confirmed:0 };
    for (const row of rows) {
      if (row.state === "no-booking") continue;
      if (!complete(row)) { totals.checks++; continue; }
      totals.confirmed++;
      row.bedPreferences.forEach(b=>{ if(b.selection==="Superking") totals.superkings++; else totals.singles+=2; });
    }
    return totals;
  }
  function readSetupLink(value) {
    const url = new URL(value);
    if (url.origin !== "https://jonny989898.github.io" || !url.pathname.startsWith("/afb-tv-dashboard/")) throw new Error("Use the AFB TV dashboard setup link.");
    const token = url.searchParams.get("tv_token") || url.hash.match(/^#tv_token=(.+)$/)?.[1] || "";
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error("The TV setup link is missing a valid access code.");
    return token;
  }
  root.AfbBedModel = { fresh, complete, summarise, readSetupLink, validDay };
  if (typeof document === "undefined") return;

  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let data = null, page = 0, paused = false, pageDeadline = Date.now()+PAGE_MS, requestRunning = false, connectionLost = false;
  const pageSize = () => window.innerHeight < 800 ? 5 : 6;
  const pages = () => Math.max(1,Math.ceil((data?.rows.length || 0)/pageSize()));
  function token() { try { return localStorage.getItem("afbTvToken") || ""; } catch { return ""; } }
  function saveToken(value) { localStorage.setItem("afbTvToken",value); }
  function clearToken() { try {localStorage.removeItem("afbTvToken");} catch {} }
  function captureToken() {
    const url = new URL(window.location.href);
    const supplied = url.searchParams.get("tv_token") || url.hash.match(/^#tv_token=(.+)$/)?.[1];
    if (!supplied) return;
    // Remove the code from the address even if storage is unavailable.
    url.searchParams.delete("tv_token");
    if(url.hash.startsWith("#tv_token=")) url.hash="";
    history.replaceState(null,"",url.pathname+url.search+url.hash);
    if (/^[a-f0-9]{64}$/i.test(supplied)) {
      try {saveToken(supplied);} catch { $("pairError").textContent="Allow storage for this TV dashboard, then reconnect."; }
    }
  }
  function formatDate(value) {
    if(!validDay(value)) return "Check date";
    return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"Europe/London"}).format(new Date(value+"T12:00:00Z"));
  }
  function time(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"}).format(d); }
  function state(kind, heading, detail) {
    $("board").hidden=true; $("setup").hidden=kind!=="setup"; $("warning").hidden=kind==="setup";
    if(kind!=="setup") { $("warningHeading").textContent=heading; $("warningText").textContent=detail; }
    $("pageLabel").textContent=""; $("previous").disabled=true; $("next").disabled=true; $("pause").disabled=true;
  }
  function renderRow(row) {
    let bedroomCells="";
    for(let room=1;room<=5;room++) {
      if(row.state==="no-booking" || room>row.expectedBedrooms) bedroomCells+='<td><span class="setup none" aria-label="Not applicable">—</span></td>';
      else {
        const bed=row.bedPreferences.find(b=>b.bedroom===room);
        const selection=row.state==="conflict" ? "" : bed?.selection;
        const cls=selection==="Superking"?"superking":selection==="Twin beds"?"twin":"check";
        bedroomCells+='<td><span class="setup '+cls+'">'+(cls==="superking"?"Superking":cls==="twin"?"Twin":"CHECK")+'</span></td>';
      }
    }
    const sums=summarise([row]), confirmed=complete(row);
    const arrival=row.state==="no-booking" ? "No next booking in verified coverage" : formatDate(row.arrivalDate)+" · "+(/^\d{2}:\d{2}$/.test(row.checkInTime)?row.checkInTime:"Check time");
    const note=row.state==="conflict"?"Conflicting bookings · check in app":row.state!=="no-booking"&&!confirmed?"Check bed choices in app":"";
    const quantities=row.state==="no-booking"?"—":confirmed?'<span class="sets">'+sums.superkings+' superking<br>'+sums.singles+' single</span>':'<span class="setup check">CHECK</span>';
    return '<tr><td><strong>'+escape(row.barn)+'</strong><span class="arrival">'+escape(arrival)+'</span>'+(note?'<span class="row-warning">'+escape(note)+'</span>':"")+'</td><td class="prepare-day">'+(row.state==="no-booking"?"—":row.neededBy?escape(formatDate(row.neededBy)):'<span class="row-warning">Not scheduled</span>')+'</td>'+bedroomCells+'<td>'+quantities+'</td></tr>';
  }
  function render() {
    if(!data || connectionLost) return;
    if(!fresh(data)) { state("unavailable","Booking information is out of date","Waiting for a verified booking update. Check AFB Staff before bagging."); $("connection").textContent="Waiting for fresh booking information"; return; }
    $("setup").hidden=true; $("warning").hidden=true; $("board").hidden=false;
    page=Math.min(Math.max(0,page),pages()-1);
    const visible=data.rows.slice(page*pageSize(),(page+1)*pageSize());
    $("bedRows").innerHTML=visible.map(renderRow).join("");
    const sums=summarise(visible);
    $("superkingTotal").textContent=sums.superkings; $("singleTotal").textContent=sums.singles; $("checkTotal").textContent=sums.checks;
    $("totalsNote").textContent=sums.checks? "Excludes "+sums.checks+" unconfirmed setup"+(sums.checks===1?"":"s"):"Confirmed setups only";
    $("pageLabel").textContent="Page "+(page+1)+" of "+pages()+(paused?" · paused":"");
    $("syncTime").textContent="Booking sync "+formatDate(data.date)+" · "+time(data.generatedAt);
    $("previous").disabled=pages()<2; $("next").disabled=pages()<2; $("pause").disabled=pages()<2;
    $("connection").textContent="AFB Staff · next booking for each property · read only";
  }
  function validRows(rows) {
    return Array.isArray(rows) && rows.length>0 && rows.length<=24 && new Set(rows.map(r=>r?.barn)).size===rows.length
      && rows.every(r=>r && typeof r.barn==="string" && ["booking","no-booking","conflict"].includes(r.state) && Array.isArray(r.bedPreferences) && r.bedPreferences.every(b=>b && typeof b.selection==="string" && Number.isInteger(b.bedroom)));
  }
  async function refresh() {
    if(requestRunning) return;
    if(!token()) {data=null;state("setup");$("connection").textContent="TV connection required";return;}
    requestRunning=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(FEED_URL,{headers:{Authorization:"Bearer "+token()},cache:"no-store",signal:controller.signal,referrerPolicy:"no-referrer"});
      if(response.status===401) {clearToken();data=null;state("setup");$("connection").textContent="TV access needs renewing";return;}
      if(!response.ok) throw new Error("Connection unavailable");
      const feed=(await response.json()).bedPreparation;
      if(!fresh(feed) || !validRows(feed.rows)) throw new Error("Booking information unavailable");
      data=feed;connectionLost=false;render();
    } catch {
      data=null;connectionLost=true;
      state("unavailable","Booking information unavailable","Reconnecting to AFB Staff. Check the app before bagging; quantities are hidden until verified.");
      $("connection").textContent=navigator.onLine?"AFB Staff connection retrying":"TV is offline · reconnect to Wi-Fi";
      $("syncTime").textContent="Waiting for verified booking information";
    } finally { clearTimeout(timeout);requestRunning=false; }
  }
  function move(direction) {page=(page+direction+pages())%pages();pageDeadline=Date.now()+PAGE_MS;render();}
  $("previous").addEventListener("click",()=>move(-1)); $("next").addEventListener("click",()=>move(1));
  $("pause").addEventListener("click",()=>{paused=!paused;pageDeadline=Date.now()+PAGE_MS;$("pause").textContent=paused?"Resume pages":"Pause pages";$("pause").setAttribute("aria-pressed",String(paused));render();});
  $("fullscreen").hidden=!document.documentElement.requestFullscreen;
  $("fullscreen").addEventListener("click",async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$("connection").textContent="Use the browser’s full-screen option";}});
  document.addEventListener("fullscreenchange",()=>{$("fullscreen").textContent=document.fullscreenElement?"Exit full screen":"Full screen";});
  $("pairForm").addEventListener("submit",event=>{event.preventDefault();try{saveToken(readSetupLink($("setupLink").value.trim()));$("setupLink").value="";$("pairError").textContent="";void refresh();}catch(error){$("pairError").textContent=error.message;}});
  window.addEventListener("keydown",event=>{if(event.target instanceof HTMLInputElement)return;if(event.key==="ArrowRight"){event.preventDefault();move(1);}else if(event.key==="ArrowLeft"){event.preventDefault();move(-1);}else if(event.key===" "&&event.target===document.body){event.preventDefault();$("pause").click();}});
  window.addEventListener("online",()=>void refresh());
  window.addEventListener("offline",()=>{connectionLost=true;data=null;state("unavailable","TV is offline","Reconnect to Wi-Fi. Check the AFB Staff app before bagging.");$("connection").textContent="Offline";});
  window.addEventListener("resize",render);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)void refresh();});
  function tick() {
    const now=new Date();
    $("clock").textContent=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/London"}).format(now);
    $("date").textContent=new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"Europe/London"}).format(now);
    if(data&&!fresh(data)) render();
    if(!paused&&data&&!document.hidden&&Date.now()>=pageDeadline) move(1);
  }
  captureToken();state("unavailable","Connecting to AFB Staff","Loading the next booking’s bed choices…");tick();void refresh();
  setInterval(tick,1000);setInterval(()=>void refresh(),REFRESH_MS);
})(globalThis);
