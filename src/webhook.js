import { middleware, Client } from '@line/bot-sdk';
import { analyzeMessage } from './analyzer.js';
import { saveMessage } from './db.js';

function getClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  });
}

export function createLineMiddleware() {
  return middleware({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  });
}

export async function handleWebhook(req, res) {
  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.json({ ok: true });
}

async function getSenderInfo(event) {
  const client = getClient();
  const userId = event.source.userId;
  const sourceType = event.source.type; // 'user' | 'group' | 'room'
  const groupId = event.source.groupId || event.source.roomId || null;

  let displayName = userId;
  let pictureUrl = null;

  try {
    if (sourceType === 'group' && groupId) {
      const profile = await client.getGroupMemberProfile(groupId, userId);
      displayName = profile.displayName;
      pictureUrl = profile.pictureUrl;
    } else {
      const profile = await client.getProfile(userId);
      displayName = profile.displayName;
      pictureUrl = profile.pictureUrl;
    }
  } catch {
    // プロフィール取得失敗は無視
  }

  return { userId, displayName, pictureUrl, sourceType, groupId };
}

function getAllowedUserIds() {
  const val = process.env.ALLOWED_USER_IDS || '';
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text;
  const messageId = event.message.id;
  const timestamp = new Date(event.timestamp).toISOString();

  const sender = await getSenderInfo(event);
  console.log(`[LINE] 受信 from ${sender.displayName}(${sender.sourceType}): ${text.slice(0, 50)}`);

  // ホワイトリストが設定されている場合は対象外をスキップ
  const allowedIds = getAllowedUserIds();
  if (allowedIds.length > 0 && !allowedIds.includes(sender.userId)) {
    console.log(`[SKIP] ホワイトリスト対象外: ${sender.displayName} (${sender.userId})`);
    return;
  }

  let analysis;
  try {
    analysis = await analyzeMessage(text);
  } catch (err) {
    console.error('[Analyzer] エラー:', err.message);
    analysis = {
      type: 'other',
      typeLabel: 'その他',
      summary: text.slice(0, 80),
      replyDraft: '（AI解析に失敗しました。手動で返信文を入力してください）',
      attendanceStatus: null,
      scheduleDates: [],
      priority: 'normal',
    };
  }

  saveMessage({
    id: messageId,
    userId: sender.userId,
    displayName: sender.displayName,
    pictureUrl: sender.pictureUrl,
    sourceType: sender.sourceType,
    groupId: sender.groupId,
    text,
    timestamp,
    status: 'pending',
    ...analysis,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  console.log(`[DB] 保存完了: type=${analysis.type}, sender=${sender.displayName}`);
}
