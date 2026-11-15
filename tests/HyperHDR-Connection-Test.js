'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),sockets=[],events=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{value:'',dataset:{},setAttribute(){}});return elements.get(id);};
let timeout;
class FakeWebSocket {
    constructor(url){this.url=url;this.closed=false;sockets.push(this);}
    send(text){this.sent=JSON.parse(text);}
    close(){this.closed=true;}
    message(data){this.onmessage({data:typeof data==='string'?data:JSON.stringify(data)});}
}
const context={URL,Blob,TextEncoder,atob,AbortController,WebSocket:FakeWebSocket,performance:{now:()=>100},window:{addEventListener(){}},
    document:{getElementById:get,addEventListener(name,handler,options){events.set(name,{handler,options});}},localStorage:{getItem(key){return key==='hyperhdr-url'?'http://localhost:8090/':null;}},
    setTimeout:callback=>{timeout=callback;return 1;},clearTimeout(){},
    fetch(){throw Error('HTTP fetch must not be used for connection checks.');}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8').replace(/render\(\);\s*$/,''),context);
function start(){const promise=get('check-hyperhdr').onclick();const socket=sockets.at(-1);socket.onopen();return {promise,socket};}
async function check(){
    assert.equal(sockets.length,0);
    assert.equal(events.get('DOMContentLoaded').options.once,true);
    let promise=events.get('DOMContentLoaded').handler(),socket=sockets.at(-1);socket.onopen();
    assert.equal(sockets.length,1);
    assert.equal(socket.url,'ws://localhost:8090/');assert.deepEqual(socket.sent,{command:'serverinfo',tan:1});
    socket.message({command:'components-update',data:[]});assert.equal(socket.closed,false);
    socket.message({success:true,command:'serverinfo',tan:1,info:{}});await promise;
    assert.equal(get('hyperhdr-status').dataset.state,'success');assert.equal(socket.closed,true);assert.equal(get('check-hyperhdr').disabled,false);
    for(const data of [{success:false,command:'serverinfo',error:'No Authorization'},{success:true,command:'serverinfo',info:[]},'not JSON']){
        ({promise,socket}=start());socket.message(data);await promise;assert.equal(get('hyperhdr-status').dataset.state,'error');assert.equal(socket.closed,true);
    }
    ({promise,socket}=start());socket.onerror();await promise;assert.equal(get('hyperhdr-status').dataset.state,'error');
    ({promise,socket}=start());socket.onclose();await promise;assert.equal(get('hyperhdr-status').dataset.state,'error');
    ({promise,socket}=start());timeout();await promise;assert(get('hyperhdr-status').textContent.includes('5'));assert.equal(socket.closed,true);
    ({promise,socket}=start());get('hyperhdr-url').value='https://localhost:8092/';get('hyperhdr-url').oninput();await promise;
    assert.equal(get('hyperhdr-status').dataset.state,'idle');assert.equal(socket.closed,true);assert.equal(get('open-hyperhdr').hidden,true);
    ({promise,socket}=start());assert.equal(socket.url,'wss://localhost:8092/');socket.message({success:true,command:'serverinfo',info:{}});await promise;
    get('hyperhdr-url').value='invalid';const count=sockets.length;await get('check-hyperhdr').onclick();assert.equal(sockets.length,count);
    console.log('Passed: automatic check on page load with saved address, manual retries, WS/WSS, read-only serverinfo, errors, timeout, cancellation and cleanup.');
}
check().catch(error=>{console.error(error);process.exitCode=1;});
