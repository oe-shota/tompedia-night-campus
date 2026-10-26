// 講義棟のマップ（4フロア）、経路探索、タスクの配置
import {W,H,NF,NN} from './config.js';

// 画面の上が西。A棟（南）・B棟・C棟（北）が左から並ぶ
export const grids=[],zoneGrid=[];
for(let f=0;f<NF;f++){grids.push(new Uint8Array(NN));zoneGrid.push(new Int16Array(NN).fill(-1));}
export const ZONES=[],BLD=[],STAIRS=[];
const BX={A:4,B:22,C:40};
function carve(f,id,x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){grids[f][j*W+i]=1;zoneGrid[f][j*W+i]=id;}}
function zone(f,name,kind,x,y,w,h){const id=ZONES.length;ZONES.push({id,name,f,kind,x,y,w,h});carve(f,id,x,y,w,h);return id;}
(function buildWorld(){
  for(let f=0;f<NF;f++){const F=f+1;
    for(const b of ['A','B','C']){
      if(b==='B'&&f>1)continue;
      const x0=BX[b];
      zone(f,`${b}棟${F}F 西階段ホール`,'stairhall',x0,11,12,3);
      const cor=zone(f,`${b}棟${F}F 廊下`,'corr',x0+5,14,2,17);
      let n=1;
      for(const side of [0,1])for(let k=0;k<4;k++){
        const ry=15+4*k,rx=side?x0+8:x0,dx=side?x0+7:x0+4;
        if(b==='B'&&side===1&&k===3)zone(f,`B棟${F}F 中央階段`,'stairroom',rx,ry,4,3);
        else zone(f,`${b}${F}${String(n++).padStart(2,'0')}`,'class',rx,ry,4,3);
        carve(f,cor,dx,ry+1,1,2);
      }
      if(b==='B')zone(f,`B棟${F}Fラウンジ`,'lounge',x0,31,12,5);
      else zone(f,`${b}棟${F}F 東階段ホール`,'stairhall',x0,31,12,3);
      if(f===1){zone(f,`${b}200`,'hall',x0+1,2,10,7);zone(f,`${b}200前`,'corr',x0+5,9,2,2);}
      BLD.push({b,f,x0,y1:f===1?1.4:10.4,y2:b==='B'?36.6:34.6});
    }
    if(f<2){
      zone(f,`A–B渡り廊下（${F}F西）`,'bridge',16,11,6,2);zone(f,`A–B渡り廊下（${F}F東）`,'bridge',16,31,6,2);
      zone(f,`B–C渡り廊下（${F}F西）`,'bridge',34,11,6,2);zone(f,`B–C渡り廊下（${F}F東）`,'bridge',34,31,6,2);
    }
  }
  for(const b of ['A','B','C']){
    const x0=BX[b],fl=b==='B'?[0,1]:[0,1,2,3];
    const wells=[{up:[x0+1,12],dn:[x0+10,12]}];
    wells.push(b==='B'?{up:[x0+9,28],dn:[x0+11,28]}:{up:[x0+1,32],dn:[x0+10,32]});
    for(const w of wells)for(const f of fl){
      if(fl.includes(f+1))STAIRS.push({f,x:w.up[0],y:w.up[1],dir:'up',to:{f:f+1,x:w.dn[0],y:w.dn[1]}});
      if(fl.includes(f-1))STAIRS.push({f,x:w.dn[0],y:w.dn[1],dir:'down',to:{f:f-1,x:w.up[0],y:w.up[1]}});
    }
  }
})();
const TP=new Map(STAIRS.map(s=>[s.f*NN+s.y*W+s.x,s.to.f*NN+s.to.y*W+s.to.x]));
const zoneByName=n=>ZONES.find(z=>z.name===n);
export const walk=(f,x,y)=>x>=0&&y>=0&&x<W&&y<H&&grids[f][y*W+x]===1;
export function zoneAt(f,x,y){const i=zoneGrid[f][Math.floor(y)*W+Math.floor(x)];return i>=0?ZONES[i]:null;}
export function placeName(f,x,y){const z=zoneAt(f,x,y);return z?z.name:`${f+1}F`;}
export function free(f,x,y,r){return walk(f,Math.floor(x-r),Math.floor(y-r))&&walk(f,Math.floor(x+r),Math.floor(y-r))&&walk(f,Math.floor(x-r),Math.floor(y+r))&&walk(f,Math.floor(x+r),Math.floor(y+r));}
export function los(f,ax,ay,bx,by){const d=Math.hypot(bx-ax,by-ay),n=Math.ceil(d*3);for(let i=1;i<n;i++){const t=i/n;if(!walk(f,Math.floor(ax+(bx-ax)*t),Math.floor(ay+(by-ay)*t)))return false;}return true;}
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
export function findPath(sf,sx,sy,tf,tx,ty){
  if(!walk(tf,tx,ty)||!walk(sf,sx,sy))return [];
  const prev=new Int32Array(NN*NF).fill(-1),q=new Int32Array(NN*NF);let h=0,t=0;
  const s=sf*NN+sy*W+sx,g=tf*NN+ty*W+tx;prev[s]=s;q[t++]=s;
  while(h<t){const c=q[h++];if(c===g)break;const f=(c/NN)|0,r=c%NN,cx=r%W,cy=(r/W)|0;
    for(const [dx,dy] of DIRS){const nx=cx+dx,ny=cy+dy;if(!walk(f,nx,ny))continue;const ni=f*NN+ny*W+nx;if(prev[ni]!==-1)continue;prev[ni]=c;q[t++]=ni;}
    const tp=TP.get(c);if(tp!=null&&prev[tp]===-1){prev[tp]=c;q[t++]=tp;}}
  if(prev[g]===-1)return [];
  const path=[];for(let c=g;c!==s;c=prev[c]){const r=c%NN;path.push([(c/NN)|0,r%W,(r/W)|0]);}return path.reverse();
}

// タスク（教室名, 種類, タスク名, 端末の位置）
export const ST=[
  ['A102','typo','講義レポ記事を校正'],
  ['A106','order','出席カードを並べる'],
  ['B103','upload','新歓写真をアップ'],
  ['B105','wires','プロジェクター配線'],
  ['C101','tags','学食レポを投稿'],
  ['C107','upload','講義スライドをアップ'],
  ['B棟1Fラウンジ','upload','原稿を入稿する',2,1],
  ['A200','typo','シラバス解説記事を校正',2,1],
  ['B200','wires','マイク配線をつなぐ',8,1],
  ['C200','upload','記事データをデプロイ',5,5],
  ['A205','order','取材メモを並べる'],
  ['B202','typo','インタビュー原稿の校正'],
  ['B棟2Fラウンジ','tags','イベント告知を投稿',9,1],
  ['C204','wires','照明ケーブルをつなぐ'],
  ['A301','upload','写真を現像する'],
  ['A307','tags','#とんペディア を投稿'],
  ['C303','typo','試験対策記事を校正'],
  ['C306','order','投稿スケジュール整理'],
  ['A404','wires','スピーカー配線'],
  ['A408','typo','サークル紹介記事を校正'],
  ['C402','tags','企画案をシェア'],
  ['C408','upload','動画をアップロード'],
].map(([r,type,name,dx=2,dy=1])=>{const z=zoneByName(r);return {r,type,name,f:z.f,x:z.x+dx,y:z.y+dy};});
export const BTN={f:0,x:28,y:33.6};
export const WANDER=ZONES.filter(z=>['class','hall','lounge'].includes(z.kind));
