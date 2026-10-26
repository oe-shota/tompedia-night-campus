// ゲーム全体の定数
export const T=48,W=56,H=40,NF=4,NN=W*H;
export const VIS_CREW=6.5,VIS_IMP=8.5,KILL_RANGE=1.5,KILL_CD=22,USE_RANGE=1.5,REPORT_RANGE=2.4,STAIR_RANGE=1.2;
export const SPEED=4.6,BOT_SPEED=4.1,TASKS_PER=5;
export const MAX_PLAYERS=10;
// 会議の時間（秒）。議論はボットの発言が尽きるか DISCUSS_TIME に達したら終わり、投票に移る
export const DISCUSS_TIME=45,VOTE_TIME=20;
// クルーのボットの強さ（タイトル・ロビーの「ボットの強さ」）。weak は以前のままの動き
// sense: 周りの人を覚える距離 / report: 死体に気づく距離 / witness: キルを目撃できる距離 / near: 死体の部屋で見かけた人への疑い(秒は nearWin 前まで)
// last: 被害者と最後に一緒にいた人への疑い / alarm: 目撃したら緊急ボタンへ向かう / buddy: 次の行き先に他の人を選ぶ確率
// trust: 自分が疑っている人の発言を割り引く / listen: 他人の発言を信じる度合い
// voteTh: 投票する疑いの下限（未満ならスキップ） / noise: 投票のぶれ / clutch: あと1キルで負けるならスキップしない / keep: 会議後に疑いを残す割合
export const DIFF={
  weak:  {sense:7,  report:5,  witness:7.5,near:2.5,nearWin:20,last:0,alarm:false,buddy:0,  trust:false,listen:1,   voteTh:3,  noise:1.2,clutch:false,keep:.6},
  normal:{sense:7.5,report:6.5,witness:8,  near:3,  nearWin:25,last:3,alarm:true, buddy:.25,trust:true, listen:1.15,voteTh:2.3,noise:.8, clutch:true, keep:.75},
  strong:{sense:8.5,report:8,  witness:8.5,near:3.5,nearWin:30,last:6,alarm:true, buddy:.45,trust:true, listen:1.5, voteTh:1.8,noise:.4, clutch:true, keep:.95},
};
export const FONT='"Zen Kaku Gothic New",sans-serif';

// パーカーの色（プレイヤーの見分け用）
export const COLORS=[
  {n:'とん平',c:'#9b78c0'},{n:'ずんだ',c:'#3fae49'},{n:'牛タン',c:'#8a3b2a'},{n:'伊達',c:'#3c3c5c'},
  {n:'笹かま',c:'#eeeadc'},{n:'はらこ',c:'#ff8a1f'},{n:'芋煮',c:'#d9b13b'},{n:'七夕',c:'#ff6fae'},
  {n:'こけし',c:'#e03636'},{n:'松島',c:'#34c9c9'},{n:'青葉',c:'#2f6fe0'}
];
