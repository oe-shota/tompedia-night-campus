// エントリ：初期化とゲームループ
import {$} from './util.js';
import {SPR_READY} from './sprites.js';
import {ac} from './audio.js';
import {render} from './render.js';
import {updatePlayer,hudTick} from './player.js';
import {updateBot} from './bots.js';
import {updateMeeting} from './meeting.js';
import {initTitle,startGame,checkWin} from './game.js';
import {G,isClient} from './state.js';
import {initRoom,enterRoom} from './net/room.js';
import {syncRemote,netTick} from './net/sync.js';

initTitle();
initRoom();

let lastRaf=performance.now();
function frame(){
  lastRaf=performance.now();
  step(lastRaf);
  render();
  requestAnimationFrame(frame);
}
let lastStep=performance.now();
function step(now){
  if(now-lastStep<8)return;
  const dt=Math.min(now-lastRaf>200?.25:.05,(now-lastStep)/1000);lastStep=now;
  if(G.state==='play'){
    G.gameTime+=dt;updatePlayer(dt);
    syncRemote(dt);
    if(!isClient()){
      for(const a of G.actors){if(G.state!=='play')break;if(a.remote){if(a.isImp&&a.alive)a.killCd-=dt;}else if(!a.isPlayer)updateBot(a,dt);}
    }
    if(G.state==='play'){hudTick();checkWin();}
  }else if(G.state==='meeting')updateMeeting(dt);
  if(G.MODE!=='solo')netTick(now);
  if(G.flash>0){G.flash=Math.max(0,G.flash-dt*1.5);$('flash').style.opacity=G.flash*.6;}
  if(G.fade>0)G.fade=Math.max(0,G.fade-dt*2.5);
}
// タブが裏に回るとrAFが止まるので、オンライン中はWorkerの合図で進行を続ける
(function bgTicker(){
  let w=null;
  try{w=new Worker(new URL('./ticker.worker.js',import.meta.url));}catch(e){w=null;}
  const tick=()=>{const t=performance.now();if(G.MODE!=='solo'&&t-lastRaf>200)step(t);};
  if(w)w.onmessage=tick;else setInterval(tick,50);
})();
$('bStart').onclick=()=>{ac();G.MODE='solo';SPR_READY.then(startGame);};
requestAnimationFrame(frame);

// ローカル開発のときだけ：test/mockroom.js の模擬 room でオンライン対戦を試す（README 参照）
if(location.hostname==='localhost'||location.hostname==='127.0.0.1'){
  window.__dev={async mockRoom(code,asHost){await import('../test/mockroom.js');G.ROOM=window.__mockRoom;await enterRoom(code,asHost);}};
}
