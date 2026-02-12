/**
 * FundVal-Live Cloudflare Workers Entry Point
 * Main Hono application with all routes mounted
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initDb } from './db.js';
import { handleScheduled } from './services/scheduler.js';

// Import routes
import authRoutes from './routes/auth.js';
import fundRoutes from './routes/funds.js';
import accountRoutes from './routes/account.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';
import dataRoutes from './routes/data.js';
import systemRoutes from './routes/system.js';

const app = new Hono();

// ============================================================================
// Middleware
// ============================================================================

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Database initialization (on first request)
let dbInitialized = false;
app.use('/api/*', async (c, next) => {
  if (!dbInitialized) {
    try {
      await initDb(c.env.DB);
      dbInitialized = true;
    } catch (e) {
      console.error(`DB init error: ${e.message}`);
      // Continue anyway - system endpoint should still work
    }
  }
  return next();
});

// ============================================================================
// API Routes
// ============================================================================

// Auth routes: /api/auth/*
app.route('/api/auth', authRoutes);

// Fund routes: /api/* (search, fund/:id, categories, etc.)
app.route('/api', fundRoutes);

// Account routes: /api/* (accounts, positions, trade, transactions)
app.route('/api', accountRoutes);

// AI routes: /api/ai/*
app.route('/api/ai', aiRoutes);

// Settings routes: /api/* (settings, preferences)
app.route('/api', settingsRoutes);

// Data routes: /api/* (data/export, data/import)
app.route('/api', dataRoutes);

// System routes: /api/system/*
app.route('/api/system', systemRoutes);

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: app.fetch,

  // Cron Triggers handler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};
