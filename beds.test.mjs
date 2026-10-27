import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const context={Intl,Date,URL}; vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("./beds.js",import.meta.url),"utf8"),context);
const {complete,summarise,fresh,readSetupLink}=context.AfbBedModel;
const row={state:"booking",needsCheck:false,expectedBedrooms:2,bedPreferences:[{bedroom:1,selection:"Superking"},{bedroom:2,selection:"Twin beds"}]};
test("one twin bedroom needs two single sets",()=>{const s=summarise([row]);assert.equal(s.superkings,1);assert.equal(s.singles,2);assert.equal(s.checks,0);});
test("unconfirmed bookings are excluded from bagging quantities",()=>{const s=summarise([row,{...row,needsCheck:true}]);assert.equal(s.superkings,1);assert.equal(s.singles,2);assert.equal(s.checks,1);});
test("partial or duplicate rooms cannot count as a confirmed setup",()=>{assert.equal(complete({...row,expectedBedrooms:3}),false);assert.equal(complete({...row,bedPreferences:[row.bedPreferences[0],row.bedPreferences[0]]}),false);});
test("unknown choices and booking conflicts need checking",()=>{assert.equal(complete({...row,bedPreferences:[{bedroom:1,selection:"Double"},{bedroom:2,selection:"Twin beds"}]}),false);assert.equal(summarise([{...row,state:"conflict"}]).checks,1);});
test("no next booking is not an unconfirmed setup",()=>{assert.equal(summarise([{state:"no-booking"}]).checks,0);});
test("old or future-dated data is rejected",()=>{const now=Date.now(),date=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));assert.equal(fresh({state:"ready",date,generatedAt:new Date(now).toISOString()},now),true);assert.equal(fresh({state:"ready",date,generatedAt:new Date(now-46*60000).toISOString()},now),false);assert.equal(fresh({state:"ready",date,generatedAt:new Date(now+2*60000).toISOString()},now),false);assert.equal(fresh({state:"unavailable",date,generatedAt:new Date(now).toISOString()},now),false);});
test("only the known AFB pairing origin and a valid TV code are accepted",()=>{const code="a".repeat(64);assert.equal(readSetupLink("https://jonny989898.github.io/afb-tv-dashboard/?tv_token="+code),code);assert.throws(()=>readSetupLink("https://example.com/afb-tv-dashboard/?tv_token="+code));assert.throws(()=>readSetupLink("https://jonny989898.github.io/afb-tv-dashboard/?tv_token=bad"));});

const html=fs.readFileSync(new URL("./beds.html",import.meta.url),"utf8");
function runScreen({feed,storedToken="a".repeat(64),height=1080,reject=false,url="https://jonny989898.github.io/afb-tv-dashboard/beds.html"}={}) {
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  const elements=Object.fromEntries(ids.map(id=>[id,{hidden:false,textContent:"",innerHTML:"",value:"",disabled:false,handlers:{},attributes:{},addEventListener(name,handler){this.handlers[name]=handler;},setAttribute(k,v){this.attributes[k]=v;}}]));
  const store=new Map(storedToken?[["afbTvToken",storedToken]]:[]);
  const historyCalls=[],requestCalls=[];
  const doc={getElementById:id=>{assert.ok(elements[id],"Missing element "+id);return elements[id];},documentElement:{},body:{},hidden:false,addEventListener(){}};
  const w={innerHeight:height,location:{href:url},addEventListener(){}};
  const c={document:doc,window:w,Intl,Date,URL,AbortController,HTMLInputElement:class{},navigator:{onLine:true},history:{replaceState(...args){historyCalls.push(args);}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setInterval(){},setTimeout(){return 1;},clearTimeout(){},fetch:async(...args)=>{requestCalls.push(args);if(reject)throw new Error("Offline");return {status:200,ok:true,json:async()=>({bedPreparation:feed})};}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(new URL("./beds.js",import.meta.url),"utf8"),c);
  return {elements,store,historyCalls,requestCalls,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
function demoFeed() {
  const now=Date.now(),date=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
  return {state:"ready",date,generatedAt:new Date(now).toISOString(),rows:Array.from({length:24},(_,i)=>({...row,barn:"Property "+(i+1),arrivalDate:date,checkInTime:"15:00",neededBy:date}))};
}
test("TV renderer paginates all 24 properties and updates totals",async()=>{const h=runScreen({feed:demoFeed()});await h.flush();assert.equal(h.elements.board.hidden,false);assert.match(h.elements.pageLabel.textContent,/Page 1 of 4/);assert.equal(h.elements.superkingTotal.textContent,6);assert.equal(h.elements.singleTotal.textContent,12);assert.match(h.elements.bedRows.innerHTML,/Property 1</);h.elements.next.handlers.click();assert.match(h.elements.pageLabel.textContent,/Page 2 of 4/);assert.match(h.elements.bedRows.innerHTML,/Property 7</);h.elements.pause.handlers.click();assert.equal(h.elements.pause.attributes["aria-pressed"],"true");});
test("720p layout shows five properties per page",async()=>{const h=runScreen({feed:demoFeed(),height:720});await h.flush();assert.match(h.elements.pageLabel.textContent,/Page 1 of 5/);assert.equal((h.elements.bedRows.innerHTML.match(/<tr>/g)||[]).length,5);});
test("unpaired TV requests setup without contacting the API",async()=>{const h=runScreen({storedToken:null});await h.flush();assert.equal(h.elements.setup.hidden,false);assert.equal(h.elements.board.hidden,true);assert.equal(h.requestCalls.length,0);});
test("connection failure hides booking quantities",async()=>{const h=runScreen({feed:demoFeed(),reject:true});await h.flush();assert.equal(h.elements.board.hidden,true);assert.equal(h.elements.warning.hidden,false);});
test("pairing code is removed from the address",async()=>{const h=runScreen({feed:demoFeed(),url:"https://jonny989898.github.io/afb-tv-dashboard/beds.html?tv_token="+"b".repeat(64)});await h.flush();assert.equal(h.store.get("afbTvToken"),"b".repeat(64));assert.equal(h.historyCalls[0][2],"/afb-tv-dashboard/beds.html");});
