/**
 * Data import/export API routes (Hono)
 * Migrated from backend/app/routers/data.py
 */

import { Hono } from 'hono';
import { getCurrentUser } from '../auth.js';
import { exportData, importData } from '../services/data-io.js';

const data = new Hono();

const VALID_MODULES = ['accounts', 'positions', 'transactions', 'ai_prompts', 'subscriptions', 'settings'];

// GET /api/data/export?modules=accounts,positions
data.get('/data/export', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const modulesParam = c.req.query('modules');
  let moduleList;

  if (modulesParam) {
    moduleList = modulesParam.split(',').map(m => m.trim());
    const invalid = moduleList.filter(m => !VALID_MODULES.includes(m));
    if (invalid.length > 0) {
      return c.json({ detail: `Invalid modules: ${invalid.join(', ')}` }, 400);
    }
  } else {
    moduleList = VALID_MODULES;
  }

  try {
    const result = await exportData(c.env.DB, moduleList, user);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const filename = `fundval_export_${timestamp}.json`;

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=${filename}`,
      },
    });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});

// POST /api/data/import
data.post('/data/import', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ detail: '未登录' }, 401);

  const body = await c.req.json();
  const { data: importDataObj, modules, mode = 'merge' } = body;

  if (!modules || !Array.isArray(modules)) {
    return c.json({ detail: '需要指定导入模块列表' }, 400);
  }

  if (!['merge', 'replace'].includes(mode)) {
    return c.json({ detail: "Invalid mode. Must be 'merge' or 'replace'" }, 400);
  }

  const invalid = modules.filter(m => !VALID_MODULES.includes(m));
  if (invalid.length > 0) {
    return c.json({ detail: `Invalid modules: ${invalid.join(', ')}` }, 400);
  }

  try {
    const result = await importData(c.env.DB, importDataObj, modules, mode, user);
    return c.json(result);
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});

export default data;
