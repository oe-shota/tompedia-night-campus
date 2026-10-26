# とんペディア 夜の講義棟

夜の東北大学 講義棟（A・B・C棟）を舞台に、とん平たちが「インポスター」を探す推理ゲームです。
ビルド不要の静的ファイル（`index.html` ＋ `css/` ＋ `js/`（ES モジュール）＋ `assets/`）で動きます。

- **1人プレイ**：ボット相手にどこでも遊べます。
- **オンライン対戦**：Web 版（Cloudflare Workers で配信したページ）か、claude.ai の artifact として開いたときに使えます（後述）。

## 遊び方

| 役職 | 目的 |
| --- | --- |
| クルー（編集部員） | 各教室のタスク（記事の校正、配線、写真のアップロードなど）を全部終わらせるか、会議でインポスターを全員追放する |
| インポスター | 見つからないようにクルーをキルし、クルーと同じ人数にする |

- 操作：WASD / 矢印キーで移動（スマホは画面をドラッグ）、E・Space で使う、R で報告、Q でキル、M でマップ
- 階段：▲▼のマスで「使う」と上下の階へ。A・C棟は4F、B棟は2Fまで。2Fの西側に大講義室（A200・B200・C200）
- 会議：死体の報告、またはB棟1Fラウンジの緊急ボタン（1人1回）で開催。定型ボタンか自由入力で発言し、投票する（議論は最長45秒、投票は20秒。`js/config.js` の `DISCUSS_TIME` / `VOTE_TIME` で変更できる）
- インポスターは6人以下なら1人、7人以上なら1〜2人
- ボットの強さ（タイトル・ロビーで選ぶ）：クルーのボットの推理力が変わる。「ふつう」「つよい」では、死体やキルに気づく距離が伸び、被害者と最後に一緒にいた人を疑い、キルを目撃したら緊急ボタンを押しに行き、自分がアリバイを知っている人への告発は信じない。数値は `js/config.js` の `DIFF`。目安として、ボットのインポスター1人（8人）を相手にしたクルーの勝率は、よわい 4%・ふつう 46%・つよい 54%

## オンライン対戦

1. ホストが「部屋を作る」を押すと、4桁の部屋コードが出る
2. ほかの人はそのコードを入力して「参加」
3. ホストが人数とインポスター数を決めて「ゲーム開始」。足りない分はボットが入る

ホストのブラウザが判定とボットを担当します。ホストが抜けると部屋は閉じ、参加者は部屋から抜けてタイトルに戻ります。
役職は暗号化していません（開発者ツールを開けば見えます）。

通信は「room」（同じ部屋の端末どうしでメッセージを配る仕組み）を通して行い、ゲーム側はどちらの room かを区別しません（`js/net/room.js` の `initRoom` で選ぶ）。

| 開き方 | room | 条件 |
| --- | --- | --- |
| Web 版 | 自前の中継サーバー（`worker/index.js`、`js/net/wsroom.js`） | URL を開くだけ。1部屋16台まで |
| claude.ai の artifact | artifact の `room` 機能 | 全員が claude.ai にログインし、artifact を **コントリビューター以上** で共有されていること |
| それ以外（GitHub Pages など） | なし | 1人プレイのみ |

### Web 版（Cloudflare Workers）

1つの Worker が、ゲームのファイルの配信と中継サーバーを兼ねます。`/ws/<部屋コード>` への WebSocket だけを Worker が受け、部屋コードごとの Durable Object（`Room`）が、届いたメッセージを同じ部屋の他の端末に配ります。配信するのは `npm run build` が `dist/` にコピーするファイルだけです（`scripts/build.mjs`）。

中継サーバーの制限：話題は `st` / `ev` / `act` / `pos` だけ、1メッセージ 4096 バイトまで、1台あたり毎秒60件まで（超えたら切断）、別のサイトからの接続は拒否。
presence（各端末の名前・位置）は 0.5 秒に1回まで間引いて送ります（位置は `pos` で0.15秒ごとに届くため）。

デプロイ（初回は Cloudflare アカウントが必要）：

```bash
npm install
npx wrangler login   # ブラウザで Cloudflare にログイン
npm run deploy       # https://tompedia-night-campus.<アカウント>.workers.dev に公開
```

- 無料プランで動きます。目安として、10人の部屋で1時間遊ぶと Durable Objects のリクエストを約1.6万回使います（無料枠は1日10万回）。
- 部屋コードは4桁なので、総当たりで他人の部屋に入られる可能性があります。
- デプロイすると中継サーバーが入れ替わり、遊んでいる部屋は切断されます。

### claude.ai の artifact

- artifact を更新すると、開いている全員のページが再読み込みされ、部屋は解散します

### 通信の仕組み

| 話題 | 送る人 | 中身 |
| --- | --- | --- |
| `st` | ホスト | 全体の状態（0.5秒ごと。名簿・生死・死体・タスク進捗・会議の状態） |
| `ev` | ホスト | 出来事（キル、会議開始、発言、開票、追放、再開、終了） |
| `act` | 参加者 | 操作（キル、報告、緊急ボタン、タスク完了、投票、発言、ロビーでの参加の合図） |
| `pos` | 全員 | 自分の位置（0.15秒ごと。ホストはボットの位置も） |

