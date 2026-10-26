// オンライン対戦（Web 版）：自前の中継サーバー（worker/index.js）と WebSocket でつなぐ room
// claude.ai の room と同じ形（join→emit/on/presence/peers/onPeers/connected/leave）にして、ゲーム側は区別しない
const MAX_MSG=4096,MAX_PRES=1800;
const PRES_GAP=500; // presence を送る最短間隔(ms)。位置は0.15秒ごとの pos で届くので間引いてよい
const FULL=4009; // 満員の close コード（worker/index.js と合わせる）

// このページが中継サーバーと同じ Worker から配信されているか
export async function wsAvailable(){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),3000);
  try{const r=await fetch('/ws/health',{signal:c.signal,cache:'no-store'});return r.ok&&(await r.text())==='ok';}
  catch(e){return false;}
  finally{clearTimeout(t);}
}

function mkRoom(ws,me,init){
  const handlers={},peerHs=[],connHs=[];
  const pres=new Map(init.filter(p=>p&&typeof p.peer==='string').map(p=>[p.peer,Object.freeze(p.presence||{})]));
  pres.set(me,Object.freeze({}));
  let snap=null,open=true,presTimer=0,lastPres=0;
  const mkPeer=(id,p)=>Object.freeze({peer:id,by:null,isMe:id===me,sameTab:id===me,kind:'viewer',guest:false,presence:p});
  const rebuild=()=>{snap=Object.freeze([...pres].map(([id,p])=>mkPeer(id,p)));};
  const find=id=>snap.find(p=>p.peer===id);
  function notify(joined,left,updated){
    rebuild();
    const ch={peers:snap,joined:joined.map(find).filter(Boolean),left,updated:updated.map(find).filter(Boolean)};
    peerHs.forEach(h=>h(ch));
  }
  function deliver(topic,data,peer){
    (handlers[topic]||[]).forEach(h=>h({topic,data,peer,by:null,isMe:peer===me,sameTab:peer===me,kind:'viewer',guest:false}));
  }
  const send=m=>{if(open&&ws.readyState===1)ws.send(JSON.stringify(m));};
  function flushPres(){presTimer=0;lastPres=performance.now();send({t:'pres',p:pres.get(me)});}
  rebuild();

  function recv(m){
    if(!m||typeof m.peer!=='string'||m.peer===me)return;
    if(m.t==='ev'&&typeof m.topic==='string')deliver(m.topic,m.data,m.peer);
    else if(m.t==='join'||m.t==='pres'){
      const isNew=!pres.has(m.peer);
      pres.set(m.peer,Object.freeze(m.presence&&typeof m.presence==='object'?m.presence:{}));
      notify(isNew?[m.peer]:[],[],isNew?[]:[m.peer]);
    }else if(m.t==='left'){
      const old=find(m.peer);if(!old)return;
      pres.delete(m.peer);notify([],[old],[]);
    }
  }
  // 予期しない切断：他の全員が抜けたことにする（参加者はタイトルへ戻り、ホストは退出として扱う）
  function closed(){
    if(!open)return;
    open=false;clearTimeout(presTimer);
    const left=snap.filter(p=>!p.sameTab);
    for(const p of left)pres.delete(p.peer);
    notify([],left,[]);
    connHs.forEach(h=>h(false));
  }

  const room={
    emit(topic,data){
      if(!open)return Promise.reject({code:'disconnected'});
      const s=JSON.stringify(data);
      if(s.length>MAX_MSG)return Promise.reject({code:'invalid_argument',message:'too big '+s.length});
      send({t:'ev',topic,data});deliver(topic,JSON.parse(s),me);
      return Promise.resolve();
    },
    on(topic,fn){
      const hs=handlers[topic]=handlers[topic]||[];hs.push(fn);
      return()=>{const i=hs.indexOf(fn);if(i>=0)hs.splice(i,1);};
    },
    presence(patch){
      if(!open)return Promise.reject({code:'disconnected'});
      const cur={...pres.get(me)};
      for(const k in patch){if(patch[k]===null)delete cur[k];else cur[k]=patch[k];}
      if(JSON.stringify(cur).length>MAX_PRES)return Promise.reject({code:'invalid_argument'});
      pres.set(me,Object.freeze(cur));notify([],[],[me]);
      if(!presTimer)presTimer=setTimeout(flushPres,Math.max(0,lastPres+PRES_GAP-performance.now()));
      return Promise.resolve();
    },
    peers(){return snap;},
    onPeers(fn){
      peerHs.push(fn);setTimeout(()=>fn({peers:snap,joined:snap,left:[],updated:[]}),0);
      return()=>{const i=peerHs.indexOf(fn);if(i>=0)peerHs.splice(i,1);};
    },
    connected(){return open;},
    onConnection(fn){
      connHs.push(fn);setTimeout(()=>fn(open),0);
      return()=>{const i=connHs.indexOf(fn);if(i>=0)connHs.splice(i,1);};
    },
    leave(){open=false;clearTimeout(presTimer);try{ws.close(1000);}catch(e){}return Promise.resolve();}
  };
  return {room,recv,closed};
}

export const wsRoom={
  join(name){
    const code=String(name).replace(/\D/g,'');
    return new Promise((resolve,reject)=>{
      const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws/'+code);
      let r=null;
      ws.onmessage=e=>{
        let m;try{m=JSON.parse(e.data);}catch(x){return;}
        if(r)r.recv(m);
        else if(m&&m.t==='welcome'&&typeof m.me==='string'&&Array.isArray(m.peers)){r=mkRoom(ws,m.me,m.peers);resolve(r.room);}
      };
      ws.onclose=e=>{if(r)r.closed();else reject({code:e.code===FULL?'room_full':'unavailable'});};
    });
  }
};
