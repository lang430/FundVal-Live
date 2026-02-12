/**
 * System API routes (Hono)
 * Migrated from backend/app/routers/system.py
 */

import { Hono } from 'hono';
import { checkDatabaseVersion, CURRENT_SCHEMA_VERSION, dropAllTables, initDb, getAllTables } from '../db.js';

const system = new Hono();

// GET /api/system/db-status
system.get('/db-status', async (c) => {
  const db = c.env.DB;

  try {
    const version = await checkDatabaseVersion(db);
    const needsRebuild = version > 0 && version !== CURRENT_SCHEMA_VERSION;
    const tables = await getAllTables(db);

    return c.json({
      version,
      current_version: CURRENT_SCHEMA_VERSION,
      needs_rebuild: needsRebuild,
      table_count: tables.length,
    });
  } catch (e) {
    return c.json({ detail: `Failed to check database status: ${e.message}` }, 500);
  }
});

// POST /api/system/rebuild-db
system.post('/rebuild-db', async (c) => {
  const db = c.env.DB;

  try {
    const version = await checkDatabaseVersion(db);

    if (version === CURRENT_SCHEMA_VERSION) {
      return c.json({ detail: 'Database is already at current version, no rebuild needed' }, 400);
    }

    console.warn(`Rebuilding database (current version: ${version}, target: ${CURRENT_SCHEMA_VERSION})`);

    await dropAllTables(db);
    await initDb(db);

    const newVersion = await checkDatabaseVersion(db);
    if (newVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(`Rebuild failed: version is ${newVersion}, expected ${CURRENT_SCHEMA_VERSION}`);
    }

    return c.json({
      message: 'Database rebuilt successfully',
      version: newVersion,
    });
  } catch (e) {
    if (e.message?.includes('already at current version')) {
      return c.json({ detail: e.message }, 400);
    }
    return c.json({ detail: `Failed to rebuild database: ${e.message}` }, 500);
  }
});

export default system;
