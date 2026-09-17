"use strict";
const GROUP_SECONDS=12;
const tubs=[
{name:"Walnut House",type:"large",booking:"Empty",current:"31.0°",set:"31.0°",status:"empty",label:"Empty",action:"Temperature reduced — no full check",updated:"10:08"},
{name:"Rowan House",type:"large",booking:"Booked",current:"37.8°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:54"},
{name:"Chestnut House",type:"large",booking:"Booked",current:"38.1°",set:"38.0°",status:"ready",label:"Ready",action:"Afternoon check due",updated:"10:02"},
{name:"Lindum Barn",type:"large",booking:"Changeover",current:"35.4°",set:"38.0°",status:"refill",label:"Refilling",action:"Refill underway — afternoon check after",updated:"10:11"},
{name:"Eastgate Barn",type:"large",booking:"Booked",current:"37.4°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:49"},
{name:"Field Maple Barn",type:"large",booking:"Empty",current:"—",set:"—",status:"maintenance",label:"Maintenance",action:"Fully drained — maintenance in progress",updated:"09:37"},
{name:"Holly Tree Barn",type:"large",booking:"Changeover",current:"34.8°",set:"38.0°",status:"drain",label:"Draining",action:"Drain and clean in progress",updated:"10:06"},
{name:"Red Oak Barn",type:"large",booking:"Booked",current:"37.7°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:58"},
{name:"Wild Cherry Barn",type:"large",booking:"Booked",current:"38.0°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"10:00"},
{name:"Meadowsweet Barn",type:"large",booking:"Booked",current:"36.9°",set:"38.0°",status:"ready",label:"Ready",action:"Heating to set temperature",updated:"09:52"},
{name:"The Birches",type:"large",booking:"Booked",current:"37.9°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"10:01"},
{name:"The Elms",type:"large",booking:"Empty",current:"31.2°",set:"31.0°",status:"empty",label:"Empty",action:"Temperature reduced",updated:"09:46"},
{name:"The Hazels",type:"large",booking:"Booked",current:"37.5°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:55"},
{name:"The Pines",type:"large",booking:"Booked",current:"38.2°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:57"},
{name:"The Sycamores",type:"large",booking:"Booked",current:"—",set:"38.0°",status:"lockout",label:"Lockout",action:"Do not use — physical inspection required",updated:"10:12"},
{name:"The Willows",type:"large",booking:"Booked",current:"37.6°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:51"},
{name:"Blue Iris Cottage",type:"small",booking:"Booked",current:"37.9°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"10:03"},
{name:"Dragonfly Cottage",type:"small",booking:"Empty",current:"31.0°",set:"31.0°",status:"empty",label:"Empty",action:"Temperature reduced — no full check",updated:"09:44"},
{name:"Mallard Cottage",type:"small",booking:"Changeover",current:"—",set:"—",status:"drain",label:"Draining",action:"Small tub drain and clean",updated:"10:07"},
{name:"Marsh Marigold Cottage",type:"small",booking:"Changeover",current:"22.4°",set:"38.0°",status:"refill",label:"Refilling",action:"Heating after refill",updated:"10:09"},
{name:"Water Lily Cottage",type:"small",booking:"Booked",current:"37.6°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:56"},
{name:"White Swan Cottage",type:"small",booking:"Booked",current:"37.8°",set:"38.0°",status:"ready",label:"Ready",action:"No action required",updated:"09:59"},
{name:"Bailgate Barn",type:"small",booking:"Empty",current:"31.1°",set:"31.0°",status:"empty",label:"Empty",action:"Temperature reduced",updated:"09:43"},
{name:"Castle Hill Barn",type:"small",booking:"Booked",current:"—",set:"—",status:"lockout",label:"Lockout",action:"Do not use — inspection required",updated:"10:13"}
];
let group="large",remaining=GROUP_SECONDS;
const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function tone(status){return status==="lockout"?"danger":status==="drain"||status==="refill"||status==="maintenance"?"warn":""}
function render(){
 const rows=tubs.filter(t=>t.type===group);
 $("tubRows").innerHTML=rows.map(t=>`<tr><td class="barn"><strong>${esc(t.name)}</strong><small>${t.type==="large"?"Sand-filter tub":"Small hub tub"}</small></td><td class="booking ${t.booking.toLowerCase()}">${esc(t.booking)}</td><td>${esc(t.current)}</td><td>${esc(t.set)}</td><td><span class="status ${t.status}">${esc(t.label)}</span></td><td class="action ${tone(t.status)}">${esc(t.action)}</td><td class="updated">${esc(t.updated)} · App</td></tr>`).join("");
 $("groupTitle").textContent=group==="large"?"Large tubs":"Small tubs";
 $("groupEyebrow").textContent=group==="large"?"Large sand-filter tubs":"Small hub tubs";
 document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.group===group));
}
function summary(){
 const count=s=>tubs.filter(t=>t.status===s).length;
 $("readyCount").textContent=count("ready");$("emptyCount").textContent=count("empty");$("workCount").textContent=count("drain")+count("refill");$("lockoutCount").textContent=count("lockout");$("maintenanceCount").textContent=count("maintenance");
}
function updateClock(){const now=new Date();$("clock").textContent=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);$("date").textContent=new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"long"}).format(now);$("countdown").textContent=remaining+"s"}
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{group=b.dataset.group;remaining=GROUP_SECONDS;render()}));
summary();render();updateClock();setInterval(()=>{remaining-=1;if(remaining<=0){group=group==="large"?"small":"large";remaining=GROUP_SECONDS;render()}updateClock()},1000);