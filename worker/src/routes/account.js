/**
 * Account/Position/Trade API routes (Hono)
 * Migrated from backend/app/routers/account.py
 */

import { Hono } from 'hono';
import { getCurrentUser, verifyAccountOwnership } from '../auth.js';
import {
  getUserAccounts, createAccount, updateAccount, deleteAccount,
  getPositions, getAggregatePositions, upsertPosition, removePosition,
  addTrade, reduceTrade, getTransactions,
} from '../services/account.js';
import { getCombinedValuation, getFundHistory, calculateTechnicalIndicators, getFundCategory } from '../services/fund.js';

const account = new Hono();

// ============================================================================
// Account endpoints
// ============================================================================

account.get('/accounts', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);
  const accounts = await getUserAccounts(c.env.DB, user.id);
  return c.json(accounts);
});

account.post('/accounts', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);
  const { name, description } = await c.req.json();
  if (!name) return c.json({ detail: '账户名称不能为空' }, 400);

  try {
    const id = await createAccount(c.env.DB, user.id, name, description);
    return c.json({ id, name, description, message: '账户创建成功' });
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});

account.put('/accounts/:id', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.param('id'));
  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const { name, description } = await c.req.json();
  await updateAccount(c.env.DB, accountId, name, description);
  return c.json({ message: '账户已更新' });
});

account.delete('/accounts/:id', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.param('id'));
  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  try {
    await deleteAccount(c.env.DB, accountId);
    return c.json({ message: '账户已删除' });
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});

// ============================================================================
// Position endpoints
// ============================================================================

// GET /api/positions/aggregate - aggregated positions across all accounts
account.get('/positions/aggregate', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const db = c.env.DB;
  const positions = await getAggregatePositions(db, user.id);

  // Enrich with real-time valuations
  const enriched = [];
  for (const pos of positions) {
    try {
      const valuation = await getCombinedValuation(db, pos.code);
      const fundRow = await db.prepare('SELECT name, type FROM funds WHERE code = ?').bind(pos.code).first();
      const name = valuation.name || fundRow?.name || pos.code;
      const type = fundRow?.type || '';
      const category = getFundCategory(type);

      const nav = parseFloat(valuation.nav || 0);
      const estimate = parseFloat(valuation.estimate || 0);
      const estRate = parseFloat(valuation.estRate || 0);
      const shares = parseFloat(pos.shares || 0);
      const cost = parseFloat(pos.cost || 0);

      const marketValue = estimate > 0 ? estimate * shares : nav * shares;
      const totalReturn = cost > 0 ? ((marketValue - cost) / cost * 100) : 0;

      enriched.push({
        code: pos.code,
        name,
        type,
        category,
        cost,
        shares,
        nav,
        estimate,
        estRate,
        marketValue: Math.round(marketValue * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        time: valuation.time || '--',
        account_id: pos.account_id,
        account_name: pos.account_name,
      });
    } catch (e) {
      enriched.push({
        code: pos.code,
        name: pos.code,
        cost: pos.cost,
        shares: pos.shares,
        error: e.message,
        account_id: pos.account_id,
        account_name: pos.account_name,
      });
    }
  }

  return c.json(enriched);
});

// GET /api/positions?account_id=X
account.get('/positions', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.query('account_id'));
  if (!accountId) return c.json({ detail: '需要 account_id 参数' }, 400);

  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const positions = await getPositions(c.env.DB, accountId);
  return c.json(positions);
});

// PUT /api/positions - upsert position
account.put('/positions', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.query('account_id'));
  if (!accountId) return c.json({ detail: '需要 account_id 参数' }, 400);

  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const { code, cost, shares } = await c.req.json();
  if (!code) return c.json({ detail: '基金代码不能为空' }, 400);

  await upsertPosition(c.env.DB, accountId, code, cost, shares);
  return c.json({ message: '持仓已更新' });
});

// DELETE /api/positions/:code
account.delete('/positions/:code', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.query('account_id'));
  if (!accountId) return c.json({ detail: '需要 account_id 参数' }, 400);

  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const code = c.req.param('code');
  await removePosition(c.env.DB, accountId, code);
  return c.json({ message: '持仓已删除' });
});

// POST /api/positions/update-nav
account.post('/positions/update-nav', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.query('account_id'));
  if (!accountId) return c.json({ detail: '需要 account_id 参数' }, 400);

  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const db = c.env.DB;
  const positions = await getPositions(db, accountId);

  let updated = 0;
  let failed = 0;
  const errors = [];

  for (const pos of positions) {
    try {
      const history = await getFundHistory(db, pos.code, 5);
      if (history.length > 0) updated++;
      else failed++;
    } catch (e) {
      failed++;
      errors.push(`${pos.code}: ${e.message}`);
    }
  }

  return c.json({
    message: `净值更新完成: ${updated} 成功, ${failed} 失败`,
    updated,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// ============================================================================
// Trade endpoints
// ============================================================================

// POST /api/trade/:code/buy
account.post('/trade/:code/buy', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.query('account_id'));
  if (!accountId) return c.json({ detail: '需要 account_id 参数' }, 400);

  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const code = c.req.param('code');
  const { amount, trade_time } = await c.req.json();

  if (!amount || amount <= 0) return c.json({ detail: '加仓金额必须大于 0' }, 400);

  try {
    const result = await addTrade(c.env.DB, accountId, code, amount, trade_time);
    return c.json(result);
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});

// POST /api/trade/:code/sell
account.post('/trade/:code/sell', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.query('account_id'));
  if (!accountId) return c.json({ detail: '需要 account_id 参数' }, 400);

  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const code = c.req.param('code');
  const { shares, trade_time } = await c.req.json();

  if (!shares || shares <= 0) return c.json({ detail: '减仓份额必须大于 0' }, 400);

  try {
    const result = await reduceTrade(c.env.DB, accountId, code, shares, trade_time);
    return c.json(result);
  } catch (e) {
    return c.json({ detail: e.message }, 400);
  }
});

// GET /api/transactions
account.get('/transactions', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const accountId = parseInt(c.req.query('account_id'));
  if (!accountId) return c.json({ detail: '需要 account_id 参数' }, 400);

  if (!(await verifyAccountOwnership(c.env.DB, accountId, user))) {
    return c.json({ detail: '无权操作此账户' }, 403);
  }

  const code = c.req.query('code') || null;
  const limit = parseInt(c.req.query('limit') || '100');
  const transactions = await getTransactions(c.env.DB, accountId, code, limit);
  return c.json(transactions);
});

export default account;
