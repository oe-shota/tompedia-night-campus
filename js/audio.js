// 効果音（Web Audioで合成）
import {$} from './util.js';

let AC=null,MASTER=null,muted=false;
try{muted=localStorage.getItem('tp-mute')==='1';}catch(e){}
export function ac(){
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();MASTER=AC.createGain();MASTER.gain.value=.55;MASTER.connect(AC.destination);}catch(e){return null;}}
  if(AC.state==='suspended')AC.resume();
  return AC;
}
function tone(freq,dur,o={}){
  const a=ac();if(!a||muted)return;
  const t=a.currentTime+(o.at||0),osc=a.createOscillator(),g=a.createGain();
  osc.type=o.type||'sine';osc.frequency.setValueAtTime(freq,t);
  if(o.slide)osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq+o.slide),t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.vol??.15,t+(o.attack||.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.connect(g).connect(MASTER);osc.start(t);osc.stop(t+dur+.05);
}
let NOISE=null;
function noise(dur,o={}){
  const a=ac();if(!a||muted)return;
  if(!NOISE){NOISE=a.createBuffer(1,a.sampleRate*2,a.sampleRate);const d=NOISE.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const t=a.currentTime+(o.at||0),src=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();
  src.buffer=NOISE;f.type=o.filter||'bandpass';f.Q.value=o.q??1;f.frequency.setValueAtTime(o.freq||1000,t);
  if(o.toFreq)f.frequency.exponentialRampToValueAtTime(o.toFreq,t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.vol??.2,t+(o.attack||.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  src.connect(f).connect(g).connect(MASTER);src.start(t);src.stop(t+dur+.05);
}
export const SFX={
  click(){tone(660,.06,{type:'square',vol:.05});},
  ok(){tone(880,.09,{type:'triangle',vol:.12});tone(1320,.08,{type:'triangle',vol:.06,at:.04});},
  ng(){tone(170,.16,{type:'square',vol:.07});},
  step(){noise(.06,{vol:.05,freq:260+Math.random()*120,q:3});},
  taskDone(){[784,988,1319].forEach((f,i)=>tone(f,.3,{type:'triangle',vol:.14,at:i*.09}));},
  open(){tone(520,.07,{vol:.1});tone(780,.09,{vol:.08,at:.05});},
  kill(){noise(.22,{vol:.45,freq:900,q:.8});tone(260,.45,{type:'sawtooth',vol:.18,slide:-200});tone(90,.5,{vol:.3,at:.02});},
  report(){for(let i=0;i<4;i++)tone(i%2?620:880,.22,{type:'square',vol:.09,at:i*.22});noise(.5,{vol:.15,freq:2000,q:.5,at:.05});},
  emergency(){for(let i=0;i<3;i++)tone(700,.34,{type:'sawtooth',vol:.08,at:i*.36,slide:300});},
  chat(){tone(1050+Math.random()*150,.05,{vol:.05});},
  vote(){tone(520,.07,{type:'square',vol:.06});tone(780,.1,{type:'square',vol:.05,at:.06});},
  tally(){[0,.12,.24].forEach(at=>noise(.12,{vol:.18,freq:180,q:1.5,at}));tone(110,.6,{vol:.2,at:.36});},
  eject(){noise(2.2,{vol:.22,freq:1800,toFreq:150,q:.7,attack:.3});tone(300,2,{vol:.06,slide:-220,attack:.2});},
  stairs(up){[0,1,2,3].forEach(i=>noise(.07,{vol:.09,freq:(up?300+i*90:570-i*90),q:4,at:i*.08}));},
  reveal(){tone(65,1.4,{vol:.35,attack:.02});noise(1.2,{vol:.12,freq:500,toFreq:4000,q:.6,attack:.4});[523,659,784].forEach((f,i)=>tone(f,.9,{type:'triangle',vol:.05,at:.3+i*.08}));},
  win(){[523,659,784,1047].forEach((f,i)=>tone(f,.45,{type:'triangle',vol:.14,at:i*.13}));tone(1047,.9,{vol:.08,at:.55});},
  lose(){[392,349,311,262].forEach((f,i)=>tone(f,.5,{type:'triangle',vol:.13,at:i*.18}));tone(65,1.2,{vol:.2,at:.6});},
  dead(){tone(440,1.2,{type:'sawtooth',vol:.08,slide:-380});noise(.8,{vol:.15,freq:300,q:1});},
};
function setMuted(m){muted=m;try{localStorage.setItem('tp-mute',m?'1':'0');}catch(e){}$('soundBtn').textContent=m?'🔇':'🔊';$('soundBtn').title=m?'効果音オフ':'効果音オン';}
$('soundBtn').onclick=()=>{setMuted(!muted);if(!muted){ac();SFX.click();}};
setMuted(muted);
