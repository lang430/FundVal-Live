/**
 * Auth API routes (Hono)
 * Migrated from backend/app/routers/auth.py
 */

import { Hono } from 'hono';
import {
  hashPassword, verifyPassword, hasAdminUser,
  createSession, deleteSession, getCurrentUser,
  setSessionCookie, clearSessionCookie, getUserById,
} from '../auth.js';

const auth = new Hono();

// ============================================================================
// Helper Functions
// ============================================================================

async function getUserDefaultAccountId(db, userId) {
  // Check user_settings
  const settingRow = await db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = 'user_current_account'"
  ).bind(userId).first();

  if (settingRow && settingRow.value) {
    return parseInt(settingRow.value);
  }

  // Fallback: first account
  const acc = await db.prepare(
    'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1'
  ).bind(userId).first();

  return acc ? acc.id : null;
}

// ============================================================================
// Public Endpoints
// ============================================================================

auth.get('/init-status', async (c) => {
  const db = c.env.DB;
  const needsInit = !(await hasAdminUser(db));

  let needsRebuild = false;
  try {
    const { checkDatabaseVersion, CURRENT_SCHEMA_VERSION } = await import('../db.js');
    const version = await checkDatabaseVersion(db);
    needsRebuild = version > 0 && version !== CURRENT_SCHEMA_VERSION;
  } catch {}

  return c.json({ needs_init: needsInit, needs_rebuild: needsRebuild });
});

auth.post('/init', async (c) => {
  const db = c.env.DB;

  if (await hasAdminUser(db)) {
    return c.json({ detail: '已存在管理员用户' }, 400);
  }

  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ detail: '用户名和密码不能为空' }, 400);
  }

  if (password.length < 6) {
    return c.json({ detail: '密码长度至少 6 位' }, 400);
  }

  const passwordHash = await hashPassword(password);

  const result = await db.prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)'
  ).bind(username, passwordHash).run();

  const userId = result.meta.last_row_id;

  // Create default account
  await db.prepare(
    'INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)'
  ).bind('默认账户', '初始化创建的默认账户', userId).run();

  // Insert default AI prompt
  const { LINUS_FINANCIAL_ANALYSIS_PROMPT } = await import('../services/prompts.js');
  const defaultPrompt = LINUS_FINANCIAL_ANALYSIS_PROMPT({});
  await db.prepare(
    'INSERT INTO ai_prompts (name, prompt, system_prompt, user_prompt, is_default, user_id) VALUES (?, ?, ?, ?, 1, ?)'
  ).bind('Linus 风格分析', '', defaultPrompt[0].content, defaultPrompt[1].content, userId).run();

  return c.json({
    message: '管理员初始化成功',
    user: { id: userId, username, is_admin: true },
  });
});

auth.get('/registration', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(
    "SELECT value FROM settings WHERE key = 'REGISTRATION_ENABLED' AND user_id IS NULL"
  ).first();

  const enabled = row ? row.value === '1' || row.value === 'true' : false;
  return c.json({ registration_enabled: enabled });
});

auth.get('/mode', async (c) => {
  const db = c.env.DB;
  const multiUserMode = await hasAdminUser(db);
  return c.json({
    environment: c.env.ENVIRONMENT || 'production',
    multi_user_mode: multiUserMode,
  });
});

auth.post('/login', async (c) => {
  const db = c.env.DB;
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ detail: '用户名和密码不能为空' }, 400);
  }

  const user = await db.prepare(
    'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?'
  ).bind(username).first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ detail: '用户名或密码错误' }, 401);
  }

  // Create session
  const sessionId = await createSession(c.env.SESSION_KV, user.id);
  setSessionCookie(c, sessionId);

  const defaultAccountId = await getUserDefaultAccountId(db, user.id);

  return c.json({
    id: user.id,
    username: user.username,
    is_admin: !!user.is_admin,
    default_account_id: defaultAccountId,
  });
});

auth.post('/logout', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  // Get session from cookie
  const cookieHeader = c.req.header('cookie') || '';
  const match = cookieHeader.match(/session_id=([^;]+)/);
  if (match) {
    await deleteSession(c.env.SESSION_KV, match[1]);
  }

  clearSessionCookie(c);
  return c.json({ message: '已登出' });
});

