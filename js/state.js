// モジュールをまたいで書き換える状態はすべてここに置く
import {DIFF} from './config.js';

export const G={
  // 進行：'title' | 'lobby' | 'intro' | 'play' | 'meeting' | 'eject' | 'end'
  state:'title',
  actors:[],player:null,bodies:[],
  tasksDone:0,tasksTotal:0,gameTime:0,roundStart:0,
  taskOpen:null,taskCleanup:null,mapOpen:false,
  flash:0,fade:0,
  M:null,          // 会議の状態
  selColor:0,      // タイトルで選んだ色
  D:DIFF.normal,   // クルーのボットの強さ（ゲーム開始時に決める）
  // オンライン
  MODE:'solo',     // 'solo' | 'host' | 'client'
  ROOM:null,RM:null,hostPeer:null,myPeer:null,gameId:0,
  lastSt:0,lobbyBusy:false,lastEnd:null,
  netStat:{st:0,ev:0,err:''},
};

export const byId=id=>G.actors.find(a=>a.id===+id);
export const nameOf=id=>byId(id).name;
export const isHost=()=>G.MODE==='host',isClient=()=>G.MODE==='client';
