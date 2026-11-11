import { Router } from 'express';
import { getDb, toObjectId } from '../db.js';
import { requireAuth } from '../auth.js';
import { num, str, oneOf, isoDate, LOG_TYPES } from '../validate.js';
import { publicUser } from './auth.js';
const router = Router();
router.use(requireAuth);
const DAY_MS = 24 * 60 * 60 * 1000;
function daysSince(isoStart, today) {
  if (!isoStart) return 0;
  const diff = Date.parse(today) - Date.parse(isoStart);
  return Math.max(0, Math.floor(diff / DAY_MS));
}
router.get('/dashboard', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = toObjectId(req.user.id);
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: 'user not found' });
    const today = isoDate(req.query.date);
    const enr = user.enrollment || {};
    const [program, mealPlan] = await Promise.all([
      enr.programId ? db.collection('programs').findOne({ _id: enr.programId }) : null,
      enr.mealPlanId ? db.collection('mealPlans').findOne({ _id: enr.mealPlanId }) : null,
    ]);
    let workout = null;
    if (program?.days?.length) {
      const dayNumber = daysSince(enr.programStart, today);
      const index = dayNumber % program.days.length;
      workout = { dayNumber: dayNumber + 1, week: Math.floor(dayNumber / 7) + 1, index, ...program.days[index] };
    }
    let meals = null;
    if (mealPlan?.days?.length) {
      const dayNumber = daysSince(enr.mealStart, today);
      const index = dayNumber % mealPlan.days.length;
      const day = mealPlan.days[index];
      const totals = day.meals.reduce((t, m) => ({
        kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat,
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
      meals = { dayNumber: dayNumber + 1, index, totals, ...day };
    }
    const since = new Date(Date.parse(today) - 90 * DAY_MS).toISOString().slice(0, 10);
    const logs = await db.collection('logs')
      .find({ userId, date: { $gte: since, $lte: today } })
      .sort({ date: 1 })
      .toArray();
    const todayLogs = Object.fromEntries(logs.filter((l) => l.date === today).map((l) => [l.type, l.value]));
    const last7 = new Date(Date.parse(today) - 6 * DAY_MS).toISOString().slice(0, 10);
    res.json({
      today,
      user: publicUser(user),
      program: program ? { _id: program._id, title: program.title, daysInCycle: program.days.length, level: program.level, goal: program.goal } : null,
      mealPlan: mealPlan ? { _id: mealPlan._id, title: mealPlan.title, targetCalories: mealPlan.targetCalories, diet: mealPlan.diet } : null,
      workout,
      meals,
      todayLogs,
      weights: logs.filter((l) => l.type === 'weight').map((l) => ({ date: l.date, value: l.value })),
      workoutsLast7: logs.filter((l) => l.type === 'workout' && l.date >= last7 && l.value).length,
    });
  } catch (err) { next(err); }
});
router.put('/enrollment', async (req, res, next) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const set = {};
    const unset = {};
    if ('programId' in (req.body || {})) {
      if (req.body.programId === null) {
        unset['enrollment.programId'] = '';
        unset['enrollment.programStart'] = '';
      } else {
        const _id = toObjectId(req.body.programId);
        const exists = _id && await db.collection('programs').countDocuments({ _id, published: true });
        if (!exists) return res.status(404).json({ error: 'program not found' });
        set['enrollment.programId'] = _id;
        set['enrollment.programStart'] = today;
      }
    }
    if ('mealPlanId' in (req.body || {})) {
      if (req.body.mealPlanId === null) {
        unset['enrollment.mealPlanId'] = '';
        unset['enrollment.mealStart'] = '';
      } else {
        const _id = toObjectId(req.body.mealPlanId);
        const exists = _id && await db.collection('mealPlans').countDocuments({ _id, published: true });
        if (!exists) return res.status(404).json({ error: 'meal plan not found' });
        set['enrollment.mealPlanId'] = _id;
        set['enrollment.mealStart'] = today;
      }
    }
    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (!Object.keys(update).length) return res.status(400).json({ error: 'nothing to update' });
    const user = await db.collection('users').findOneAndUpdate(
      { _id: toObjectId(req.user.id) }, update, { returnDocument: 'after' },
    );
    return res.json({ user: publicUser(user) });
  } catch (err) { return next(err); }
});
router.put('/profile', async (req, res, next) => {
  try {
    const b = req.body || {};
    const profile = {
      sex: oneOf(b.sex, ['male', 'female'], 'male'),
      age: num(b.age, { min: 13, max: 100, fallback: 30 }),
      heightCm: num(b.heightCm, { min: 100, max: 250, fallback: 175 }),
      weightKg: num(b.weightKg, { min: 30, max: 300, fallback: 75 }),
      activity: oneOf(b.activity, ['sedentary', 'light', 'moderate', 'active', 'very-active'], 'moderate'),
      goal: oneOf(b.goal, ['fat-loss', 'maintenance', 'muscle-gain'], 'maintenance'),
    };
    const user = await getDb().collection('users').findOneAndUpdate(
      { _id: toObjectId(req.user.id) }, { $set: { profile } }, { returnDocument: 'after' },
    );
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});
router.post('/logs', async (req, res, next) => {
  try {
    const type = oneOf(req.body?.type, LOG_TYPES, null);
    if (!type) return res.status(400).json({ error: `type must be one of ${LOG_TYPES.join(', ')}` });
    const date = isoDate(req.body?.date);
    let value;
    if (type === 'weight') value = num(req.body?.value, { min: 30, max: 300, fallback: NaN });
    else value = req.body?.value === true || req.body?.value === 1;
    if (Number.isNaN(value)) return res.status(400).json({ error: 'invalid value' });
    const userId = toObjectId(req.user.id);
    await getDb().collection('logs').updateOne(
      { userId, type, date },
      { $set: { value, note: str(req.body?.note, 300), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    res.status(201).json({ ok: true, type, date, value });
  } catch (err) { next(err); }
});
export default router;
