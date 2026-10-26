// HUDまわりの小さな表示
import {$,el} from './util.js';
import {ST} from './world.js';
import {G} from './state.js';

let toastT=null;
export function toast(msg,ms=2200){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),ms);}
export function toggleMap(){G.mapOpen=!G.mapOpen;$('mapPanel').classList.toggle('hidden',!G.mapOpen);}
export function renderTaskList(){
  const p=G.player;
  const line=s=>`${ST[s].f+1}F ${ST[s].r}：${ST[s].name}`;
  if(p.isImp){
    $('taskCount').textContent='';
    $('tasklist').replaceChildren(el('div',{class:'imp',text:'クルーをキルしよう'}),el('div',{class:'note',text:'偽のタスク（フリをしよう）:'}),...p.tasks.map(s=>el('div',{text:line(s)})));
    return;
  }
  $('taskCount').textContent=` ${p.tasks.filter(s=>p.done.has(s)).length}/${p.tasks.length}`;
  $('tasklist').replaceChildren(...(p.alive?[]:[el('div',{class:'note',text:'ゴーストでもタスクは続けられる'})]),...p.tasks.map(s=>el('div',{class:p.done.has(s)?'done':'',text:line(s)})));
}
// タスク一覧の折りたたみ（スマホでマップが隠れすぎないように）
$('bTasks').onclick=()=>{const b=$('bTasks'),open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',open);$('tasklist').classList.toggle('hidden',!open);};
// 画面（.screen）をまとめて隠す
export function hideScreens(ids){ids.forEach(i=>$(i).classList.add('hidden'));}
