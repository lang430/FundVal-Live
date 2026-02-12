/**
 * AI API routes (Hono)
 * Migrated from backend/app/routers/ai.py
 */

import { Hono } from 'hono';
import { getCurrentUser } from '../auth.js';
import { aiService } from '../services/ai.js';

const ai = new Hono();

// POST /api/ai/analyze
ai.post('/analyze', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const body = await c.req.json();
  const { fund_id, fund_name, prompt_id, account_id } = body;

  if (!fund_id) return c.json({ detail: '需要指定基金代码' }, 400);

  try {
    const result = await aiService.analyzeFund(c.env.DB, c.env, {
      id: fund_id,
      name: fund_name,
      account_id: account_id || 1,
    }, prompt_id, user.id);

    return c.json(result);
  } catch (e) {
    console.error(`AI analysis error: ${e.message}`);
    return c.json({ detail: e.message }, 500);
  }
});

// GET /api/ai/history?account_id=X&fund_code=Y&limit=10
ai.get('/history', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const db = c.env.DB;
  const accountId = c.req.query('account_id');
  const fundCode = c.req.query('fund_code');
  const limit = parseInt(c.req.query('limit') || '10');

  let query = 'SELECT * FROM ai_analysis_history WHERE user_id = ?';
  const params = [user.id];

  if (accountId) {
    query += ' AND account_id = ?';
    params.push(parseInt(accountId));
  }

  if (fundCode) {
    query += ' AND fund_code = ?';
    params.push(fundCode);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await db.prepare(query).bind(...params).all();
  return c.json(result.results);
});

// DELETE /api/ai/history/:id
ai.delete('/history/:id', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const historyId = parseInt(c.req.param('id'));
  await c.env.DB.prepare(
    'DELETE FROM ai_analysis_history WHERE id = ? AND user_id = ?'
  ).bind(historyId, user.id).run();

  return c.json({ message: '已删除' });
});

// ============================================================================
// Prompt Management
// ============================================================================

// GET /api/ai/prompts
ai.get('/prompts', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const result = await c.env.DB.prepare(
    'SELECT id, name, system_prompt, user_prompt, is_default, created_at, updated_at FROM ai_prompts WHERE user_id = ? ORDER BY is_default DESC, id'
  ).bind(user.id).all();

  return c.json(result.results);
});

// POST /api/ai/prompts
ai.post('/prompts', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const { name, system_prompt, user_prompt, is_default } = await c.req.json();
  if (!name) return c.json({ detail: '提示词名称不能为空' }, 400);

  const db = c.env.DB;

  // If setting as default, unset existing defaults
  if (is_default) {
    await db.prepare(
      'UPDATE ai_prompts SET is_default = 0 WHERE user_id = ?'
    ).bind(user.id).run();
  }

  const result = await db.prepare(
    'INSERT INTO ai_prompts (name, prompt, system_prompt, user_prompt, is_default, user_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(name, '', system_prompt || '', user_prompt || '', is_default ? 1 : 0, user.id).run();

  return c.json({ id: result.meta.last_row_id, message: '提示词已创建' });
});

// PUT /api/ai/prompts/:id
ai.put('/prompts/:id', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const promptId = parseInt(c.req.param('id'));
  const { name, system_prompt, user_prompt, is_default } = await c.req.json();

  const db = c.env.DB;

  if (is_default) {
    await db.prepare(
      'UPDATE ai_prompts SET is_default = 0 WHERE user_id = ?'
    ).bind(user.id).run();
  }

  await db.prepare(
    'UPDATE ai_prompts SET name = ?, system_prompt = ?, user_prompt = ?, is_default = ?, updated_at = datetime() WHERE id = ? AND user_id = ?'
  ).bind(name, system_prompt || '', user_prompt || '', is_default ? 1 : 0, promptId, user.id).run();

  return c.json({ message: '提示词已更新' });
});

// DELETE /api/ai/prompts/:id
ai.delete('/prompts/:id', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const promptId = parseInt(c.req.param('id'));
  await c.env.DB.prepare(
    'DELETE FROM ai_prompts WHERE id = ? AND user_id = ?'
  ).bind(promptId, user.id).run();

  return c.json({ message: '提示词已删除' });
});

export default ai;
