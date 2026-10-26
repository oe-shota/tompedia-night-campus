// 描画：フロアの背景、プレイヤー視点の画面、全体マップ
import {T,W,H,NF,NN,VIS_CREW,VIS_IMP,FONT} from './config.js';
import {$,shade,rr,srand} from './util.js';
import {ZONES,BLD,STAIRS,ST,BTN,zoneGrid,walk,zoneAt,los} from './world.js';
import {drawPig,drawBody} from './sprites.js';
import {G} from './state.js';

const KIND_C={class:'#2b2744',hall:'#30284a',lounge:'#3a2a58',corr:'#1f1a33',bridge:'#1a1529',stairhall:'#241d3a',stairroom:'#241d3a'};

// いまいるフロアの背景を1枚のcanvasに描いておく
let mapCv=null,mapF=-1;
export function buildFloor(f){
  const cv=mapCv||(mapCv=document.createElement('canvas'));cv.width=W*T;cv.height=H*T;const m=cv.getContext('2d');const R=srand(11+f*7);
  m.fillStyle='#07050f';m.fillRect(0,0,W*T,H*T);
  for(let i=0;i<260;i++){const s=R()<.1?3:1.5;m.fillStyle=`rgba(255,255,255,${R()*.5+.15})`;m.fillRect(R()*W*T,R()*H*T,s,s);}
  // 棟の外枠
  for(const b of BLD)if(b.f===f){m.fillStyle='#120c22';rr(m,(b.x0-.6)*T,b.y1*T,13.2*T,(b.y2-b.y1)*T,18);m.fill();m.strokeStyle='#3a2a5a';m.lineWidth=6;m.stroke();
    m.fillStyle='rgba(168,216,78,.75)';m.font=`900 ${T*.9}px ${FONT}`;m.textAlign='center';m.fillText(`${b.b}棟 ${f+1}F`,(b.x0+6)*T,(b.y2+1.1)*T);}
  // 床
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(!walk(f,x,y)){if(walk(f,x,y+1)){m.fillStyle='#231a3a';m.fillRect(x*T,y*T+T*.35,T,T*.65);m.fillStyle='#3e2d5e';m.fillRect(x*T,y*T+T*.35,T,4);}continue;}
    const base=KIND_C[zoneAt(f,x,y).kind];m.fillStyle=((x+y)&1)?base:shade(base,.04);m.fillRect(x*T,y*T,T,T);
  }
  // 窓（月明かり）と黒板
  for(const z of ZONES){if(z.f!==f)continue;
    if(z.kind==='hall'){
      m.fillStyle='#16301f';m.fillRect((z.x+z.w/2-3)*T,(z.y-.58)*T,6*T,.5*T);m.strokeStyle='#5b4a3a';m.lineWidth=3;m.strokeRect((z.x+z.w/2-3)*T,(z.y-.58)*T,6*T,.5*T);
    }else if(z.kind==='lounge'||z.kind==='stairhall'){
      if(walk(f,z.x,z.y-1))continue;
      for(let wx=z.x+.5;wx<z.x+z.w-1.5;wx+=3){
        m.fillStyle='#1b2b5e';m.fillRect(wx*T,(z.y-.6)*T,T*1.6,T*.5);m.fillStyle='rgba(160,185,255,.45)';m.fillRect(wx*T+4,(z.y-.6)*T+4,T*1.6-8,T*.5-8);
        m.fillStyle='rgba(150,175,255,.07)';m.beginPath();m.moveTo(wx*T,z.y*T);m.lineTo((wx+1.6)*T,z.y*T);m.lineTo((wx+2.4)*T,(z.y+z.h)*T);m.lineTo((wx+.8)*T,(z.y+z.h)*T);m.fill();
      }
    }
  }
  // 壁の線
  m.strokeStyle='#05030a';m.lineWidth=4;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!walk(f,x,y))continue;
    m.beginPath();
    if(!walk(f,x-1,y)){m.moveTo(x*T,y*T);m.lineTo(x*T,(y+1)*T);}
    if(!walk(f,x+1,y)){m.moveTo((x+1)*T,y*T);m.lineTo((x+1)*T,(y+1)*T);}
    if(!walk(f,x,y-1)){m.moveTo(x*T,y*T);m.lineTo((x+1)*T,y*T);}
    if(!walk(f,x,y+1)){m.moveTo(x*T,(y+1)*T);m.lineTo((x+1)*T,(y+1)*T);}
    m.stroke();}
  // 家具
  for(const z of ZONES){if(z.f!==f)continue;
    if(z.kind==='class'){m.fillStyle='#3a2e48';m.strokeStyle='#05030a';m.lineWidth=2;
      for(const yy of [.25,1.75])for(let i=0;i<3;i++){const x=(z.x+.3+i*1.2)*T,y=(z.y+yy)*T;m.fillRect(x,y,T*.9,T*.4);m.strokeRect(x,y,T*.9,T*.4);}}
    else if(z.kind==='hall'){m.fillStyle='#3a2e48';m.strokeStyle='#05030a';m.lineWidth=2;
      for(let k=0;k<4;k++){const y=(z.y+1.3+k*1.4)*T;m.fillRect((z.x+.6)*T,y,(z.w/2-1.2)*T,T*.45);m.strokeRect((z.x+.6)*T,y,(z.w/2-1.2)*T,T*.45);
        m.fillRect((z.x+z.w/2+.6)*T,y,(z.w/2-1.2)*T,T*.45);m.strokeRect((z.x+z.w/2+.6)*T,y,(z.w/2-1.2)*T,T*.45);}}
    else if(z.kind==='lounge'){
      m.fillStyle='#3d3352';for(const tx of [z.x+2.5,z.x+9.5]){m.beginPath();m.arc(tx*T,(z.y+3.4)*T,T*.75,0,7);m.fill();}
      m.save();m.shadowColor='rgba(168,216,78,.9)';m.shadowBlur=24;m.fillStyle='#d9f2a6';m.fillRect((z.x+z.w-1.3)*T,(z.y+.3)*T,T*1,T*1.5);m.restore();
      m.fillStyle='#2b3a12';for(let k=0;k<3;k++)m.fillRect((z.x+z.w-1.2)*T,(z.y+.5+k*.45)*T,T*.8,4);
    }
  }
  // 緊急ボタン
  if(f===BTN.f){m.fillStyle='rgba(133,45,171,.35)';m.beginPath();m.ellipse(BTN.x*T,BTN.y*T,T*2.4,T*1.7,0,0,7);m.fill();
    m.fillStyle='#2a1f40';m.beginPath();m.arc(BTN.x*T,BTN.y*T,T*.85,0,7);m.fill();m.strokeStyle='#05030a';m.lineWidth=4;m.stroke();
    m.fillStyle='#d32f2f';m.beginPath();m.arc(BTN.x*T,BTN.y*T,T*.32,0,7);m.fill();m.stroke();}
  // 階段
  for(const s of STAIRS){if(s.f!==f)continue;const x=s.x*T,y=s.y*T;
    m.fillStyle='#4a3670';m.fillRect(x+2,y+2,T-4,T-4);m.strokeStyle='#8a6cc0';m.lineWidth=2;
    for(let k=1;k<5;k++){m.beginPath();m.moveTo(x+5,y+k*T/5);m.lineTo(x+T-5,y+k*T/5);m.stroke();}
    m.fillStyle='#c6f05a';m.font=`900 15px ${FONT}`;m.textAlign='center';m.fillText((s.dir==='up'?'▲':'▼')+(s.to.f+1)+'F',x+T/2,y-5);}
  // タスク端末
  m.strokeStyle='#05030a';m.lineWidth=3;
  for(const s of ST){if(s.f!==f)continue;const cx=(s.x+.5)*T,cy=(s.y+.5)*T;m.fillStyle='#1d1630';rr(m,cx-16,cy-14,32,28,6);m.fill();m.stroke();
    m.save();m.shadowColor='rgba(168,216,78,.8)';m.shadowBlur=12;m.fillStyle='#a8d84e';m.fillRect(cx-11,cy-9,22,12);m.restore();}
  // 部屋名
  m.textAlign='center';
  for(const z of ZONES){if(z.f!==f)continue;
    if(z.kind==='class'){m.font=`900 16px ${FONT}`;m.fillStyle='rgba(255,255,255,.4)';m.fillText(z.name,(z.x+z.w/2)*T,(z.y+z.h-.15)*T);}
    else if(z.kind==='hall'){m.font=`900 46px ${FONT}`;m.fillStyle='rgba(255,255,255,.22)';m.fillText(z.name,(z.x+z.w/2)*T,(z.y+z.h/2+.4)*T);}
    else if(z.kind==='lounge'){m.font=`700 22px ${FONT}`;m.fillStyle='rgba(255,255,255,.3)';m.fillText('ラウンジ',(z.x+z.w/2)*T,(z.y+z.h-.3)*T);}
  }
  mapF=f;
}

