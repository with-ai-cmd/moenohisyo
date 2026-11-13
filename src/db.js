import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/messages.json');

function load() {
  if (!existsSync(DB_PATH)) return { messages: [] };
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { messages: [] };
  }
}

function save(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function saveMessage(msg) {
  const db = load();
  const existing = db.messages.findIndex(m => m.id === msg.id);
  if (existing >= 0) {
    db.messages[existing] = { ...db.messages[existing], ...msg };
  } else {
    db.messages.unshift(msg);
  }
  save(db);
  return msg;
}

export function getMessages({ status, type, limit = 50 } = {}) {
  const db = load();
  let msgs = db.messages;
  if (status) msgs = msgs.filter(m => m.status === status);
  if (type) msgs = msgs.filter(m => m.type === type);
  return msgs.slice(0, limit);
}

export function getMessage(id) {
  const db = load();
  return db.messages.find(m => m.id === id) || null;
}

export function updateMessage(id, updates) {
  const db = load();
  const idx = db.messages.findIndex(m => m.id === id);
  if (idx < 0) return null;
  db.messages[idx] = { ...db.messages[idx], ...updates, updatedAt: new Date().toISOString() };
  save(db);
  return db.messages[idx];
}

export function getStats() {
  const db = load();
  const msgs = db.messages;
  return {
    total: msgs.length,
    pending: msgs.filter(m => m.status === 'pending').length,
    replied: msgs.filter(m => m.status === 'replied').length,
    attendance: {
      attending: msgs.filter(m => m.attendanceStatus === 'attending').length,
      absent: msgs.filter(m => m.attendanceStatus === 'absent').length,
      pending: msgs.filter(m => m.type === 'attendance' && !m.attendanceStatus).length,
    },
  };
}
