import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `あなたは社長秘書の業務支援AIです。
LINEに届いたメッセージを解析して、以下のJSONを返してください。

{
  "type": "attendance" | "schedule" | "inquiry" | "other",
  "typeLabel": "出欠連絡" | "日程調整" | "問い合わせ" | "その他",
  "summary": "メッセージの要約（30文字以内）",
  "replyDraft": "返信文案（丁寧・簡潔な日本語）",
  "attendanceStatus": "attending" | "absent" | null,
  "scheduleDates": ["2026-10-25", ...],  // 日程調整の場合に候補日をYYYY-MM-DD形式で
  "eventName": "イベント名（わかれば）",
  "priority": "high" | "normal" | "low"
}

ルール：
- typeは内容から最も適切なものを選ぶ
- replyDraftは社長秘書として送る返信文（送信者への返信）
- attendanceStatusはtype=attendanceのときのみ設定
- scheduleDatesはtype=scheduleのときのみ設定（本文から読み取れる日付）
- priorityはhighを急ぎ、normalを通常、lowを確認のみ
- 必ずJSON形式のみで返す（説明文不要）`;

export async function analyzeMessage(text) {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Tokyo',
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `今日は${today}です。\n\nLINEメッセージ：\n${text}`,
      },
    ],
  });

  const raw = response.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSONが取得できませんでした');

  return JSON.parse(jsonMatch[0]);
}
