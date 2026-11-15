'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const sockets=[],timers=new Map(),intervals=new Map();let sequence=0;
class FakeWebSocket {
    constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}
    send(data){this.sent.push(JSON.parse(data));}
    close(){this.readyState=3;}
    open(){this.readyState=1;this.onopen();}
    ack(command,success=true){this.onmessage({data:JSON.stringify({command:command.command,tan:command.tan,success,error:success?undefined:'No Authorization'})});}
}
const ctx={URL,WebSocket:FakeWebSocket,
    setTimeout(fn){const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    setInterval(fn){const id=++sequence;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/live-control.js'),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
const tick=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
async function check(){
    ctx.errors=[];const controller=run("new HyperHDRLiveController('http://localhost:8099/json-rpc',e=>errors.push(e.message))");
    const connecting=controller.connect(),socket=sockets.at(-1);socket.open();await connecting;
    controller.setColor([260,-1,75.6]);controller.flush();assert.deepEqual(socket.sent[0].color,[255,0,76]);assert.equal(socket.sent[0].duration,1500);
    controller.setColor([2,3,4]);controller.flush();assert.equal(socket.sent.length,1);
    socket.ack(socket.sent[0]);await tick();controller.flush();assert.deepEqual(socket.sent[1].color,[2,3,4]);
    socket.ack(socket.sent[1]);await tick();controller.flush();assert.equal(socket.sent.length,3); // Renews constant colors.
    socket.ack(socket.sent[2]);await tick();
    const stopping=controller.stop();assert.equal(socket.sent.at(-1).command,'clear');assert.equal(socket.sent.at(-1).priority,50);
    socket.ack(socket.sent.at(-1));await stopping;assert.equal(socket.readyState,3);assert.equal(intervals.size,0);assert.equal(timers.size,0);
    const cancelled=run("new HyperHDRLiveController('https://localhost:8092/json-rpc',e=>errors.push(e.message))");
    const pending=cancelled.connect().catch(e=>e);assert.equal(sockets.at(-1).url,'wss://localhost:8092/');await cancelled.stop();assert((await pending).message);assert.equal(timers.size,0);
    const denied=run("new HyperHDRLiveController('http://localhost:8099/json-rpc',e=>errors.push(e.message))");
    const ready=denied.connect(),deniedSocket=sockets.at(-1);deniedSocket.open();await ready;
    denied.setColor([1,1,1]);denied.flush();deniedSocket.ack(deniedSocket.sent[0],false);await tick();
    assert.equal(ctx.errors.length,1);assert.equal(deniedSocket.sent.at(-1).command,'clear');deniedSocket.ack(deniedSocket.sent.at(-1));await denied.stop();assert.equal(intervals.size,0);
    const elements=new Map(),frames=new Map();let frameId=0;
    const get=id=>{if(!elements.has(id))elements.set(id,{value:id==='scrub'?'720':'',dataset:{},setAttribute(){}});return elements.get(id);};
    Object.assign(ctx,{Blob,TextEncoder,atob,AbortController,window:{addEventListener(){}},document:{getElementById:get,addEventListener(){}},localStorage:{getItem(){return null;}},performance:{now:()=>0},requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId;},cancelAnimationFrame:id=>frames.delete(id)});
    run(fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8').replace(/render\(\);\s*$/,''));
    run('preview=()=>{};');
    const start=get('play').onclick();await tick();const live=sockets.at(-1);live.open();await start;
    const expected=JSON.parse(run('JSON.stringify(sample(schedule.colors,720,true).map(c=>Math.round(c*sample(schedule.brightness,720)/100)))'));
    assert.deepEqual(live.sent[0].color,expected);
    live.ack(live.sent[0]);await tick();frames.get(frameId)(1000);
    assert.equal(Number(get('scrub').value),780);
    await get('play').onclick();assert.equal(live.sent.at(-1).command,'clear');live.ack(live.sent.at(-1));await run('playbackStop');assert.equal(live.readyState,3);
    console.log('Passed: socket backpressure, RGB/brightness, leases, stop/clear, cancel, errors; play button sends selected schedule and advances 1 virtual hour per second. Mocked device only.');
}
check().catch(error=>{console.error(error);process.exitCode=1;});
