import { api, session } from '/shared/api.js';
import {
  el, add, clear, toast, labelize, cover, field, select, errorBox, formatDate,
  plateMark, plateBadge, loader, rv, reveal, countUp, initChrome, initials,
} from '/shared/ui.js';
const view = document.getElementById('view');
document.getElementById('brand-plate').append(plateMark());
initChrome();
const LEVELS = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
const GOALS = ['fat-loss', 'muscle-gain', 'strength', 'endurance', 'general-fitness', 'maintenance'].map((g) => [g, labelize(g)]);
function go(path) { location.hash = `#/${path}`; }
const isCoach = () => session.loggedIn && session.user?.role === 'coach';
function renderNav(path) {
  const nav = document.getElementById('nav');
  const right = document.getElementById('nav-right');
  clear(nav);
  clear(right);
  if (!isCoach()) return;
  const section = path.split('/')[0];
  [['', 'Clients'], ['programs', 'Programs'], ['meal-plans', 'Nutrition']]
    .forEach(([p, label]) => nav.append(el('a', { href: `#/${p}`, class: section === p ? 'active' : '' }, label)));
  right.append(
    el('span', { class: 'script small' }, session.user.name),
    el('button', { class: 'btn ghost small', onclick: () => { session.clear(); router(); } }, 'Sign out'));
}
function bind(obj, key, { type = 'text', onupdate, onchange, ...attrs } = {}) {
  if (type === 'textarea') {
    return el('textarea', { ...attrs, value: obj[key] ?? '', oninput: (e) => { obj[key] = e.target.value; } });
  }
  if (type === 'checkbox') {
    return el('input', { type: 'checkbox', checked: Boolean(obj[key]), onchange: (e) => { obj[key] = e.target.checked; onchange?.(e); } });
  }
  return el('input', {
    type,
    ...attrs,
    value: obj[key] ?? '',
    oninput: (e) => { obj[key] = type === 'number' ? Number(e.target.value) : e.target.value; onupdate?.(); },
  });
}
function mediaInput(obj, key, accept) {
  const preview = el('div', { class: 'media-preview' });
  const status = el('span', { class: 'muted small' });
  const show = (url) => {
    clear(preview);
    if (!url) return;
    preview.append(/\.(mp4|webm)$/.test(url) ? el('video', { src: url, controls: true, preload: 'metadata' }) : el('img', { src: url, alt: '' }));
  };
  const input = el('input', {
    type: 'file',
    accept,
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      status.textContent = `Uploading ${(file.size / 1e6).toFixed(1)} MB...`;
      try {
        const { url } = await api('/coach/media', { method: 'POST', file });
        obj[key] = url;
        show(url);
        status.textContent = 'Uploaded';
      } catch (err) {
        status.textContent = '';
        toast(err.message, 'error');
      }
      e.target.value = '';
    },
  });
  show(obj[key]);
  return el('div', { class: 'media-input' }, preview, input,
    el('div', { class: 'row' }, status, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { obj[key] = ''; show(''); } }, 'Remove')));
}
function confirmButton(label, onConfirm) {
  let armed = false;
  const btn = el('button', {
    type: 'button',
    class: 'btn danger',
    onclick: async () => {
      if (!armed) {
        armed = true;
        btn.textContent = 'Click again to confirm';
        setTimeout(() => { armed = false; btn.textContent = label; }, 3000);
        return;
      }
      await onConfirm();
    },
  }, label);
  return btn;
}
function tile(label, value, sub) {
  const v = el('div', { class: 'value num' }, '0');
  requestAnimationFrame(() => countUp(v, value));
  return el('div', { class: 'card tile' }, el('div', { class: 'label' }, label), v, sub ? el('div', { class: 'muted small' }, sub) : null);
}
function loginPage() {
  const email = el('input', { type: 'email', required: true, autocomplete: 'username' });
  const password = el('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const submit = el('button', { class: 'btn', type: 'submit' }, 'Sign in');
  return el('div', { class: 'login-wrap view-enter' },
    el('div', {}, plateBadge(), el('span', { class: 'eyebrow' }, 'Staff entrance'), el('h1', {}, 'Coach', el('br'), el('span', { class: 'gold-text' }, 'HQ.')),
      el('p', { class: 'muted' }, 'Build programs, write meal plans, keep an eye on every client.')),
    el('div', { class: 'card auth-card' },
    el('h2', {}, 'Sign in'),
    el('p', { class: 'muted small' }, 'Coaches only. Client accounts are turned away at the door.'),
    el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        submit.disabled = true;
        try {
          const { token, user } = await api('/auth/login', { method: 'POST', body: { email: email.value, password: password.value } });
          if (user.role !== 'coach') { toast('This account is not a coach account', 'error'); return; }
          session.set(token, user);
          router();
        } catch (err) { toast(err.message, 'error'); } finally { submit.disabled = false; }
      },
    }, field('Email', email), field('Password', password), submit)));
}
async function overview() {
  const [stats, { items: clients }] = await Promise.all([api('/coach/stats'), api('/coach/clients')]);
  const rows = clients.map((c) => {
    const change = c.lastWeight && c.firstWeight ? +(c.lastWeight.value - c.firstWeight.value).toFixed(1) : null;
    return el('tr', {},
      el('td', {}, el('div', { class: 'who' }, el('span', { class: 'avatar' }, initials(c.name)), el('div', {}, el('div', { class: 'client-name' }, c.name), el('div', { class: 'muted small' }, c.email)))),
      el('td', {}, c.program || el('span', { class: 'muted' }, '-')),
      el('td', {}, c.mealPlan || el('span', { class: 'muted' }, '-')),
      el('td', {}, el('span', { class: 'pill-n' }, el('span', { class: 'dots' }, [0, 1, 2, 3, 4, 5, 6].map((k) => el('i', { class: k < c.workouts7 ? 'on' : '' }))), String(c.workouts7))),
      el('td', {}, c.lastWeight ? `${c.lastWeight.value} kg` : '-',
        change !== null && change !== 0 ? el('span', { class: change < 0 ? 'trend-down' : 'trend-up' }, ` (${change > 0 ? '+' : ''}${change})`) : null),
      el('td', {}, c.lastActive ? formatDate(c.lastActive) : '-'),
      el('td', {}, formatDate(c.createdAt)));
  });
  return el('div', { class: 'stack' },
    rv(el('div', { class: 'hq-head' }, el('div', {}, el('span', { class: 'eyebrow' }, formatDate(new Date().toISOString())), el('h1', {}, 'The ', el('span', { class: 'gold-text' }, 'roster'))))),
    rv(el('div', { class: 'tiles' },
      tile('Clients', stats.clients),
      tile('Workout programs', stats.programs),
      tile('Meal plans', stats.mealPlans)), 1),
    rv(el('div', { class: 'card table-wrap' },
      clients.length ? el('table', {},
        el('thead', {}, el('tr', {}, ['Client', 'Program', 'Meal plan', 'Sessions (7d)', 'Weight', 'Last log', 'Joined'].map((h) => el('th', {}, h)))),
        el('tbody', {}, rows))
        : el('div', { class: 'empty' }, 'No clients yet. Share the client site so people can sign up.')), 2));
}
function listPage(kind) {
  const isProgram = kind === 'programs';
  return async () => {
    const { items } = await api(`/coach/${kind}`);
    return el('div', { class: 'stack' },
      rv(el('div', { class: 'hq-head' },
        el('div', {}, el('span', { class: 'eyebrow' }, isProgram ? 'The training floor' : 'The kitchen'), el('h1', {}, isProgram ? 'Programs' : 'Nutrition')),
        el('a', { class: 'btn', href: `#/${kind}/new` }, isProgram ? 'New program' : 'New meal plan'))),
      rv(el('div', { class: 'card' },
        items.length ? items.map((it) => el('a', { class: 'list-row', href: `#/${kind}/${it._id}` },
          cover(it.coverUrl, it.title),
          el('div', {},
            el('strong', {}, it.title),
            el('div', { class: 'muted small' }, it.summary || ''),
            el('div', { class: 'small' },
              el('span', { class: `status-dot ${it.published ? 'on' : ''}` }), it.published ? 'Published' : 'Draft',
              el('span', { class: 'muted' }, ` - updated ${formatDate(it.updatedAt)}`))),
          el('span', { class: 'badge grey' }, isProgram ? labelize(it.level) : `${it.targetCalories} kcal`)))
          : el('div', { class: 'empty' }, 'Nothing here yet.')), 1));
  };
}
function exerciseRow(ex, onRemove) {
  return el('div', { class: 'sub-row' },
    field('Exercise', bind(ex, 'name', { required: true, maxlength: 100 })),
    field('Sets', bind(ex, 'sets', { type: 'number', min: 0, max: 20 })),
    field('Reps', bind(ex, 'reps', { maxlength: 30, placeholder: '8-12' })),
    field('Rest (s)', bind(ex, 'restSec', { type: 'number', min: 0, max: 900 })),
    field('Coaching notes', bind(ex, 'notes', { maxlength: 500 })),
    el('button', { type: 'button', class: 'btn ghost small', onclick: onRemove, 'aria-label': 'Remove exercise' }, 'Remove'),
    el('div', { class: 'wide' }, field('Demo video (mp4/webm)', mediaInput(ex, 'videoUrl', 'video/mp4,video/webm'))));
}
function programDays(state) {
  const box = el('div', { class: 'stack' });
  const render = () => {
    clear(box);
    state.days.forEach((day, i) => {
      const exercises = el('div');
      const renderEx = () => {
        clear(exercises);
        day.exercises.forEach((ex, j) => exercises.append(exerciseRow(ex, () => { day.exercises.splice(j, 1); renderEx(); })));
      };
      renderEx();
      box.append(el('div', { class: `card day-editor ${day.rest ? 'rest' : ''}` },
        el('div', { class: 'day-tag' }, `D${i + 1}`),
        el('div', { class: 'form-grid' },
          field(`Day ${i + 1} name`, bind(day, 'name', { maxlength: 80 })),
          field('Focus / instructions', bind(day, 'focus', { maxlength: 120 }))),
        el('div', { class: 'row section' },
          el('label', { class: 'row small' }, bind(day, 'rest', { type: 'checkbox', onchange: render }), 'Rest day'),
          el('span', { class: 'spacer' }),
          day.rest ? null : el('button', { type: 'button', class: 'btn secondary small', onclick: () => { day.exercises.push({ name: '', sets: 3, reps: '10', restSec: 60, notes: '', videoUrl: '' }); renderEx(); } }, 'Add exercise'),
          el('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.days.splice(i, 1); render(); } }, 'Remove day')),
        day.rest ? null : exercises));
    });
    box.append(el('button', {
      type: 'button',
      class: 'btn secondary',
      onclick: () => { state.days.push({ name: `Day ${state.days.length + 1}`, rest: false, focus: '', exercises: [] }); render(); },
    }, 'Add day'));
  };
  render();
  return box;
}
function mealRow(meal, onRemove, onUpdate) {
  const num = (key, label) => field(label, bind(meal, key, { type: 'number', min: 0, max: 3000, onupdate: onUpdate }));
  return el('div', { class: 'sub-row meal-row' },
    field('Time', bind(meal, 'time', { placeholder: '08:00', maxlength: 20 })),
    field('Meal', bind(meal, 'name', { required: true, maxlength: 100, placeholder: 'Breakfast' })),
    num('kcal', 'kcal'), num('protein', 'Protein g'), num('carbs', 'Carbs g'), num('fat', 'Fat g'),
    el('button', { type: 'button', class: 'btn ghost small', onclick: onRemove }, 'Remove'),
    el('div', { class: 'wide' }, field('Foods & quantities', bind(meal, 'items', { type: 'textarea', maxlength: 1000 }))),
    el('div', { class: 'wide' }, field('Photo', mediaInput(meal, 'photoUrl', 'image/jpeg,image/png,image/webp'))));
}
function mealDays(state) {
  const box = el('div', { class: 'stack' });
  const render = () => {
    clear(box);
    state.days.forEach((day, i) => {
      const totals = el('span', { class: 'badge energy' });
      const updateTotals = () => {
        const t = day.meals.reduce((a, m) => ({ kcal: a.kcal + (+m.kcal || 0), p: a.p + (+m.protein || 0), c: a.c + (+m.carbs || 0), f: a.f + (+m.fat || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
        totals.textContent = `${Math.round(t.kcal)} kcal - P ${Math.round(t.p)} / C ${Math.round(t.c)} / F ${Math.round(t.f)}`;
      };
      const meals = el('div');
      const renderMeals = () => {
        clear(meals);
        day.meals.forEach((m, j) => meals.append(mealRow(m, () => { day.meals.splice(j, 1); renderMeals(); }, updateTotals)));
        updateTotals();
      };
      renderMeals();
      box.append(el('div', { class: 'card day-editor' },
        el('div', { class: 'row' },
          field(`Day ${i + 1} name`, bind(day, 'name', { maxlength: 80 })),
          el('span', { class: 'spacer' }), totals),
        meals,
        el('div', { class: 'row section' },
          el('button', { type: 'button', class: 'btn secondary small', onclick: () => { day.meals.push({ name: '', time: '', items: '', kcal: 0, protein: 0, carbs: 0, fat: 0, photoUrl: '' }); renderMeals(); } }, 'Add meal'),
          el('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.days.splice(i, 1); render(); } }, 'Remove day'))));
    });
    box.append(el('button', {
      type: 'button',
      class: 'btn secondary',
      onclick: () => { state.days.push({ name: `Day ${state.days.length + 1}`, meals: [] }); render(); },
    }, 'Add day'));
  };
  render();
  return box;
}
function editorPage(kind) {
  const isProgram = kind === 'programs';
  const blank = isProgram
    ? { title: '', summary: '', description: '', level: 'beginner', goal: 'general-fitness', durationWeeks: 8, coverUrl: '', published: false, days: [{ name: 'Day 1', rest: false, focus: '', exercises: [] }] }
    : { title: '', summary: '', description: '', goal: 'maintenance', diet: 'omnivore', targetCalories: 2000, coverUrl: '', published: false, days: [{ name: 'Day 1', meals: [] }] };
  return async (id) => {
    const isNew = id === 'new';
    const state = isNew ? structuredClone(blank) : (await api(`/coach/${kind}/${id}`)).item;
    const save = el('button', { class: 'btn', type: 'submit' }, isNew ? 'Create' : 'Save changes');
    const settings = isProgram
      ? [field('Level', select(state.level, LEVELS, (v) => { state.level = v; })),
        field('Goal', select(state.goal, GOALS, (v) => { state.goal = v; })),
        field('Duration (weeks)', bind(state, 'durationWeeks', { type: 'number', min: 1, max: 52 }))]
      : [field('Goal', select(state.goal, GOALS, (v) => { state.goal = v; })),
        field('Diet', bind(state, 'diet', { maxlength: 60, placeholder: 'omnivore, vegetarian, vegan...' })),
        field('Target kcal / day', bind(state, 'targetCalories', { type: 'number', min: 800, max: 6000 }))];
    return el('form', {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        save.disabled = true;
        try {
          const body = { ...state };
          delete body._id;
          await api(isNew ? `/coach/${kind}` : `/coach/${kind}/${id}`, { method: isNew ? 'POST' : 'PUT', body });
          toast('Saved', 'success');
          go(kind);
        } catch (err) { toast(err.message, 'error'); } finally { save.disabled = false; }
      },
    },
    el('a', { href: `#/${kind}`, class: 'small' }, 'Back'),
    el('h1', {}, isNew ? (isProgram ? 'New workout program' : 'New meal plan') : state.title),
    el('div', { class: 'editor' },
      el('div', { class: 'stack' },
        el('div', { class: 'card form' },
          field('Title', bind(state, 'title', { required: true, maxlength: 100 })),
          field('Short summary', bind(state, 'summary', { maxlength: 300 }), 'Shown on the catalogue cards'),
          field('Description', bind(state, 'description', { type: 'textarea', maxlength: 4000 })),
          el('div', { class: 'form-grid' }, settings)),
        el('h2', {}, isProgram ? 'Weekly cycle' : 'Daily rotation'),
        el('p', { class: 'muted small' }, isProgram
          ? 'Days repeat in order from the date a client starts. Use 7 days for a classic weekly split.'
          : 'Days rotate in order from the date a client starts following the plan.'),
        isProgram ? programDays(state) : mealDays(state)),
      el('aside', { class: 'card form' },
        field('Cover image', mediaInput(state, 'coverUrl', 'image/jpeg,image/png,image/webp')),
        el('label', { class: 'row' }, bind(state, 'published', { type: 'checkbox' }), 'Published (visible to clients)'),
        save,
        isNew ? null : confirmButton('Delete', async () => {
          try { await api(`/coach/${kind}/${id}`, { method: 'DELETE' }); toast('Deleted'); go(kind); } catch (err) { toast(err.message, 'error'); }
        }))));
  };
}
const ROUTES = [
  [/^$/, overview],
  [/^programs$/, listPage('programs')],
  [/^programs\/(new|[a-f0-9]{24})$/, editorPage('programs')],
  [/^meal-plans$/, listPage('meal-plans')],
  [/^meal-plans\/(new|[a-f0-9]{24})$/, editorPage('meal-plans')],
];
let renderId = 0;
async function router() {
  const path = location.hash.replace(/^#\/?/, '');
  const id = ++renderId;
  renderNav(path);
  if (!isCoach()) {
    clear(view);
    view.append(loginPage());
    return;
  }
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
window.addEventListener('hashchange', () => { router(); window.scrollTo(0, 0); });
window.addEventListener('session-expired', () => { toast('Session expired, please sign in again', 'error'); router(); });
router();