auth.post('/register', async (c) => {
  const db = c.env.DB;

  // Check registration enabled
  const regRow = await db.prepare(
    "SELECT value FROM settings WHERE key = 'REGISTRATION_ENABLED' AND user_id IS NULL"
  ).first();
  const regEnabled = regRow ? regRow.value === '1' || regRow.value === 'true' : false;

  if (!regEnabled) {
    return c.json({ detail: '注册功能未开启' }, 403);
  }

  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ detail: '用户名和密码不能为空' }, 400);
  }

  if (password.length < 6) {
    return c.json({ detail: '密码长度至少 6 位' }, 400);
  }

  // Check duplicate
  const existing = await db.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first();

  if (existing) {
    return c.json({ detail: '用户名已存在' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const result = await db.prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)'
  ).bind(username, passwordHash).run();

  const userId = result.meta.last_row_id;

  // Create default account
  await db.prepare(
    'INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)'
  ).bind('默认账户', '', userId).run();

  // Create session
  const sessionId = await createSession(c.env.SESSION_KV, userId);
  setSessionCookie(c, sessionId);

  const defaultAccountId = await getUserDefaultAccountId(db, userId);

  return c.json({
    id: userId,
    username,
    is_admin: false,
    default_account_id: defaultAccountId,
  });
});

auth.get('/me', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const db = c.env.DB;
  const defaultAccountId = await getUserDefaultAccountId(db, user.id);

  return c.json({
    id: user.id,
    username: user.username,
    is_admin: user.isAdmin,
    default_account_id: defaultAccountId,
  });
});

auth.post('/change-password', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const db = c.env.DB;
  const { old_password, new_password } = await c.req.json();

  if (!old_password || !new_password) {
    return c.json({ detail: '新旧密码不能为空' }, 400);
  }

  if (new_password.length < 6) {
    return c.json({ detail: '新密码长度至少 6 位' }, 400);
  }

  const dbUser = await db.prepare(
    'SELECT password_hash FROM users WHERE id = ?'
  ).bind(user.id).first();

  if (!(await verifyPassword(old_password, dbUser.password_hash))) {
    return c.json({ detail: '旧密码错误' }, 400);
  }

  const newHash = await hashPassword(new_password);
  await db.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ?'
  ).bind(newHash, user.id).run();

  return c.json({ message: '密码修改成功' });
});

// ============================================================================
// Admin Endpoints
// ============================================================================

auth.post('/users', async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin) return c.json({ detail: '未登录' }, 401);
  if (!admin.isAdmin) return c.json({ detail: '权限不足' }, 403);

  const db = c.env.DB;
  const { username, password, is_admin = false } = await c.req.json();

  if (!username || !password) {
    return c.json({ detail: '用户名和密码不能为空' }, 400);
  }

  const existing = await db.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first();

  if (existing) {
    return c.json({ detail: '用户名已存在' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const result = await db.prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
  ).bind(username, passwordHash, is_admin ? 1 : 0).run();

  const userId = result.meta.last_row_id;

  // Create default account
  await db.prepare(
    'INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)'
  ).bind('默认账户', '', userId).run();

  return c.json({ id: userId, username, is_admin: !!is_admin });
});

auth.get('/users', async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin) return c.json({ detail: '未登录' }, 401);
  if (!admin.isAdmin) return c.json({ detail: '权限不足' }, 403);

  const db = c.env.DB;
  const result = await db.prepare(
    'SELECT id, username, is_admin, created_at FROM users ORDER BY id'
  ).all();

  const users = [];
  for (const row of result.results) {
    const defaultAccountId = await getUserDefaultAccountId(db, row.id);
    users.push({
      id: row.id,
      username: row.username,
      is_admin: !!row.is_admin,
      default_account_id: defaultAccountId,
    });
  }

  return c.json(users);
});

auth.delete('/users/:id', async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin) return c.json({ detail: '未登录' }, 401);
  if (!admin.isAdmin) return c.json({ detail: '权限不足' }, 403);

  const db = c.env.DB;
  const userId = parseInt(c.req.param('id'));

  if (userId === admin.id) {
    return c.json({ detail: '不能删除自己' }, 400);
  }

  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return c.json({ message: '用户已删除' });
});

auth.post('/registration', async (c) => {
  const admin = await getCurrentUser(c);
  if (!admin) return c.json({ detail: '未登录' }, 401);
  if (!admin.isAdmin) return c.json({ detail: '权限不足' }, 403);

  const db = c.env.DB;
  const { enabled } = await c.req.json();

  await db.prepare(`
    INSERT INTO settings (key, value, user_id, updated_at)
    VALUES ('REGISTRATION_ENABLED', ?, NULL, datetime())
    ON CONFLICT(key, user_id) DO UPDATE SET
      value = excluded.value, updated_at = datetime()
  `).bind(enabled ? '1' : '0').run();

  return c.json({ registration_enabled: !!enabled });
});

export default auth;
