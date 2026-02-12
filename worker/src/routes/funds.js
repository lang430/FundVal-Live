/**
 * Fund API routes (Hono)
 * Migrated from backend/app/routers/funds.py
 */

import { Hono } from 'hono';
import { getCurrentUser } from '../auth.js';
import {
  searchFunds, getFundIntraday, getFundHistory,
  getCombinedValuation, calculateTechnicalIndicators,
  getFundCategory,
} from '../services/fund.js';
import { upsertSubscription, getSubscriptions, deleteSubscription } from '../services/subscription.js';

const funds = new Hono();

// GET /api/search?q=xxx
funds.get('/search', async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q) return c.json([]);

  const results = await searchFunds(c.env.DB, q);
  return c.json(results);
});

// GET /api/fund/:id
funds.get('/fund/:id', async (c) => {
  const fundId = c.req.param('id');
  try {
    const data = await getFundIntraday(c.env.DB, fundId);
    return c.json(data);
  } catch (e) {
    console.error(`Fund detail error for ${fundId}: ${e.message}`);
    return c.json({ detail: `获取基金详情失败: ${e.message}` }, 500);
  }
});

// GET /api/fund/:id/history?limit=30
funds.get('/fund/:id/history', async (c) => {
  const fundId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '30');

  try {
    const history = await getFundHistory(c.env.DB, fundId, limit);
    return c.json(history);
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});

// GET /api/fund/:id/intraday
funds.get('/fund/:id/intraday', async (c) => {
  const fundId = c.req.param('id');
  const db = c.env.DB;

  try {
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await db.prepare(
      'SELECT time, estimate FROM fund_intraday_snapshots WHERE fund_code = ? AND date = ? ORDER BY time'
    ).bind(fundId, today).all();

    return c.json(result.results.map(r => ({
      time: r.time,
      estimate: r.estimate,
    })));
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});

// GET /api/fund/:id/backtest?period=30|90|180|365
funds.get('/fund/:id/backtest', async (c) => {
  const fundId = c.req.param('id');
  const period = parseInt(c.req.query('period') || '30');
  const db = c.env.DB;

  try {
    const history = await getFundHistory(db, fundId, period);
    if (!history || history.length === 0) {
      return c.json({ detail: '无历史数据' }, 404);
    }

    const indicators = calculateTechnicalIndicators(history);

    // Build chart data
    const chartData = history.map(item => ({
      date: item.date,
      nav: item.nav,
    }));

    // Calculate period returns
    const startNav = history[0].nav;
    const endNav = history[history.length - 1].nav;
    const totalReturn = ((endNav - startNav) / startNav * 100).toFixed(2);

    return c.json({
      period,
      total_return: `${totalReturn}%`,
      start_nav: startNav,
      end_nav: endNav,
      data_points: history.length,
      indicators,
      chart_data: chartData,
    });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});

// POST /api/fund/:id/subscribe
funds.post('/fund/:id/subscribe', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const fundId = c.req.param('id');
  const body = await c.req.json();
  const { email, threshold_up, threshold_down, enable_digest, digest_time, enable_volatility } = body;

  if (!email) return c.json({ detail: '邮箱不能为空' }, 400);

  try {
    await upsertSubscription(c.env.DB, user.id, fundId, email, threshold_up, threshold_down, {
      enableDigest: enable_digest ? 1 : 0,
      digestTime: digest_time || '14:45',
      enableVolatility: enable_volatility !== false ? 1 : 0,
    });

    return c.json({ status: 'ok', message: '订阅已激活' });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});

// GET /api/subscriptions
funds.get('/subscriptions', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const subs = await getSubscriptions(c.env.DB, user.id);
  return c.json(subs);
});

// DELETE /api/subscriptions/:id
funds.delete('/subscriptions/:id', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const subId = parseInt(c.req.param('id'));
  await deleteSubscription(c.env.DB, user.id, subId);
  return c.json({ message: '已取消订阅' });
});

// GET /api/categories
funds.get('/categories', async (c) => {
  const categories = ['偏股类', '偏债类', '货币类', '商品类', '未分类'];
  return c.json(categories);
});

export default funds;
