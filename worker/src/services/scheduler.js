/**
 * Scheduled tasks (Cloudflare Cron Triggers)
 * Replaces Python threading-based scheduler
 */

import { fetchAndUpdateFunds, getCombinedValuation } from './fund.js';
import { checkSubscriptions } from './subscription.js';
import { getNavOnDate } from './fund.js';

/**
 * Main scheduled event handler
 * Called by Cloudflare Cron Triggers
 */
export async function handleScheduled(event, env) {
  const db = env.DB;

  // Get current time in CST (UTC+8)
  const now = new Date();
  const cstHour = (now.getUTCHours() + 8) % 24;
  const cstMinute = now.getUTCMinutes();
  const dayOfWeek = new Date(now.getTime() + 8 * 60 * 60 * 1000).getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  console.log(`Cron triggered at CST ${cstHour}:${String(cstMinute).padStart(2, '0')} (day=${dayOfWeek})`);

  try {
    // Daily tasks (run once at 8:00 CST)
    if (cstHour === 8 && cstMinute < 10) {
      await dailyTasks(db, env);
    }

    // Trading hours tasks (9:30-15:00 weekdays)
    if (isWeekday && cstHour >= 9 && cstHour < 16) {
      await tradingHoursTasks(db, env, cstHour, cstMinute);
    }

    // Post-market tasks (16:00-22:00 weekdays)
    if (isWeekday && cstHour >= 16 && cstHour <= 22) {
      await postMarketTasks(db, env, cstHour);
    }
  } catch (e) {
    console.error(`Scheduled task error: ${e.message}`);
  }
}

/**
 * Daily tasks: update fund list, cleanup
 */
async function dailyTasks(db, env) {
  console.log('Running daily tasks...');

  // Update fund list from Eastmoney
  try {
    await fetchAndUpdateFunds(db);
  } catch (e) {
    console.error(`Fund list update failed: ${e.message}`);
  }

  // Cleanup old snapshots (keep last 30 days)
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.prepare('DELETE FROM fund_intraday_snapshots WHERE date < ?').bind(cutoff).run();
    console.log('Old snapshots cleaned up');
  } catch (e) {
    console.error(`Snapshot cleanup failed: ${e.message}`);
  }
}

/**
 * Trading hours tasks: collect intraday data, check subscriptions
 */
async function tradingHoursTasks(db, env, cstHour, cstMinute) {
  // Only during actual trading hours (9:30-11:30, 13:00-15:00)
  const inTradeSession =
    (cstHour === 9 && cstMinute >= 30) ||
    (cstHour === 10) ||
    (cstHour === 11 && cstMinute <= 30) ||
    (cstHour >= 13 && cstHour < 15);

  if (!inTradeSession) return;

  // Collect intraday snapshots for all positions
  try {
    const positions = await db.prepare(`
      SELECT DISTINCT p.code
      FROM positions p
      JOIN accounts a ON a.id = p.account_id
    `).all();

    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const timeStr = `${String(cstHour).padStart(2, '0')}:${String(cstMinute).padStart(2, '0')}`;

    for (const { code } of positions.results) {
      try {
        const valuation = await getCombinedValuation(db, code);
        if (valuation && valuation.estimate > 0) {
          await db.prepare(`
            INSERT OR REPLACE INTO fund_intraday_snapshots (fund_code, date, time, estimate)
            VALUES (?, ?, ?, ?)
          `).bind(code, today, timeStr, valuation.estimate).run();
        }
      } catch (e) {
        console.warn(`Snapshot failed for ${code}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`Intraday collection failed: ${e.message}`);
  }

  // Check subscriptions
  try {
    await checkSubscriptions(db, env);
  } catch (e) {
    console.error(`Subscription check failed: ${e.message}`);
  }
}

/**
 * Post-market tasks: confirm transactions, update NAVs
 */
async function postMarketTasks(db, env, cstHour) {
  // Run once at 16:00
  if (cstHour !== 16) return;

  console.log('Running post-market tasks...');

  // Process pending transactions (T+1 confirmation)
  try {
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const pending = await db.prepare(`
      SELECT * FROM transactions
      WHERE applied_at IS NULL AND confirm_date <= ?
      ORDER BY confirm_date
    `).bind(today).all();

    for (const tx of pending.results) {
      try {
        const nav = await getNavOnDate(db, tx.code, tx.confirm_date);
        if (!nav) continue; // NAV not yet available

        if (tx.op_type === 'buy') {
          // Calculate shares bought
          const sharesBought = tx.amount_cny / nav;

          // Get current position
          const pos = await db.prepare(
            'SELECT cost, shares FROM positions WHERE account_id = ? AND code = ?'
          ).bind(tx.account_id, tx.code).first();

          const currentCost = pos ? pos.cost : 0;
          const currentShares = pos ? pos.shares : 0;
          const totalCost = currentCost + tx.amount_cny;
          const totalShares = currentShares + sharesBought;

          // Update position
          await db.prepare(`
            INSERT INTO positions (account_id, code, cost, shares, updated_at)
            VALUES (?, ?, ?, ?, datetime())
            ON CONFLICT(account_id, code) DO UPDATE SET
              cost = excluded.cost,
              shares = excluded.shares,
              updated_at = datetime()
          `).bind(tx.account_id, tx.code, totalCost, totalShares).run();

          // Update transaction
          await db.prepare(`
            UPDATE transactions SET confirm_nav = ?, shares_added = ?, cost_after = ?, applied_at = datetime()
            WHERE id = ?
          `).bind(nav, sharesBought, totalCost, tx.id).run();

        } else if (tx.op_type === 'sell') {
          // Calculate redemption value
          const pos = await db.prepare(
            'SELECT cost, shares FROM positions WHERE account_id = ? AND code = ?'
          ).bind(tx.account_id, tx.code).first();

          if (!pos || pos.shares < tx.shares_redeemed) continue;

          const costPerShare = pos.shares > 0 ? pos.cost / pos.shares : 0;
          const costReduced = costPerShare * tx.shares_redeemed;
          const newCost = Math.max(0, pos.cost - costReduced);
          const newShares = pos.shares - tx.shares_redeemed;

          if (newShares <= 0.001) {
            await db.prepare(
              'DELETE FROM positions WHERE account_id = ? AND code = ?'
            ).bind(tx.account_id, tx.code).run();
          } else {
            await db.prepare(`
              UPDATE positions SET cost = ?, shares = ?, updated_at = datetime()
              WHERE account_id = ? AND code = ?
            `).bind(newCost, newShares, tx.account_id, tx.code).run();
          }

          // Update transaction
          await db.prepare(`
            UPDATE transactions SET confirm_nav = ?, cost_after = ?, applied_at = datetime()
            WHERE id = ?
          `).bind(nav, newCost, tx.id).run();
        }
      } catch (e) {
        console.error(`Transaction processing failed for tx ${tx.id}: ${e.message}`);
      }
    }

    console.log(`Processed ${pending.results.length} pending transactions`);
  } catch (e) {
    console.error(`Transaction processing failed: ${e.message}`);
  }
}
