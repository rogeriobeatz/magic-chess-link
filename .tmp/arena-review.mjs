import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const tabs=await(await fetch('http://127.0.0.1:9223/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();const errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text)});
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expr,limit=20000){const start=Date.now();while(Date.now()-start<limit){if(await evaluate(expr))return;await delay(100)}throw new Error('Timeout '+expr)}
const shot=async name=>fs.writeFile('.tmp/'+name+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:860,deviceScaleFactor:1,mobile:false});
await cdp('Page.navigate',{url:'http://127.0.0.1:8090/jogo/solo-medium'});
await until('!!document.querySelector("canvas") && document.querySelectorAll(".arena-power-btn").length === 5');await delay(3000);
await evaluate(`window.currentFibers=()=>{const el=document.querySelector('.game-shell');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f.return)f=f.return;const nodes=[];function walk(n){if(!n)return;nodes.push(n);walk(n.child);walk(n.sibling)}walk(f.stateNode.current);return nodes};window.boardProps=()=>currentFibers().find(f=>f.type?.name==='Board3D')?.memoizedProps;window.injectMatch=state=>{let h=currentFibers().find(f=>f.type?.name==='GamePage').memoizedState;for(;h;h=h.next)if(h.memoizedState?.state?.board){h.queue.dispatch(row=>({...row,state}));return}};`);
const results=[];
for(const [width,height] of [[1920,860],[1440,900],[1366,768],[1280,720],[1024,768],[390,844],[360,640],[360,500],[844,390]]){
 await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<761});await delay(800);
 const metrics=await evaluate(`(()=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};return{viewport:[innerWidth,innerHeight],page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],stage:box(document.querySelector('.arena-stage')),canvas:box(document.querySelector('canvas')),console:box(document.querySelector('.arena-console')),powers:[...document.querySelectorAll('.arena-power-btn')].map(box),hud:[...document.querySelectorAll('.arena-hud')].map(box)}})()`);
 results.push(metrics);await shot(`arena-${width}x${height}`);
 assert.ok(metrics.page[0]<=width && metrics.page[1]<=height+1,JSON.stringify(metrics));
 assert.ok(metrics.powers.every(p=>p.y>=0&&p.bottom<=height&&p.right<=width),JSON.stringify(metrics));
 assert.ok(metrics.canvas.right <= metrics.stage.right + 1 && metrics.canvas.bottom <= metrics.stage.bottom, JSON.stringify(metrics));
 assert.ok(metrics.hud.every(p=>p.y>=0&&p.bottom<=height),JSON.stringify(metrics));
}
await cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:860,deviceScaleFactor:1,mobile:false});await delay(250);
// The real Three renderer retains its interaction after resizing.
await evaluate(`(async()=>{const src=performance.getEntriesByType('resource').find(r=>r.name.includes('@react-three_fiber')).name;const mod=await import(src);const canvas=document.querySelector('canvas');window.store=mod._roots.get(canvas).store.getState();window.projectSquare=(i,y=0.15)=>{const v=store.camera.position.clone().set(i%8-3.5,y,Math.floor(i/8)-3.5).project(store.camera);const r=canvas.getBoundingClientRect();return{x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2}}})()`);
async function click(point){await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1})}
await click(await evaluate('projectSquare(52,0.8)'));await until('boardProps().selected===52');await click(await evaluate('projectSquare(36)'));await until('boardProps().state.move>=2');
await evaluate(`document.querySelector('button[aria-label="Configurações"]').click()`);await until('!!document.querySelector("#game-difficulty")');await shot('arena-settings');
assert.equal(await evaluate('document.querySelector("#game-difficulty").value'),'medium');
await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await until('!document.querySelector("#game-difficulty")');
await evaluate(`document.querySelector('button[aria-label="Histórico de lances"]').click()`);await until('!!document.querySelector(".arena-history-list")');assert.ok(await evaluate('document.querySelector(".arena-history-list").children.length >= 2'));
await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await until('!document.querySelector(".arena-history-list")');
await evaluate(`document.querySelector('button[aria-label="Regras e chances"]').click()`);await until('!!document.querySelector(".arena-rule-list")');await shot('arena-rules');
assert.deepEqual(errors,[]);
console.log(JSON.stringify({layouts:results,realBoardMove:true,soloWorkerReply:true,settings:true,history:true,rules:true,runtimeErrors:errors}));ws.close();
