/**
 * liturgy.js — resolves today's position in the Western church year.
 *
 * Writes two attributes on <html> and nothing else:
 *   data-season="lent"        the season id, consumed by core/css/liturgy.css
 *   data-season-use="sarum"   optional traditional variant, from church.config.json
 *
 * Everything moveable in the calendar hangs off Easter, so Easter is computed
 * first (anonymous Gregorian computus) and the rest falls out as fixed offsets.
 * All arithmetic is in UTC to avoid a church in a negative offset seeing
 * yesterday's season.
 *
 * No dependencies. ~2 KB. Safe to inline in <head> to avoid a colour flash.
 */

export const DAY = 86400000;

/** UTC midnight for a Y/M/D triple. */
const utc = (y, m, d) => Date.UTC(y, m, d);

/** Strip a Date down to its UTC midnight timestamp. */
const midnight = (date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * Easter Sunday for a Gregorian year — the "anonymous Gregorian algorithm".
 * Valid 1583–4099. Returns a UTC timestamp.
 */
export function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month - 1, day);
}

/**
 * The First Sunday of Advent for a given year: the fourth Sunday before
 * Christmas Day. When Christmas itself falls on a Sunday, the Sunday "before"
 * it is a full week earlier — hence the `|| 7`.
 */
export function advent(year) {
  const christmas = utc(year, 11, 25);
  const dow = new Date(christmas).getUTCDay(); // 0 = Sunday
  return christmas - ((dow || 7) + 21) * DAY;
}

/** Ordinal of the week within a season, 1-based, counted from its first day. */
const weekOf = (now, start) => Math.floor((now - start) / (7 * DAY)) + 1;

const ORDINAL = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth',
  'Seventh', 'Eighth', 'Ninth', 'Tenth'];

/**
 * Resolve a date to its liturgical season.
 * @param {Date} [date] defaults to now
 * @returns {{id:string, name:string, colour:string, week:number, label:string}}
 */
export function season(date = new Date()) {
  const now = midnight(date);
  const y = new Date(now).getUTCFullYear();

  const christmasDay = utc(y, 11, 25);
  const adventStart = advent(y);
  const epiphany = utc(y, 0, 6);

  // ── Late in the calendar year: Advent, then Christmas ──────────────────
  if (now >= adventStart && now < christmasDay) {
    const week = weekOf(now, adventStart);
    return mk('advent', 'Advent', 'violet', week, `Advent · ${ORDINAL[week]} Sunday`);
  }
  if (now >= christmasDay) {
    return mk('christmas', 'Christmastide', 'gold', 1, 'Christmastide');
  }

  // ── Early in the calendar year: the previous year's Christmas ──────────
  if (now < epiphany) {
    return mk('christmas', 'Christmastide', 'gold', 1, 'Christmastide');
  }

  // ── Everything between Epiphany and Advent hangs off Easter ────────────
  const E = easter(y);
  const ashWednesday = E - 46 * DAY;
  const palmSunday = E - 7 * DAY;
  const pentecost = E + 49 * DAY;

  if (now < ashWednesday) {
    const week = weekOf(now, epiphany);
    return mk('epiphany', 'Time after Epiphany', 'green', week, 'Time after Epiphany');
  }
  if (now < palmSunday) {
    const week = weekOf(now, ashWednesday);
    return mk('lent', 'Lent', 'violet', week, `Lent · Week ${week}`);
  }
  if (now < E) {
    return mk('holyweek', 'Holy Week', 'oxblood', 1, 'Holy Week');
  }
  if (now < pentecost) {
    const week = weekOf(now, E);
    return mk('easter', 'Eastertide', 'gold', week, `Eastertide · Week ${week}`);
  }
  if (now < pentecost + DAY) {
    return mk('pentecost', 'Pentecost', 'oxblood', 1, 'Pentecost');
  }

  const week = weekOf(now, pentecost + DAY);
  return mk('ordinary', 'Ordinary Time', 'green', week, 'Ordinary Time');
}

const mk = (id, name, colour, week, label) => ({ id, name, colour, week, label });

/**
 * Apply the season to the document and fill any [data-season-label] elements.
 * Call with the parsed church config so traditional variants are honoured.
 */
export function applySeason(config = {}, date = new Date()) {
  const s = season(date);
  const root = document.documentElement;

  root.dataset.season = s.id;

  // Traditional variants a parish may keep: Sarum blue in Advent, the
  // unbleached "Lenten array" instead of violet.
  const use = config.liturgical?.use || {};
  if (s.id === 'advent' && use.advent === 'sarum') root.dataset.seasonUse = 'sarum';
  else if (s.id === 'lent' && use.lent === 'array') root.dataset.seasonUse = 'array';
  else delete root.dataset.seasonUse;

  document.querySelectorAll('[data-season-label]').forEach((el) => {
    el.textContent = el.dataset.seasonLabel === 'long' ? s.label : s.name;
    el.setAttribute('data-resolved', '');
  });

  return s;
}
