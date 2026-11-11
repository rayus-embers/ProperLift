import { MongoClient, ObjectId } from 'mongodb';
let client = null;
let db = null;
export async function connectWithRetry(uri, onConnected) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        retryWrites: true,
        retryReads: true,
        writeConcern: { w: 'majority' },
        maxPoolSize: 20,
      });
      await client.connect();
      db = client.db();
      await ensureIndexes();
      console.log(`[db] connected (attempt ${attempt})`);
      if (onConnected) await onConnected(db);
      return db;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt} failed: ${err.message}`);
      try { await client?.close(); } catch {  }
      client = null;
      db = null;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
async function ensureIndexes() {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('programs').createIndex({ slug: 1 }, { unique: true, sparse: true });
  await db.collection('mealPlans').createIndex({ slug: 1 }, { unique: true, sparse: true });
  await db.collection('logs').createIndex({ userId: 1, type: 1, date: 1 }, { unique: true });
}
export function getDb() {
  if (!db) {
    const err = new Error('database not ready');
    err.status = 503;
    throw err;
  }
  return db;
}
export async function ping() {
  if (!db) return false;
  try {
    await db.command({ ping: 1 }, { timeoutMS: 2000 });
    return true;
  } catch {
    return false;
  }
}
export async function closeDb() {
  if (client) await client.close();
}
export function toObjectId(id) {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}
export { ObjectId };
