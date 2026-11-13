import { Client } from '@line/bot-sdk';

function getClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  });
}

export async function sendReply(userId, text, { sourceType, groupId } = {}) {
  const client = getClient();
  // グループ/ルームの場合はグループへ送信、個人の場合はユーザーへ送信
  const targetId = (sourceType === 'group' || sourceType === 'room') && groupId ? groupId : userId;
  await client.pushMessage(targetId, { type: 'text', text });
}

export async function getUserProfile(userId) {
  const client = getClient();
  try {
    return await client.getProfile(userId);
  } catch {
    return { displayName: userId, pictureUrl: null };
  }
}
