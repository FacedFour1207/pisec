# π秒見積もり

> 稲刈り遠征中に思いついたクソゲー

ボタンを押して、**ちょうどπ秒（3.14159265…秒）** だと思ったらもう一度押す。
小数点以下何桁までπと一致したかを競う、それだけのゲームです。

**▶ 遊ぶ: https://pisec.siesnet.com/**

- 必要人数：2人以上推奨、1人でも可
- 必要なもの：ブラウザ（スマホでもPCでも）

## ルール

1. ボタンを押してタイマー開始（経過時間は見えません）。
2. π秒経ったと思ったら、もう一度ボタンを押す。
3. 記録が小数点以下何桁までπと一致したかを調べる。
4. 一致した桁数が一番多い人の勝ち。同じ桁数なら、πとの差が小さい方が勝ち。

例：`3.141062` 秒 → `3.141` まで一致 → **3桁**

## 遊べるモード

| モード | 内容 |
| --- | --- |
| この端末で遊ぶ | 1台の端末を回して順番にプレイ。1人でも遊べる |
| オンライン対戦 | 部屋を作ると5文字の部屋コードが出る。コードか招待リンクを送れば、別々の端末から同時に遊べる |
| ランキング | 1人で遊んだときの自己ベストが自動で登録され、全員分が順位表示される |

- スペースキー / Enter でもボタンを押せます。
- 「経過時間を表示する（ぬるいモード）」をオンにすると経過時間が見えます。この記録はランキングに登録されません。

## 仕組み

```
public/index.html            ゲーム本体（HTML 1枚）
src/worker.js                Cloudflare Worker（静的ファイル配信 + ランキング API）
migrations/                  D1 のテーブル定義
wrangler.toml                Workers / D1 の設定
```

- **配信**：Cloudflare Workers（Static Assets）
- **ランキング**：Cloudflare D1（SQLite）
  - `GET /api/scores?limit=100&me=<playerId>`：上位の記録と自分の順位
  - `POST /api/scores`（`{ playerId, name, sec }`）：記録を送信。自己ベストのときだけ更新
  - プレイヤーはブラウザごとにランダムな ID で区別（ログイン不要）
  - 一致桁数はサーバー側でも計算し直す。ただし秒数はブラウザから送られるので、偽装は防げない（クソゲーなので割り切り）
- **オンライン対戦**：[PeerJS](https://peerjs.com/)（WebRTC の P2P）。接続の仲介には PeerJS の無料公開サーバーを使用
  - 計測は各自の端末で行い、秒数だけを送るので、通信の遅れは記録に影響しない
  - 部屋を作った人（ホスト）がタブを閉じると部屋は解散
  - 中継（TURN）サーバーは使っていないため、一部のモバイル回線や社内ネットワークでは接続できないことがある
- **計測**：`performance.now()`。ブラウザがセキュリティ上の理由で精度を丸めるため、実際に意味がある桁は 0.1ms〜1ms 程度（ブラウザ依存）

## 自分で動かす

[Node.js](https://nodejs.org/) と [Cloudflare](https://dash.cloudflare.com/) のアカウント（無料）が必要です。

### ローカルで動かす

```sh
git clone https://github.com/FacedFour1207/pisec.git
cd pisec
npm install
npm run dev                       # http://localhost:8787
```

### デプロイ（初回）

```sh
npx wrangler login
npx wrangler d1 create pisec      # 表示された database_id を wrangler.toml に貼る
npm run deploy                    # テーブル作成（migrations）+ デプロイ
```

`https://pisec.<あなたのサブドメイン>.workers.dev` で公開されます。2回目以降は `npm run deploy` だけで更新できます。

GitHub への push で自動デプロイしたい場合は、Cloudflare ダッシュボードの Workers & Pages → 作成 →「リポジトリをインポート」でこのリポジトリをつなぎ、デプロイコマンドを `npm run deploy` にしてください。

## お問い合わせ

support@siesnet.com

## ライセンス

[MIT License](LICENSE)
