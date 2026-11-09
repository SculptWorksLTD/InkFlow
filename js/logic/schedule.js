// Calcolo degli slot liberi in agenda, usato per offerte last-minute e statistiche.

import { addDays, parseYmd, ymd } from '../util.js';

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const busyStatus = (a) => a.status !== 'annullato' && a.status !== 'noshow';

// Restituisce gli intervalli liberi (almeno minMinutes) per ogni giorno da `from` per `days` giorni.
export function freeSlots({ appointments = [], settings, from = new Date(), days = 7, minMinutes = 60, artist = null }) {
  const out = [];
  const now = from instanceof Date ? from : new Date(from);
  for (let i = 0; i < days; i++) {
    const day = addDays(parseYmd(ymd(now)), i);
    const wd = (day.getDay() + 6) % 7;
    const h = settings.hours?.[wd];
    if (!h) continue;
    let open = toMin(h.open);
    const close = toMin(h.close);
    if (i === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      open = Math.max(open, Math.ceil(nowMin / 30) * 30);
    }
    const dayStr = ymd(day);
    const busy = appointments
      .filter((a) => busyStatus(a) && ymd(new Date(a.start)) === dayStr && (!artist || !a.artist || a.artist === artist))
      .map((a) => { const s = new Date(a.start); const st = s.getHours() * 60 + s.getMinutes(); return [st, st + (Number(a.durationMin) || 60)]; })
      .sort((x, y) => x[0] - y[0]);
    let cur = open;
    for (const [s, e] of busy) {
      if (s - cur >= minMinutes) out.push({ date: dayStr, startMin: cur, endMin: s });
      cur = Math.max(cur, e);
    }
    if (close - cur >= minMinutes) out.push({ date: dayStr, startMin: cur, endMin: close });
  }
  return out;
}

export const minToHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Ore di apertura e ore occupate in un intervallo di date (per la percentuale di riempimento).
export function occupancy({ appointments = [], settings, from, days = 7 }) {
  let openMin = 0;
  let busyMin = 0;
  for (let i = 0; i < days; i++) {
    const day = addDays(parseYmd(ymd(from)), i);
    const h = settings.hours?.[(day.getDay() + 6) % 7];
    if (!h) continue;
    openMin += toMin(h.close) - toMin(h.open);
    const dayStr = ymd(day);
    busyMin += appointments
      .filter((a) => busyStatus(a) && ymd(new Date(a.start)) === dayStr)
      .reduce((s, a) => s + (Number(a.durationMin) || 60), 0);
  }
  const artists = Math.max(1, (settings.artists || []).length);
  openMin *= artists;
  return { openHours: openMin / 60, busyHours: busyMin / 60, rate: openMin ? Math.min(1, busyMin / openMin) : 0 };
}
