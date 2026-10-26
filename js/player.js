// 自分の操作（キーボード・タッチ）とHUD
import {W,H,SPEED,KILL_RANGE,USE_RANGE,REPORT_RANGE,STAIR_RANGE} from './config.js';
import {$,dist} from './util.js';
import {ST,STAIRS,BTN,free,los,placeName} from './world.js';
import {SFX} from './audio.js';
import {toast,toggleMap} from './ui.js';
import {openTask,closeTask} from './tasks.js';
import {kill} from './bots.js';
import {startMeeting} from './meeting.js';
import {G,isClient} from './state.js';
import {emitAct} from './net/room.js';

let useTarget=null,reportTarget=null,killTarget=null,lastPlace='';
const keys={};
let joy=null;
addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys[e.code]=true;
  if(G.state!=='play')return;
  if(G.taskOpen!=null){if(e.code==='Escape')closeTask();return;}
  if(e.code==='KeyE'||e.code==='Space')doUse();
  if(e.code==='KeyR')doReport();
  if(e.code==='KeyQ')doKill();
  if(e.code==='KeyM')toggleMap();
  if(e.code==='Escape'&&G.mapOpen)toggleMap();
});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
const cv=$('c');
cv.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||G.state!=='play')return;joy={id:e.pointerId,ox:e.clientX,oy:e.clientY,dx:0,dy:0};
  const j=$('joy');j.style.left=e.clientX+'px';j.style.top=e.clientY+'px';j.classList.remove('hidden');$('knob').style.transform='';cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{if(!joy||e.pointerId!==joy.id)return;let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const d=Math.hypot(dx,dy);if(d>50){dx=dx/d*50;dy=dy/d*50;}
  joy.dx=dx;joy.dy=dy;$('knob').style.transform=`translate(${dx}px,${dy}px)`;});
const endJoy=e=>{if(joy&&e.pointerId===joy.id){joy=null;$('joy').classList.add('hidden');}};
cv.addEventListener('pointerup',endJoy);cv.addEventListener('pointercancel',endJoy);
$('bUse').onclick=doUse;$('bReport').onclick=doReport;$('bKill').onclick=doKill;$('bMap').onclick=toggleMap;
$('mapPanel').onclick=toggleMap;

export function updatePlayer(dt){
  const p=G.player;p.moving=false;
  if(p.isImp&&p.alive)p.killCd-=dt;
  if(G.taskOpen!=null)return;
  let kx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
  let ky=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  if(joy&&Math.hypot(joy.dx,joy.dy)>8){kx=joy.dx/50;ky=joy.dy/50;}
  const m=Math.hypot(kx,ky);if(m<.01)return;
  if(m>1){kx/=m;ky/=m;}
  const sp=(p.alive?SPEED:SPEED*1.2)*dt;
  if(p.alive){const r=.28;const nx=p.x+kx*sp;if(free(p.f,nx,p.y,r))p.x=nx;const ny=p.y+ky*sp;if(free(p.f,p.x,ny,r))p.y=ny;}
  else{p.x=Math.max(0,Math.min(W,p.x+kx*sp));p.y=Math.max(0,Math.min(H,p.y+ky*sp));}
  if(Math.abs(kx)>.05)p.facing=kx>0?1:-1;p.moving=true;p.anim+=dt*12;
  if(p.alive){p.stepT=(p.stepT||0)-dt;if(p.stepT<=0){p.stepT=.3;SFX.step();}}
}
export function hudTick(){
  const p=G.player;useTarget=null;reportTarget=null;killTarget=null;
  if(!p.isImp)for(const s of p.tasks){const st=ST[s];if(!p.done.has(s)&&st.f===p.f&&Math.hypot(st.x+.5-p.x,st.y+.5-p.y)<USE_RANGE){useTarget={kind:'task',s};break;}}
  if(!useTarget&&p.alive&&!p.emUsed&&dist(p,BTN)<1.9)useTarget={kind:'btn'};
  if(!useTarget)for(const s of STAIRS)if(s.f===p.f&&Math.hypot(s.x+.5-p.x,s.y+.5-p.y)<STAIR_RANGE){useTarget={kind:'stair',s};break;}
  if(p.alive)reportTarget=G.bodies.find(b=>dist(p,b)<REPORT_RANGE&&los(p.f,p.x,p.y,b.x,b.y))||null;
  if(p.alive&&p.isImp){let best=null,bd=KILL_RANGE;for(const a of G.actors)if(a.alive&&!a.isImp&&dist(p,a)<bd&&los(p.f,p.x,p.y,a.x,a.y)){bd=dist(p,a);best=a;}killTarget=best;}
  const ub=$('bUse');ub.classList.toggle('on',!!useTarget&&G.taskOpen==null);
  ub.firstChild.textContent=useTarget&&useTarget.kind==='stair'?`${useTarget.s.to.f+1}Fへ`:'使う';
  $('bReport').classList.toggle('on',!!reportTarget);
  const kb=$('bKill');kb.classList.toggle('on',!!killTarget&&p.killCd<=0);
  kb.firstChild.textContent=p.isImp&&p.alive&&p.killCd>0?`キル ${Math.ceil(p.killCd)}`:'キル';
  $('taskfill').style.width=(G.tasksTotal?G.tasksDone/G.tasksTotal*100:0)+'%';
  const pl=`${p.f+1}F ｜ ${placeName(p.f,p.x,p.y)}`;if(pl!==lastPlace){lastPlace=pl;$('floorTag').textContent=pl;}
}
function doUse(){
  if(G.state!=='play'||!useTarget||G.taskOpen!=null)return;
  const player=G.player;
  if(useTarget.kind==='btn'){
    if(G.gameTime-G.roundStart<10){SFX.ng();toast(`緊急ボタンはあと${Math.ceil(10-(G.gameTime-G.roundStart))}秒で使えます`);return;}
    player.emUsed=true;if(isClient())emitAct({k:'btn'});else startMeeting(player,null);
  }else if(useTarget.kind==='stair'){
    const s=useTarget.s;SFX.stairs(s.dir==='up');player.f=s.to.f;player.x=s.to.x+.5;player.y=s.to.y+.5;G.fade=.9;toast(`${s.to.f+1}F`,900);
  }else openTask(useTarget.s);
}
function doReport(){if(G.state!=='play'||!reportTarget||G.taskOpen!=null)return;if(isClient())emitAct({k:'report',b:reportTarget.id});else startMeeting(G.player,reportTarget);}
function doKill(){
  const player=G.player;
  if(G.state!=='play'||!killTarget||player.killCd>0||G.taskOpen!=null)return;
  if(isClient()){if(performance.now()<(player.killWait||0))return;player.killWait=performance.now()+800;emitAct({k:'kill',v:killTarget.id});}
  else kill(player,killTarget);
}
