import { api, session } from '/shared/api.js';
import {
  el, add, svg, clear, toast, labelize, cover, field, select, errorBox, formatDate, lineChart,
  plateMark, plateBadge, loader, rv, reveal, countUp, ring, burst, tilt, initChrome,
} from '/shared/ui.js';
const cfg = window.APP_CONFIG || {};
const view = document.getElementById('view');
document.getElementById('brand-name').textContent = cfg.appName || 'Proper Lift';
document.getElementById('brand-plate').append(plateMark());
initChrome();
const NAV = [
  ['', 'Home'],
  ['programs', 'Programs'],
  ['meal-plans', 'Nutrition'],
  ['calculator', 'Calculator'],
  ['dashboard', 'My plan'],
];
const go = (path) => { location.hash = `#/${path}`; };
const pad2 = (n) => String(n).padStart(2, '0');
function renderNav(path) {
  const nav = document.getElementById('nav');
  clear(nav);
  const section = path.split('/')[0];
  NAV.forEach(([p, label]) => nav.append(el('a', { href: `#/${p}`, class: section === p ? 'active' : '' }, label)));
  const right = document.getElementById('nav-right');
  clear(right);
  if (session.loggedIn) {
    add(right,
      el('span', { class: 'script small' }, session.user?.name?.split(' ')[0] || ''),
      el('button', { class: 'btn ghost small', onclick: () => { session.clear(); toast('Signed out. Rest well.'); go(''); } }, 'Sign out'));
  } else {
    add(right,
      el('a', { href: '#/login', class: 'btn ghost small' }, 'Sign in'),
      el('a', { href: '#/register', class: 'btn small' }, 'Join free'));
  }
}
function requireLogin() {
  if (session.loggedIn) return false;
  sessionStorage.setItem('returnTo', location.hash.slice(2));
  go('login');
  return true;
}
function stat(value, label, opts = {}) {
  const v = el('div', { class: 'value num' }, '0');
  requestAnimationFrame(() => countUp(v, value, opts));
  return el('div', {}, v, el('div', { class: 'label' }, label));
}
function catalogCard({ href, index, coverUrl, title, badges, summary, foot }) {
  const card = tilt(el('a', { class: 'card item-card', href },
    el('span', { class: 'item-index' }, `No. ${pad2(index)}`),
    cover(coverUrl, title),
    el('div', { class: 'item-body' },
      el('div', { class: 'row' }, badges),
      el('h3', {}, title),
      el('p', {}, summary)),
    el('div', { class: 'item-foot' }, el('span', {}, foot), el('span', { class: 'arrow-dot', 'aria-hidden': 'true' }, '→'))));
  return rv(el('div', { class: 'reveal-wrap' }, card), index - 1);
}
const programCard = (p, i) => catalogCard({
  href: `#/programs/${p._id}`, index: i + 1, coverUrl: p.coverUrl, title: p.title, summary: p.summary,
  badges: [el('span', { class: 'badge energy' }, labelize(p.level)), el('span', { class: 'badge' }, labelize(p.goal))],
  foot: `${p.durationWeeks} weeks`,
});
const mealPlanCard = (m, i) => catalogCard({
  href: `#/meal-plans/${m._id}`, index: i + 1, coverUrl: m.coverUrl, title: m.title, summary: m.summary,
  badges: [el('span', { class: 'badge energy' }, `${m.targetCalories} kcal`), el('span', { class: 'badge' }, labelize(m.diet))],
  foot: labelize(m.goal),
});
function macroChips(m) {
  return el('div', { class: 'macros' },
    el('span', { class: 'macro kcal' }, `${Math.round(m.kcal)} kcal`),
    el('span', { class: 'macro' }, `P ${Math.round(m.protein)}g`),
    el('span', { class: 'macro' }, `C ${Math.round(m.carbs)}g`),
    el('span', { class: 'macro' }, `F ${Math.round(m.fat)}g`));
}
function macroSplit(t) {
  const kp = t.protein * 4; const kc = t.carbs * 4; const kf = t.fat * 9; const sum = kp + kc + kf || 1;
  const seg = (cls, k) => { const i = el('i', { class: cls }); i.style.flex = String(k / sum); return i; };
  return [
    el('div', { class: 'split' }, seg('p', kp), seg('c', kc), seg('f', kf)),
    el('div', { class: 'split-legend' },
      el('span', {}, el('b', { class: 'p' }), `Protein ${Math.round((kp / sum) * 100)}%`),
      el('span', {}, el('b', { class: 'c' }), `Carbs ${Math.round((kc / sum) * 100)}%`),
      el('span', {}, el('b', { class: 'f' }), `Fat ${Math.round((kf / sum) * 100)}%`)),
  ];
}
function exerciseRow(e, i) {
  return el('div', { class: 'exercise' },
    el('span', { class: 'n' }, pad2(i + 1)),
    el('div', {}, el('strong', {}, e.name)),
    el('div', { class: 'prescription' }, `${e.sets} × ${e.reps}`, e.restSec ? el('span', { class: 'rest' }, `  ${e.restSec}s rest`) : null),
    e.notes ? el('div', { class: 'notes' }, e.notes) : null,
    e.videoUrl ? el('video', { src: e.videoUrl, controls: true, preload: 'metadata', playsinline: true }) : null);
}
function dayCard(d, i) {
  return rv(el('div', { class: `card day ${d.rest ? 'rest' : ''}` },
    el('div', { class: 'day-head' },
      el('div', { class: 'day-num' }, `D${i + 1}`),
      el('div', {}, el('h3', {}, d.rest ? 'Rest' : d.name), d.focus ? el('p', { class: 'muted' }, d.focus) : null),
      el('span', { class: 'spacer' }),
      d.rest ? el('span', { class: 'badge grey' }, 'Recover') : el('span', { class: 'badge' }, `${d.exercises.length} moves`)),
    d.exercises.map(exerciseRow)), i);
}
function mealRow(m) {
  return el('div', { class: 'meal' },
    el('div', { class: 'time' }, m.time || ''),
    el('div', {}, el('strong', {}, m.name), el('div', { class: 'muted small' }, m.items)),
    macroChips(m),
    m.photoUrl ? el('img', { src: m.photoUrl, alt: m.name, loading: 'lazy' }) : null);
}
function dayTotals(meals) {
  return meals.reduce((t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
const MARQUEE = ['Progressive overload', 'Eat with intent', 'Log every session', 'Sleep like it’s your job', 'No ego lifting', 'Protein first', 'Show up on rest days too'];
function words(text, delay = 0, gold = false) {
  return text.split(' ').map((w, i, arr) => {
    const s = el('span', { class: `word${gold ? ' gold-text' : ''}` }, w + (i < arr.length - 1 ? '\u00a0' : ''));
    const d = delay + i * 0.09;
    s.style.animationDelay = gold ? `${d}s, ${d + 1}s` : `${d}s`;
    return s;
  });
}
async function home() {
  const [programs, plans] = await Promise.all([api('/programs'), api('/meal-plans')]);
  let preview = null;
  try {
    if (programs.items[0]) preview = (await api(`/programs/${programs.items[0]._id}`)).item;
  } catch {  }
  const day = preview?.days?.find((d) => !d.rest);
  const hero = el('section', { class: 'hero', 'data-spotlight': true },
    el('div', { class: 'hero-copy' },
      el('span', { class: 'eyebrow' }, 'Online coaching for people who lift'),
      el('h1', { class: 'hero-title' },
        el('span', { class: 'l1' }, words('Lift', 0.05)),
        el('span', { class: 'l2' }, words('proper.', 0.2, true)),
        el('span', { class: 'l3 outline-text' }, words('Eat with intent.', 0.4))),
      el('p', { class: 'lead' }, 'Coach-built programs and meal plans that tell you exactly what to lift and eat today, with tracking that shows it working.'),
      el('div', { class: 'row' },
        el('a', { href: session.loggedIn ? '#/dashboard' : '#/register', class: 'btn' }, session.loggedIn ? 'Open my plan' : 'Start training free'),
        el('a', { href: '#/calculator', class: 'btn secondary' }, 'Find my macros')),
      el('div', { class: 'hero-proof' },
        stat(programs.items.length, 'Programs'),
        stat(plans.items.length, 'Meal plans'),
        stat(90, 'Day trends'))),
    el('div', { class: 'hero-art plate-wrap' },
      el('div', { class: 'halo' }),
      plateBadge(),
      el('span', { class: 'chip-live' }, 'Today’s session ready'),
      day ? el('div', { class: 'float-card' },
        el('div', { class: 'kicker' }, `${preview.title}`),
        el('h4', {}, `${day.name} · ${day.focus || 'Training'}`),
        el('ul', {}, day.exercises.slice(0, 3).map((e) => el('li', {}, el('b', {}, e.name), `${e.sets} × ${e.reps}`))),
        el('div', { class: 'mini-bar' }, el('i'))) : null));
  const strip = el('div', { class: 'marquee', 'aria-hidden': 'true' },
    el('div', { class: 'marquee-track' }, [...MARQUEE, ...MARQUEE].map((t) => el('span', {}, t))));
  const steps = [
    ['Pick a program', 'Choose a coach-built plan for your level and goal. Day 1 starts the moment you enrol.'],
    ['Follow today', 'Your dashboard shows today’s session and meals. Tick off sets as you go.'],
    ['Watch the trend', 'Log your weigh-ins and sessions. The curve tells you when to adjust.'],
  ];
  return el('div', {},
    hero,
    strip,
    el('section', { class: 'section' },
      rv(el('div', { class: 'section-head' },
        el('div', {}, el('span', { class: 'sec-num' }, 'Chapter one'), el('h2', {}, 'The programs')),
        el('a', { href: '#/programs' }, 'All programs →'))),
      el('div', { class: 'grid' }, programs.items.slice(0, 3).map(programCard))),
    el('section', { class: 'section' },
      rv(el('div', { class: 'section-head' }, el('div', {}, el('span', { class: 'sec-num' }, 'Chapter two'), el('h2', {}, 'How it works')))),
      rv(el('div', { class: 'steps' }, steps.map(([t, d], i) => el('div', { class: 'step' },
        el('div', { class: 'big' }, pad2(i + 1)), el('h3', {}, t), el('p', {}, d)))), 1)),
    el('section', { class: 'section' },
      rv(el('div', { class: 'section-head' },
        el('div', {}, el('span', { class: 'sec-num' }, 'Chapter three'), el('h2', {}, 'Fuel the work')),
        el('a', { href: '#/meal-plans' }, 'All meal plans →'))),
      el('div', { class: 'grid' }, plans.items.slice(0, 3).map(mealPlanCard))),
    rv(el('section', { class: 'cta-band' },
      el('span', { class: 'eyebrow' }, 'No more guessing'),
      el('h2', {}, 'Your first session ', el('span', { class: 'gold-text' }, 'starts today.')),
      el('p', { class: 'muted' }, 'Free account. Pick a program, follow the plan, log the work.'),
      el('a', { href: session.loggedIn ? '#/dashboard' : '#/register', class: 'btn' }, session.loggedIn ? 'Go to my plan' : 'Create my account'))));
}
function pageHead(eyebrow, title, text) {
  return rv(el('header', { class: 'page-head' }, el('span', { class: 'eyebrow' }, eyebrow), el('h1', {}, title), text ? el('p', {}, text) : null));
}
async function programList() {
  const { items } = await api('/programs');
  return el('div', {},
    pageHead('The training floor', 'Programs', 'Pick one program; your dashboard tells you which session to do each day.'),
    items.length ? el('div', { class: 'grid' }, items.map(programCard)) : el('div', { class: 'empty' }, 'No programs published yet.'));
}
async function enroll(body, label) {
  if (requireLogin()) return;
  try {
    const { user } = await api('/me/enrollment', { method: 'PUT', body });
    session.setUser(user);
    toast(`${label} is on your plan. Let’s work.`, 'success');
    go('dashboard');
  } catch (e) { toast(e.message, 'error'); }
}
function miniStats(pairs) {
  return el('div', { class: 'mini-stats' }, pairs.map(([v, l]) => {
    const b = el('b', { class: 'num' }, '0');
    requestAnimationFrame(() => countUp(b, v));
    return el('div', {}, b, el('span', {}, l));
  }));
}
async function programDetail(id) {
  const { item: p } = await api(`/programs/${id}`);
  const trainingDays = p.days.filter((d) => !d.rest).length;
  return el('div', { class: 'stack' },
    el('div', { class: 'detail-head' },
      el('div', {},
        el('a', { href: '#/programs', class: 'back' }, '← All programs'),
        el('span', { class: 'eyebrow' }, `${labelize(p.level)} · ${labelize(p.goal)}`),
        el('h1', {}, p.title),
        el('p', { class: 'detail-desc' }, p.description)),
      rv(el('div', { class: 'card side-card' },
        cover(p.coverUrl, p.title),
        miniStats([[trainingDays, 'Sessions'], [p.days.length, 'Day cycle'], [p.durationWeeks, 'Weeks']]),
        el('button', { class: 'btn', onclick: () => enroll({ programId: p._id }, p.title) }, 'Start this program'),
        el('p', { class: 'muted small' }, 'Day 1 starts today. Switch any time.')), 1)),
    el('div', { class: 'section-head section' }, el('div', {}, el('span', { class: 'sec-num' }, 'The weekly cycle'), el('h2', {}, `${p.days.length} days, repeat`))),
    el('div', { class: 'grid-2' }, p.days.map(dayCard)));
}
async function mealPlanList() {
  const { items } = await api('/meal-plans');
  return el('div', {},
    pageHead('The kitchen', 'Nutrition', 'Not sure which calorie level fits you? Run the calculator first.'),
    items.length ? el('div', { class: 'grid' }, items.map(mealPlanCard)) : el('div', { class: 'empty' }, 'No meal plans published yet.'));
}
async function mealPlanDetail(id) {
  const { item: m } = await api(`/meal-plans/${id}`);
  return el('div', { class: 'stack' },
    el('div', { class: 'detail-head' },
      el('div', {},
        el('a', { href: '#/meal-plans', class: 'back' }, '← All meal plans'),
        el('span', { class: 'eyebrow' }, `${labelize(m.diet)} · ${labelize(m.goal)}`),
        el('h1', {}, m.title),
        el('p', { class: 'detail-desc' }, m.description)),
      rv(el('div', { class: 'card side-card' },
        cover(m.coverUrl, m.title),
        miniStats([[m.targetCalories, 'kcal / day'], [m.days.length, 'Day rotation'], [m.days[0]?.meals.length || 0, 'Meals']]),
        el('button', { class: 'btn', onclick: () => enroll({ mealPlanId: m._id }, m.title) }, 'Follow this plan')), 1)),
    m.days.map((d, i) => {
      const t = dayTotals(d.meals);
      return rv(el('div', { class: 'card' },
        el('div', { class: 'card-head' },
          el('div', {}, el('span', { class: 'sec-num' }, `Day ${i + 1}`), el('h2', {}, d.name)),
          macroChips(t)),
        macroSplit(t),
        d.meals.map(mealRow)), i);
    }));
}
const ACTIVITY = {
  sedentary: [1.2, 'Sedentary (desk job, little exercise)'],
  light: [1.375, 'Light (1-3 sessions / week)'],
  moderate: [1.55, 'Moderate (3-5 sessions / week)'],
  active: [1.725, 'Active (6-7 sessions / week)'],
  'very-active': [1.9, 'Very active (physical job + training)'],
};
function computeTargets(p) {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'female' ? -161 : 5);
  const tdee = bmr * ACTIVITY[p.activity][0];
  const factor = { 'fat-loss': 0.8, maintenance: 1, 'muscle-gain': 1.1 }[p.goal];
  const kcal = Math.round((tdee * factor) / 10) * 10;
  const protein = Math.round(p.weightKg * (p.goal === 'fat-loss' ? 2.2 : 1.8));
  const fat = Math.round(p.weightKg * 0.8);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs };
}
function donut(size = 150, stroke = 16) {
  const r = (size - stroke) / 2; const circ = 2 * Math.PI * r;
  const segs = ['#f6dc95', '#d4a642', '#8a6420'].map((c) => svg('circle', {
    cx: size / 2, cy: size / 2, r, fill: 'none', stroke: c, 'stroke-width': stroke, class: 'seg', transform: `rotate(-90 ${size / 2} ${size / 2})`,
  }));
  const node = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'donut', role: 'img', 'aria-label': 'Macro split' },
    svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: '#2c271f', 'stroke-width': stroke }), segs);
  node.update = (parts) => {
    const total = parts.reduce((a, b) => a + b, 0) || 1;
    let offset = 0;
    parts.forEach((v, i) => {
      const len = (v / total) * circ;
      const gap = Math.min(4, len);
      segs[i].style.strokeDasharray = `${Math.max(0, len - gap)} ${circ}`;
      segs[i].style.strokeDashoffset = String(-offset);
      offset += len;
    });
  };
  return node;
}
async function calculator() {
  const p = {
    sex: 'male', age: 30, heightCm: 175, weightKg: 75, activity: 'moderate', goal: 'maintenance',
    ...(session.loggedIn ? session.user?.profile : {}),
  };
  const plans = (await api('/meal-plans')).items;
  const kcalEl = el('div', { class: 'kcal-big num' }, '0');
  const ring3 = donut();
  const leg = { protein: el('b', { class: 'num' }, '0'), carbs: el('b', { class: 'num' }, '0'), fat: el('b', { class: 'num' }, '0') };
  const note = el('p', { class: 'muted small' });
  const best = el('div');
  const out = el('div', { class: 'card calc-out stack' },
    el('div', {}, el('div', { class: 'kicker' }, 'Daily target'), el('div', { class: 'row' }, kcalEl, el('span', { class: 'script' }, 'kcal / day'))),
    el('div', { class: 'donut-row' }, ring3,
      el('div', { class: 'legend-list' },
        el('div', {}, el('i', { vars: {} }), leg.protein, el('span', { class: 'muted' }, 'protein')),
        el('div', {}, el('i'), leg.carbs, el('span', { class: 'muted' }, 'carbs')),
        el('div', {}, el('i'), leg.fat, el('span', { class: 'muted' }, 'fat')))),
    note, best,
    session.loggedIn ? el('button', {
      class: 'btn secondary',
      onclick: async () => {
        try {
          const { user } = await api('/me/profile', { method: 'PUT', body: p });
          session.setUser(user);
          toast('Saved to your profile', 'success');
        } catch (e) { toast(e.message, 'error'); }
      },
    }, 'Save to my profile') : null);
  ['#f6dc95', '#d4a642', '#8a6420'].forEach((c, i) => { out.querySelectorAll('.legend-list i')[i].style.background = c; });
  let lastBest = null;
  function update() {
    if (!(p.age > 0 && p.heightCm > 0 && p.weightKg > 0)) return;
    const t = computeTargets(p);
    countUp(kcalEl, t.kcal, { duration: 800 });
    countUp(leg.protein, t.protein, { duration: 800, suffix: 'g' });
    countUp(leg.carbs, t.carbs, { duration: 800, suffix: 'g' });
    countUp(leg.fat, t.fat, { duration: 800, suffix: 'g' });
    ring3.update([t.protein * 4, t.carbs * 4, t.fat * 9]);
    note.textContent = `BMR ${t.bmr} kcal; maintenance about ${t.tdee} kcal. Estimates: adjust after 2-3 weeks of weigh-ins.`;
    const pick = [...plans].sort((a, b) => Math.abs(a.targetCalories - t.kcal) - Math.abs(b.targetCalories - t.kcal))[0];
    if (pick && pick._id !== lastBest) {
      lastBest = pick._id;
      clear(best);
      add(best, el('div', { class: 'kicker' }, 'Closest meal plan'),
        el('a', { href: `#/meal-plans/${pick._id}`, class: 'row' }, el('strong', {}, pick.title), el('span', { class: 'badge energy' }, `${pick.targetCalories} kcal`)));
    }
  }
  const numInput = (key, min, max) => el('input', {
    type: 'number', min, max, value: p[key], oninput: (e) => { p[key] = Number(e.target.value); update(); },
  });
  const form = el('div', { class: 'card form' },
    el('div', { class: 'form-grid' },
      field('Sex', select(p.sex, [['male', 'Male'], ['female', 'Female']], (v) => { p.sex = v; update(); })),
      field('Age', numInput('age', 13, 100)),
      field('Height (cm)', numInput('heightCm', 100, 250)),
      field('Weight (kg)', numInput('weightKg', 30, 300))),
    field('Activity level', select(p.activity, Object.entries(ACTIVITY).map(([k, [, label]]) => [k, label]), (v) => { p.activity = v; update(); })),
    field('Goal', select(p.goal, [['fat-loss', 'Lose fat (-20%)'], ['maintenance', 'Maintain'], ['muscle-gain', 'Gain muscle (+10%)']], (v) => { p.goal = v; update(); })));
  requestAnimationFrame(update);
  return el('div', {},
    pageHead('Know your numbers', 'Calculator', 'Mifflin-St Jeor equation with an activity multiplier, then a protein-first macro split.'),
    el('div', { class: 'grid-2' }, rv(form), rv(out, 1)));
}
function tile(label, value, sub, opts) {
  const v = el('div', { class: 'value num' }, '-');
  if (Number.isFinite(value)) requestAnimationFrame(() => countUp(v, value, opts));
  return el('div', { class: 'card tile' }, el('div', { class: 'label' }, label), v, sub ? el('div', { class: 'muted small' }, sub) : null);
}
const setsKey = (date) => `properlift.sets.${date}`;
function loadSets(date) { try { return new Set(JSON.parse(localStorage.getItem(setsKey(date)) || '[]')); } catch { return new Set(); } }
function saveSets(date, s) { try { localStorage.setItem(setsKey(date), JSON.stringify([...s])); } catch {  } }
async function logValue(type, value) {
  await api('/me/logs', { method: 'POST', body: { type, value } });
}
function workoutCard(d) {
  const card = el('div', { class: 'card stack' });
  if (!d.workout) {
    return add(card, el('span', { class: 'eyebrow' }, 'Today’s training'), el('h2', {}, 'No program yet'),
      el('p', { class: 'muted' }, 'Pick a program and today’s session appears here.'), el('a', { href: '#/programs', class: 'btn secondary' }, 'Choose a program'));
  }
  const w = d.workout;
  add(card, el('div', { class: 'card-head' },
    el('div', {}, el('span', { class: 'eyebrow' }, `Week ${w.week} · Day ${w.dayNumber}`), el('h2', {}, w.rest ? 'Rest day' : w.name)),
    el('a', { href: `#/programs/${d.program._id}`, class: 'back' }, 'Program →')));
  if (w.rest) {
    return add(card, el('div', { class: 'rest-day' }, el('div', { class: 'big' }, 'Recover'), el('p', { class: 'muted' }, w.focus || 'Walk, stretch, eat well, sleep early.')));
  }
  if (w.focus) add(card, el('p', { class: 'muted' }, w.focus));
  const done = loadSets(d.today);
  const fill = el('i');
  const count = el('span', {}, '');
  const refresh = () => {
    fill.style.width = `${(done.size / w.exercises.length) * 100}%`;
    count.textContent = `${done.size} / ${w.exercises.length} done`;
  };
  add(card, el('div', { class: 'sets-progress' }, count, el('div', { class: 'bar' }, fill)));
  w.exercises.forEach((e, i) => {
    const row = el('div', {
      class: `check-ex ${done.has(i) ? 'done' : ''}`, role: 'checkbox', tabindex: '0', 'aria-checked': String(done.has(i)),
      onclick: () => {
        if (done.has(i)) done.delete(i); else done.add(i);
        row.classList.toggle('done', done.has(i));
        row.setAttribute('aria-checked', String(done.has(i)));
        saveSets(d.today, done);
        refresh();
      },
      onkeydown: (ev) => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); row.click(); } },
    },
    el('span', { class: 'box' }, '✓'),
    el('span', { class: 'name' }, e.name),
    el('span', { class: 'prescription' }, `${e.sets} × ${e.reps}`),
    e.notes ? el('span', { class: 'notes' }, e.notes) : null);
    card.append(row);
  });
  requestAnimationFrame(refresh);
  let logged = Boolean(d.todayLogs.workout);
  const btn = el('button', { class: `btn log-session ${logged ? 'logged' : ''}` }, logged ? 'Session logged ✓' : 'Log this session');
  const stampIfLogged = () => { card.querySelector('.stamp')?.remove(); if (logged) card.append(el('div', { class: 'stamp' }, 'Logged')); };
  btn.addEventListener('click', async (ev) => {
    const next = !logged;
    btn.disabled = true;
    try {
      await logValue('workout', next);
      logged = next;
      btn.classList.toggle('logged', logged);
      btn.textContent = logged ? 'Session logged ✓' : 'Log this session';
      stampIfLogged();
      if (logged) { burst(ev.clientX, ev.clientY); toast('Session logged. That’s how it’s done.', 'success'); }
    } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; }
  });
  add(card, btn);
  stampIfLogged();
  return card;
}
function mealsCard(d) {
  const card = el('div', { class: 'card stack' });
  if (!d.meals) {
    return add(card, el('span', { class: 'eyebrow' }, 'Today’s fuel'), el('h2', {}, 'No meal plan yet'),
      el('p', { class: 'muted' }, 'Follow a meal plan and your meals and macros appear here.'), el('a', { href: '#/meal-plans', class: 'btn secondary' }, 'Choose a meal plan'));
  }
  const t = d.meals.totals;
  const bars = [['Protein', t.protein, '#f6dc95'], ['Carbs', t.carbs, '#d4a642'], ['Fat', t.fat, '#8a6420']];
  const maxG = Math.max(...bars.map((b) => b[1])) || 1;
  const fills = [];
  add(card,
    el('div', { class: 'card-head' },
      el('div', {}, el('span', { class: 'eyebrow' }, `${d.mealPlan.title} · ${d.meals.name}`), el('h2', {}, 'Today’s fuel'))),
    el('div', { class: 'meals-top' },
      ring(t.kcal, d.mealPlan.targetCalories, { label: 'kcal planned', sub: `of ${d.mealPlan.targetCalories}` }),
      el('div', { class: 'macro-bars' }, bars.map(([name, g, color]) => {
        const i = el('i');
        i.style.background = color;
        fills.push([i, g / maxG]);
        return el('div', {}, el('div', { class: 'lbl' }, name, el('b', {}, `${Math.round(g)} g`)), el('div', { class: 'track' }, i));
      }))),
    d.meals.meals.map(mealRow));
  requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach(([i, f]) => { i.style.width = `${f * 100}%`; })));
  const box = el('input', {
    type: 'checkbox',
    checked: Boolean(d.todayLogs.meals),
    onchange: async (e) => {
      const v = e.target.checked;
      try { await logValue('meals', v); toast(v ? 'Nutrition on point.' : 'Unmarked', 'success'); if (v) { const r = e.target.getBoundingClientRect(); burst(r.left + 10, r.top + 10, 16); } } catch (err) { e.target.checked = !v; toast(err.message, 'error'); }
    },
  });
  add(card, el('label', { class: 'toggle-line' }, box, 'I followed my meal plan today'));
  return card;
}
async function dashboard() {
  if (requireLogin()) return el('div');
  const d = await api('/me/dashboard');
  const latest = d.weights.at(-1);
  const first = d.weights[0];
  const change = latest && first ? +(latest.value - first.value).toFixed(1) : null;
  const weightInput = el('input', { type: 'number', step: '0.1', min: 30, max: 300, placeholder: 'kg', value: d.todayLogs.weight ?? '' });
  const weightCard = el('div', { class: 'card stack' },
    el('div', { class: 'card-head' },
      el('div', {}, el('span', { class: 'eyebrow' }, 'Last 90 days'), el('h2', {}, 'Bodyweight')),
      latest ? el('span', { class: 'badge energy' }, `${latest.value} kg`) : null),
    lineChart(d.weights),
    el('form', {
      class: 'weigh-form',
      onsubmit: async (e) => {
        e.preventDefault();
        try { await logValue('weight', Number(weightInput.value)); toast('Weigh-in logged', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
      },
    }, field('Today’s weigh-in', weightInput), el('button', { class: 'btn', type: 'submit' }, 'Log weight')));
  const stop = (body, label) => el('button', {
    class: 'btn ghost small',
    onclick: async () => {
      try {
        const { user } = await api('/me/enrollment', { method: 'PUT', body });
        session.setUser(user);
        toast(`${label} removed`);
        router();
      } catch (e) { toast(e.message, 'error'); }
    },
  }, `Stop ${label}`);
  const firstName = d.user.name.split(' ')[0];
  return el('div', { class: 'stack' },
    rv(el('div', { class: 'dash-head' },
      el('span', { class: 'eyebrow' }, formatDate(d.today)),
      el('h1', {}, `${firstName},`, el('br'), el('span', { class: 'gold-text' }, 'let’s work.')))),
    rv(el('div', { class: 'tiles' },
      tile('Program day', d.workout ? d.workout.dayNumber : NaN, d.program?.title || 'No program yet'),
      tile('Sessions · 7 days', d.workoutsLast7, 'completed'),
      tile('Bodyweight', latest ? latest.value : NaN, latest ? `logged ${formatDate(latest.date)}` : 'log below', { decimals: 1, suffix: ' kg' }),
      tile('Change', change ?? NaN, 'since first weigh-in', { decimals: 1, prefix: change > 0 ? '+' : '', suffix: ' kg' })), 1),
    el('div', { class: 'dash-grid' }, rv(workoutCard(d), 2), rv(mealsCard(d), 3)),
    rv(weightCard, 1),
    el('div', { class: 'row' },
      d.program ? stop({ programId: null }, 'program') : null,
      d.mealPlan ? stop({ mealPlanId: null }, 'meal plan') : null));
}
function authPage(mode) {
  const isLogin = mode === 'login';
  const name = el('input', { required: true, autocomplete: 'name', maxlength: 80, placeholder: 'Your name' });
  const email = el('input', { type: 'email', required: true, autocomplete: 'email', placeholder: 'you@example.com' });
  const password = el('input', { type: 'password', required: true, minlength: isLogin ? 1 : 8, autocomplete: isLogin ? 'current-password' : 'new-password', placeholder: isLogin ? 'Password' : 'At least 8 characters' });
  const submit = el('button', { class: 'btn', type: 'submit' }, isLogin ? 'Sign in' : 'Create my account');
  return el('div', { class: 'auth-wrap' },
    el('div', { class: 'auth-quote' },
      el('span', { class: 'eyebrow' }, isLogin ? 'Welcome back' : 'Day one starts here'),
      el('h1', {}, el('span', {}, isLogin ? 'Back to' : 'Earn it.'), el('br'), el('span', { class: 'gold-text' }, isLogin ? 'the iron.' : 'Every rep.')),
      el('p', {}, isLogin ? 'Your plan, your numbers and today’s session are waiting.' : 'Free account. Coach-built programs, meal plans and tracking that shows it working.')),
    rv(el('div', { class: 'card auth-card' },
      el('h2', {}, isLogin ? 'Sign in' : 'Join the club'),
      el('form', {
        class: 'form',
        onsubmit: async (e) => {
          e.preventDefault();
          submit.disabled = true;
          try {
            const body = isLogin ? { email: email.value, password: password.value } : { name: name.value, email: email.value, password: password.value };
            const { token, user } = await api(`/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body });
            session.set(token, user);
            const back = sessionStorage.getItem('returnTo');
            sessionStorage.removeItem('returnTo');
            go(back || 'dashboard');
          } catch (err) {
            toast(err.message, 'error');
          } finally { submit.disabled = false; }
        },
      },
      isLogin ? null : field('Name', name),
      field('Email', email),
      field('Password', password),
      submit),
      el('p', { class: 'muted small section' },
        isLogin ? 'No account yet? ' : 'Already a member? ',
        el('a', { href: isLogin ? '#/register' : '#/login' }, isLogin ? 'Join free' : 'Sign in'))), 1));
}
const ROUTES = [
  [/^$/, home],
  [/^programs$/, programList],
  [/^programs\/([a-f0-9]{24})$/, programDetail],
  [/^meal-plans$/, mealPlanList],
  [/^meal-plans\/([a-f0-9]{24})$/, mealPlanDetail],
  [/^calculator$/, calculator],
  [/^dashboard$/, dashboard],
  [/^login$/, () => authPage('login')],
  [/^register$/, () => authPage('register')],
];
let renderId = 0;
async function router() {
  const path = location.hash.replace(/^#\/?/, '');
  const id = ++renderId;
  renderNav(path);
  const match = ROUTES.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
  if (!match) { go(''); return; }
  const [m, fn] = match;
  const slow = setTimeout(() => { if (id === renderId) { clear(view); view.append(loader()); } }, 150);
  let node;
  try {
    node = await fn(...m.slice(1));
  } catch (err) {
    node = errorBox(err);
  }
  clearTimeout(slow);
  if (id !== renderId) return;
  clear(view);
  node.classList.add('view-enter');
  view.append(node);
  reveal(view);
}
window.addEventListener('hashchange', () => { router(); window.scrollTo({ top: 0, behavior: 'instant' }); });
window.addEventListener('session-expired', () => { toast('Session expired, please sign in again', 'error'); go('login'); });
router();
