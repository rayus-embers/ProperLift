export function str(v, max = 200, fallback = '') {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return fallback;
  return v.trim().slice(0, max);
}
export function num(v, { min = 0, max = 100000, fallback = 0 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}
export function oneOf(v, options, fallback) {
  return options.includes(v) ? v : fallback;
}
export function mediaUrl(v) {
  const s = str(v, 300);
  return /^\/media\/uploads\/(?:[\w-]+\/)*[\w-]+\.(?:jpg|png|webp|mp4|webm)$/.test(s) ? s : '';
}
export function slugify(title) {
  return str(title, 80)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const GOALS = ['fat-loss', 'muscle-gain', 'strength', 'endurance', 'general-fitness', 'maintenance'];
export function sanitizeProgram(body = {}) {
  const days = Array.isArray(body.days) ? body.days.slice(0, 14) : [];
  return {
    title: str(body.title, 100),
    summary: str(body.summary, 300),
    description: str(body.description, 4000),
    level: oneOf(body.level, LEVELS, 'beginner'),
    goal: oneOf(body.goal, GOALS, 'general-fitness'),
    durationWeeks: num(body.durationWeeks, { min: 1, max: 52, fallback: 8 }),
    coverUrl: mediaUrl(body.coverUrl),
    published: body.published === true,
    days: days.map((d, i) => ({
      name: str(d?.name, 80) || `Day ${i + 1}`,
      rest: d?.rest === true,
      focus: str(d?.focus, 120),
      exercises: (Array.isArray(d?.exercises) && d?.rest !== true ? d.exercises.slice(0, 30) : []).map((e) => ({
        name: str(e?.name, 100),
        sets: num(e?.sets, { min: 0, max: 20, fallback: 3 }),
        reps: str(e?.reps, 30) || '10',
        restSec: num(e?.restSec, { min: 0, max: 900, fallback: 60 }),
        notes: str(e?.notes, 500),
        videoUrl: mediaUrl(e?.videoUrl),
      })).filter((e) => e.name),
    })),
  };
}
export function sanitizeMealPlan(body = {}) {
  const days = Array.isArray(body.days) ? body.days.slice(0, 14) : [];
  return {
    title: str(body.title, 100),
    summary: str(body.summary, 300),
    description: str(body.description, 4000),
    goal: oneOf(body.goal, GOALS, 'maintenance'),
    diet: str(body.diet, 60) || 'omnivore',
    targetCalories: num(body.targetCalories, { min: 800, max: 6000, fallback: 2000 }),
    coverUrl: mediaUrl(body.coverUrl),
    published: body.published === true,
    days: days.map((d, i) => ({
      name: str(d?.name, 80) || `Day ${i + 1}`,
      meals: (Array.isArray(d?.meals) ? d.meals.slice(0, 10) : []).map((m) => ({
        name: str(m?.name, 100),
        time: str(m?.time, 20),
        items: str(m?.items, 1000),
        kcal: num(m?.kcal, { max: 3000 }),
        protein: num(m?.protein, { max: 400 }),
        carbs: num(m?.carbs, { max: 600 }),
        fat: num(m?.fat, { max: 300 }),
        photoUrl: mediaUrl(m?.photoUrl),
      })).filter((m) => m.name),
    })),
  };
}
export const LOG_TYPES = ['weight', 'workout', 'meals'];
export function isoDate(v) {
  const s = str(v, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s) return s;
  }
  return new Date().toISOString().slice(0, 10);
}
