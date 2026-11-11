import { hashPassword } from './auth.js';
const ex = (name, sets, reps, restSec, notes = '') => ({ name, sets, reps, restSec, notes, videoUrl: '' });
const rest = (name = 'Rest & recovery') => ({ name, rest: true, focus: 'Walk 20-30 min, mobility', exercises: [] });
const PROGRAMS = [
  {
    slug: 'demo-full-body-foundations',
    title: 'Full-Body Foundations',
    summary: '3 full-body sessions a week to build strength and good habits.',
    description: 'A beginner-friendly program built around the big compound lifts. Add a little weight each week when you hit the top of the rep range with good form.',
    level: 'beginner', goal: 'strength', durationWeeks: 8,
    days: [
      { name: 'Day A', rest: false, focus: 'Squat + push', exercises: [ex('Goblet squat', 3, '8-12', 90), ex('Push-up', 3, 'AMRAP', 60, 'Elevate hands if needed'), ex('Dumbbell row', 3, '10-12', 60), ex('Plank', 3, '30-45 s', 45)] },
      rest(),
      { name: 'Day B', rest: false, focus: 'Hinge + pull', exercises: [ex('Romanian deadlift', 3, '8-10', 90), ex('Lat pulldown', 3, '10-12', 60), ex('Dumbbell bench press', 3, '8-12', 90), ex('Dead bug', 3, '10/side', 45)] },
      rest(),
      { name: 'Day C', rest: false, focus: 'Single-leg + conditioning', exercises: [ex('Reverse lunge', 3, '10/side', 60), ex('Seated cable row', 3, '10-12', 60), ex('Overhead press', 3, '8-10', 90), ex('Bike intervals', 6, '30 s hard / 60 s easy', 0)] },
      rest(), rest('Rest'),
    ],
  },
  {
    slug: 'demo-hypertrophy-upper-lower',
    title: 'Upper / Lower Hypertrophy',
    summary: '4 days a week, moderate volume, built for muscle gain.',
    description: 'Upper/lower split hitting every muscle twice a week. Keep 1-2 reps in reserve on most sets and push the last set of each exercise.',
    level: 'intermediate', goal: 'muscle-gain', durationWeeks: 10,
    days: [
      { name: 'Upper 1', rest: false, focus: 'Horizontal push/pull', exercises: [ex('Barbell bench press', 4, '6-8', 120), ex('Chest-supported row', 4, '8-10', 90), ex('Incline DB press', 3, '10-12', 75), ex('Cable curl', 3, '12-15', 45), ex('Triceps pushdown', 3, '12-15', 45)] },
      { name: 'Lower 1', rest: false, focus: 'Squat focus', exercises: [ex('Back squat', 4, '6-8', 150), ex('Romanian deadlift', 3, '8-10', 120), ex('Leg press', 3, '10-12', 90), ex('Standing calf raise', 4, '10-15', 45)] },
      rest(),
      { name: 'Upper 2', rest: false, focus: 'Vertical push/pull', exercises: [ex('Overhead press', 4, '6-8', 120), ex('Pull-up', 4, '6-10', 90), ex('Cable fly', 3, '12-15', 60), ex('Lateral raise', 4, '12-20', 45)] },
      { name: 'Lower 2', rest: false, focus: 'Hinge focus', exercises: [ex('Deadlift', 3, '4-6', 180), ex('Bulgarian split squat', 3, '8-10/side', 90), ex('Leg curl', 3, '10-12', 60), ex('Hanging knee raise', 3, '10-15', 45)] },
      rest(), rest('Rest'),
    ],
  },
];
const meal = (name, time, items, kcal, protein, carbs, fat) => ({ name, time, items, kcal, protein, carbs, fat, photoUrl: '' });
const MEAL_PLANS = [
  {
    slug: 'demo-lean-cut-1800',
    title: 'Lean Cut - 1800 kcal',
    summary: 'High-protein, moderate deficit for steady fat loss.',
    description: 'Roughly 40% protein / 35% carbs / 25% fat. Drink plenty of water and keep vegetables unlimited.',
    goal: 'fat-loss', diet: 'omnivore', targetCalories: 1800,
    days: [
      { name: 'Day 1', meals: [
        meal('Breakfast', '08:00', 'Greek yogurt 250 g, berries 100 g, oats 30 g', 380, 32, 45, 7),
        meal('Lunch', '12:30', 'Grilled chicken 150 g, quinoa 60 g dry, mixed salad, olive oil 1 tsp', 560, 50, 50, 15),
        meal('Snack', '16:00', 'Apple, almonds 20 g', 210, 5, 25, 11),
        meal('Dinner', '19:30', 'Baked salmon 140 g, potatoes 200 g, green beans', 620, 38, 45, 28),
      ] },
      { name: 'Day 2', meals: [
        meal('Breakfast', '08:00', '3 egg-white + 1 egg omelette, spinach, wholegrain toast', 340, 28, 30, 10),
        meal('Lunch', '12:30', 'Tuna 120 g, brown rice 70 g dry, cucumber, tomatoes', 540, 42, 62, 10),
        meal('Snack', '16:00', 'Cottage cheese 200 g, pineapple 80 g', 230, 24, 18, 5),
        meal('Dinner', '19:30', 'Turkey mince 150 g chilli with beans, side salad', 650, 52, 55, 20),
      ] },
    ],
  },
  {
    slug: 'demo-plant-power-2600',
    title: 'Plant Power Gain - 2600 kcal',
    summary: 'Vegetarian surplus plan for lean muscle gain.',
    description: 'Vegetarian, high in legumes, dairy and whole grains. About 1.8 g protein per kg for a 75 kg athlete.',
    goal: 'muscle-gain', diet: 'vegetarian', targetCalories: 2600,
    days: [
      { name: 'Day 1', meals: [
        meal('Breakfast', '07:30', 'Overnight oats 80 g, milk 300 ml, whey 30 g, banana', 690, 45, 95, 12),
        meal('Lunch', '12:30', 'Lentil & chickpea curry, basmati rice 90 g dry', 760, 34, 120, 14),
        meal('Snack', '16:30', 'Skyr 200 g, granola 40 g, walnuts 15 g', 420, 26, 45, 14),
        meal('Dinner', '20:00', 'Tofu 200 g stir-fry, egg noodles 90 g dry, vegetables', 730, 40, 85, 24),
      ] },
    ],
  },
];
export async function seed(db, { coachEmail, coachPassword, coachName, demoContent }) {
  const now = new Date();
  if (coachEmail && coachPassword) {
    await db.collection('users').updateOne(
      { email: coachEmail.toLowerCase() },
      {
        $setOnInsert: {
          email: coachEmail.toLowerCase(),
          name: coachName,
          role: 'coach',
          passwordHash: hashPassword(coachPassword),
          profile: {},
          enrollment: {},
          createdAt: now,
        },
      },
      { upsert: true },
    ).catch((err) => { if (err.code !== 11000) throw err; });
  }
  if (!demoContent) return;
  for (const [collection, docs] of [['programs', PROGRAMS], ['mealPlans', MEAL_PLANS]]) {
    for (const doc of docs) {
      await db.collection(collection).updateOne(
        { slug: doc.slug },
        { $setOnInsert: { ...doc, coverUrl: '', published: true, createdAt: now, updatedAt: now } },
        { upsert: true },
      ).catch((err) => { if (err.code !== 11000) throw err; });
    }
  }
  console.log('[seed] done');
}
