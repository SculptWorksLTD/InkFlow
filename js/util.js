// Funzioni di supporto senza dipendenze dal browser (testabili con node).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// ---------- date ----------
const pad = (n) => String(n).padStart(2, '0');

// Data locale in formato YYYY-MM-DD (non UTC, per evitare sfasamenti di mezzanotte).
export function ymd(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export function parseYmd(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const x = d instanceof Date ? new Date(d) : parseYmd(d);
  x.setDate(x.getDate() + n);
  return x;
}
// Giorni interi tra due date (b - a), ignorando l'ora.
export function daysBetween(a, b) {
  const A = parseYmd(ymd(a instanceof Date ? a : new Date(a)));
  const B = parseYmd(ymd(b instanceof Date ? b : new Date(b)));
  return Math.round((B - A) / 86400000);
}
export function startOfWeek(d = new Date()) {
  const x = parseYmd(ymd(d));
  const dow = (x.getDay() + 6) % 7; // lunedì = 0
  x.setDate(x.getDate() - dow);
  return x;
}
export const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function fmtDate(d, { weekday = false } = {}) {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x)) return '';
  const wd = weekday ? WEEKDAYS[(x.getDay() + 6) % 7].toLowerCase() + ' ' : '';
  return `${wd}${x.getDate()} ${MONTHS[x.getMonth()]}`;
}
export function fmtTime(d) {
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x) ? '' : `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export const fmtEuro = (n) => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const fmtPct = (n) => (n == null || !isFinite(n) ? '–' : `${Math.round(n * 100)}%`);

// ---------- telefono e WhatsApp ----------
// Restituisce il numero in formato internazionale senza "+" (es. 393469593629), o '' se non valido.
export function normalizePhone(raw, defaultCountry = '39') {
  let s = String(raw || '').trim();
  if (!s) return '';
  const plus = s.startsWith('+');
  s = s.replace(/\D/g, '');
  if (!s) return '';
  if (!plus && s.startsWith('00')) s = s.slice(2);
  else if (!plus && (s.startsWith('3') || s.startsWith('0')) && s.length <= 11) s = defaultCountry + s;
  return s.length >= 8 && s.length <= 15 ? s : '';
}
export function waLink(phone, text) {
  const p = normalizePhone(phone);
  const t = encodeURIComponent(text || '');
  return p ? `https://wa.me/${p}?text=${t}` : `https://wa.me/?text=${t}`;
}

// ---------- modelli di messaggio ----------
// Sostituisce {segnaposto}; quelli senza valore restano vuoti.
export function fillTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')).replace(/[ \t]+\n/g, '\n').trim();
}
export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// ---------- codici ----------
export function makeCode(name, existing = new Set(), rnd = Math.random) {
  const base = (String(name || 'INK').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase() + 'INK').slice(0, 4);
  for (let i = 0; i < 1000; i++) {
    const code = base + String(Math.floor(rnd() * 900) + 100);
    if (!existing.has(code)) return code;
  }
  return base + Date.now().toString().slice(-5);
}

// ---------- calendario .ics ----------
const icsDate = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00Z`;
};
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);

export function buildIcs(events, calName = 'InkFlow') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//InkFlow//IT', `X-WR-CALNAME:${icsText(calName)}`];
  for (const e of events) {
    const start = new Date(e.start);
    const end = new Date(e.end || start.getTime() + (e.durationMin || 60) * 60000);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@inkflow`, `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${icsText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.alarmMin) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:-PT${e.alarmMin}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function sum(arr, fn = (x) => x) { return arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0); }
export function groupCount(arr, fn) {
  const m = {};
  for (const x of arr) { const k = fn(x) || 'non indicato'; m[k] = (m[k] || 0) + 1; }
  return m;
}
