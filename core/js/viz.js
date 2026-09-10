/**
 * viz.js — the visual layer: the year wheel, magnitude bars, stat figures.
 *
 * COLOUR POLICY, and the reason for it:
 *
 * The liturgical five are pigment colours fixed by tradition, not a palette
 * designed for data encoding. Run through the standard categorical checks they
 * fail hard — oxblood↔green separate by ΔE 5.4 under deuteranopia, and
 * green↔gold by only 11.1 even with full colour vision. So:
 *
 *   · The YEAR WHEEL uses them, because there the colour IS the subject —
 *     the chart's whole purpose is "what colour is the church in June?".
 *     Every arc is directly labelled, so nothing depends on telling two
 *     hues apart.
 *   · Every DATA chart uses a single hue (the current --accent) and carries
 *     identity in the labels. A church budget does not need a rainbow.
 *
 * No dependencies. Renders SVG; no canvas, no chart library.
 */

import { easter, advent, season, DAY } from './liturgy.js';

const NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs = {}, text) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE LITURGICAL YEAR WHEEL

   The church year drawn as a ring, each season an arc in its own colour, with
   today marked. A church year runs Advent → Advent, so it spans two calendar
   years; the wheel is built from the Advent that begins the current cycle.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Season boundaries for the church year beginning at Advent of `startYear`. */
export function churchYear(startYear) {
  const a0 = advent(startYear);
  const a1 = advent(startYear + 1);
  const y2 = startYear + 1;
  const E = easter(y2);

  return {
    start: a0,
    end: a1,
    seasons: [
      { id: 'advent',    name: 'Advent',        from: a0,                   to: Date.UTC(startYear, 11, 25) },
      { id: 'christmas', name: 'Christmastide', from: Date.UTC(startYear, 11, 25), to: Date.UTC(y2, 0, 6) },
      { id: 'epiphany',  name: 'Epiphany',      from: Date.UTC(y2, 0, 6),   to: E - 46 * DAY },
      { id: 'lent',      name: 'Lent',          from: E - 46 * DAY,         to: E - 7 * DAY },
      { id: 'holyweek',  name: 'Holy Week',     from: E - 7 * DAY,          to: E },
      { id: 'easter',    name: 'Eastertide',    from: E,                    to: E + 49 * DAY },
      { id: 'pentecost', name: 'Pentecost',     from: E + 49 * DAY,         to: E + 50 * DAY },
      { id: 'ordinary',  name: 'Ordinary Time', from: E + 50 * DAY,         to: a1 },
    ],
  };
}

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

/** Annular sector path. */
function ring(cx, cy, rOuter, rInner, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, rOuter, a0);
  const [x1, y1] = polar(cx, cy, rOuter, a1);
  const [x2, y2] = polar(cx, cy, rInner, a1);
  const [x3, y3] = polar(cx, cy, rInner, a0);
  return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}
          L ${x2} ${y2} A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Draw the wheel into `host`.
 * @param {HTMLElement} host
 * @param {Date} [now]
 */
