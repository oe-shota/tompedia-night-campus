// とん平（公式イラスト。パーカーの色だけプレイヤーカラーに塗り替える）
import {COLORS} from './config.js';

const SPRITE_NAMES=['dead','stand','walk1','walk2'];
const SPR={};
export const SPR_READY=Promise.all(SPRITE_NAMES.map(k=>new Promise(res=>{const im=new Image();im.onload=()=>{SPR[k]=im;res();};im.src=new URL(`../assets/tonpei/${k}.png`,import.meta.url).href;})));
const HOOD_BASE_L=.64;
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;if(mx===mn)return[0,0,l];const d=mx-mn,s=l>.5?d/(2-mx-mn):d/(mx+mn);
  let h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;return[h*60,s,l];}
function hsl2rgb(h,s,l){h/=360;if(!s)return[l*255,l*255,l*255];const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  const f=t=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};return[f(h+1/3)*255,f(h)*255,f(h-1/3)*255];}
const TINT=new Map();
function sprite(name,col){
  const key=name+col;if(TINT.has(key))return TINT.get(key);
  const img=SPR[name];const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
  if(col!==COLORS[0].c){
    const n=parseInt(col.slice(1),16),[th,ts,tl]=rgb2hsl(n>>16,n>>8&255,n&255);
    const d=x.getImageData(0,0,c.width,c.height),p=d.data;
    for(let i=0;i<p.length;i+=4){if(!p[i+3])continue;const [h,s,l]=rgb2hsl(p[i],p[i+1],p[i+2]);
      if(h>235&&h<315&&s>.15&&l>.12&&l<.93){const [r,g,b]=hsl2rgb(th,ts,Math.min(.95,tl*l/HOOD_BASE_L));p[i]=r;p[i+1]=g;p[i+2]=b;}}
    x.putImageData(d,0,0);
  }
  TINT.set(key,c);return c;
}
const PIG_H=64;
export function drawPig(c,x,y,col,o={}){
  const frame=o.ghost||!o.anim?'stand':(Math.floor(o.anim/3)%2?'walk1':'walk2');
  const im=sprite(frame,col),s=o.s||1,h=PIG_H*s,w=im.width*h/im.height;
  c.save();c.globalAlpha=o.alpha??1;c.translate(x,y);
  if(!o.ghost){c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(0,20*s,15*s,4.5*s,0,0,7);c.fill();}
  c.scale(o.face||1,1);c.drawImage(im,-w/2,22*s-h,w,h);
  c.restore();
}
export function drawBody(c,x,y,col,s=1){
  const im=sprite('dead',col),w=80*s,h=im.height*w/im.width;
  c.save();c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(x,y+h/2-6*s,w*.42,5*s,0,0,7);c.fill();
  c.drawImage(im,x-w/2,y-h/2,w,h);c.restore();
}
export function beanCanvas(col,size=44,dead=false){
  const cv=document.createElement('canvas');const d=devicePixelRatio||1;cv.width=size*d;cv.height=size*d;cv.style.width=cv.style.height=size+'px';
  const c=cv.getContext('2d');c.scale(d,d);
  if(dead)drawBody(c,size/2,size/2,col,size/84);else drawPig(c,size/2,size-22*size/72,col,{s:size/72});
  return cv;
}
