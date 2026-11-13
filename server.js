import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createLineMiddleware, handleWebhook } from './src/webhook.js';
import { getMessages, getMessage, updateMessage, getStats } from './src/db.js';
import { sendReply } from './src/line-api.js';
import { createCalendarEvent, getAvailableSlots, getAuthUrl, saveToken } from './src/calendar.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(join(__dirname, 'public')));

// LINE Webhook（署名検証が必要なためjson()より先に登録）
app.post('/webhook', createLineMiddleware(), handleWebhook);

app.use(express.json());

// --- Google OAuth ---
app.get('/auth/google', (req, res) => {
  res.redirect(getAuthUrl());
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('codeが取得できませんでした');
  try {
    await saveToken(code);
    res.send('<h2>Google認証が完了しました。このタブを閉じてダッシュボードに戻ってください。</h2>');
  } catch (err) {
    res.status(500).send(`認証エラー: ${err.message}`);
  }
});

// --- メッセージ一覧 ---
app.get('/api/messages', (req, res) => {
  const { status, type, limit } = req.query;
  const messages = getMessages({ status, type, limit: Number(limit) || 50 });
  res.json(messages);
});

// --- 統計 ---
app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

// --- メッセージ詳細 ---
app.get('/api/messages/:id', (req, res) => {
  const msg = getMessage(req.params.id);
  if (!msg) return res.status(404).json({ error: '見つかりません' });
  res.json(msg);
});

// --- 返信文を編集して保存 ---
app.patch('/api/messages/:id', (req, res) => {
  const { replyDraft, attendanceStatus, note } = req.body;
  const updated = updateMessage(req.params.id, { replyDraft, attendanceStatus, note });
  if (!updated) return res.status(404).json({ error: '見つかりません' });
  res.json(updated);
});

// --- 返信を送信 ---
app.post('/api/messages/:id/reply', async (req, res) => {
  const msg = getMessage(req.params.id);
  if (!msg) return res.status(404).json({ error: '見つかりません' });

  const text = req.body.text || msg.replyDraft;
  if (!text) return res.status(400).json({ error: '返信文が空です' });

  try {
    await sendReply(msg.userId, text, { sourceType: msg.sourceType, groupId: msg.groupId });
    const updated = updateMessage(req.params.id, {
      status: 'replied',
      repliedAt: new Date().toISOString(),
      repliedText: text,
    });
    res.json({ ok: true, message: updated });
  } catch (err) {
    console.error('[Reply]', err.message);
    res.status(500).json({ error: `送信失敗: ${err.message}` });
  }
});

// --- カレンダー登録 ---
app.post('/api/calendar/events', async (req, res) => {
  const { title, date, startTime, endTime, description, calendarId } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title と date は必須です' });

  try {
    const event = await createCalendarEvent({ title, date, startTime, endTime, description, calendarId });
    res.json({ ok: true, event });
  } catch (err) {
    console.error('[Calendar]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- カレンダー空き確認 ---
app.post('/api/calendar/check', async (req, res) => {
  const { dates } = req.body;
  if (!dates?.length) return res.status(400).json({ error: 'dates が必要です' });

  try {
    const slots = await getAvailableSlots(dates);
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- テスト用：ダミーメッセージを注入 ---
app.post('/api/debug/inject', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text が必要です' });

  const { analyzeMessage } = await import('./src/analyzer.js');
  const { saveMessage } = await import('./src/db.js');

  const analysis = await analyzeMessage(text);
  const msg = saveMessage({
    id: `debug_${Date.now()}`,
    userId: 'debug_user',
    text,
    timestamp: new Date().toISOString(),
    status: 'pending',
    ...analysis,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.json(msg);
});

app.listen(PORT, () => {
  console.log(`\n🟢 秘書ダッシュボード起動中: http://localhost:${PORT}`);
  console.log(`   LINE Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`   Google認証: http://localhost:${PORT}/auth/google\n`);
});
