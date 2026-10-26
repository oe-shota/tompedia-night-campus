// オンライン対戦（room：ホストが判定とボットを担当）
// 話題: st=ホストの全体状態(0.5秒ごと) / ev=ホストの出来事 / act=参加者の操作 / pos=各自の位置
import {COLORS,TASKS_PER,MAX_PLAYERS} from '../config.js';
import {$,el,cleanText,cleanName,validColor} from '../util.js';
import {beanCanvas,SPR_READY} from '../sprites.js';
import {ac} from '../audio.js';
import {toast,toggleMap,hideScreens} from '../ui.js';
import {closeTask} from '../tasks.js';
import {limitImp,checkWin} from '../game.js';
import {G,isHost,isClient} from '../state.js';
import {sendState,onAct,hostStartGame} from './host.js';
import {onSt,onEv,hostGone} from './client.js';
import {renderDiag} from './sync.js';
import {wsRoom,wsAvailable} from './wsroom.js';

export const posMap=new Map(); // peer -> {d,t}：posイベントで届いた最新位置（ゲームの参加者の分だけ）
export const lobbyReg=new Map(); // presenceが届かない場合の予備：参加者の「参加中」合図
let permWarned=false;

export function myName(){const n=cleanText($('iName').value,8);return !n||n==='あなた'?COLORS[G.selColor].n:n;}
export function netErr(e){
  if(e&&e.code)G.netStat.err=e.code;
  if(e&&e.code==='not_permitted'&&!permWarned){permWarned=true;toast('送信する権限がありません。オーナーに「コントリビューター」以上で共有してもらってください',6000);}
}
export function emitEv(d){if(isHost()&&G.RM)G.RM.emit('ev',d).catch(netErr);}
export function emitAct(d){if(isClient()&&G.RM)G.RM.emit('act',{...d,g:G.gameId}).catch(netErr);}

export async function initRoom(){
  let r=null;
  try{if(window.claude&&typeof window.claude.use==='function')r=await window.claude.use('room');}catch(e){r=null;}
  if(!r&&await wsAvailable())r=wsRoom; // claude.ai の外：自前の中継サーバー（worker/index.js）
  G.ROOM=r;
  if(!r){$('mpNote').textContent='このページではオンライン対戦は使えません（1人プレイのみ）。';$('bCreate').disabled=$('bJoin').disabled=true;return;}
  $('mpNote').textContent='「部屋を作る」と4桁のコードが出ます。仲間はそのコードで参加。人数が足りない分はボットが入ります。';
}
$('bCreate').onclick=()=>{ac();enterRoom(String(1000+Math.floor(Math.random()*9000)),true);};
$('bJoin').onclick=()=>{ac();const c=$('iCode').value.replace(/\D/g,'');if(c.length!==4){$('mpNote').textContent='部屋コードは4桁の数字です。';return;}enterRoom(c,false);};
$('iCode').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing)$('bJoin').click();});
$('bLobbyStart').onclick=()=>{if(isHost())SPR_READY.then(hostStartGame);};
$('bLobbyLeave').onclick=leaveRoom;
$('lN').onchange=renderLobby;

// 位置を受け取るのは、いまのゲームの参加者とホストだけ（知らない peer の分は溜めない）
const knownPeer=peer=>peer===G.hostPeer||G.actors.some(a=>a.remote&&a.peer===peer);

