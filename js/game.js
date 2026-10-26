// ゲームの開始・ラウンド・勝敗
import {COLORS,TASKS_PER,DIFF} from './config.js';
import {$,el,rand,shuffle} from './util.js';
import {ST,BTN} from './world.js';
import {beanCanvas} from './sprites.js';
import {SFX} from './audio.js';
import {buildFloor} from './render.js';
import {toggleMap,renderTaskList,hideScreens} from './ui.js';
import {closeTask} from './tasks.js';
import {G,isHost} from './state.js';
import {emitEv,showLobby} from './net/room.js';
import {sendState} from './net/host.js';

// インポスター2人は7人以上のときだけ選べる
export const maxImp=total=>total>=7?2:1;
export function limitImp(sel,total){
  const ok=maxImp(total)>=2;
  sel.querySelector('option[value="2"]').disabled=!ok;
  if(!ok)sel.value='1';
}
export function initTitle(){
  const sw=$('swatches');
  COLORS.forEach((c,i)=>{const d=el('button',{class:'sw'+(i===0?' sel':''),title:c.n,type:'button'});d.style.background=c.c;
    d.setAttribute('role','radio');d.setAttribute('aria-label',c.n);d.setAttribute('aria-checked',i===0);
    d.onclick=()=>{G.selColor=i;[...sw.children].forEach((e,j)=>{e.classList.toggle('sel',j===i);e.setAttribute('aria-checked',j===i);});};sw.appendChild(d);});
  // 設定を閉じていても今の値が見えるように、summary に要約を出す
  const txt=id=>$(id).selectedOptions[0].textContent.replace(/（.*）/,'');
  const sum=()=>{$('optSum').textContent=`${$('sN').value}人・インポスター${$('sImp').value}・${txt('sRole')}・ボット${txt('sDiff')}`;};
  $('sN').onchange=()=>{limitImp($('sImp'),+$('sN').value);sum();};
  ['sImp','sRole','sDiff'].forEach(id=>$(id).onchange=sum);
  limitImp($('sImp'),+$('sN').value);sum();
}

export function mkActor(id,name,color,isPlayer){
  return {id,name,color,isPlayer,isImp:false,alive:true,f:0,x:0,y:0,path:[],state:'idle',wait:0,tasks:[],done:new Set(),cur:null,
    killCd:15,remote:false,human:false,peer:null,mem:[],sus:{},facing:1,moving:false,anim:0,senseT:Math.random()*.5,repath:0,chaseT:0,target:null,scan:0,emUsed:false};
}
// タスクの割り当てとキルのクールダウン（1人用・ホストで共通）
export function dealTasks(firstKillCd){
  G.tasksTotal=0;
  for(const a of G.actors){a.tasks=shuffle(ST.map((_,i)=>i)).slice(0,TASKS_PER);if(!a.isImp)G.tasksTotal+=TASKS_PER;a.killCd=firstKillCd(a);}
}
// 1人用（ボット対戦）
export function startGame(){
  const n=+$('sN').value,impN=Math.min(+$('sImp').value,maxImp(+$('sN').value)),role=$('sRole').value;
  const pc=COLORS[G.selColor];
  G.actors=[];G.bodies=[];G.tasksDone=0;G.gameTime=0;G.D=DIFF[$('sDiff').value]||DIFF.normal;
  const player=G.player=mkActor(0,($('iName').value.trim()||'あなた').slice(0,8),pc.c,true);G.actors.push(player);
  const pool=shuffle(COLORS.filter((_,i)=>i!==G.selColor));
  for(let i=0;i<n-1;i++)G.actors.push(mkActor(i+1,pool[i].n,pool[i].c,false));
  let cands=G.actors.slice();
  const imps=[];
  if(role==='imp'){imps.push(player);cands=cands.filter(a=>a!==player);}
  else if(role==='crew')cands=cands.filter(a=>a!==player);
  shuffle(cands);while(imps.length<impN)imps.push(cands.shift());
  imps.forEach(a=>a.isImp=true);
  dealTasks(a=>a.isPlayer?12:rand(14,20));
  spawnAll();
  buildFloor(0);
  $('title').classList.add('hidden');
  showIntro();
}
export function spawnAll(){
  const al=G.actors.filter(a=>a.alive);
  al.forEach((a,i)=>{const ang=i/al.length*Math.PI*2-Math.PI/2;a.f=BTN.f;a.x=BTN.x+Math.cos(ang)*4;a.y=BTN.y+Math.sin(ang)*1.5;a.path=[];a.state='idle';a.cur=null;a.facing=Math.cos(ang)>0?-1:1;});
  G.roundStart=G.gameTime;
}
export function showIntro(){
  G.state='intro';SFX.reveal();
  const imp=G.player.isImp;
  const impN=G.actors.filter(a=>a.isImp).length;
  const bs=el('div',{class:'beans'});
  (imp?G.actors.filter(a=>a.isImp):G.actors).forEach(a=>{const s=el('span',{text:a.name});if(imp)s.style.color='#ff4d5e';bs.appendChild(el('div',{class:'b'},beanCanvas(a.color,58),s));});
  $('introBody').replaceChildren(
    el('div',{class:'role '+(imp?'imp':'crew'),text:imp?'インポスター':'クルー'}),
    el('p',{class:'note',text:imp?'気づかれないように編集部員をキルしよう':`夜の講義棟に インポスターが ${impN}人 潜んでいる…`}),
    bs,
    el('button',{class:'btn',text:'はじめる',onclick:beginPlay}));
  $('intro').classList.remove('hidden');
  if(G.MODE!=='solo')setTimeout(()=>{if(G.state==='intro')beginPlay();},5000);
}
export function beginPlay(){
  $('intro').classList.add('hidden');$('hud').classList.remove('hidden');
  G.state='play';renderTaskList();
  const imp=G.player.isImp;
  $('roleTag').textContent=imp?'インポスター':'クルー（編集部員）';$('roleTag').className=imp?'imp':'crew';
  $('bKill').classList.toggle('hidden',!imp);
}

