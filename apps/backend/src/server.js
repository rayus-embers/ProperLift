import express from 'express';
import os from 'node:os';
import { config } from './config.js';
import { connectWithRetry, ping, closeDb } from './db.js';
import { seed } from './seed.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import meRoutes from './routes/me.js';
import coachRoutes from './routes/coach.js';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
let shuttingDown = false;
app.get('/api/healthz', (req, res) => res.json({ status: 'ok' }));
app.get('/api/readyz', async (req, res) => {
  if (shuttingDown) return res.status(503).json({ status: 'shutting-down' });
  const dbOk = await ping();
  return res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ready' : 'db-unavailable', pod: os.hostname() });
});
app.get('/api/whoami', (req, res) => res.json({ pod: os.hostname() }));
app.use('/api', express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/me', meRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(`[error] ${req.method} ${req.path}:`, err);
  res.status(status).json({ error: status >= 500 ? 'internal error' : err.message });
});
const server = app.listen(config.port, () => {
  console.log(`[http] listening on :${config.port} (pod ${os.hostname()})`);
});
server.keepAliveTimeout = 65_000;
connectWithRetry(config.mongoUri, (db) => seed(db, config.seed)).catch((err) => {
  console.error('[db] fatal', err);
  process.exit(1);
});
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[http] ${signal} received, draining connections`);
  server.close(async () => {
    await closeDb().catch(() => {});
    console.log('[http] bye');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 20_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