export function renderYearWheel(host, now = new Date()) {
  if (!host) return;

  // Which cycle are we in? If we're past this year's Advent, the cycle
  // started this year; otherwise it started last year.
  const y = now.getUTCFullYear();
  const startYear = now.valueOf() >= advent(y) ? y : y - 1;
  const cy = churchYear(startYear);
  const span = cy.end - cy.start;

  // The viewBox needs headroom beyond rOut for the tick labels, which sit at
  // rOut + 24 and are themselves ~12px tall/wide. Sizing S to 2×rOut clips them
  // on all four sides — the kind of thing only a getBBox check catches.
  const rOut = 196, rIn = 132, pad = 48;
  const S = (rOut + pad) * 2, c = S / 2;
  const svg = el('svg', {
    viewBox: `0 0 ${S} ${S}`, class: 'wheel', role: 'img',
    'aria-labelledby': 'wheel-title wheel-desc',
  });
  svg.append(
    el('title', { id: 'wheel-title' }, `The church year, Advent ${startYear} to Advent ${startYear + 1}`),
    el('desc', { id: 'wheel-desc' },
      cy.seasons.map((s) => `${s.name}: ${fmt(s.from)} to ${fmt(s.to)}`).join('. '))
  );

  const angle = (t) => ((t - cy.start) / span) * 360;

  // ── Month ticks, so the ring reads against the ordinary calendar ───────
  const ticks = el('g', { class: 'wheel__ticks' });
  for (let m = 0; m < 12; m++) {
    const t = Date.UTC(startYear + (m >= 11 ? 0 : 1), m, 1);
    const tt = t < cy.start ? Date.UTC(startYear + 1, m, 1) : t;
    if (tt < cy.start || tt > cy.end) continue;
    const a = angle(tt);
    const [x1, y1] = polar(c, c, rOut + 4, a);
    const [x2, y2] = polar(c, c, rOut + 11, a);
    ticks.append(el('line', { x1, y1, x2, y2 }));
    const [lx, ly] = polar(c, c, rOut + 24, a);
    ticks.append(el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, MONTHS[m]));
  }
  svg.append(ticks);

  // ── Season arcs ────────────────────────────────────────────────────────
  const arcs = el('g', { class: 'wheel__arcs' });
  cy.seasons.forEach((s) => {
    const a0 = angle(s.from), a1 = angle(s.to);
    // A 0.6° gap between segments — the 2px surface spacer, in polar form.
    // Pentecost is a single day (~1°), so the gap would consume it entirely:
    // shrink the gap rather than let a real season vanish.
    const g = Math.min(0.6, (a1 - a0) / 4);
    const path = el('path', {
      d: ring(c, c, rOut, rIn, a0 + g, Math.max(a0 + g, a1 - g)),
      class: `wheel__arc wheel__arc--${s.id}`,
      tabindex: '0', role: 'listitem',
      'aria-label': `${s.name}, ${fmt(s.from)} to ${fmt(s.to)}`,
    });
    path.dataset.season = s.id;
    path.dataset.name = s.name;
    path.dataset.range = `${fmt(s.from)} – ${fmt(s.to)}`;
    arcs.append(path);

    // Direct label on any arc with room — identity never rests on colour.
    //
    // The label has to be TANGENT to the ring. Set horizontally it is wider
    // than the 64px band, so on the left and right of the wheel it spills out
    // of its own arc and collides with the month ticks. Rotating it to follow
    // the curve keeps it inside the band at every angle.
    if (a1 - a0 > 20) {
      const mid = (a0 + a1) / 2;
      const [tx, ty] = polar(c, c, (rOut + rIn) / 2, mid);
      // Tangent is `mid`; flip through 180° in the lower half so the text
      // never reads upside down.
      const rot = mid > 90 && mid < 270 ? mid - 180 : mid;
      arcs.append(el('text', {
        x: tx, y: ty, class: 'wheel__label',
        transform: `rotate(${rot.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})`,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
      }, s.name));
    }
  });
  arcs.setAttribute('role', 'list');
  svg.append(arcs);

  // ── Today ──────────────────────────────────────────────────────────────
  const nowA = angle(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [nx1, ny1] = polar(c, c, rIn - 8, nowA);
  const [nx2, ny2] = polar(c, c, rOut + 8, nowA);
  svg.append(el('line', { x1: nx1, y1: ny1, x2: nx2, y2: ny2, class: 'wheel__now' }));
  const [dx, dy] = polar(c, c, rOut + 8, nowA);
  svg.append(el('circle', { cx: dx, cy: dy, r: 4.5, class: 'wheel__now-dot' }));

  // ── Centre: where we are now ───────────────────────────────────────────
  const s = season(now);
  svg.append(
    el('text', { x: c, y: c - 14, class: 'wheel__center-label', 'text-anchor': 'middle' }, 'TODAY'),
    el('text', { x: c, y: c + 14, class: 'wheel__center-name', 'text-anchor': 'middle' }, s.name),
    el('text', { x: c, y: c + 38, class: 'wheel__center-sub', 'text-anchor': 'middle' },
      `${startYear}–${String(startYear + 1).slice(2)}`)
  );

  host.replaceChildren(svg);
  attachTooltip(host, svg, '.wheel__arc', (n) =>
    `<strong>${n.dataset.name}</strong><span>${n.dataset.range}</span>`);
}