artifact として公開するときは、次のファイルだけを含めます（`test/`・`docs/`・`worker/`・`assets/tonpei/original/` は含めない）：

```
index.html, css/style.css, js/**/*.js, assets/tonpei/{stand,walk1,walk2,dead}.png
```

artifact の capabilities：

```json
{ "room": { "topics": { "st": "interact", "ev": "interact", "act": "interact", "pos": "interact" } } }
```

## ローカルでの確認

Web 版と同じ構成（中継サーバーつき）で試すには：

```bash
npm install
npm run dev          # http://localhost:8787/
```

同じブラウザの2つのタブで開けば、片方で部屋を作り、もう片方で参加してオンライン対戦を試せます。

中継サーバーなしで、静的ファイルだけを配って試す場合：

```bash
python -m http.server 5178
```

ES モジュールを使っているので、`index.html` をファイルとして直接開く（`file://`）と動きません。必ずローカルサーバー経由で開いてください。

`http://localhost:5178/` を開くと1人プレイを試せます（ローカルではオンライン対戦のボタンは無効です）。

オンライン対戦は、`test/mockroom.js` で `room` を BroadcastChannel で模擬して、同じブラウザの2タブで試せます。
それぞれのタブの開発者コンソールで次を実行します（コードは同じ4桁に、ホスト側は `true`、参加者側は `false`）。
`window.__dev` は localhost / 127.0.0.1 で開いたときだけ用意されます。

```js
await __dev.mockRoom('1234', true);
```

## ファイル構成

```
index.html               画面のマークアップ（CSP を設定。script / style はすべて外部ファイル）
css/style.css            見た目
js/main.js               エントリ（初期化・ゲームループ）
js/config.js             定数・プレイヤーの色
js/util.js               小さな共通関数（DOM 生成・入力の無害化など）
js/state.js              モジュールをまたいで書き換える状態（G）
js/world.js              講義棟のマップ・経路探索・タスクの配置
js/sprites.js            とん平の画像の読み込みと色の塗り替え
js/audio.js              効果音
js/render.js             描画（フロア・視界・全体マップ）
js/ui.js                 HUD の小さな表示（トースト・タスク一覧・マップ開閉）
js/game.js               ゲームの開始・ラウンド・勝敗
js/player.js             自分の操作と HUD のボタン
js/bots.js               ボットの AI とキル
js/tasks.js              タスクのミニゲーム
js/meeting.js            会議・投票・追放
js/net/room.js           オンライン対戦：部屋への出入り・ロビー・送信
js/net/host.js           オンライン対戦：ホストの判定と状態配信
js/net/client.js         オンライン対戦：参加者の受信処理
js/net/sync.js           オンライン対戦：位置の同期・定期処理
js/net/wsroom.js         オンライン対戦（Web 版）：中継サーバーとつなぐ room
js/ticker.worker.js      タブが裏に回っても進行を続けるための Worker
assets/tonpei/           ゲームで使っているとん平の画像（白フチを外して縮小したもの）
assets/tonpei/original/  元のイラスト
docs/floorplan-sketch.jpg 講義棟の配置の手書きメモ（上が西）
test/mockroom.js         オンライン対戦のテスト用の模擬 room
worker/index.js          Web 版の中継サーバー（Cloudflare Workers + Durable Objects）
scripts/build.mjs        Web 版で配信するファイルを dist/ にコピー
wrangler.jsonc           Web 版の Cloudflare の設定
LICENSE                  ライセンス（コードは MIT。とん平のイラストなどは対象外）
```

## セキュリティ

- `index.html` の CSP で、自分のオリジンの script / style / 画像と Google Fonts だけを許可しています（インライン script・style 属性・`eval`・`blob:` は不可）。
- 画面の文字はすべて `textContent` で入れています（`innerHTML` は使わない）。
- ほかの端末から届いたデータは、型・範囲・件数を確かめてから使います（名前と発言は制御文字・不可視文字を除去）。

## 権利・クレジット

- ソースコードなどは [MIT ライセンス](LICENSE)（© 2026 oe-shota）です。
- **とん平のイラスト（`assets/tonpei/`）は MIT ライセンスの対象外です。** とんペディアの著作物で、許可を得てこのゲームに使っています。フォークや改変をして使う場合は、イラストを差し替えてください。「とんペディア」「とん平」の名前も対象外です。
- フォント：[Zen Kaku Gothic New](https://fonts.google.com/specimen/Zen+Kaku+Gothic+New)（SIL Open Font License 1.1、Google Fonts から読み込み）。効果音は Web Audio で合成しています（音源ファイルなし）。
- 非公式のファン作品です。東北大学、Innersloth LLC（Among Us）とは関係がなく、承認も受けていません。「Among Us」は Innersloth LLC の商標です。講義棟の配置は手書きのメモをもとにしたもので、正確ではありません。
- 名前と発言は中継サーバーで同じ部屋の端末に配るだけで、保存しません。フォントを Google Fonts から読み込むため、閲覧者の IP アドレスなどが Google に送られます。
