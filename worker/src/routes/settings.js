/**
 * Settings API routes (Hono)
 * Migrated from backend/app/routers/settings.py
 */

import { Hono } from 'hono';
import { getCurrentUser } from '../auth.js';
import { encryptValue, decryptValue } from '../crypto.js';

const settings = new Hono();

const ENCRYPTED_FIELDS = new Set(['OPENAI_API_KEY', 'SMTP_PASSWORD']);

function validateEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function validateUrl(url) {
  return /^https?:\/\/\S+$/.test(url);
}

function validatePort(port) {
  const p = parseInt(port);
  return !isNaN(p) && p >= 1 && p <= 65535;
}

// GET /api/settings
settings.get('/settings', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const db = c.env.DB;
  const result = await db.prepare(
    'SELECT key, value, encrypted FROM settings WHERE user_id = ?'
  ).bind(user.id).all();

  const settingsObj = {};
  for (const row of result.results) {
    if (row.encrypted && row.value) {
      settingsObj[row.key] = '***';
    } else {
      settingsObj[row.key] = row.value;
    }
  }

  // Fallback defaults
  if (Object.keys(settingsObj).length === 0) {
    return c.json({
      settings: {
        OPENAI_API_KEY: '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',
        OPENAI_API_BASE: 'https://integrate.api.nvidia.com/v1',
        AI_MODEL_NAME: 'deepseek-ai/deepseek-v3.2',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        EMAIL_FROM: '',
      },
    });
  }

  return c.json({ settings: settingsObj });
});

// POST /api/settings
settings.post('/settings', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const body = await c.req.json();
  const settingsData = body.settings || {};
  const errors = {};

  // Validate
  if ('SMTP_PORT' in settingsData && settingsData.SMTP_PORT) {
    if (!validatePort(settingsData.SMTP_PORT)) {
      errors.SMTP_PORT = '端口必须在 1-65535 之间';
    }
  }
  if ('SMTP_USER' in settingsData && settingsData.SMTP_USER) {
    if (!validateEmail(settingsData.SMTP_USER)) {
      errors.SMTP_USER = '邮箱格式不正确';
    }
  }
  if ('EMAIL_FROM' in settingsData && settingsData.EMAIL_FROM) {
    if (!validateEmail(settingsData.EMAIL_FROM)) {
      errors.EMAIL_FROM = '邮箱格式不正确';
    }
  }
  if ('OPENAI_API_BASE' in settingsData && settingsData.OPENAI_API_BASE) {
    if (!validateUrl(settingsData.OPENAI_API_BASE)) {
      errors.OPENAI_API_BASE = 'URL 格式不正确';
    }
  }

  if (Object.keys(errors).length > 0) {
    return c.json({ detail: { errors } }, 400);
  }

  const db = c.env.DB;
  for (const [key, value] of Object.entries(settingsData)) {
    if (value === '***') continue; // Masked, not modified

    const encrypted = ENCRYPTED_FIELDS.has(key) ? 1 : 0;
    let storedValue = value;
    if (encrypted && value) {
      storedValue = await encryptValue(value, c.env);
    }

    await db.prepare(`
      INSERT INTO settings (key, value, encrypted, user_id, updated_at)
      VALUES (?, ?, ?, ?, datetime())
      ON CONFLICT(key, user_id) DO UPDATE SET
        value = excluded.value,
        encrypted = excluded.encrypted,
        updated_at = datetime()
    `).bind(key, storedValue, encrypted, user.id).run();
  }

  return c.json({ message: '设置已保存' });
});

// GET /api/preferences
settings.get('/preferences', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const db = c.env.DB;

  const watchlistRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_watchlist'"
  ).bind(user.id).first();

  const accountRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_current_account'"
  ).bind(user.id).first();

  const sortRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_sort_option'"
  ).bind(user.id).first();

  return c.json({
    watchlist: watchlistRow?.value || '[]',
    currentAccount: accountRow ? parseInt(accountRow.value) : 1,
    sortOption: sortRow?.value || null,
  });
});

// POST /api/preferences
settings.post('/preferences', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const db = c.env.DB;
  const data = await c.req.json();

  const upsertPref = async (key, value) => {
    await db.prepare(`
      INSERT INTO settings (key, value, encrypted, user_id, updated_at)
      VALUES (?, ?, 0, ?, datetime())
      ON CONFLICT(key, user_id) DO UPDATE SET
        value = excluded.value, updated_at = datetime()
    `).bind(key, String(value), user.id).run();
  };

  if ('watchlist' in data) await upsertPref('user_watchlist', data.watchlist);
  if ('currentAccount' in data) await upsertPref('user_current_account', data.currentAccount);
  if ('sortOption' in data) await upsertPref('user_sort_option', data.sortOption);

  return c.json({ message: '偏好已保存' });
});

export default settings;
