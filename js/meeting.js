// 会議（ボットの発言・投票）と追放
import {DISCUSS_TIME,VOTE_TIME} from './config.js';
import {$,el,rand,pick,shuffle,shade,cleanText} from './util.js';
import {WANDER,placeName} from './world.js';
import {beanCanvas} from './sprites.js';
import {SFX} from './audio.js';
import {toast,toggleMap,renderTaskList} from './ui.js';
import {closeTask} from './tasks.js';
import {spawnAll,checkWin} from './game.js';
import {G,byId,nameOf,isHost,isClient} from './state.js';
import {emitEv,emitAct} from './net/room.js';
import {sendState} from './net/host.js';

// ---- ボットの発言 ----
function hear(sp,id,amt){for(const c of G.actors)if(c.alive&&!c.isImp&&!c.isPlayer&&!c.human&&c!==sp&&c.id!==id)c.sus[id]=(c.sus[id]||0)+amt;}
function replyTo(id){const t=byId(id);if(!t||t.isPlayer||t.human||!t.alive||Math.random()>.7)return;
  G.M.lines.splice(G.M.shown,0,{a:t,text:t.isImp?pick(['いやいや、濡れ衣だって！','証拠あるの？','ぼくはタスクしてただけだよ']):pick(['えっ、ぼくじゃないよ！','ずっとタスクしてたって！','信じてよ〜'])});}
function crewLine(b){
  for(const id in b.sus){if(b.sus[id]>=100){const x=byId(id);if(x.alive)return{a:b,text:`${x.name}がキルするところを見た！！間違いない！`,fx:()=>{hear(b,x.id,4);replyTo(x.id);}};}}
  const body=G.M.body;
  if(body){
    const seen=new Set(),alibi=new Map();
    for(const m of b.mem){if(m.id===body.id||!byId(m.id).alive)continue;
      if(m.t>=body.t-20&&m.t<=body.t+3&&m.room===body.roomName)seen.add(m.id);
      if(Math.abs(m.t-body.t)<=4&&m.room!==body.roomName)alibi.set(m.id,m.room);}
    for(const id of alibi.keys())seen.delete(id);
    if(seen.size){const ids=[...seen];ids.forEach(id=>b.sus[id]=(b.sus[id]||0)+2.5);
      return{a:b,text:`${body.roomName}の近くで${ids.map(nameOf).join('と')}を見かけたよ`,fx:()=>{ids.forEach(id=>hear(b,id,1.2));replyTo(ids[0]);}};}
    if(alibi.size){const [id,room]=pick([...alibi]);b.sus[id]=(b.sus[id]||0)-1.5;
      return{a:b,text:`${nameOf(id)}はそのとき${room}にいたよ。白だと思う`,fx:()=>hear(b,id,-1)};}
  }
  let top=null,tv=0;for(const a of G.actors)if(a.alive&&a!==b&&(b.sus[a.id]||0)>tv){tv=b.sus[a.id];top=a;}
  if(top&&tv>=2)return{a:b,text:`${top.name}がちょっと怪しい気がする…`,fx:()=>{hear(b,top.id,.8);replyTo(top.id);}};
  return{a:b,text:pick([`${placeName(b.f,b.x,b.y)}でタスクしてた。何も見てないや`,'うーん、情報なし…','誰か見た人いる？',`${pick(WANDER).name}の方にいたよ`])};
}
function impLine(b){
  const acc=G.actors.find(c=>c.alive&&!c.isImp&&!c.isPlayer&&!c.human&&(c.sus[b.id]||0)>=100);
  if(acc)return{a:b,text:`は？${acc.name}の方が怪しいでしょ！嘘ついてる！`,fx:()=>hear(b,acc.id,1.5)};
  const crew=G.actors.filter(a=>a.alive&&!a.isImp&&a!==b);
  if(crew.length&&Math.random()<.5){const c=pick(crew),r=pick(WANDER).name;return{a:b,text:`${c.name}が${r}で一人でウロウロしてたよ`,fx:()=>{hear(b,c.id,1);replyTo(c.id);}};}
  return{a:b,text:pick([`${pick(WANDER).name}でタスクしてた`,'何も見てない…','ぼくはずっとタスクやってたよ'])};
}

