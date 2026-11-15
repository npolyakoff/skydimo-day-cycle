'use strict';
// One persistent WebSocket; at most one color request in flight, with finite leases.
class HyperHDRLiveController {
    constructor(endpoint,onError) {
        const url=new URL(endpoint);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/';
        this.url=url.href;this.onError=onError;this.pending=new Map();this.sequence=0;
        this.latest=null;this.inFlight=false;this.stopping=false;this.ownsPriority=false;
    }
    connect() {
        return new Promise((resolve,reject)=>{
            this.rejectConnect=reject;
            this.connectTimer=setTimeout(()=>this.fail(Error('HyperHDR не ответил за 5 секунд.')),5000);
            try{this.socket=new WebSocket(this.url);}catch(error){this.fail(error);return;}
            this.socket.onopen=()=>{
                clearTimeout(this.connectTimer);this.rejectConnect=null;
                this.interval=setInterval(()=>this.flush(),100);resolve();
            };
            this.socket.onmessage=event=>{
                let data;try{data=JSON.parse(event.data);}catch{this.fail(Error('HyperHDR вернул некорректный JSON.'));return;}
                const pending=this.pending.get(data?.tan);if(!pending)return;
                clearTimeout(pending.timer);this.pending.delete(data.tan);
                if(data.success!==true)pending.reject(Error(typeof data.error==='string'?data.error:'HyperHDR отклонил команду.'));
                else pending.resolve(data);
            };
            this.socket.onerror=()=>this.fail(Error('Соединение с HyperHDR потеряно. Проверьте адрес и доступ к локальной сети.'));
            this.socket.onclose=()=>this.fail(Error('HyperHDR закрыл соединение.'));
        });
    }
    request(body,timeout=1500) {
        return new Promise((resolve,reject)=>{
            if(this.socket?.readyState!==1){reject(Error('HyperHDR не подключён.'));return;}
            const tan=++this.sequence;
            const timer=setTimeout(()=>{this.pending.delete(tan);reject(Error('HyperHDR не подтвердил команду.'));},timeout);
            this.pending.set(tan,{resolve,reject,timer});
            try{this.socket.send(JSON.stringify({...body,tan}));}
            catch(error){clearTimeout(timer);this.pending.delete(tan);reject(error);}
        });
    }
    setColor(rgb) {this.latest=rgb.map(c=>Math.max(0,Math.min(255,Math.round(c))));}
    flush() {
        if(this.stopping||this.inFlight||!this.latest)return;
        this.inFlight=true;this.ownsPriority=true;
        this.request({command:'color',color:this.latest,priority:50,duration:1500})
            .catch(error=>{if(!this.stopping)this.fail(error);})
            .finally(()=>{this.inFlight=false;});
    }
    fail(error) {
        if(this.stopping)return;
        // stop() closes/rejects pending connection and commands before reporting.
        this.stop();this.onError(error);
    }
    stop() {
        if(this.stopPromise)return this.stopPromise;
        this.stopping=true;clearInterval(this.interval);clearTimeout(this.connectTimer);
        if(this.rejectConnect){this.rejectConnect(Error('Подключение отменено.'));this.rejectConnect=null;}
        this.stopPromise=(async()=>{
            try{if(this.ownsPriority&&this.socket?.readyState===1)await this.request({command:'clear',priority:50},500);}
            catch{/* The 1500ms color lease releases control if clear cannot be delivered. */}
            finally{
                if(this.socket){this.socket.onopen=this.socket.onmessage=this.socket.onerror=this.socket.onclose=null;try{this.socket.close();}catch{}}
                for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Проигрывание остановлено.'));}
                this.pending.clear();
            }
        })();
        return this.stopPromise;
    }
}
