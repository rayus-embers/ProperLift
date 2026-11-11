export const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
function append(parent, child) {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) { child.forEach((c) => append(parent, c)); return; }
  parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
}
export function add(parent, ...children) {
  append(parent, children);
  return parent;
}
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'value') node.value = value;
    else if (key === 'vars') for (const [k, v] of Object.entries(value)) node.style.setProperty(`--${k}`, String(v));
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  append(node, children);
  return node;
}
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
let toastTimer;
export function toast(message, kind = 'info') {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.className = `toast show ${kind}`;
  box.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = 'toast'; }, 3200);
}
export function labelize(slug) {
  return String(slug || '').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
export function initials(text) {
  return String(text || '?').split(/[\s/]+/).filter((w) => /\w/.test(w)).slice(0, 2).map((w) => w.match(/\w/)[0].toUpperCase()).join('');
}
export function cover(url, title, cls = 'cover') {
  if (url) return el('div', { class: cls }, el('img', { src: url, alt: '', loading: 'lazy' }));
  const hue = [...String(title)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 180, 7);
  return el('div', { class: `${cls} placeholder`, vars: { hue } }, el('span', {}, initials(title)));
}
export function field(label, input, hint) {
  return el('label', { class: 'field' }, el('span', { class: 'field-label' }, label), input, hint ? el('small', {}, hint) : null);
}
export function select(value, options, onChange) {
  return el('select', { onchange: (e) => onChange(e.target.value) },
    options.map(([v, text]) => el('option', { value: v, selected: v === value }, text)));
}
export function errorBox(err) {
  return el('div', { class: 'empty error' },
    el('h3', {}, 'Something went wrong'),
    el('p', {}, err?.message || String(err)));
}
export function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
let uid = 0;
const nextId = (p) => `${p}${++uid}`;
export function plateMark(cls = 'brand-plate') {
  const g = nextId('pm');
  return svg('svg', { viewBox: '0 0 40 40', class: cls, 'aria-hidden': 'true' },
    svg('defs', {}, svg('linearGradient', { id: g, x1: '0', y1: '0', x2: '1', y2: '1' },
      svg('stop', { offset: '0', 'stop-color': '#f8e2a0' }), svg('stop', { offset: '.5', 'stop-color': '#c9973a' }), svg('stop', { offset: '1', 'stop-color': '#8a6420' }))),
    svg('circle', { cx: 20, cy: 20, r: 18.5, fill: 'none', stroke: `url(#${g})`, 'stroke-width': 3 }),
    svg('circle', { cx: 20, cy: 20, r: 12, fill: 'none', stroke: `url(#${g})`, 'stroke-width': 1.2, opacity: '.7' }),
    [0, 120, 240].map((a) => svg('rect', { x: 18, y: 4.5, width: 4, height: 6, rx: 2, fill: `url(#${g})`, transform: `rotate(${a} 20 20)` })),
    svg('circle', { cx: 20, cy: 20, r: 5, fill: `url(#${g})` }),
    svg('circle', { cx: 20, cy: 20, r: 2, fill: '#0a0907' }));
}
export function plateBadge(text = 'PROPER LIFT • IRON CLUB • EST. 2026 • TRAIN PROPER •') {
  const g = nextId('pg'); const r = nextId('pr'); const p = nextId('pp');
  return svg('svg', { viewBox: '0 0 400 400', class: 'plate', role: 'img', 'aria-label': 'Proper Lift weight plate emblem' },
    svg('defs', {},
      svg('radialGradient', { id: r, cx: '.4', cy: '.35', r: '.75' },
        svg('stop', { offset: '0', 'stop-color': '#2b251b' }), svg('stop', { offset: '.7', 'stop-color': '#13110c' }), svg('stop', { offset: '1', 'stop-color': '#0a0907' })),
      svg('linearGradient', { id: g, x1: '0', y1: '0', x2: '1', y2: '1' },
        svg('stop', { offset: '0', 'stop-color': '#fbe7ab' }), svg('stop', { offset: '.35', 'stop-color': '#d4a642' }),
        svg('stop', { offset: '.6', 'stop-color': '#8f681f' }), svg('stop', { offset: '1', 'stop-color': '#f0cf7d' })),
      svg('path', { id: p, d: 'M 200 200 m -152 0 a 152 152 0 1 1 304 0 a 152 152 0 1 1 -304 0' })),
    svg('g', { class: 'plate-spin' },
      svg('circle', { cx: 200, cy: 200, r: 194, fill: `url(#${r})` }),
      svg('circle', { cx: 200, cy: 200, r: 190, fill: 'none', stroke: `url(#${g})`, 'stroke-width': 3 }),
      svg('circle', { cx: 200, cy: 200, r: 172, fill: 'none', stroke: '#3a3328', 'stroke-width': 1 }),
      svg('text', { class: 'plate-text', fill: `url(#${g})` }, svg('textPath', { href: `#${p}`, startOffset: '0', textLength: '940', lengthAdjust: 'spacing' }, text)),
      svg('circle', { cx: 200, cy: 200, r: 132, fill: 'none', stroke: '#3a3328', 'stroke-width': 1 }),
      [60, 180, 300].map((a) => svg('rect', { x: 166, y: 86, width: 68, height: 26, rx: 13, fill: '#060504', stroke: '#2e281f', 'stroke-width': 2, transform: `rotate(${a} 200 200)` })),
      svg('circle', { cx: 200, cy: 200, r: 64, fill: 'none', stroke: `url(#${g})`, 'stroke-width': 2, opacity: '.8' }),
      svg('text', { x: 200, y: 156, 'text-anchor': 'middle', class: 'plate-kg', fill: `url(#${g})` }, '20'),
      svg('text', { x: 200, y: 268, 'text-anchor': 'middle', class: 'plate-unit', fill: '#a99f8b' }, 'KG')),
    svg('circle', { cx: 200, cy: 200, r: 30, fill: `url(#${g})` }),
    svg('circle', { cx: 200, cy: 200, r: 17, fill: '#0a0907' }),
    svg('circle', { cx: 200, cy: 200, r: 17, fill: 'none', stroke: '#000', 'stroke-width': 3, opacity: '.6' }));
}
export function loader() {
  return el('div', { class: 'loading' }, add(plateMark('loader')));
}
export function rv(node, index = 0) {
  node.classList.add('reveal');
  node.style.setProperty('--d', String(index));
  return node;
}
let observer;
export function reveal(root = document) {
  const nodes = root.querySelectorAll('.reveal:not(.in)');
  if (reducedMotion || !('IntersectionObserver' in window)) { nodes.forEach((n) => n.classList.add('in')); return; }
  observer ??= new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  nodes.forEach((n) => observer.observe(n));
}
export function countUp(node, to, { decimals = 0, duration = 1400, prefix = '', suffix = '' } = {}) {
  const from = Number(node.dataset.value || 0);
  node.dataset.value = String(to);
  const fmt = (v) => `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  if (reducedMotion || !Number.isFinite(to)) { node.textContent = Number.isFinite(to) ? fmt(to) : '-'; return node; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 4;
    node.textContent = fmt(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return node;
}
export function ring(value, max, { size = 168, stroke = 12, label = '', sub = '' } = {}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const g = nextId('rg');
  const arc = svg('circle', {
    cx: size / 2, cy: size / 2, r: radius, fill: 'none', stroke: `url(#${g})`, 'stroke-width': stroke,
    'stroke-linecap': 'round', 'stroke-dasharray': circ, 'stroke-dashoffset': circ, transform: `rotate(-90 ${size / 2} ${size / 2})`,
    class: 'ring-arc',
  });
  const valueEl = el('div', { class: 'ring-value num' }, '0');
  const node = el('div', { class: 'ring', vars: { size: `${size}px` } },
    svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size },
      svg('defs', {}, svg('linearGradient', { id: g, x1: '0', y1: '0', x2: '1', y2: '1' },
        svg('stop', { offset: '0', 'stop-color': '#f8e2a0' }), svg('stop', { offset: '1', 'stop-color': '#a8792a' }))),
      svg('circle', { cx: size / 2, cy: size / 2, r: radius, fill: 'none', stroke: '#2c271f', 'stroke-width': stroke }),
      arc),
    el('div', { class: 'ring-center' }, valueEl, label ? el('div', { class: 'ring-label' }, label) : null, sub ? el('div', { class: 'ring-sub' }, sub) : null));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    arc.style.transition = reducedMotion ? 'none' : 'stroke-dashoffset 1.6s cubic-bezier(.2,.75,.15,1)';
    arc.setAttribute('stroke-dashoffset', String(circ * (1 - pct)));
    countUp(valueEl, Math.round(value));
  }));
  return node;
}
export function burst(x, y, count = 28) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 70 + Math.random() * 110;
    const p = el('span', {
      class: 'particle',
      vars: { dx: `${Math.cos(angle) * dist}px`, dy: `${Math.sin(angle) * dist - 40}px`, rot: `${Math.random() * 540}deg` },
    });
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    if (i % 3 === 0) p.style.background = '#f6dc95';
    if (i % 4 === 0) { p.style.width = '5px'; p.style.height = '12px'; }
    document.body.append(p);
    setTimeout(() => p.remove(), 1000);
  }
}
export function tilt(node, max = 6) {
  if (reducedMotion || window.matchMedia?.('(hover: none)').matches) return node;
  node.classList.add('tilt');
  node.addEventListener('pointermove', (e) => {
    const r = node.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    node.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
    node.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    node.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
  });
  node.addEventListener('pointerleave', () => {
    node.style.setProperty('--rx', '0deg');
    node.style.setProperty('--ry', '0deg');
  });
  return node;
}
export function initChrome() {
  const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  window.addEventListener('pointermove', (e) => {
    const spot = document.querySelector('[data-spotlight]');
    if (!spot) return;
    const r = spot.getBoundingClientRect();
    spot.style.setProperty('--sx', `${e.clientX - r.left}px`);
    spot.style.setProperty('--sy', `${e.clientY - r.top}px`);
  }, { passive: true });
}
export function lineChart(points, { width = 900, height = 260, unit = 'kg' } = {}) {
  if (points.length < 2) {
    return el('p', { class: 'muted' }, points.length ? 'Log your weight on another day to see the trend.' : 'No weigh-ins yet.');
  }
  const pad = { l: 46, r: 14, t: 16, b: 30 };
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) { min -= 1; max += 1; }
  const x = (i) => pad.l + (i * (width - pad.l - pad.r)) / (points.length - 1);
  const y = (v) => pad.t + ((max - v) * (height - pad.t - pad.b)) / (max - min);
  const pts = points.map((p, i) => [x(i), y(p.value)]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${x(points.length - 1).toFixed(1)},${height - pad.b} L${x(0).toFixed(1)},${height - pad.b} Z`;
  const ticks = [max, (max + min) / 2, min];
  return svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': `Weight trend from ${values[0]} to ${values[values.length - 1]} ${unit}` },
    svg('defs', {},
      svg('linearGradient', { id: 'plLineGrad', x1: '0', y1: '0', x2: '1', y2: '0' },
        svg('stop', { offset: '0', 'stop-color': '#9a7224' }), svg('stop', { offset: '.5', 'stop-color': '#f6dc95' }), svg('stop', { offset: '1', 'stop-color': '#d4a642' })),
      svg('linearGradient', { id: 'plAreaGrad', x1: '0', y1: '0', x2: '0', y2: '1' },
        svg('stop', { offset: '0', 'stop-color': '#d4a642', 'stop-opacity': '.28' }), svg('stop', { offset: '1', 'stop-color': '#d4a642', 'stop-opacity': '0' }))),
    ticks.map((t) => [
      svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), class: 'grid' }),
      svg('text', { x: pad.l - 10, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, t.toFixed(1)),
    ]),
    svg('path', { d: area, class: 'area' }),
    svg('path', { d, class: 'line draw', pathLength: 1 }),
    points.map((p, i) => {
      const c = svg('circle', { cx: x(i), cy: y(p.value), r: i === points.length - 1 ? 6 : 4, class: 'dot' }, svg('title', {}, `${p.date}: ${p.value} ${unit}`));
      c.style.animationDelay = `${0.3 + (1.5 * i) / points.length}s`;
      return c;
    }),
    svg('text', { x: pad.l, y: height - 8, class: 'tick' }, points[0].date),
    svg('text', { x: width - pad.r, y: height - 8, 'text-anchor': 'end', class: 'tick' }, points[points.length - 1].date),
  );
}
