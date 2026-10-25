// テスト用：claude.ai の room を BroadcastChannel で模擬する（本番ページには含めない）
(function(){
  const me='p'+Math.random().toString(36).slice(2,10);
  function mkRoom(name){
    const bc=new BroadcastChannel('mock-'+name);
    const handlers={},peerHs=[];let peersMap=new Map([[me,{presence:{},updatedAt:Date.now()}]]);let snap=null;
    const mkPeer=(id,v)=>Object.freeze({peer:id,by:null,isMe:id===me,sameTab:id===me,kind:'viewer',guest:false,presence:v.presence,updatedAt:v.updatedAt});
    function rebuild(){snap=Object.freeze([...peersMap].map(([id,v])=>mkPeer(id,v)));}
    rebuild();
    let pending=false,joined=[],left=[];
    function notify(j,l){joined.push(...j);left.push(...l);if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;rebuild();const ch={peers:snap,joined:joined.map(id=>snap.find(p=>p.peer===id)).filter(Boolean),left,updated:[]};joined=[];left=[];peerHs.forEach(h=>h(ch));});}
    bc.onmessage=e=>{const m=e.data;
      if(m.t==='ev'){(handlers[m.topic]||[]).forEach(h=>h({topic:m.topic,data:m.data,peer:m.peer,by:null,isMe:false,sameTab:false,kind:'viewer',guest:false}));}
      else if(m.t==='pres'){const isNew=!peersMap.has(m.peer);peersMap.set(m.peer,{presence:Object.freeze(m.p),updatedAt:Date.now()});notify(isNew?[m.peer]:[],[]);if(isNew)bc.postMessage({t:'pres',peer:me,p:peersMap.get(me).presence});}
      else if(m.t==='bye'){if(peersMap.has(m.peer)){const old=snap.find(p=>p.peer===m.peer);peersMap.delete(m.peer);notify([],old?[old]:[]);}}
      else if(m.t==='hello'){bc.postMessage({t:'pres',peer:me,p:peersMap.get(me).presence});}
    };
    addEventListener('beforeunload',()=>bc.postMessage({t:'bye',peer:me}));
    bc.postMessage({t:'hello',peer:me});
    return {name,
      emit(topic,data){const s=JSON.stringify(data);if(s.length>4096)return Promise.reject({code:'invalid_argument',message:'too big '+s.length});bc.postMessage({t:'ev',topic,data:JSON.parse(s),peer:me});(handlers[topic]||[]).forEach(h=>h({topic,data:JSON.parse(s),peer:me,by:null,isMe:true,sameTab:true,kind:'viewer',guest:false}));return Promise.resolve();},
      on(topic,fn){(handlers[topic]=handlers[topic]||[]).push(fn);return()=>{};},
      presence(patch){const cur={...peersMap.get(me).presence};for(const k in patch){if(patch[k]===null)delete cur[k];else cur[k]=patch[k];}if(JSON.stringify(cur).length>4096)return Promise.reject({code:'invalid_argument'});peersMap.set(me,{presence:Object.freeze(cur),updatedAt:Date.now()});bc.postMessage({t:'pres',peer:me,p:cur});notify([],[]);return Promise.resolve();},
      peers(){return snap;},
      onPeers(fn){peerHs.push(fn);setTimeout(()=>fn({peers:snap,joined:snap,left:[],updated:[]}),0);return()=>{};},
      connected(){return true;},onConnection(fn){setTimeout(()=>fn(true));return()=>{};},
      leave(){bc.postMessage({t:'bye',peer:me});bc.close();return Promise.resolve();}};
  }
  window.__mockRoom={join:async n=>mkRoom(n)};
})();