export async function enterRoom(code,asHost){
  if(!G.ROOM||G.RM)return;
  $('bCreate').disabled=$('bJoin').disabled=true;
  try{G.RM=await G.ROOM.join('tp-'+code);}
  catch(e){$('mpNote').textContent=e&&e.code==='not_permitted'?'この部屋には入れませんでした（権限がありません）。':e&&e.code==='room_full'?'この部屋は満員です。':'部屋に入れませんでした。少し待ってからもう一度試してください。';$('bCreate').disabled=$('bJoin').disabled=false;return;}
  const RM=G.RM;
  G.MODE=asHost?'host':'client';G.hostPeer=null;G.gameId=0;G.lobbyBusy=false;G.lastEnd=null;G.actors=[];G.player=null;
  const le=e=>{G.netStat.err=(e&&e.code)||'error';renderDiag();};
  G.netStat={st:0,ev:0,err:''};
  RM.on('st',onSt,le);RM.on('ev',onEv,le);RM.on('act',onAct,le);
  RM.on('pos',m=>{if(m.sameTab||!m.data||typeof m.data!=='object'||!knownPeer(m.peer))return;posMap.set(m.peer,{d:m.data,t:performance.now()});},le);
  RM.onPeers(onPeersChange,le);
  const me=RM.peers().find(p=>p.sameTab);if(me)G.myPeer=me.peer;
  RM.presence({nm:myName(),col:COLORS[G.selColor].c,host:asHost?1:null}).catch(netErr);
  $('lobbyCode').textContent=code;
  showLobby();
}
// 部屋から抜けて通信の状態を片付ける（画面はそのまま）
export function closeRoom(){
  if(G.RM)G.RM.leave().catch(()=>{});
  G.RM=null;G.MODE='solo';G.hostPeer=null;
  posMap.clear();lobbyReg.clear();
  $('bCreate').disabled=$('bJoin').disabled=!G.ROOM;
}
export function leaveRoom(){
  closeRoom();
  G.state='title';G.actors=[];G.player=null;
  hideScreens(['lobby','end','hud','intro','meeting','eject']);
  $('title').classList.remove('hidden');
}
export function lobbyPeers(){
  if(!G.RM)return [];
  const ps=G.RM.peers().filter(p=>p.kind==='viewer'&&p.presence&&typeof p.presence.nm==='string');
  if(isHost()){
    if(!ps.some(p=>p.sameTab))ps.unshift({peer:G.myPeer||'self',sameTab:true,presence:{nm:myName(),col:COLORS[G.selColor].c,host:1}});
    const now=performance.now();
    for(const [peer,r] of lobbyReg)if(now-r.t<6000&&!ps.some(p=>p.peer===peer))ps.push({peer,sameTab:false,presence:{nm:r.nm,col:r.col}});
  }
  return ps;
}
export function showLobby(){
  G.state='lobby';closeTask();if(G.mapOpen)toggleMap();
  hideScreens(['title','end','hud','intro','meeting','eject']);
  $('lobby').classList.remove('hidden');
  if(isHost())sendState();
  renderLobby();
}
export function renderLobby(){
  if(G.state!=='lobby')return;
  const ps=lobbyPeers();
  $('lobbyList').replaceChildren(...ps.map(p=>el('div',{class:'b'},
    beanCanvas(validColor(p.presence.col),52),
    el('span',{text:cleanName(p.presence.nm)+(p.sameTab?'（あなた）':'')+(p.presence.host?' ★':'')}))));
  const host=isHost(),n=+$('lN').value;
  limitImp($('lImp'),Math.max(n,ps.length));
  $('bLobbyStart').classList.toggle('hidden',!host);$('lobbyHostOpts').classList.toggle('hidden',!host);
  $('lobbyMsg').textContent=host
    ?(ps.length>MAX_PLAYERS?`参加できるのは${MAX_PLAYERS}人までです。`:`参加者 ${ps.length}人。開始すると ${Math.max(n,ps.length)}人でプレイします（★がホスト）。`)
    :!G.hostPeer?'ホストが見つかりません。部屋コードを確認してください。'
    :G.lobbyBusy?'いまゲーム中です。次のゲームから参加できます。'
    :'ホストがゲームを始めるのを待っています…';
}
function onPeersChange(ch){
  for(const p of ch.peers){
    if(p.sameTab)G.myPeer=p.peer;
    else if(isClient()&&p.presence&&p.presence.host&&!G.hostPeer)G.hostPeer=p.peer;
  }
  if(isHost())G.hostPeer=G.myPeer;
  for(const p of ch.left){
    posMap.delete(p.peer);
    if(isClient()&&p.peer===G.hostPeer){G.hostPeer=null;hostGone();}
    if(isHost()&&G.state!=='lobby'&&G.state!=='end'){
      const a=G.actors.find(x=>x.remote&&x.peer===p.peer);
      if(a&&!a.left){
        a.left=true;
        if(!a.isImp)G.tasksTotal-=TASKS_PER-a.done.size;
        a.alive=false;
        emitEv({k:'toast',text:`${a.name} が退出した`});toast(`${a.name} が退出した`);
        sendState();if(G.state==='play')checkWin();
      }
    }
  }
  if(G.state==='lobby')renderLobby();
}
