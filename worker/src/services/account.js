/**
 * Account and position management service
 */

/**
 * Get all accounts for a user
 */
export async function getUserAccounts(db, userId) {
  const result = await db.prepare(
    'SELECT id, name, description, created_at, updated_at FROM accounts WHERE user_id = ? ORDER BY id'
  ).bind(userId).all();
  return result.results;
}

/**
 * Create a new account
 */
export async function createAccount(db, userId, name, description = '') {
  const result = await db.prepare(
    'INSERT INTO accounts (name, description, user_id) VALUES (?, ?, ?)'
  ).bind(name, description || '', userId).run();
  return result.meta.last_row_id;
}

/**
 * Update account
 */
export async function updateAccount(db, accountId, name, description) {
  await db.prepare(
    'UPDATE accounts SET name = ?, description = ?, updated_at = datetime() WHERE id = ?'
  ).bind(name, description || '', accountId).run();
}

/**
 * Delete account (checks positions)
 */
export async function deleteAccount(db, accountId) {
  const posCount = await db.prepare(
    'SELECT COUNT(*) as cnt FROM positions WHERE account_id = ?'
  ).bind(accountId).first();

  if (posCount.cnt > 0) {
    throw new Error('该账户下仍有持仓，请先清空持仓后再删除');
  }

  await db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
}

/**
 * Get all positions for an account
 */
export async function getPositions(db, accountId) {
  const result = await db.prepare(
    'SELECT code, cost, shares, updated_at FROM positions WHERE account_id = ? ORDER BY code'
  ).bind(accountId).all();
  return result.results;
}

/**
 * Get all positions across accounts for a user (aggregated)
 */
export async function getAggregatePositions(db, userId) {
  const result = await db.prepare(`
    SELECT p.code, p.cost, p.shares, p.account_id, p.updated_at, a.name as account_name
    FROM positions p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.user_id = ?
    ORDER BY p.code
  `).bind(userId).all();
  return result.results;
}

/**
 * Upsert position
 */
export async function upsertPosition(db, accountId, code, cost, shares) {
  await db.prepare(`
    INSERT INTO positions (account_id, code, cost, shares, updated_at)
    VALUES (?, ?, ?, ?, datetime())
    ON CONFLICT(account_id, code) DO UPDATE SET
      cost = excluded.cost,
      shares = excluded.shares,
      updated_at = datetime()
  `).bind(accountId, code, cost, shares).run();
}

/**
 * Remove position
 */
export async function removePosition(db, accountId, code) {
  await db.prepare(
    'DELETE FROM positions WHERE account_id = ? AND code = ?'
  ).bind(accountId, code).run();
}

/**
 * Add trade (buy more)
 */
export async function addTrade(db, accountId, code, amountCny, tradeTime = null) {
  const now = new Date();
  const confirmDate = getConfirmDate(tradeTime ? new Date(tradeTime) : now);

  await db.prepare(`
    INSERT INTO transactions (account_id, code, op_type, amount_cny, confirm_date)
    VALUES (?, ?, 'buy', ?, ?)
  `).bind(accountId, code, amountCny, confirmDate).run();

  return { confirm_date: confirmDate, message: `加仓 ¥${amountCny}，确认日: ${confirmDate}` };
}

/**
 * Reduce trade (sell)
 */
export async function reduceTrade(db, accountId, code, shares, tradeTime = null) {
  const position = await db.prepare(
    'SELECT shares FROM positions WHERE account_id = ? AND code = ?'
  ).bind(accountId, code).first();

  if (!position || position.shares < shares) {
    throw new Error('持仓份额不足');
  }

  const now = new Date();
  const confirmDate = getConfirmDate(tradeTime ? new Date(tradeTime) : now);

  await db.prepare(`
    INSERT INTO transactions (account_id, code, op_type, shares_redeemed, confirm_date)
    VALUES (?, ?, 'sell', ?, ?)
  `).bind(accountId, code, shares, confirmDate).run();

  return { confirm_date: confirmDate, message: `减仓 ${shares} 份，确认日: ${confirmDate}` };
}

/**
 * Get transactions for an account
 */
export async function getTransactions(db, accountId, code = null, limit = 100) {
  let query = 'SELECT * FROM transactions WHERE account_id = ?';
  const params = [accountId];

  if (code) {
    query += ' AND code = ?';
    params.push(code);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(query);
  const result = await stmt.bind(...params).all();
  return result.results;
}

/**
 * Get T+1 confirm date
 */
function getConfirmDate(submitDate) {
  const d = new Date(submitDate);
  d.setDate(d.getDate() + 1);

  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }

  return d.toISOString().slice(0, 10);
}
