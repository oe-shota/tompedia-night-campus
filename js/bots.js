// ボットのAIとキル
import {KILL_RANGE,KILL_CD,BOT_SPEED} from './config.js';
import {rand,pick,dist} from './util.js';
import {ST,WANDER,findPath,free,los,placeName} from './world.js';
import {SFX} from './audio.js';
import {canSee} from './render.js';
import {toast,renderTaskList} from './ui.js';
import {closeTask} from './tasks.js';
import {checkWin} from './game.js';
import {startMeeting} from './meeting.js';
import {G,byId,isHost} from './state.js';
import {emitEv} from './net/room.js';
import {sendState} from './net/host.js';

function go(a,tf,tx,ty){a.path=findPath(a.f,Math.floor(a.x),Math.floor(a.y),tf,tx,ty);}
function followPath(a,dt,speed){
  if(!a.path.length)return true;
  const [nf,tx,ty]=a.path[0];
  if(nf!==a.f){a.f=nf;a.x=tx+.5;a.y=ty+.5;a.path.shift();return !a.path.length;}
  const gx=tx+.5,gy=ty+.5,dx=gx-a.x,dy=gy-a.y,d=Math.hypot(dx,dy),step=speed*dt;
  if(d<=step){a.x=gx;a.y=gy;a.path.shift();}else{a.x+=dx/d*step;a.y+=dy/d*step;}
  if(Math.abs(dx)>.01)a.facing=dx>0?1:-1;
  a.moving=true;a.anim+=dt*12;
  return a.path.length===0;
}
function taskLogic(a,dt,fake){
  if(a.state==='task'||a.state==='wait'){a.wait-=dt;if(a.wait<=0){
    if(a.state==='task'&&!fake&&a.cur!=null&&!a.done.has(a.cur)){a.done.add(a.cur);G.tasksDone++;}a.state='idle';}return;}
  if(a.state==='move'||a.state==='flee'){if(followPath(a,dt,BOT_SPEED)){if(a.cur!=null){a.state='task';a.wait=rand(3.5,7);}else{a.state='wait';a.wait=rand(.5,3);}}return;}
  const rem=fake?[]:a.tasks.filter(s=>!a.done.has(s));
  if(rem.length&&Math.random()<.7)a.cur=pick(rem);
  else if(fake&&Math.random()<.6)a.cur=Math.floor(Math.random()*ST.length);
  else a.cur=null;
  if(a.cur!=null)go(a,ST[a.cur].f,ST[a.cur].x,ST[a.cur].y);
  else{const z=pick(WANDER);go(a,z.f,z.x+Math.floor(Math.random()*z.w),z.y+Math.floor(Math.random()*z.h));}
  a.state='move';
}
function sees(o,t,r){return dist(o,t)<r&&los(o.f,o.x,o.y,t.x,t.y);}
function hasWitness(a,t,ignorePlayer){
  for(const o of G.actors){if(!o.alive||o.isImp||o===t||o===a)continue;if(ignorePlayer&&(o.isPlayer||o.human))continue;
    if(sees(o,a,7)||sees(o,t,7))return true;}
  return false;
}
function sense(a){
  for(const o of G.actors){if(o===a||!o.alive)continue;if(sees(a,o,7))a.mem.push({id:o.id,room:placeName(o.f,o.x,o.y),t:G.gameTime});}
  if(a.mem.length>400)a.mem=a.mem.filter(m=>G.gameTime-m.t<60);
}
export function updateBot(a,dt){
  a.moving=false;
  if(!a.alive){if(!a.isImp)taskLogic(a,dt,false);return;}
  if(!a.isImp){
    a.senseT-=dt;if(a.senseT<=0){a.senseT=.5;sense(a);}
    for(const b of G.bodies)if(sees(a,b,5)){startMeeting(a,b);return;}
    taskLogic(a,dt,false);return;
  }
  a.killCd-=dt;
  if(a.state==='chase'){
    const t=byId(a.target);a.chaseT-=dt;
    if(!t||!t.alive||a.chaseT<=0){a.state='idle';return;}
    if(dist(a,t)<KILL_RANGE*.8&&a.killCd<=0){
      if(!hasWitness(a,t,a.gamble)){kill(a,t);if(G.state!=='play')return;
        const far=pick(ST.map((s,i)=>i).filter(i=>ST[i].f!==a.f||Math.hypot(ST[i].x-a.x,ST[i].y-a.y)>12));
        a.cur=far;go(a,ST[far].f,ST[far].x,ST[far].y);a.state='flee';}
      else a.state='idle';
      return;
    }
    a.repath-=dt;if(a.repath<=0){a.repath=.35;go(a,t.f,Math.floor(t.x),Math.floor(t.y));}
    if(a.path.length)followPath(a,dt,BOT_SPEED*1.1);
    else if(t.f===a.f){const dx=t.x-a.x,dy=t.y-a.y,d=Math.hypot(dx,dy)||1,s=BOT_SPEED*1.1*dt;if(free(a.f,a.x+dx/d*s,a.y+dy/d*s,.2)){a.x+=dx/d*s;a.y+=dy/d*s;a.facing=dx>0?1:-1;a.moving=true;a.anim+=dt*12;}}
    return;
  }
  if(a.killCd<=0&&G.gameTime-G.roundStart>6){a.scan-=dt;if(a.scan<=0){a.scan=.3;
    const cands=G.actors.filter(t=>t.alive&&!t.isImp&&sees(a,t,8)).sort((p,q)=>dist(a,p)-dist(a,q));
    for(const t of cands){const g=Math.random()<.2;if(!hasWitness(a,t,g)){a.state='chase';a.target=t.id;a.chaseT=6;a.repath=0;a.gamble=g;return;}}
  }}
  taskLogic(a,dt,true);
}
export function kill(k,v){
  const body={id:v.id,f:v.f,x:v.x,y:v.y,color:v.color,t:G.gameTime,roomName:placeName(v.f,v.x,v.y)};
  k.killCd=KILL_CD;
  for(const o of G.actors)if(o.alive&&!o.isPlayer&&!o.human&&!o.isImp&&o!==k&&o!==v&&sees(o,k,7.5))o.sus[k.id]=100;
  killFx(k,v,body);
  if(isHost()){emitEv({k:'kill',kl:k.id,v:v.id,f:body.f,x:+body.x.toFixed(2),y:+body.y.toFixed(2),rn:body.roomName});sendState();}
  checkWin();
}
// キルの見た目と音（ホスト・1人用・参加者で共通）
export function killFx(k,v,body){
  if(!v.alive)return;
  if(k.isPlayer||v.isPlayer||canSee(v))SFX.kill();if(v.isPlayer)SFX.dead();
  v.alive=false;G.bodies.push(body);
  k.f=body.f;k.x=body.x;k.y=body.y;
  if(k.isPlayer){k.killCd=KILL_CD;G.flash=.5;}
  if(v.isPlayer){G.flash=1;closeTask();toast(`${k.name} にキルされた！ ゴーストとして${G.player.isImp?'見守ろう':'タスクを続けられます'}`,4000);renderTaskList();}
}
