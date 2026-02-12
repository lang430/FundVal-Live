/**
 * Subscription management service
 */

/**
 * Get subscriptions for a user
 */
export async function getSubscriptions(db, userId) {
  const result = await db.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return result.results;
}

/**
 * Add or update subscription
 */
export async function upsertSubscription(db, userId, code, email, thresholdUp, thresholdDown, options = {}) {
  const {
    enableDigest = 0,
    digestTime = '14:45',
    enableVolatility = 1,
  } = options;

  await db.prepare(`
    INSERT INTO subscriptions (code, email, user_id, threshold_up, threshold_down, enable_digest, digest_time, enable_volatility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code, email, user_id) DO UPDATE SET
      threshold_up = excluded.threshold_up,
      threshold_down = excluded.threshold_down,
      enable_digest = excluded.enable_digest,
      digest_time = excluded.digest_time,
      enable_volatility = excluded.enable_volatility
  `).bind(code, email, userId, thresholdUp, thresholdDown, enableDigest, digestTime, enableVolatility).run();
}

/**
 * Delete subscription
 */
export async function deleteSubscription(db, userId, subscriptionId) {
  await db.prepare(
    'DELETE FROM subscriptions WHERE id = ? AND user_id = ?'
  ).bind(subscriptionId, userId).run();
}

/**
 * Check subscriptions and trigger alerts
 */
export async function checkSubscriptions(db, env) {
  const result = await db.prepare(
    'SELECT s.*, f.name as fund_name FROM subscriptions s LEFT JOIN funds f ON s.code = f.code'
  ).all();

  const { getCombinedValuation } = await import('./fund.js');

  for (const sub of result.results) {
    try {
      const valuation = await getCombinedValuation(db, sub.code);
      if (!valuation || !valuation.estRate) continue;

      const estRate = parseFloat(valuation.estRate);
      let shouldNotify = false;
      let reason = '';

      if (sub.threshold_up && estRate >= sub.threshold_up) {
        shouldNotify = true;
        reason = `涨幅达到 ${estRate}%，超过阈值 ${sub.threshold_up}%`;
      } else if (sub.threshold_down && estRate <= -Math.abs(sub.threshold_down)) {
        shouldNotify = true;
        reason = `跌幅达到 ${estRate}%，超过阈值 -${Math.abs(sub.threshold_down)}%`;
      }

      if (shouldNotify) {
        // Check if already notified recently (within 1 hour)
        if (sub.last_notified_at) {
          const lastNotified = new Date(sub.last_notified_at);
          if (Date.now() - lastNotified.getTime() < 60 * 60 * 1000) continue;
        }

        // Send notification
        const { sendNotificationEmail } = await import('./email.js');
        await sendNotificationEmail(env, sub.email, {
          fundCode: sub.code,
          fundName: sub.fund_name || sub.code,
          estRate,
          reason,
          estimate: valuation.estimate,
          nav: valuation.nav,
        });

        // Update last_notified_at
        await db.prepare(
          'UPDATE subscriptions SET last_notified_at = datetime() WHERE id = ?'
        ).bind(sub.id).run();
      }
    } catch (e) {
      console.error(`Subscription check failed for ${sub.code}: ${e.message}`);
    }
  }
}