// ---- 会議の開始（ホスト・1人用） ----
export function startMeeting(caller,body){
  if(G.state!=='play')return;
  if(body)SFX.report();else SFX.emergency();
  G.state='meeting';
  const M=G.M={caller,body,t:0,next:.6,lines:[],shown:0,votes:new Map(),botAt:new Map(),voteStart:null,sel:null,chatLeft:new Map(),result:false};
  M.lines.push({a:caller,text:body?`${body.roomName}で${nameOf(body.id)}が倒れてる！！`:'緊急会議！ちょっと話し合おう'});
  const speakers=shuffle(G.actors.filter(a=>a.alive&&!a.isPlayer&&!a.human&&a!==caller));
  if(!caller.isPlayer&&!caller.human)speakers.unshift(caller);
  for(const b of speakers)M.lines.push(b.isImp?impLine(b):crewLine(b));
  emitEv({k:'meet',c:caller.id,b:body?body.id:-1,rn:body?body.roomName:''});
  meetingUI(caller,body);
  sendState();
}
// 会議画面を開く（ホスト・参加者で共通）
export function meetingUI(caller,body){
  closeTask();if(G.mapOpen)toggleMap();
  $('mInput').value='';G.bodies=[];
  $('hud').classList.add('hidden');
  $('mTitle').textContent=body?`${caller.name} が死体を報告！`:`${caller.name} が緊急会議を招集！`;
  $('mChat').replaceChildren();
  $('mTarget').replaceChildren(...G.actors.filter(a=>a.alive&&a!==G.player).map(a=>el('option',{value:a.id,text:a.name})));
  $('mCtl').style.display=G.player.alive?'':'none';
  $('bSkip').classList.remove('sel');
  buildCards();
  $('meeting').classList.remove('hidden');
}
function buildCards(){
  const player=G.player;
  $('mGrid').replaceChildren(...G.actors.map(a=>{
    const nm=el('div',{class:'nm',text:a.name+(a===player&&a.name!=='あなた'?'（あなた）':'')});
    if(player.isImp&&a.isImp)nm.style.color='#c00';
    const d=el('div',{class:'pc'+(a.alive?'':' dead'),onclick:()=>playerVote(a.id)},
      beanCanvas(a.color,40,!a.alive),
      el('div',{},nm,el('div',{class:'st'}),el('div',{class:'dots'})));
    d.dataset.id=a.id;
    return d;
  }));
  updateCards();
}
export function updateCards(){
  const M=G.M;
  for(const d of $('mGrid').children){
    const id=+d.dataset.id,a=byId(id);
    d.classList.toggle('sel',M.sel===id);
    d.querySelector('.st').textContent=!a.alive?'死亡':M.sel===id?'もう一度押して投票':'';
    if(M.votes.has(id)&&!d.querySelector('.badge'))d.appendChild(el('span',{class:'badge',text:'投票済'}));
  }
  $('bSkip').textContent=M.sel==='skip'?'もう一度押してスキップ':'スキップに投票';
  $('bSkip').classList.toggle('sel',M.sel==='skip');
}

