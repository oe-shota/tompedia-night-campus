// タスクのミニゲーム
import {$,el,pick,shuffle} from './util.js';
import {ST} from './world.js';
import {SFX} from './audio.js';
import {toast,renderTaskList} from './ui.js';
import {checkWin} from './game.js';
import {G,isClient} from './state.js';
import {emitAct} from './net/room.js';
import {sendState} from './net/host.js';

const TYPOS=[
  {w:['今年の','学祭には','多くの','来晶者が','訪れた。'],bad:3,fix:'来場者が'},
  {w:['新入生','向けに','履習登録の','コツを','まとめた。'],bad:2,fix:'履修登録の'},
  {w:['図書館の','開刊時間が','変更された。'],bad:1,fix:'開館時間が'},
  {w:['サークルの','新歓','情報を','権載した。'],bad:3,fix:'掲載した。'},
  {w:['研究室','紹介の','記事を','公開ちた。'],bad:3,fix:'公開した。'},
  {w:['仙台の','牛タン店を','徹底','比絞した。'],bad:3,fix:'比較した。'},
  {w:['期末','試験の','日程が','発標された。'],bad:3,fix:'発表された。'},
  {w:['川内','キャンバスの','紅葉が','見頃だ。'],bad:1,fix:'キャンパスの'},
  {w:['定禅寺通りで','ジャズフェスが','開最された。'],bad:2,fix:'開催された。'},
  {w:['青葉山の','新キャンパスに','取財に','行った。'],bad:2,fix:'取材に'},
];
const hint=text=>el('p',{class:'hint',text});
const GAMES={
  typo(body,done){
    body.append(hint('各文の誤字をタップして直そう'));
    const items=shuffle(TYPOS.slice()).slice(0,3);let left=3;
    for(const it of items){const row=el('div',{class:'sent'});
      it.w.forEach((w,i)=>{const b=el('span',{class:'chip',text:w});
        b.onclick=()=>{if(row.classList.contains('ok'))return;
          if(i===it.bad){SFX.ok();b.textContent=it.fix;b.classList.add('fixed');row.classList.add('ok');if(--left===0)setTimeout(done,500);}
          else{SFX.ng();b.classList.add('ng');setTimeout(()=>b.classList.remove('ng'),400);}};
        row.appendChild(b);});
      body.appendChild(row);}
  },
  wires(body,done){
    const cols=['#e23b3b','#2f6fe0','#f5d000','#d24fd6'];
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),L=el('div',{class:'wcol'}),R=el('div',{class:'wcol'});
    const box=el('div',{class:'wires'},svg,L,R);
    body.append(hint('左から右へ、同じ色のケーブルをつなごう'),box);
    let sel=null,n=0;
    const mk=(par,c,side)=>{const b=el('button',{class:'wb'});b.style.background=cols[c];b.dataset.c=c;par.appendChild(b);
      b.onclick=()=>{if(b.classList.contains('dis'))return;
        if(side==='l'){SFX.click();[...L.children].forEach(x=>x.classList.remove('sel'));sel=b;b.classList.add('sel');}
        else if(sel){if(sel.dataset.c==b.dataset.c){
          const br=box.getBoundingClientRect(),a=sel.getBoundingClientRect(),z=b.getBoundingClientRect();
          const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
          ln.setAttribute('x1',a.right-br.left);ln.setAttribute('y1',a.top+a.height/2-br.top);ln.setAttribute('x2',z.left-br.left);ln.setAttribute('y2',z.top+z.height/2-br.top);
          ln.setAttribute('stroke',cols[c]);ln.setAttribute('stroke-width','8');ln.setAttribute('stroke-linecap','round');svg.appendChild(ln);
          SFX.ok();sel.classList.add('dis');sel.classList.remove('sel');b.classList.add('dis');sel=null;if(++n===4)setTimeout(done,500);}
          else{SFX.ng();sel.classList.remove('sel');sel=null;}}};};
    shuffle([0,1,2,3]).forEach(c=>mk(L,c,'l'));shuffle([0,1,2,3]).forEach(c=>mk(R,c,'r'));
  },
  upload(body,done){
    const f=el('div',{class:'fill'}),b=el('button',{class:'btn',text:'アップロード開始'});
    body.append(hint('完了するまでパネルを開いたまま待とう'),el('div',{class:'bar'},f),b);
    let iv=null;
    b.onclick=()=>{SFX.click();b.disabled=true;b.textContent='アップロード中…';let p=0;iv=setInterval(()=>{p+=100/90;f.style.width=Math.min(100,p)+'%';if(p>=100){clearInterval(iv);b.textContent='完了！';setTimeout(done,400);}},50);};
    G.taskCleanup=()=>clearInterval(iv);
  },
  order(body,done){
    const g=el('div',{class:'ord'});
    body.append(hint('1から10まで順番にタップしよう'),g);
    let next=1;
    shuffle([1,2,3,4,5,6,7,8,9,10]).forEach(n=>{const b=el('button',{text:n});g.appendChild(b);
      b.onclick=()=>{if(n===next){SFX.ok();b.classList.add('lit');if(++next>10)setTimeout(done,400);}
        else if(n>next){SFX.ng();next=1;[...g.children].forEach(x=>x.classList.remove('lit'));g.classList.remove('bad');void g.offsetWidth;g.classList.add('bad');}};});
  },
  tags(body,done){
    const sets=[['#とんペディア','#東北大学','#学食レポ'],['#とんペディア','#仙台','#新歓'],['#東北大','#青葉山','#研究紹介'],['#とんペディア','#杜の都','#取材']];
    const want=pick(sets),decoys=shuffle(['#牛タン','#ずんだ','#七夕まつり','#芋煮会','#笹かま','#伊達政宗'].filter(t=>!want.includes(t))).slice(0,3);
    const slots=want.map(()=>el('span',{class:'slot',text:'　'}));
    const post=el('div',{class:'post'},'新しい記事を公開しました！',el('br'));
    slots.forEach((s,i)=>{if(i)post.append(' ');post.append(s);});
    post.append(el('div',{class:'answer',text:'正解：'+want.join(' ')}));
    const box=el('div',{class:'tags'});
    body.append(hint('投稿に入れるハッシュタグを上から順に選ぼう'),post,box);
    let k=0;
    shuffle(want.concat(decoys)).forEach(t=>{const b=el('button',{text:t});box.appendChild(b);
      b.onclick=()=>{if(b.classList.contains('used'))return;
        if(t===want[k]){SFX.ok();slots[k].textContent=t;b.classList.add('used');if(++k===3)setTimeout(done,500);}
        else{SFX.ng();box.classList.remove('bad');b.style.background='#c0392b';setTimeout(()=>b.style.background='',350);}};});
  },
};
export function openTask(s){
  G.taskOpen=s;G.taskCleanup=null;SFX.open();
  $('taskTitle').textContent=`${ST[s].f+1}F ${ST[s].r}：${ST[s].name}`;
  const body=$('taskBody');body.replaceChildren();
  GAMES[ST[s].type](body,()=>completeTask(s));
  $('taskPanel').classList.remove('hidden');
}
export function closeTask(){if(G.taskCleanup)G.taskCleanup();G.taskCleanup=null;G.taskOpen=null;$('taskPanel').classList.add('hidden');}
function completeTask(s){
  if(G.taskOpen!==s)return;
  closeTask();
  const p=G.player,first=!p.done.has(s);
  p.done.add(s);
  renderTaskList();toast('タスク完了！');SFX.taskDone();
  if(isClient()){if(first)emitAct({k:'task',s});return;}
  if(first)G.tasksDone++;
  sendState();checkWin();
}
$('bTaskClose').onclick=closeTask;
