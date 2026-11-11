import { Router } from 'express';
import { getDb, toObjectId } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth, rateLimit } from '../auth.js';
import { str } from '../validate.js';
const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function publicUser(u) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    profile: u.profile || {},
    enrollment: u.enrollment || {},
    createdAt: u.createdAt,
  };
}
router.post('/register', limiter, async (req, res, next) => {
  try {
    const name = str(req.body?.name, 80);
    const email = str(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!name || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'name and a valid email are required' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'password must be 8-200 characters' });
    const user = {
      name,
      email,
      role: 'client',
      passwordHash: hashPassword(password),
      profile: {},
      enrollment: {},
      createdAt: new Date(),
    };
    try {
      const { insertedId } = await getDb().collection('users').insertOne(user);
      user._id = insertedId;
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'an account with this email already exists' });
      throw err;
    }
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { return next(err); }
});
router.post('/login', limiter, async (req, res, next) => {
  try {
    const email = str(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = await getDb().collection('users').findOne({ email });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'invalid email or password' });
    }
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { return next(err); }
});
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getDb().collection('users').findOne({ _id: toObjectId(req.user.id) });
    if (!user) return res.status(404).json({ error: 'user not found' });
    return res.json({ user: publicUser(user) });
  } catch (err) { return next(err); }
});
export default router;