// ---- 自分の投票・発言 ----
function playerVote(id){
  const M=G.M,player=G.player;
  if(!M||M.result||!player.alive||M.votes.has(player.id))return;
  if(id!=='skip'){const a=byId(id);if(!a.alive)return;}
  if(M.sel===id){
    SFX.vote();M.votes.set(player.id,id);M.sel=null;
    if(isClient())emitAct({k:'vote',v:id});else{addSys(`${player.name}が投票した`);sendState();}
  }
  else M.sel=id;
  updateCards();
}
$('bSkip').onclick=()=>playerVote('skip');
document.querySelectorAll('#mCtl [data-say]').forEach(b=>b.onclick=()=>{
  const t=byId(+$('mTarget').value);if(!t)return;
  const k=b.dataset.say;
  playerSay(k==='sus'?`${t.name}が怪しい！`:k==='saw'?`${t.name}がキルするところを見た！`:`${t.name}は白だと思う`);
});
// 自由入力の発言。名前と言い回しからボットの疑いを動かす（影響するのは1会議5回まで）
function playerSay(raw){
  if(!G.M||G.M.result||!G.player.alive)return;
  if(isClient()){const t=String(raw).trim().slice(0,80);if(t)emitAct({k:'say',text:t});return;}
  humanSay(G.player,raw);
}
// 人間の発言をボットの判断に反映する（ホスト・1人用）
export function humanSay(a,raw){
  const M=G.M;
  const text=cleanText(raw,80);if(!text)return;
  addChat(a,text);
  const left=M.chatLeft.get(a.id)??5;
  const named=G.actors.filter(o=>o!==a&&o.alive&&text.includes(o.name));
  if(named.length&&left>0){
    M.chatLeft.set(a.id,left-1);
    const saw=/キル|殺|やって(た|る)|目撃/.test(text);
    const white=/白|一緒|信じ|違う|味方|無実/.test(text)&&!/怪し|犯人|インポ|黒|キル|殺/.test(text);
    for(const t of named){
      if(white)hear(a,t.id,-2);
      else{hear(a,t.id,saw?3.5:2);replyTo(t.id);}
    }
  }else if(/[?？]|誰|だれ|どこ/.test(text)){
    const bots=G.actors.filter(o=>o.alive&&!o.isPlayer&&!o.human);
    if(bots.length){const b=pick(bots);M.lines.splice(M.shown,0,b.isImp?impLine(b):crewLine(b));M.next=Math.min(M.next,M.t+.8);}
  }
}
$('mSend').onclick=()=>{playerSay($('mInput').value);$('mInput').value='';};
$('mInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('mSend').click();}});
export function addChat(a,text){
  SFX.chat();if(isHost())emitEv({k:'chat',a:a.id,text});
  const w=el('span',{class:'who',text:a.name+':'});w.style.color=shade(a.color,-.2);
  const c=$('mChat');c.appendChild(el('div',{class:'ln'},beanCanvas(a.color,22),w,el('span',{text})));c.scrollTop=c.scrollHeight;
}
export function addSys(text){if(isHost())emitEv({k:'sys',text});const c=$('mChat');c.appendChild(el('div',{class:'ln sys',text}));c.scrollTop=c.scrollHeight;}

// ---- 投票と開票（ホスト・1人用） ----
function botVote(b){
  const M=G.M;
  const counts=new Map();for(const v of M.votes.values())if(v!=='skip')counts.set(v,(counts.get(v)||0)+1);
  const alive=G.actors.filter(a=>a.alive&&a!==b);
  if(!b.isImp){let best=null,bv=-1;for(const o of alive){const v=(b.sus[o.id]||0)+(counts.get(o.id)||0)*1+Math.random()*1.2;if(v>bv){bv=v;best=o;}}return bv>=3?best.id:'skip';}
  let best=null,bv=-1;
  for(const c of alive){if(c.isImp)continue;let tot=(counts.get(c.id)||0)*1.5+Math.random();for(const o of G.actors)if(o.alive&&!o.isImp&&!o.isPlayer&&!o.human&&o!==c)tot+=Math.max(0,o.sus[c.id]||0)/3;if(tot>bv){bv=tot;best=c;}}
  if(best&&bv>=2.2)return best.id;
  return Math.random()<.25&&best?best.id:'skip';
}
export function updateMeeting(dt){
  const M=G.M;
  if(!M)return;
  M.t+=dt;
  if(isClient()){
    if(M.vl>=0)M.vl=Math.max(0,M.vl-dt);
    if(M.dl>=0)M.dl=Math.max(0,M.dl-dt);
    $('mTimer').textContent=M.result?'開票':M.vl<0?discussLabel(M.dl):`投票終了まで ${Math.ceil(M.vl)}秒`;
    return;
  }
  if(M.result){M.resT-=dt;if(M.resT<=0)showEject(M.ejected,M.tie);return;}
  if(M.shown<M.lines.length&&M.t>=M.next){const l=M.lines[M.shown++];addChat(l.a,l.text);if(l.fx)l.fx();M.next=M.t+1.5;}
  // 発言が続いても DISCUSS_TIME で打ち切る（「？」の連投で会議が終わらなくなるのを防ぐ）
  if(M.voteStart==null&&(M.shown>=M.lines.length&&M.t>=M.next||M.t>=DISCUSS_TIME)){M.voteStart=M.t;addSys('― 投票タイム ―');
    for(const a of G.actors)if(a.alive&&!a.isPlayer&&!a.human)M.botAt.set(a.id,M.t+rand(1,10));}
  if(M.voteStart!=null)for(const [id,at] of M.botAt)if(!M.votes.has(id)&&M.t>=at){M.votes.set(id,botVote(byId(id)));SFX.vote();sendState();addSys(`${nameOf(id)}が投票した`);updateCards();}
  const aliveN=G.actors.filter(a=>a.alive).length;
  const deadline=M.voteStart!=null?M.voteStart+VOTE_TIME:Infinity;
  $('mTimer').textContent=M.voteStart==null?discussLabel(DISCUSS_TIME-M.t):`投票終了まで ${Math.max(0,Math.ceil(deadline-M.t))}秒`;
  if(M.votes.size>=aliveN||M.t>=deadline)concludeVotes();
}
const discussLabel=left=>left>=0?`議論中…（最長あと ${Math.max(0,Math.ceil(left))}秒）`:'議論中…';
function concludeVotes(){
  const M=G.M;
  SFX.tally();
  M.result=true;M.resT=3.5;M.sel=null;
  const counts=new Map();let skip=0;
  for(const a of G.actors)if(a.alive&&!M.votes.has(a.id))M.votes.set(a.id,'skip');
  for(const [v,t] of M.votes){if(t==='skip')skip++;else counts.set(t,(counts.get(t)||0)+1);}
  let top=null,tv=0,tie=false;for(const [id,c] of counts){if(c>tv){tv=c;top=id;tie=false;}else if(c===tv)tie=true;}
  M.ejected=(top!=null&&!tie&&tv>skip)?byId(top):null;
  M.tie=tie&&tv>skip;
  const voters=renderVoteDots(M.votes);
  addSys(`開票！ スキップ ${skip}票`+(voters.get('skip')?`（${voters.get('skip').map(nameOf).join('、')}）`:''));
  emitEv({k:'result',vs:[...M.votes]});
  updateCards();
  $('mTimer').textContent='開票';
  sendState();
}
export function renderVoteDots(votes){
  const voters=new Map();
  for(const [v,t] of votes){if(!voters.has(t))voters.set(t,[]);voters.get(t).push(v);}
  for(const d of $('mGrid').children){
    d.querySelector('.dots').replaceChildren(...(voters.get(+d.dataset.id)||[]).map(byId).filter(Boolean).map(a=>{const s=el('span',{class:'dot'});s.style.background=a.color;return s;}));}
  return voters;
}

// ---- 追放 ----
let ejectIv=null;
export function showEject(e,tie){
  if(G.state==='eject')return;
  G.state='eject';SFX.eject();$('meeting').classList.add('hidden');
  if(isHost()){emitEv({k:'eject',ej:e?e.id:-1,tie:tie?1:0});sendState();}
  const fb=$('floatBean');fb.replaceChildren();
  const impLeft=G.actors.filter(a=>a.alive&&a.isImp&&a!==e).length;
  let txt;
  if(e){fb.appendChild(beanCanvas(e.color,70));fb.style.animation='none';void fb.offsetWidth;fb.style.animation='';
    txt=`${e.name} はインポスター${e.isImp?'だった。':'ではなかった。'}`;}
  else txt=tie?'同票のため、誰も追放されなかった。':'誰も追放されなかった。（スキップ）';
  $('ejectTxt').textContent='';$('ejectSub').textContent='';
  $('eject').classList.remove('hidden');
  let i=0;clearInterval(ejectIv);const iv=ejectIv=setInterval(()=>{$('ejectTxt').textContent=txt.slice(0,++i);if(i>=txt.length){clearInterval(iv);$('ejectSub').textContent=`インポスターは残り ${impLeft}人`;}},70);
  setTimeout(()=>{clearInterval(iv);if(!isClient())afterEject(e);},txt.length*70+2200);
}
// 追放画面を途中で閉じる（参加者がホストの再開を受けたとき）
export function stopEject(){clearInterval(ejectIv);$('eject').classList.add('hidden');}
function afterEject(e){
  $('eject').classList.add('hidden');
  if(e){e.alive=false;if(e.isPlayer){renderTaskList();toast('あなたは追放された… ゴーストとして続行',3500);}}
  G.state='play';
  if(checkWin())return;
  for(const a of G.actors){if(a.isImp)a.killCd=a.isPlayer?15:rand(16,22);for(const k in a.sus)if(a.sus[k]<100)a.sus[k]*=.6;a.state='idle';a.path=[];}
  spawnAll();
  $('hud').classList.remove('hidden');
  G.M=null;
  emitEv({k:'resume',al:G.actors.map(a=>a.alive?1:0)});sendState();
}
