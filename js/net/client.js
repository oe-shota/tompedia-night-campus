// 参加者側：ホストから届いた状態・出来事を反映する（受け取った値はすべて型と範囲を確かめてから使う）
import {NF,MAX_PLAYERS,DISCUSS_TIME} from '../config.js';
import {$,el,cleanText,cleanName,validColor} from '../util.js';
import {ST} from '../world.js';
import {SFX} from '../audio.js';
import {buildFloor} from '../render.js';
import {toast,toggleMap,renderTaskList,hideScreens} from '../ui.js';
import {closeTask} from '../tasks.js';
import {mkActor,spawnAll,showIntro,beginPlay,endGame} from '../game.js';
import {killFx} from '../bots.js';
import {meetingUI,updateCards,addChat,addSys,renderVoteDots,showEject,stopEject} from '../meeting.js';
import {G,byId,isClient} from '../state.js';
import {renderLobby,showLobby} from './room.js';

const listOk=a=>Array.isArray(a)&&a.length<=MAX_PLAYERS;

function clientInitFromSt(d){
  if(!listOk(d.rs)||!Array.isArray(d.al))return false;
  const list=[];
  for(const r of d.rs){
    if(!Array.isArray(r))return false;
    const a=mkActor(r[0]|0,cleanName(r[2]),validColor(r[3]),!!r[1]&&r[1]===G.myPeer);
    a.peer=r[1]||null;a.human=!!r[1];a.remote=a.human&&!a.isPlayer;a.isImp=!!r[4];
    a.tasks=Array.isArray(r[5])?r[5].slice(0,ST.length).map(x=>x|0).filter(x=>ST[x]):[];
    list.push(a);
  }
  const me=list.find(a=>a.isPlayer);if(!me)return false;
  G.actors=list;G.player=me;G.gameId=d.g;G.bodies=[];G.tasksDone=d.td|0;G.tasksTotal=d.tt|0;G.gameTime=0;G.lastEnd=null;G.M=null;
  for(const a of G.actors){a.alive=!!d.al[a.id];a.killCd=12;}
  spawnAll();buildFloor(0);
  hideScreens(['lobby','end','meeting','eject']);
  showIntro();
  return true;
}
function bodiesFrom(bd){
  if(!Array.isArray(bd))return [];
  return bd.slice(0,MAX_PLAYERS).filter(b=>Array.isArray(b)&&byId(b[0])).map(b=>({id:b[0]|0,f:Math.max(0,Math.min(NF-1,b[1]|0)),x:+b[2]||0,y:+b[3]||0,color:byId(b[0]).color,t:0,roomName:cleanText(b[4],30)}));
}
export function onSt(msg){
  if(!isClient()||msg.sameTab)return;
  const d=msg.data;if(!d||typeof d!=='object')return;
  G.netStat.st++;
  if(!G.hostPeer){G.hostPeer=msg.peer;renderLobby();}
  if(msg.peer!==G.hostPeer)return;
  if(d.ph==='lobby'){if(G.lobbyBusy){G.lobbyBusy=false;renderLobby();}return;}
  if(d.g!==G.gameId){
    const mine=listOk(d.rs)&&d.rs.some(r=>Array.isArray(r)&&r[1]&&r[1]===G.myPeer);
    if(mine&&(G.state==='lobby'||G.state==='end'))clientInitFromSt(d);
    else if(G.state==='lobby'&&!G.lobbyBusy){G.lobbyBusy=true;renderLobby();}
    return;
  }
  if(G.state==='lobby')return; // 終わったゲームの状態は、ロビーでは無視する
  G.tasksDone=d.td|0;G.tasksTotal=d.tt|0;
  if(Array.isArray(d.al)){
    const was=G.player.alive;
    for(const a of G.actors)a.alive=!!d.al[a.id];
    if(was&&!G.player.alive&&G.state==='play'){toast('あなたはやられた… ゴーストとして続行',3500);renderTaskList();}
  }
  if(G.state==='play'||G.state==='intro')G.bodies=bodiesFrom(d.bd);
  if(d.ph==='meeting'&&d.mt&&(G.state==='play'||G.state==='intro'))clientStartMeeting(d.mt);
  const M=G.M;
  if(G.state==='meeting'&&M&&d.mt){
    if(listOk(d.mt.vd))for(const id of d.mt.vd)if(!M.votes.has(id|0))M.votes.set(id|0,true);
    M.vl=typeof d.mt.vl==='number'?d.mt.vl:-1;
    M.dl=typeof d.mt.dl==='number'?Math.min(d.mt.dl,DISCUSS_TIME):-1;updateCards();
  }
  if(d.ph==='play'&&(G.state==='meeting'||G.state==='eject'))clientResume({al:d.al});
  if(d.ph==='end'&&G.state!=='end'&&d.en)endGame(d.en.team==='imp'?'imp':'crew',cleanText(d.en.reason,60));
}
export function onEv(msg){
  if(!isClient()||msg.sameTab)return;G.netStat.ev++;
  if(msg.peer!==G.hostPeer)return;
  const d=msg.data;if(!d||typeof d!=='object'||!G.player)return;
  switch(d.k){
    case 'kill':{
      const k=byId(d.kl),v=byId(d.v);if(!k||!v)return;
      killFx(k,v,{id:v.id,f:Math.max(0,Math.min(NF-1,d.f|0)),x:+d.x||v.x,y:+d.y||v.y,color:v.color,t:0,roomName:cleanText(d.rn,30)});break;}
    case 'meet':clientStartMeeting(d);break;
    case 'chat':if(G.state==='meeting'){const a=byId(d.a);if(a)addChat(a,cleanText(d.text,80));}break;
    case 'sys':if(G.state==='meeting')addSys(cleanText(d.text,120));break;
    case 'result':clientResult(d);break;
    case 'eject':if(G.state==='meeting')showEject(d.ej>=0?byId(d.ej)||null:null,!!d.tie);break;
    case 'resume':clientResume(d);break;
    case 'end':if(G.state!=='end')endGame(d.team==='imp'?'imp':'crew',cleanText(d.reason,60));break;
    case 'toast':toast(cleanText(d.text,60));break;
  }
}
function clientStartMeeting(d){
  if(G.state!=='play'&&G.state!=='intro')return;
  const caller=byId(d.c);if(!caller)return;
  if(G.state==='intro')beginPlay();
  const body=d.b>=0&&byId(d.b)?{id:d.b|0,roomName:cleanText(d.rn,30)}:null;
  if(body)SFX.report();else SFX.emergency();
  G.state='meeting';
  G.M={caller,body,t:0,votes:new Map(),sel:null,result:false,vl:-1,dl:-1};
  meetingUI(caller,body);
}
function clientResult(d){
  const M=G.M;
  if(G.state!=='meeting'||!M||!listOk(d.vs))return;
  SFX.tally();M.result=true;M.sel=null;
  M.votes=new Map(d.vs.filter(x=>Array.isArray(x)).map(([v,t])=>[v|0,t==='skip'?'skip':t|0]));
  renderVoteDots(M.votes);updateCards();$('mTimer').textContent='開票';
}
function clientResume(d){
  if(G.state!=='meeting'&&G.state!=='eject')return;
  stopEject();$('meeting').classList.add('hidden');
  const player=G.player,was=player.alive;
  if(d&&Array.isArray(d.al))for(const a of G.actors)a.alive=!!d.al[a.id];
  if(was&&!player.alive)toast('あなたは追放された… ゴーストとして続行',3500);
  G.state='play';player.killCd=15;G.bodies=[];G.M=null;
  spawnAll();renderTaskList();$('hud').classList.remove('hidden');
}
export function hostGone(){
  if(G.state==='lobby'){renderLobby();return;}
  if(G.state==='end')return;
  closeTask();if(G.mapOpen)toggleMap();
  hideScreens(['hud','meeting','eject','intro']);
  G.state='end';
  $('endBody').replaceChildren(
    el('div',{class:'role imp',text:'ゲーム終了'}),
    el('p',{text:'ホストが退出したため、ゲームを終了しました。'}),
    el('button',{class:'btn',text:'ロビーに戻る',onclick:showLobby}));
  $('end').classList.remove('hidden');
}
