import { Router } from 'express';
import { getDb, toObjectId } from '../db.js';
const router = Router();
const LIST_PROJECTION = { days: 0 };
router.get('/programs', async (req, res, next) => {
  try {
    const items = await getDb().collection('programs')
      .find({ published: true }, { projection: LIST_PROJECTION })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ items });
  } catch (err) { next(err); }
});
router.get('/programs/:id', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ error: 'not found' });
    const item = await getDb().collection('programs').findOne({ _id, published: true });
    if (!item) return res.status(404).json({ error: 'not found' });
    return res.json({ item });
  } catch (err) { return next(err); }
});
router.get('/meal-plans', async (req, res, next) => {
  try {
    const items = await getDb().collection('mealPlans')
      .find({ published: true }, { projection: LIST_PROJECTION })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ items });
  } catch (err) { next(err); }
});
router.get('/meal-plans/:id', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ error: 'not found' });
    const item = await getDb().collection('mealPlans').findOne({ _id, published: true });
    if (!item) return res.status(404).json({ error: 'not found' });
    return res.json({ item });
  } catch (err) { return next(err); }
});
export default router;
