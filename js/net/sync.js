// 位置の同期と、オンライン中の定期処理
import {NF,COLORS,MAX_PLAYERS} from '../config.js';
import {$} from '../util.js';
import {G,byId,isHost,isClient} from '../state.js';
import {posMap,lobbyReg,myName,renderLobby,netErr} from './room.js';
import {sendState} from './host.js';

let lastPres=0,lastPosEmit=0,lastNetTag=0,lastHello=0,lastDiag=0;

function applyPos(a,pr,dt){
  const f=pr.f|0,x=+pr.x,y=+pr.y;
  if(f<0||f>=NF||!isFinite(x)||!isFinite(y))return;
  if(a.f!==f||Math.hypot(a.x-x,a.y-y)>3){a.f=f;a.x=x;a.y=y;}
  else{const k=Math.min(1,dt*14);a.x+=(x-a.x)*k;a.y+=(y-a.y)*k;}
  a.facing=pr.fc<0?-1:1;a.moving=!!pr.mv;if(a.moving)a.anim+=dt*12;
}
// 相手の最新位置：posイベント（1秒以内）を優先し、なければpresence
function latestPos(peer){
  const e=posMap.get(peer);
  if(e&&e.d.g===G.gameId&&performance.now()-e.t<1000)return e.d;
  const p=G.RM.peers().find(q=>q.peer===peer);
  const pr=p&&p.presence;
  return pr&&pr.g===G.gameId&&typeof pr.x==='number'?pr:null;
}
export function syncRemote(dt){
  if(!G.RM)return;
  for(const a of G.actors){if(!a.remote)continue;const pr=latestPos(a.peer);if(pr)applyPos(a,pr,dt);}
  if(isClient()&&G.hostPeer){
    const pr=latestPos(G.hostPeer);
    if(pr&&Array.isArray(pr.bots))
      for(const b of pr.bots.slice(0,MAX_PLAYERS)){if(!Array.isArray(b))continue;const o=byId(b[0]);if(o&&!o.human)applyPos(o,{f:b[1],x:b[2],y:b[3],fc:b[4],mv:b[5]},dt);}
  }
}
function renderNetTag(){
  const el=$('netTag');
  if(G.MODE==='solo'||G.state!=='play'){el.classList.add('hidden');return;}
  const others=G.actors.filter(a=>a.remote&&!a.left),now=performance.now();
  const fresh=others.filter(a=>{const e=posMap.get(a.peer);return e&&now-e.t<1500;}).length;
  const hostOk=isHost()||(posMap.get(G.hostPeer)&&now-posMap.get(G.hostPeer).t<1500);
  el.classList.remove('hidden');
  const ok=fresh===others.length&&hostOk;
  el.classList.toggle('ok',ok);el.classList.toggle('ng',!ok);
  el.textContent=`オンライン：${ok?'同期中':'同期待ち'}（位置 ${fresh}/${others.length}人${isClient()?`・ホスト${hostOk?'OK':'未受信'}`:''}）`;
}
export function renderDiag(){
  if(!G.RM||G.state!=='lobby')return;
  const ps=G.RM.peers(),others=ps.filter(p=>!p.sameTab);
  $('lobbyDiag').textContent=`接続状況：${G.RM.connected()?'接続中':'未接続'}／この部屋にいる端末 ${ps.length}台（自分以外 ${others.length}台）／ホスト${G.hostPeer?'あり':'なし'}／受信 ${G.netStat.st}件`+(isHost()?`／参加の合図 ${lobbyReg.size}人`:'')+(G.netStat.err?`／エラー ${G.netStat.err}`:'');
}
export function netTick(now){
  const RM=G.RM,player=G.player;
  if(!RM)return;
  if(G.state==='lobby'&&now-lastDiag>1000){lastDiag=now;renderDiag();if(isClient()&&!G.hostPeer)renderLobby();if(isHost())renderLobby();}
  if(isClient()&&G.state==='lobby'&&now-lastHello>2000){lastHello=now;RM.emit('act',{k:'hello',nm:myName(),col:COLORS[G.selColor].c}).catch(netErr);}
  if(isHost()&&G.state!=='title'&&now-G.lastSt>500)sendState();
  if(G.state==='play'&&player&&now-lastPres>66){
    lastPres=now;
    const pr={g:G.gameId,x:+player.x.toFixed(2),y:+player.y.toFixed(2),f:player.f,fc:player.facing,mv:player.moving?1:0};
    if(isHost())pr.bots=G.actors.filter(a=>!a.human).map(a=>[a.id,a.f,+a.x.toFixed(2),+a.y.toFixed(2),a.facing,a.moving?1:0]);
    RM.presence(pr).catch(()=>{});
    if(now-lastPosEmit>150){lastPosEmit=now;RM.emit('pos',pr).catch(netErr);}
  }
  if(now-lastNetTag>1000){lastNetTag=now;renderNetTag();}
}
