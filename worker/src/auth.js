/**
 * Authentication module using Web Crypto API + KV sessions
 * Replaces Python bcrypt + in-memory sessions
 */

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Hash password using PBKDF2 (Web Crypto API)
 * Returns format: iterations:salt_b64:hash_b64
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));

  return `${iterations}:${saltB64}:${hashB64}`;
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password, storedHash) {
  try {
    const [iterationsStr, saltB64, expectedHashB64] = storedHash.split(':');
    const iterations = parseInt(iterationsStr);
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const hash = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return hashB64 === expectedHashB64;
  } catch {
    return false;
  }
}

/**
 * Check if any admin user exists
 */
export async function hasAdminUser(db) {
  const row = await db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').first();
  return row.count > 0;
}

/**
 * Create a session in KV store
 */
export async function createSession(kv, userId) {
  const sessionId = crypto.randomUUID() + '-' + crypto.randomUUID();

  await kv.put(`session:${sessionId}`, JSON.stringify({
    userId,
    createdAt: Date.now(),
  }), {
    expirationTtl: SESSION_EXPIRY_SECONDS,
  });

  return sessionId;
}

/**
 * Get user ID from session
 */
export async function getSessionUser(kv, sessionId) {
  if (!sessionId) return null;

  const data = await kv.get(`session:${sessionId}`, 'json');
  if (!data) return null;

  // Renew session on access (sliding window)
  await kv.put(`session:${sessionId}`, JSON.stringify(data), {
    expirationTtl: SESSION_EXPIRY_SECONDS,
  });

  return data.userId;
}

/**
 * Delete session
 */
export async function deleteSession(kv, sessionId) {
  if (sessionId) {
    await kv.delete(`session:${sessionId}`);
  }
}

/**
 * Get user by ID
 */
async function getUserById(db, userId) {
  const row = await db.prepare(
    'SELECT id, username, is_admin FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!row) return null;
  return { id: row.id, username: row.username, isAdmin: !!row.is_admin };
}

/**
 * Get current user from request cookies
 */
export async function getCurrentUser(c) {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;

  const userId = await getSessionUser(c.env.SESSION_KV, sessionId);
  if (!userId) return null;

  return getUserById(c.env.DB, userId);
}

/**
 * Middleware: require authentication
 */
export async function requireAuth(c, next) {
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ detail: '未登录' }, 401);
  }
  c.set('user', user);
  if (next) return next();
  return user;
}

/**
 * Middleware: require admin
 */
export async function requireAdmin(c, next) {
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ detail: '未登录' }, 401);
  }
  if (!user.isAdmin) {
    return c.json({ detail: '权限不足' }, 403);
  }
  c.set('user', user);
  if (next) return next();
  return user;
}

/**
 * Verify account ownership
 */
export async function verifyAccountOwnership(db, accountId, user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const row = await db.prepare(
    'SELECT user_id FROM accounts WHERE id = ?'
  ).bind(accountId).first();

  if (!row) return false;
  return row.user_id === user.id;
}

/**
 * Helper: get cookie value from request
 */
function getCookie(c, name) {
  const cookieHeader = c.req.header('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=');
    if (key.trim() === name) {
      return valueParts.join('=').trim();
    }
  }
  return null;
}

/**
 * Helper: set session cookie on response
 */
export function setSessionCookie(c, sessionId) {
  c.header('Set-Cookie',
    `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_EXPIRY_SECONDS}`
  );
}

/**
 * Helper: clear session cookie
 */
export function clearSessionCookie(c) {
  c.header('Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export { SESSION_COOKIE_NAME, getUserById };
