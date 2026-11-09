// I numeri che contano, calcolati da soli.

import { addDays, groupCount, parseYmd, startOfWeek, sum, ymd } from '../util.js';
import { occupancy } from './schedule.js';

const inRange = (iso, from, to) => { const d = ymd(new Date(iso)); return d >= from && d < to; };

export function weekStats({ leads = [], appointments = [], messages = [], settings, weekStart = startOfWeek() }) {
  const from = ymd(weekStart);
  const to = ymd(addDays(weekStart, 7));
  const wLeads = leads.filter((l) => inRange(l.createdAt, from, to));
  const booked = wLeads.filter((l) => l.status === 'prenotata').length;
  const done = appointments.filter((a) => a.status === 'completato' && inRange(a.start, from, to));
  const noshow = appointments.filter((a) => a.status === 'noshow' && inRange(a.start, from, to)).length;
  const reviewsAsked = messages.filter((m) => m.ruleId === 'recensione' && m.status === 'inviato' && inRange(m.at, from, to)).length;
  return {
    leads: wLeads.length,
    conversion: wLeads.length ? booked / wLeads.length : null,
    revenue: sum(done, (a) => a.price),
    sessions: done.length,
    noshow,
    reviewsAsked,
    occ: occupancy({ appointments, settings, from: parseYmd(from), days: 7 }),
  };
}

// Serie settimanali per i grafici (ultime n settimane).
export function weeklySeries(input, n = 8, today = new Date()) {
  const start = startOfWeek(today);
  const rows = [];
  for (let i = n - 1; i >= 0; i--) {
    const ws = addDays(start, -7 * i);
    const s = weekStats({ ...input, weekStart: ws });
    rows.push({ week: ymd(ws), ...s, occRate: s.occ.rate });
  }
  return rows;
}

export function sourceBreakdown({ leads = [], clients = [] }) {
  const leadSrc = groupCount(leads, (l) => l.source);
  const won = groupCount(leads.filter((l) => l.status === 'prenotata'), (l) => l.source);
  const keys = [...new Set([...Object.keys(leadSrc), ...Object.keys(groupCount(clients, (c) => c.source))])];
  return keys.map((k) => ({ source: k, leads: leadSrc[k] || 0, booked: won[k] || 0 }))
    .sort((a, b) => b.booked - a.booked || b.leads - a.leads);
}

export function monthRevenue(appointments, today = new Date()) {
  const m = ymd(today).slice(0, 7);
  return sum(appointments.filter((a) => a.status === 'completato' && ymd(new Date(a.start)).startsWith(m)), (a) => a.price);
}
