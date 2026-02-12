/**
 * Data import/export service
 */

/**
 * Export user data
 */
export async function exportData(db, modules, user) {
  const data = { version: 1, exported_at: new Date().toISOString(), modules: {} };

  for (const mod of modules) {
    switch (mod) {
      case 'accounts': {
        const result = await db.prepare(
          'SELECT id, name, description, created_at, updated_at FROM accounts WHERE user_id = ?'
        ).bind(user.id).all();
        data.modules.accounts = result.results;
        break;
      }
      case 'positions': {
        const result = await db.prepare(`
          SELECT p.account_id, p.code, p.cost, p.shares, p.updated_at, a.name as account_name
          FROM positions p
          JOIN accounts a ON a.id = p.account_id
          WHERE a.user_id = ?
        `).bind(user.id).all();
        data.modules.positions = result.results;
        break;
      }
      case 'transactions': {
        const result = await db.prepare(`
          SELECT t.*
          FROM transactions t
          JOIN accounts a ON a.id = t.account_id
          WHERE a.user_id = ?
          ORDER BY t.created_at DESC
        `).bind(user.id).all();
        data.modules.transactions = result.results;
        break;
      }
      case 'ai_prompts': {
        const result = await db.prepare(
          'SELECT id, name, prompt, system_prompt, user_prompt, is_default, created_at, updated_at FROM ai_prompts WHERE user_id = ?'
        ).bind(user.id).all();
        data.modules.ai_prompts = result.results;
        break;
      }
      case 'subscriptions': {
        const result = await db.prepare(
          'SELECT * FROM subscriptions WHERE user_id = ?'
        ).bind(user.id).all();
        data.modules.subscriptions = result.results;
        break;
      }
      case 'settings': {
        const result = await db.prepare(
          'SELECT key, value, encrypted FROM settings WHERE user_id = ? AND key NOT IN (?, ?)'
        ).bind(user.id, 'OPENAI_API_KEY', 'SMTP_PASSWORD').all();
        data.modules.settings = result.results;
        break;
      }
    }
  }

  return data;
}

/**
 * Import user data
 */
export async function importData(db, data, modules, mode, user) {
  const results = {};

  for (const mod of modules) {
    const modData = data[mod] || data?.modules?.[mod];
    if (!modData || !Array.isArray(modData)) {
      results[mod] = { status: 'skipped', reason: '无数据' };
      continue;
    }

    try {
      if (mode === 'replace') {
        await clearModuleData(db, mod, user.id);
      }

      let imported = 0;
      switch (mod) {
        case 'accounts':
          for (const item of modData) {
            await db.prepare(
              'INSERT OR IGNORE INTO accounts (name, description, user_id) VALUES (?, ?, ?)'
            ).bind(item.name, item.description || '', user.id).run();
            imported++;
          }
          break;

        case 'positions':
          for (const item of modData) {
            let accountId = item.account_id;
            if (item.account_name) {
              const acc = await db.prepare(
                'SELECT id FROM accounts WHERE name = ? AND user_id = ?'
              ).bind(item.account_name, user.id).first();
              if (acc) accountId = acc.id;
            }
            if (!accountId) continue;
            await db.prepare(`
              INSERT OR REPLACE INTO positions (account_id, code, cost, shares, updated_at)
              VALUES (?, ?, ?, ?, datetime())
            `).bind(accountId, item.code, item.cost, item.shares).run();
            imported++;
          }
          break;

        case 'transactions':
          for (const item of modData) {
            await db.prepare(`
              INSERT INTO transactions (account_id, code, op_type, amount_cny, shares_redeemed, confirm_date, confirm_nav, shares_added, cost_after)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              item.account_id, item.code, item.op_type, item.amount_cny,
              item.shares_redeemed, item.confirm_date, item.confirm_nav,
              item.shares_added, item.cost_after
            ).run();
            imported++;
          }
          break;

        case 'ai_prompts':
          for (const item of modData) {
            await db.prepare(`
              INSERT OR REPLACE INTO ai_prompts (name, prompt, system_prompt, user_prompt, is_default, user_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(item.name, item.prompt || '', item.system_prompt || '', item.user_prompt || '', item.is_default || 0, user.id).run();
            imported++;
          }
          break;

        case 'subscriptions':
          for (const item of modData) {
            await db.prepare(`
              INSERT OR IGNORE INTO subscriptions (code, email, user_id, threshold_up, threshold_down, enable_digest, digest_time, enable_volatility)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(item.code, item.email, user.id, item.threshold_up, item.threshold_down, item.enable_digest || 0, item.digest_time || '14:45', item.enable_volatility ?? 1).run();
            imported++;
          }
          break;

        case 'settings':
          for (const item of modData) {
            if (item.key === 'OPENAI_API_KEY' || item.key === 'SMTP_PASSWORD') continue;
            await db.prepare(`
              INSERT OR REPLACE INTO settings (key, value, encrypted, user_id, updated_at)
              VALUES (?, ?, ?, ?, datetime())
            `).bind(item.key, item.value, item.encrypted || 0, user.id).run();
            imported++;
          }
          break;
      }

      results[mod] = { status: 'ok', imported };
    } catch (e) {
      results[mod] = { status: 'error', error: e.message };
    }
  }

  return { results };
}

async function clearModuleData(db, mod, userId) {
  switch (mod) {
    case 'accounts':
      await db.prepare('DELETE FROM accounts WHERE user_id = ?').bind(userId).run();
      break;
    case 'positions':
      await db.prepare(`
        DELETE FROM positions WHERE account_id IN (
          SELECT id FROM accounts WHERE user_id = ?
        )
      `).bind(userId).run();
      break;
    case 'transactions':
      await db.prepare(`
        DELETE FROM transactions WHERE account_id IN (
          SELECT id FROM accounts WHERE user_id = ?
        )
      `).bind(userId).run();
      break;
    case 'ai_prompts':
      await db.prepare('DELETE FROM ai_prompts WHERE user_id = ?').bind(userId).run();
      break;
    case 'subscriptions':
      await db.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(userId).run();
      break;
    case 'settings':
      await db.prepare(
        'DELETE FROM settings WHERE user_id = ? AND key NOT IN (?, ?)'
      ).bind(userId, 'OPENAI_API_KEY', 'SMTP_PASSWORD').run();
      break;
  }
}
