import express, { Router } from 'express';
import { getDb, toObjectId } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { sanitizeProgram, sanitizeMealPlan, slugify } from '../validate.js';
import { uploadMedia, ALLOWED_TYPES } from '../storage.js';
import { config } from '../config.js';
const router = Router();
router.use(requireAuth, requireRole('coach'));
function crud(path, collectionName, sanitize) {
  router.get(`/${path}`, async (req, res, next) => {
    try {
      const items = await getDb().collection(collectionName)
        .find({}, { projection: { days: 0 } }).sort({ updatedAt: -1 }).toArray();
      res.json({ items });
    } catch (err) { next(err); }
  });
  router.get(`/${path}/:id`, async (req, res, next) => {
    try {
      const _id = toObjectId(req.params.id);
      const item = _id && await getDb().collection(collectionName).findOne({ _id });
      if (!item) return res.status(404).json({ error: 'not found' });
      return res.json({ item });
    } catch (err) { return next(err); }
  });
  router.post(`/${path}`, async (req, res, next) => {
    try {
      const doc = sanitize(req.body);
      if (!doc.title) return res.status(400).json({ error: 'title is required' });
      const now = new Date();
      Object.assign(doc, {
        slug: `${slugify(doc.title)}-${now.getTime().toString(36)}`,
        createdBy: toObjectId(req.user.id),
        createdAt: now,
        updatedAt: now,
      });
      const { insertedId } = await getDb().collection(collectionName).insertOne(doc);
      return res.status(201).json({ item: { ...doc, _id: insertedId } });
    } catch (err) { return next(err); }
  });
  router.put(`/${path}/:id`, async (req, res, next) => {
    try {
      const _id = toObjectId(req.params.id);
      if (!_id) return res.status(404).json({ error: 'not found' });
      const doc = sanitize(req.body);
      if (!doc.title) return res.status(400).json({ error: 'title is required' });
      const item = await getDb().collection(collectionName).findOneAndUpdate(
        { _id }, { $set: { ...doc, updatedAt: new Date() } }, { returnDocument: 'after' },
      );
      if (!item) return res.status(404).json({ error: 'not found' });
      return res.json({ item });
    } catch (err) { return next(err); }
  });
  router.delete(`/${path}/:id`, async (req, res, next) => {
    try {
      const _id = toObjectId(req.params.id);
      if (!_id) return res.status(404).json({ error: 'not found' });
      const field = collectionName === 'programs' ? 'enrollment.programId' : 'enrollment.mealPlanId';
      const enrolled = await getDb().collection('users').countDocuments({ [field]: _id });
      if (enrolled > 0) {
        return res.status(409).json({ error: `${enrolled} client(s) are enrolled; unpublish it instead of deleting` });
      }
      await getDb().collection(collectionName).deleteOne({ _id });
      return res.status(204).end();
    } catch (err) { return next(err); }
  });
}
crud('programs', 'programs', sanitizeProgram);
crud('meal-plans', 'mealPlans', sanitizeMealPlan);
router.get('/clients', async (req, res, next) => {
  try {
    const db = getDb();
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const clients = await db.collection('users').aggregate([
      { $match: { role: 'client' } },
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
      { $lookup: { from: 'programs', localField: 'enrollment.programId', foreignField: '_id', as: 'program', pipeline: [{ $project: { title: 1 } }] } },
      { $lookup: { from: 'mealPlans', localField: 'enrollment.mealPlanId', foreignField: '_id', as: 'mealPlan', pipeline: [{ $project: { title: 1 } }] } },
      { $lookup: {
        from: 'logs',
        let: { uid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$userId', '$$uid'] } } },
          { $sort: { date: -1 } },
          { $group: {
            _id: null,
            weights: { $push: { $cond: [{ $eq: ['$type', 'weight'] }, { value: '$value', date: '$date' }, '$$REMOVE'] } },
            workouts7: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'workout'] }, { $gte: ['$date', since] }, '$value'] }, 1, 0] } },
            lastActive: { $max: '$date' },
          } },
        ],
        as: 'stats',
      } },
      { $project: {
        name: 1, email: 1, createdAt: 1, profile: 1, enrollment: 1,
        program: { $first: '$program.title' },
        mealPlan: { $first: '$mealPlan.title' },
        lastWeight: { $first: { $first: '$stats.weights' } },
        firstWeight: { $last: { $first: '$stats.weights' } },
        workouts7: { $ifNull: [{ $first: '$stats.workouts7' }, 0] },
        lastActive: { $first: '$stats.lastActive' },
      } },
    ]).toArray();
    res.json({ items: clients });
  } catch (err) { next(err); }
});
router.get('/stats', async (req, res, next) => {
  try {
    const db = getDb();
    const [clients, programs, mealPlans] = await Promise.all([
      db.collection('users').countDocuments({ role: 'client' }),
      db.collection('programs').countDocuments({}),
      db.collection('mealPlans').countDocuments({}),
    ]);
    res.json({ clients, programs, mealPlans });
  } catch (err) { next(err); }
});
router.post(
  '/media',
  express.raw({ type: Object.keys(ALLOWED_TYPES), limit: `${config.maxUploadMb}mb` }),
  async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: `send a file with one of: ${Object.keys(ALLOWED_TYPES).join(', ')}` });
      }
      const contentType = req.get('content-type').split(';')[0].trim();
      const result = await uploadMedia(req.body, contentType);
      return res.status(201).json(result);
    } catch (err) { return next(err); }
  },
);
export default router;