const cv=$('c'),ctx=cv.getContext('2d');
let dpr=1,zoom=1;
function resize(){dpr=devicePixelRatio||1;cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;zoom=Math.max(.55,Math.min(1.1,Math.min(innerWidth,innerHeight)/760));}
addEventListener('resize',resize);resize();

export function canSee(o){const p=G.player;if(o.f!==p.f)return false;if(!p.alive)return true;return Math.hypot(o.x-p.x,o.y-p.y)<=(p.isImp?VIS_IMP:VIS_CREW)&&los(p.f,p.x,p.y,o.x,o.y);}
function drawArrow(sx,sy,w,h){
  const dx=sx-w/2,dy=sy-h/2;
  if(Math.abs(dx)<w/2-30&&Math.abs(dy)<h/2-30)return;
  const k=Math.min((w/2-60)/Math.abs(dx||1e-6),(h/2-60)/Math.abs(dy||1e-6));
  ctx.save();ctx.translate(w/2+dx*k,h/2+dy*k);ctx.rotate(Math.atan2(dy,dx));ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-10);ctx.lineTo(-8,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
export function render(){
  const w=innerWidth,h=innerHeight,player=G.player;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#07050f';ctx.fillRect(0,0,w,h);
  if(!player||G.state==='title'||G.state==='lobby')return;
  if(mapF!==player.f)buildFloor(player.f);
  const z=zoom,vw=w/z,vh=h/z,camX=player.x*T-vw/2,camY=player.y*T-vh/2;
  ctx.save();ctx.scale(z,z);ctx.translate(-camX,-camY);
  const sx=Math.max(0,camX),sy=Math.max(0,camY),ex=Math.min(W*T,camX+vw),ey=Math.min(H*T,camY+vh);
  if(ex>sx&&ey>sy)ctx.drawImage(mapCv,sx,sy,ex-sx,ey-sy,sx,sy,ex-sx,ey-sy);
  const now=performance.now()/1000;
  if(!player.isImp)for(const s of player.tasks)if(!player.done.has(s)&&ST[s].f===player.f){const st=ST[s];ctx.strokeStyle=`rgba(198,240,90,${.55+.45*Math.sin(now*5)})`;ctx.lineWidth=4;ctx.strokeRect((st.x+.5)*T-21,(st.y+.5)*T-18,42,36);}
  for(const b of G.bodies)if(canSee(b))drawBody(ctx,b.x*T,b.y*T,b.color);
  const list=G.actors.filter(a=>a.f===player.f&&(a.alive?(a===player||canSee(a)):!player.alive)).sort((a,b)=>a.y-b.y);
  ctx.textAlign='center';ctx.font=`700 14px ${FONT}`;ctx.lineJoin='round';
  for(const a of list){
    const bob=a.alive?0:Math.sin(now*3+a.id)*3;
    drawPig(ctx,a.x*T,a.y*T-4+bob,a.color,{face:a.facing,anim:a.moving?a.anim:0,alpha:a.alive?1:.45,ghost:!a.alive});
    ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(a.name,a.x*T,a.y*T-50+bob);
    ctx.fillStyle=(player.isImp&&a.isImp)?'#ff5a5a':'#fff';ctx.fillText(a.name,a.x*T,a.y*T-50+bob);
  }
  ctx.restore();
  if(player.alive){const px=w/2,py=h/2,r=(player.isImp?VIS_IMP:VIS_CREW)*T*z;const g=ctx.createRadialGradient(px,py,r*.55,px,py,r);
    g.addColorStop(0,'rgba(6,3,18,0)');g.addColorStop(1,'rgba(6,3,18,.94)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  // タスクへの矢印（別の階なら、その階へ向かう階段を指す）
  if(!player.isImp){ctx.fillStyle='#c6f05a';ctx.strokeStyle='#000';ctx.lineWidth=2;
    const rem=player.tasks.filter(s=>!player.done.has(s));
    const here=rem.filter(s=>ST[s].f===player.f);
    let pts=here.map(s=>[ST[s].x+.5,ST[s].y+.5]);
    if(!pts.length&&rem.length){const dir=ST[rem[0]].f>player.f?'up':'down';pts=STAIRS.filter(s=>s.f===player.f&&s.dir===dir).map(s=>[s.x+.5,s.y+.5]);ctx.fillStyle='#c88be6';}
    for(const [x,y] of pts)drawArrow((x*T-camX)*z,(y*T-camY)*z,w,h);}
  if(G.fade>0){ctx.fillStyle=`rgba(0,0,0,${G.fade})`;ctx.fillRect(0,0,w,h);}
  if(G.mapOpen)drawMiniMap();
}
// 全4フロアを2×2で表示
function drawMiniMap(){
  const player=G.player;
  const c=$('mapC'),mw=Math.min(innerWidth-40,1000),cw=mw/2,s=cw/W,ch=H*s,mh=ch*2,d=dpr;
  if(c.width!==Math.round(mw*d)){c.width=Math.round(mw*d);c.height=Math.round(mh*d);c.style.width=mw+'px';c.style.height=mh+'px';}
  const m=c.getContext('2d');m.setTransform(d,0,0,d,0,0);m.fillStyle='#07050f';m.fillRect(0,0,mw,mh);
  for(let f=0;f<NF;f++){const ox=(f%2)*cw,oy=(f>>1)*ch;
    m.save();m.translate(ox,oy);
    for(let i=0;i<NN;i++){const zi=zoneGrid[f][i];if(zi<0)continue;m.fillStyle=shade(KIND_C[ZONES[zi].kind],.22);m.fillRect((i%W)*s,((i/W)|0)*s,s+.6,s+.6);}
    m.fillStyle='#8a6cc0';for(const st of STAIRS)if(st.f===f)m.fillRect(st.x*s,st.y*s,s,s);
    m.textAlign='center';m.font=`900 ${Math.max(10,s*1.8)}px ${FONT}`;m.fillStyle='rgba(168,216,78,.9)';
    for(const b of BLD)if(b.f===f)m.fillText(b.b,(b.x0+6)*s,(b.y2+1.4)*s);
    m.font=`700 ${Math.max(8,s*.9)}px ${FONT}`;m.fillStyle='rgba(255,255,255,.75)';
    for(const zz of ZONES)if(zz.f===f&&zz.kind==='hall')m.fillText(zz.name,(zz.x+zz.w/2)*s,(zz.y+zz.h/2+.3)*s);
    m.textAlign='left';m.font=`900 ${Math.max(14,s*2.4)}px ${FONT}`;m.fillStyle='#fff';m.fillText(`${f+1}F`,s*1,s*3);
    if(f===BTN.f){m.fillStyle='#d32f2f';m.beginPath();m.arc(BTN.x*s,BTN.y*s,Math.max(3,s*.5),0,7);m.fill();}
    if(!player.isImp)for(const i of player.tasks)if(!player.done.has(i)&&ST[i].f===f){m.fillStyle='#c6f05a';m.beginPath();m.arc((ST[i].x+.5)*s,(ST[i].y+.5)*s,Math.max(3.5,s*.55),0,7);m.fill();m.strokeStyle='#000';m.lineWidth=1.5;m.stroke();}
    if(player.f===f){m.strokeStyle='#852dab';m.lineWidth=3;m.strokeRect(1.5,1.5,cw-3,ch-3);
      m.fillStyle=player.color;m.beginPath();m.arc(player.x*s,player.y*s,Math.max(5,s*.8),0,7);m.fill();m.strokeStyle='#fff';m.lineWidth=2;m.stroke();}
    else{m.strokeStyle='#33264d';m.lineWidth=1;m.strokeRect(.5,.5,cw-1,ch-1);}
    m.restore();
  }
}