export function checkWin(){
  if(G.MODE==='client')return false;
  if(G.state==='end')return true;
  if(G.state!=='play')return false;
  const ai=G.actors.filter(a=>a.alive&&a.isImp).length,ac=G.actors.filter(a=>a.alive&&!a.isImp).length;
  if(ai===0)return endGame('crew','インポスターを全員追放した！');
  if(ai>=ac)return endGame('imp','インポスターが講義棟を乗っ取った…');
  if(G.tasksDone>=G.tasksTotal)return endGame('crew','すべての記事が完成した！');
  return false;
}
export function endGame(team,reason){
  G.lastEnd={team,reason};
  if(isHost())emitEv({k:'end',team,reason});
  G.state='end';closeTask();if(G.mapOpen)toggleMap();
  hideScreens(['meeting','eject','intro','hud']);
  const win=(team==='imp')===G.player.isImp;if(win)SFX.win();else SFX.lose();
  const bs=el('div',{class:'beans'});
  G.actors.forEach(a=>{
    const col=a.isImp?'#ff4d5e':'#a99cbf';
    const s=el('span',{text:a.name});s.style.color=col;
    const r=el('span',{text:a.isImp?'インポスター':'クルー'});r.style.fontWeight='400';r.style.color=col;
    bs.appendChild(el('div',{class:'b'},beanCanvas(a.color,48,!a.alive),s,r));});
  const st=el('p',{class:'note',text:`タスク進捗 ${G.tasksDone}/${G.tasksTotal}`});st.style.fontSize='13px';
  const solo=G.MODE==='solo';
  $('endBody').replaceChildren(
    el('div',{class:'role '+(win?'crew':'imp'),text:win?'勝利':'敗北'}),
    el('p',{text:reason+`（${team==='imp'?'インポスター':'クルー'}の勝ち）`}),
    bs,st,
    el('button',{class:'btn',text:solo?'もう一度遊ぶ':'ロビーに戻る',onclick:()=>{$('end').classList.add('hidden');if(G.MODE==='solo'){$('title').classList.remove('hidden');G.state='title';}else showLobby();}}));
  $('end').classList.remove('hidden');
  if(isHost())sendState();
  return true;
}
