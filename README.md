# LINE秘書ダッシュボード

LINEに届いたメッセージをAIで解析し、返信文案を自動生成する秘書業務支援ツールです。

## 機能

- **メッセージ自動分類**: 出欠連絡 / 日程調整 / 問い合わせ の3種類に自動判定
- **返信文案の自動生成**: Claude APIで丁寧な返信文を下書き
- **出欠管理**: 参加/欠席をワンクリックで記録
- **日程調整サポート**: カレンダーと照合して空き日を自動確認
- **カレンダー登録**: 確定した予定をGoogleカレンダーに直接登録
- **送信ボタン**: 編集後にLINEへプッシュ送信

---

## セットアップ

### 1. 依存パッケージをインストール

```bash
npm install
```

### 2. 環境変数を設定

`.env.example` をコピーして `.env` を作成し、各キーを設定します。

```bash
cp .env.example .env
```

#### LINE Messaging API
1. [LINE Developers Console](https://developers.line.biz/) でチャンネルを開く
2. 「Messaging API」タブ → Channel access token を発行
3. Channel secret も同画面で確認
4. `.env` の `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_CHANNEL_SECRET` に設定

#### Anthropic Claude API
1. [Anthropic Console](https://console.anthropic.com/) でAPIキーを発行
2. `.env` の `ANTHROPIC_API_KEY` に設定

#### Google Calendar API
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「有効なAPIとサービス」→「Google Calendar API」を有効化
3. 「認証情報」→「OAuthクライアントID」を作成（種類: Webアプリケーション）
4. 承認済みリダイレクトURI に `http://localhost:3000/auth/google/callback` を追加
5. クライアントID とクライアントシークレットを `.env` に設定

### 3. サーバーを起動

```bash
npm start
# または開発用（ファイル変更で自動再起動）
npm run dev
```

### 4. Google認証（初回のみ）

ブラウザで `http://localhost:3000/auth/google` にアクセスしてGoogleアカウントで認証します。
トークンは `data/google_token.json` に保存されます。

### 5. LINE Webhookを設定

サーバーをインターネットに公開する必要があります。

**ローカル開発時は ngrok を使用:**

```bash
# ngrokをインストール後
ngrok http 3000
```

表示された `https://xxxx.ngrok.io` を使って、LINE Developers Console の「Messaging API」タブで
Webhook URL を `https://xxxx.ngrok.io/webhook` に設定します。

**本番環境では** VPSやクラウドサーバーにデプロイして固定URLを使用してください。

---

## 画面の使い方

1. ブラウザで `http://localhost:3000` を開く
2. 左列のメッセージをクリックして選択
3. 右パネルで返信文を確認・編集
4. 「LINE で送信」ボタンで送信

### フィルタータブ

| タブ | 表示内容 |
|------|---------|
| すべて | 全メッセージ |
| 未返信 | まだ返信していないもの |
| 出欠 | 出欠連絡のみ |
| 日程 | 日程調整のみ |

---

## テスト（動作確認）

LINEと繋がなくてもAPIでテストできます:

```bash
curl -X POST http://localhost:3000/api/debug/inject \
  -H "Content-Type: application/json" \
  -d '{"text": "来月のセミナー、参加します！よろしくお願いします。"}'
```

---

## ファイル構成

```
line-secretary/
├── server.js          # Expressサーバー・APIルート
├── src/
│   ├── analyzer.js    # Claude APIでメッセージ解析
│   ├── webhook.js     # LINE Webhookハンドラー
│   ├── line-api.js    # LINE返信送信
│   ├── calendar.js    # Google Calendar連携
│   └── db.js          # JSONファイルベースのデータ保存
├── public/
│   └── index.html     # ダッシュボードUI
├── data/
│   ├── messages.json  # メッセージデータ（自動生成）
│   └── google_token.json  # Google認証トークン（自動生成）
├── .env               # 環境変数（要作成）
└── .env.example       # 環境変数のテンプレート
```
