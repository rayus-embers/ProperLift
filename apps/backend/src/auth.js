import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(expected, actual);
}
export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtTtl, issuer: 'properlift', algorithm: 'HS256' },
  );
}
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'authentication required' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'properlift', algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  };
}
const buckets = new Map();
export function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || entry.reset < now) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'too many attempts, try again later' });
    }
    return next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}, 60_000).unref();
