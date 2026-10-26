// ホスト側：ゲームの開始、全体状態の配信、参加者の操作の判定
import {COLORS,KILL_RANGE,REPORT_RANGE,MAX_PLAYERS,DISCUSS_TIME,VOTE_TIME} from '../config.js';
import {$,rand,shuffle,dist,cleanName,validColor} from '../util.js';
import {BTN} from '../world.js';
import {SFX} from '../audio.js';
import {buildFloor} from '../render.js';
import {mkActor,maxImp,dealTasks,spawnAll,showIntro,checkWin} from '../game.js';
import {kill} from '../bots.js';
import {startMeeting,humanSay,addSys,updateCards} from '../meeting.js';
import {G,byId,isHost} from '../state.js';
import {lobbyPeers,lobbyReg,renderLobby,netErr} from './room.js';

const LOBBY_REG_MAX=16;

export function hostStartGame(){
  if(!isHost()||G.state!=='lobby')return;
  const n=+$('lN').value,impN=+$('lImp').value;
  const hs=lobbyPeers().sort((a,b)=>(b.sameTab?1:0)-(a.sameTab?1:0)).slice(0,MAX_PLAYERS);
  if(!hs.some(p=>p.sameTab))return;
  const total=Math.max(n,hs.length),used=new Set();
  G.actors=[];G.bodies=[];G.tasksDone=0;G.gameTime=0;G.lastEnd=null;G.gameId=1+Math.floor(Math.random()*1e9);
  hs.forEach((p,i)=>{
    let c=validColor(p.presence.col);if(used.has(c))c=COLORS.find(x=>!used.has(x.c)).c;used.add(c);
    const a=mkActor(i,cleanName(p.presence.nm),c,!!p.sameTab);a.human=true;a.peer=p.peer;a.remote=!p.sameTab;G.actors.push(a);
    if(p.sameTab)G.player=a;
  });
  const pool=COLORS.filter(x=>!used.has(x.c));
  for(let i=hs.length;i<total;i++){const c=pool[i-hs.length];G.actors.push(mkActor(i,c.n,c.c,false));}
  shuffle(G.actors.slice()).slice(0,Math.min(impN,maxImp(total))).forEach(a=>a.isImp=true);
  dealTasks(a=>a.human?12:rand(14,20));
  spawnAll();buildFloor(0);
  $('lobby').classList.add('hidden');
  showIntro();
  sendState();
}
export function sendState(){
  if(!isHost()||!G.RM)return;
  G.lastSt=performance.now();
  const M=G.M,ph=G.state==='intro'?'play':G.state;
  const d={g:G.gameId,ph,td:G.tasksDone,tt:G.tasksTotal};
  if(ph!=='lobby'){
    d.rs=G.actors.map(a=>[a.id,a.peer||0,a.name,a.color,a.isImp?1:0,a.tasks]);
    d.al=G.actors.map(a=>a.alive?1:0);
    d.bd=G.bodies.map(b=>[b.id,b.f,+b.x.toFixed(2),+b.y.toFixed(2),b.roomName]);
  }
  if(ph==='meeting'&&M)d.mt={c:M.caller.id,b:M.body?M.body.id:-1,rn:M.body?M.body.roomName:'',vd:[...M.votes.keys()],vl:M.voteStart==null?-1:Math.max(0,Math.ceil(M.voteStart+VOTE_TIME-M.t)),dl:M.voteStart==null?Math.max(0,Math.ceil(DISCUSS_TIME-M.t)):-1,res:M.result?1:0};
  if(ph==='end'&&G.lastEnd)d.en=G.lastEnd;
  G.RM.emit('st',d).catch(netErr);
}
// 参加者の操作は、すべてホストがルールに照らして判定してから反映する
export function onAct(msg){
  if(!isHost()||msg.sameTab)return;
  if(msg.data&&msg.data.k==='hello'){
    const now=performance.now(),fresh=!lobbyReg.has(msg.peer);
    for(const [p,r] of lobbyReg)if(now-r.t>=6000)lobbyReg.delete(p);
    if(fresh&&lobbyReg.size>=LOBBY_REG_MAX)return;
    lobbyReg.set(msg.peer,{nm:cleanName(msg.data.nm),col:validColor(msg.data.col),t:now});
    if(fresh&&G.state==='lobby')renderLobby();
    return;
  }
  const a=G.actors.find(x=>x.remote&&x.peer===msg.peer);const d=msg.data;
  if(!a||a.left||!d||typeof d!=='object'||d.g!==G.gameId)return;
  const M=G.M;
  switch(d.k){
    case 'kill':{
      if(G.state!=='play'||!a.isImp||!a.alive||a.killCd>0)return;
      const v=byId(d.v);if(!v||!v.alive||v.isImp||dist(a,v)>KILL_RANGE+1.5)return;
      kill(a,v);break;}
    case 'report':{
      if(G.state!=='play'||!a.alive)return;
      const b=G.bodies.find(b=>b.id===d.b);if(b&&dist(a,b)<REPORT_RANGE+2)startMeeting(a,b);break;}
    case 'btn':
      if(G.state!=='play'||!a.alive||a.emUsed||G.gameTime-G.roundStart<10||dist(a,BTN)>4)return;
      a.emUsed=true;startMeeting(a,null);break;
    case 'task':{
      const s=d.s|0;
      if(a.isImp||!a.tasks.includes(s)||a.done.has(s)||(G.state!=='play'&&G.state!=='meeting'))return;
      a.done.add(s);G.tasksDone++;sendState();checkWin();break;}
    case 'vote':{
      if(G.state!=='meeting'||!M||M.result||!a.alive||M.votes.has(a.id))return;
      let t='skip';if(d.v!=='skip'){const o=byId(d.v);if(!o||!o.alive)return;t=o.id;}
      M.votes.set(a.id,t);SFX.vote();addSys(`${a.name}が投票した`);updateCards();sendState();break;}
    case 'say':
      if(G.state==='meeting'&&M&&!M.result&&a.alive)humanSay(a,d.text);break;
  }
}
