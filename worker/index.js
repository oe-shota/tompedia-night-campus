// オンライン対戦の中継サーバー（Cloudflare Workers + Durable Objects）
// /ws/<4桁> だけここで受け、それ以外は静的ファイル（wrangler.jsonc の assets）
// 部屋コードごとに Room を1つ立て、届いたメッセージを部屋の他の全員に配る。判定はホストのブラウザが行う
// サーバー→端末: welcome{me,peers} / join{peer,presence} / pres{peer,presence} / left{peer} / ev{topic,data,peer}
// 端末→サーバー: ev{topic,data}（他の全員へ） / pres{p}（自分の presence を丸ごと置き換え）
import {DurableObject} from 'cloudflare:workers';

const TOPICS=new Set(['st','ev','act','pos']);
const MAX_MSG=4096,MAX_PRES=1800,MAX_PEERS=16; // MAX_PRES: serializeAttachment の上限(2048バイト)に収める
const RATE=60; // 1接続が1秒に送れる件数。超えたら切断
const FULL=4009; // 満員のときの close コード（js/net/wsroom.js と合わせる）

function sameOrigin(req,url){
  try{return new URL(req.headers.get('Origin')).host===url.host;}catch(e){return false;}
}

export default {
  async fetch(req,env){
    const url=new URL(req.url);
    if(url.pathname==='/ws/health')return new Response('ok',{headers:{'cache-control':'no-store'}});
    const m=url.pathname.match(/^\/ws\/(\d{4})$/);
    if(!m)return new Response('not found',{status:404});
    if(req.headers.get('Upgrade')!=='websocket')return new Response('expected websocket',{status:426});
    if(!sameOrigin(req,url))return new Response('forbidden',{status:403});
    return env.ROOMS.get(env.ROOMS.idFromName('tp-'+m[1])).fetch(req);
  }
};

export class Room extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.rate=new Map();}
  open(except){return this.ctx.getWebSockets().filter(w=>w!==except&&w.readyState===1&&w.deserializeAttachment());}
  broadcast(m,except){
    const s=JSON.stringify(m);
    for(const w of this.open(except))try{w.send(s);}catch(e){}
  }
  async fetch(){
    const others=this.open();
    const [client,server]=Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    if(others.length>=MAX_PEERS){server.close(FULL,'room full');return new Response(null,{status:101,webSocket:client});}
    const peer=crypto.randomUUID().replace(/-/g,'').slice(0,12);
    server.serializeAttachment({peer,presence:{}});
    server.send(JSON.stringify({t:'welcome',me:peer,peers:others.map(w=>w.deserializeAttachment())}));
    this.broadcast({t:'join',peer,presence:{}},server);
    return new Response(null,{status:101,webSocket:client});
  }
  // 1秒ごとの件数で数える（休止すると数え直しになるが、休止するのは誰も送っていないときだけ）
  allow(peer){
    const now=Date.now(),r=this.rate.get(peer);
    if(!r||now-r.t>=1000){this.rate.set(peer,{t:now,n:1});return true;}
    return ++r.n<=RATE;
  }
  webSocketMessage(ws,raw){
    const me=ws.deserializeAttachment();if(!me)return;
    if(typeof raw!=='string'||raw.length>MAX_MSG+64){ws.close(1009,'too big');return;}
    if(!this.allow(me.peer)){ws.close(1008,'too many messages');return;}
    let m;try{m=JSON.parse(raw);}catch(e){return;}
    if(!m||typeof m!=='object')return;
    if(m.t==='ev'&&TOPICS.has(m.topic)){
      this.broadcast({t:'ev',topic:m.topic,data:m.data,peer:me.peer},ws);
    }else if(m.t==='pres'&&m.p&&typeof m.p==='object'&&!Array.isArray(m.p)){
      if(JSON.stringify(m.p).length>MAX_PRES)return;
      me.presence=m.p;ws.serializeAttachment(me);
      this.broadcast({t:'pres',peer:me.peer,presence:m.p},ws);
    }
  }
  gone(ws){
    const me=ws.deserializeAttachment();if(!me)return;
    ws.serializeAttachment(null);this.rate.delete(me.peer);
    try{ws.close(1000,'bye');}catch(e){}
    this.broadcast({t:'left',peer:me.peer},ws);
  }
  webSocketClose(ws){this.gone(ws);}
  webSocketError(ws){this.gone(ws);}
}
