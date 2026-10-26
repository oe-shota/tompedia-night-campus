import {COLORS} from './config.js';

export const $=id=>document.getElementById(id);
export const rand=(a,b)=>a+Math.random()*(b-a);
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const dist=(a,b)=>a.f!==b.f?1e9:Math.hypot(a.x-b.x,a.y-b.y);

// DOM要素を作る（innerHTMLは使わない。文字は必ず textContent で入れる）
export function el(tag,props={},...kids){
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else e[k]=v;}
  e.append(...kids);return e;
}

export function shade(hex,amt){const n=parseInt(hex.slice(1),16);const f=v=>Math.max(0,Math.min(255,Math.round(amt<0?v*(1+amt):v+(255-v)*amt)));return `rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`;}
export function rr(c,x,y,w,h,r){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}
export function srand(seed){return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// 外から来た文字列の無害化：制御文字・不可視文字（ゼロ幅・方向制御・BOM）を除いて長さを切る
export function cleanText(s,n){return String(s??'').replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁯﻿]/g,'').trim().slice(0,n);}
export const cleanName=s=>cleanText(s,8)||'ななし';
export const validColor=c=>COLORS.some(x=>x.c===c)?c:COLORS[0].c;