const fmt = (t) => new Date(t).toLocaleDateString('en', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAGNITUDE BARS — "where your giving goes"

   One measure, one hue. Categories are named in the row label, so colour
   carries nothing and a legend would be noise.
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderBars(host, items, { unit = '%', caption } = {}) {
  if (!host || !items?.length) return;
  const max = Math.max(...items.map((d) => d.value));

  const fig = document.createElement('figure');
  fig.className = 'bars';

  const list = document.createElement('div');
  list.className = 'bars__rows';

  items.forEach((d) => {
    const row = document.createElement('div');
    row.className = 'bars__row';
    row.tabIndex = 0;
    row.dataset.name = d.label;
    row.dataset.value = `${d.value}${unit}`;
    if (d.note) row.dataset.note = d.note;

    const name = document.createElement('span');
    name.className = 'bars__name';
    name.textContent = d.label;

    const track = document.createElement('span');
    track.className = 'bars__track';
    const fill = document.createElement('span');
    fill.className = 'bars__fill';
    fill.style.inlineSize = `${(d.value / max) * 100}%`;
    track.append(fill);

    const val = document.createElement('span');
    val.className = 'bars__value tabular';
    val.textContent = `${d.value}${unit}`;

    row.append(name, track, val);
    list.append(row);
  });

  fig.append(list);
  if (caption) {
    const cap = document.createElement('figcaption');
    cap.textContent = caption;
    fig.append(cap);
  }

  // A table view, so the figure is never the only way to read the numbers.
  const details = document.createElement('details');
  details.className = 'bars__table';
  details.innerHTML =
    `<summary>View as a table</summary><div class="table-wrap"><table><thead><tr>` +
    `<th scope="col">Category</th><th scope="col">Share</th></tr></thead><tbody>` +
    items.map((d) => `<tr><td>${d.label}</td><td class="num">${d.value}${unit}</td></tr>`).join('') +
    `</tbody></table></div>`;
  fig.append(details);

  host.replaceChildren(fig);
  attachTooltip(host, list, '.bars__row', (n) =>
    `<strong>${n.dataset.name}</strong><span>${n.dataset.value}${
      n.dataset.note ? ` · ${n.dataset.note}` : ''}</span>`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED TOOLTIP
   ═══════════════════════════════════════════════════════════════════════════ */

function attachTooltip(host, scope, selector, content) {
  let tip = host.querySelector('.viz-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'viz-tip';
    tip.setAttribute('role', 'status');
    host.append(tip);
  }
  const show = (node) => {
    tip.innerHTML = content(node);
    tip.dataset.show = '';
    const hb = host.getBoundingClientRect();
    const nb = node.getBoundingClientRect();
    tip.style.insetInlineStart = `${nb.left - hb.left + nb.width / 2}px`;
    tip.style.insetBlockStart = `${nb.top - hb.top - 8}px`;
  };
  const hide = () => delete tip.dataset.show;

  scope.addEventListener('pointerover', (e) => {
    const n = e.target.closest(selector);
    if (n) show(n);
  });
  scope.addEventListener('pointerleave', hide);
  scope.addEventListener('focusin', (e) => {
    const n = e.target.closest(selector);
    if (n) show(n);
  });
  scope.addEventListener('focusout', hide);
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIGURES · WEEK GRID · GALLERY
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hero numbers. A single value is better served by type than by a bar of length one. */
export function renderFigures(host, items) {
  if (!host || !items?.length) return;
  host.replaceChildren(...items.map((f) => {
    const d = document.createElement('div');
    d.className = 'figure';
    d.innerHTML =
      `<span class="figure__value">${f.value}</span>` +
      `<span class="figure__label">${f.label}</span>` +
      (f.note ? `<span class="figure__note">${f.note}</span>` : '');
    return d;
  }));
}

/** What happens across a week. Cells are events, not magnitudes — not a heatmap. */
export function renderWeek(host, days) {
  if (!host || !days?.length) return;
  host.replaceChildren(...days.map((d) => {
    const col = document.createElement('div');
    col.className = 'week__day';
    col.innerHTML =
      `<span class="week__name">${d.day.slice(0, 3)}</span>` +
      (d.items || []).map((i) =>
        `<span class="week__item"><b>${formatClock(i.time)}</b>${i.name}</span>`).join('');
    return col;
  }));
}

const formatClock = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  const period = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}.${String(m).padStart(2, '0')}${period}` : `${hour}${period}`;
};

/**
 * Gallery. One aspect ratio across the row so the captions align — mixing
 * ratios in a grid reads as a broken layout, not as rhythm. The variety comes
 * from the images. The first frame is arched, which is enough of a gesture.
 */
export function renderGallery(host, items) {
  if (!host || !items?.length) return;
  host.replaceChildren(...items.map((g, i) => {
    const fig = document.createElement('figure');
    const frame = document.createElement('div');
    frame.className = `frame frame--tall${i === 0 ? ' frame--arch' : ''}`;
    const img = document.createElement('img');
    img.src = g.src;
    img.alt = g.alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    frame.append(img);
    fig.append(frame);
    if (g.caption) {
      const cap = document.createElement('figcaption');
      cap.textContent = g.caption;
      fig.append(cap);
    }
    return fig;
  }));
}

/** Wire everything a page declares. */
export function initViz(config) {
  const at = (path) => path.split('.').reduce((o, k) => o?.[k], config);

  document.querySelectorAll('[data-year-wheel]').forEach((h) => renderYearWheel(h));

  document.querySelectorAll('[data-bars]').forEach((h) => {
    const data = at(h.dataset.bars);
    if (data) renderBars(h, data, { unit: h.dataset.unit || '%', caption: h.dataset.caption });
  });

  document.querySelectorAll('[data-figures]').forEach((h) =>
    renderFigures(h, at(h.dataset.figures || 'figures')));

  document.querySelectorAll('[data-week]').forEach((h) =>
    renderWeek(h, at(h.dataset.week || 'week')));

  document.querySelectorAll('[data-gallery]').forEach((h) =>
    renderGallery(h, at(h.dataset.gallery || 'gallery')));

  renderToday(config);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY

   Cathedral sites put the date, the season and the next service on the
   homepage — it is the single thing that makes a church site feel inhabited
   rather than archived. We already resolve the season, so the rest is cheap.
   ═══════════════════════════════════════════════════════════════════════════ */

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

/** The next scheduled service at or after `now`, searching forward a week. */
export function nextService(services = [], now = new Date()) {
  if (!services.length) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();

  const candidates = services.flatMap((s) => {
    const day = WEEKDAYS.indexOf(String(s.day).toLowerCase());
    if (day < 0) return [];
    const [h, m] = String(s.time).split(':').map(Number);
    const mins = h * 60 + (m || 0);
    let delta = (day - today + 7) % 7;
    // Already started today → it belongs to next week.
    if (delta === 0 && mins <= nowMins) delta = 7;
    return [{ ...s, day, mins, when: delta * 1440 + mins - (delta === 0 ? nowMins : 0) }];
  });

  candidates.sort((a, b) => (a.day * 1440 + a.mins) - (b.day * 1440 + b.mins) || 0);
  const upcoming = candidates
    .map((c) => ({ ...c, rank: ((c.day - today + 7) % 7) * 1440 + c.mins - (c.day === today ? nowMins : 0) }))
    .filter((c) => c.rank > 0)
    .sort((a, b) => a.rank - b.rank);
  return upcoming[0] || candidates[0];
}

export function renderToday(config, now = new Date()) {
  const dateEl = document.querySelector('[data-today-date]');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString(config.locale || 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  const next = nextService(config.services, now);
  const label = next
    ? `${next.day === now.getDay() ? 'Today' : WEEKDAYS[next.day].replace(/^./, (c) => c.toUpperCase())}, ` +
      `${formatClock(next.time)} — ${next.label}`
    : null;

  document.querySelectorAll('[data-next-service]').forEach((el) => {
    if (label) el.textContent = label;
  });
  document.querySelectorAll('[data-today-note]').forEach((el) => {
    if (label) el.textContent = label;
  });
}
