import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, waLink, fillTemplate, ymd, daysBetween, startOfWeek, buildIcs, makeCode } from '../js/util.js';
import { DEFAULT_SETTINGS } from '../js/logic/defaults.js';
import { dueMessages } from '../js/logic/automations.js';
import { freeSlots, occupancy } from '../js/logic/schedule.js';
import { planWeek, captionFor } from '../js/logic/content.js';
import { advice, metrics } from '../js/logic/ads.js';
import { formatRequest, parseRequest } from '../js/logic/leadParse.js';
import { weekStats } from '../js/logic/stats.js';
import { db, useMemoryBackend } from '../js/db.js';

const S = structuredClone(DEFAULT_SETTINGS);
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const TODAY = new Date(2026, 10, 9, 10, 0); // lunedì 9 novembre 2026

test('telefoni italiani e link WhatsApp', () => {
  assert.equal(normalizePhone('346 959 3629'), '393469593629');
  assert.equal(normalizePhone('+39 346-959-3629'), '393469593629');
  assert.equal(normalizePhone('0039 3469593629'), '393469593629');
  assert.equal(normalizePhone('+44 7700 900123'), '447700900123');
  assert.equal(normalizePhone('abc'), '');
  assert.match(waLink('3469593629', 'Ciao a tutti'), /^https:\/\/wa\.me\/393469593629\?text=Ciao%20a%20tutti$/);
});

test('modelli e date', () => {
  assert.equal(fillTemplate('Ciao {nome}, {x}!', { nome: 'Luca' }), 'Ciao Luca, !');
  assert.equal(daysBetween(new Date(2026, 0, 1, 23), new Date(2026, 0, 2, 1)), 1);
  assert.equal(ymd(startOfWeek(new Date(2026, 10, 15))), '2026-11-09');
  const ics = buildIcs([{ id: 'a', title: 'Tattoo, braccio', start: at(2026, 11, 10, 15), durationMin: 120 }]);
  assert.match(ics, /SUMMARY:Tattoo\\, braccio/);
  assert.match(ics, /BEGIN:VEVENT[\s\S]*END:VCALENDAR$/);
  const code = makeCode('Élena', new Set(), () => 0.5);
  assert.equal(code, 'ELEN550');
});

test('automazioni: promemoria, acconto, cura, recensione, ritorno', () => {
  const clients = [
    { id: 'c1', name: 'Giulia Rossi', phone: '3331112222', consentMarketing: true, referralCode: 'GIUL123' },
    { id: 'c2', name: 'Marco Bianchi', phone: '3334445555', consentMarketing: false, birthday: '1990-11-09' },
    { id: 'c3', name: 'Sara Neri', phone: '3336667777', consentMarketing: true, birthday: '1995-11-09' },
  ];
  const appointments = [
    { id: 'a1', clientId: 'c1', start: at(2026, 11, 10, 15), status: 'prenotato', deposit: 50, depositPaid: false, type: 'Tatuaggio' },
    { id: 'a2', clientId: 'c2', start: at(2026, 11, 9, 9), status: 'completato', type: 'Tatuaggio' },
    { id: 'a3', clientId: 'c2', start: at(2026, 11, 4, 15), status: 'completato', type: 'Tatuaggio' },
    { id: 'a4', clientId: 'c3', start: at(2026, 8, 1, 15), status: 'completato', type: 'Tatuaggio' },
  ];
  const due = dueMessages({ clients, appointments, messages: [], settings: S, today: TODAY });
  const keys = due.map((m) => m.key);
  assert.ok(keys.includes('promemoria:a1'));
  assert.ok(keys.includes('acconto:a1'));
  assert.ok(keys.includes('cura:a2'));
  assert.ok(keys.includes('recensione:a3'));
  assert.ok(keys.includes('ritorno:a4'), 'cliente con consenso a 100 giorni riceve il ritorno');
  assert.ok(keys.includes('compleanno:c3:2026'));
  assert.ok(!keys.some((k) => k.startsWith('compleanno:c2')), 'senza consenso niente marketing');
  assert.ok(!keys.includes('cura:a3'), 'cura solo nei primi 2 giorni');
  const promo = due.find((m) => m.key === 'promemoria:a1');
  assert.match(promo.text, /Giulia/);
  assert.match(promo.text, /15:00/);

  // una volta gestito non torna
  const again = dueMessages({ clients, appointments, messages: [{ key: 'promemoria:a1' }], settings: S, today: TODAY });
  assert.ok(!again.some((m) => m.key === 'promemoria:a1'));

  // con un appuntamento futuro il "ritorno" non parte
  const withNext = dueMessages({ clients, appointments: [...appointments, { id: 'a5', clientId: 'c3', start: at(2026, 12, 1), status: 'confermato' }], messages: [], settings: S, today: TODAY });
  assert.ok(!withNext.some((m) => m.key === 'ritorno:a4'));
});

test('automazioni: richiamo richieste ferme', () => {
  const leads = [
    { id: 'l1', name: 'Anna', phone: '3330000000', status: 'nuova', idea: 'rosa sul polso', createdAt: at(2026, 11, 6), updatedAt: at(2026, 11, 6) },
    { id: 'l2', name: 'Bea', status: 'nuova', createdAt: at(2026, 11, 9), updatedAt: at(2026, 11, 9) },
    { id: 'l3', name: 'Ciro', status: 'persa', createdAt: at(2026, 11, 1), updatedAt: at(2026, 11, 1) },
  ];
  const due = dueMessages({ leads, settings: S, today: TODAY });
  assert.equal(due.length, 1);
  assert.match(due[0].text, /rosa sul polso/);
});

test('slot liberi e riempimento', () => {
  const appointments = [
    { start: at(2026, 11, 10, 11), durationMin: 180, status: 'confermato' },
    { start: at(2026, 11, 10, 15), durationMin: 60, status: 'annullato' },
  ];
  const slots = freeSlots({ appointments, settings: S, from: new Date(2026, 10, 10, 8), days: 1 });
  assert.deepEqual(slots.map((s) => [s.startMin, s.endMin]), [[14 * 60, 19 * 60 + 30]]);
  const sunday = freeSlots({ appointments: [], settings: S, from: new Date(2026, 10, 15, 8), days: 1 });
  assert.equal(sunday.length, 0, 'domenica chiuso');
  const occ = occupancy({ appointments, settings: S, from: new Date(2026, 10, 10), days: 1 });
  assert.equal(occ.busyHours, 3);
});

test('piano contenuti e didascalie', () => {
  const plan = planWeek({ weekStart: new Date(2026, 10, 9), recentWork: [{ id: 'a9', description: 'rosa' }] });
  assert.equal(plan.length, 5);
  assert.equal(plan[0].date, '2026-11-09');
  assert.equal(plan[0].appointmentId, 'a9');
  const cap = captionFor({ format: 'flash', settings: S });
  assert.match(cap, /FLASH in DM/);
  assert.match(cap, /#tattoomilano/);
  assert.doesNotMatch(cap, /balletto|trend/i);
});

test('sponsorizzate: metriche e consigli', () => {
  const ok = { start: '2026-11-01', spent: 60, messages: 20, bookings: 3, revenue: 600 };
  assert.equal(metrics(ok, TODAY).costPerBooking, 20);
  assert.equal(advice(ok, S, TODAY).level, 'good');
  assert.equal(advice({ start: '2026-11-01', spent: 80, messages: 10, bookings: 0 }, S, TODAY).level, 'bad');
  assert.equal(advice({ start: '2026-11-08', spent: 10, messages: 1, bookings: 0 }, S, TODAY).level, 'neutral');
});

test('modulo richieste: andata e ritorno', () => {
  const data = { name: 'Luca Verdi', phone: '3471234567', idea: 'lupo geometrico', bodyPart: 'avambraccio', sizeCm: '15', source: 'Instagram' };
  const parsed = parseRequest(formatRequest(data));
  assert.deepEqual(parsed, data);
  assert.equal(parseRequest('*Nome:* Pia\n• Zona: caviglia').bodyPart, 'caviglia');
});

test('statistiche settimanali', () => {
  const leads = [
    { status: 'prenotata', createdAt: at(2026, 11, 9), source: 'Instagram' },
    { status: 'nuova', createdAt: at(2026, 11, 10), source: 'Google' },
  ];
  const appointments = [{ status: 'completato', start: at(2026, 11, 9, 14), price: 250, durationMin: 120 }];
  const w = weekStats({ leads, appointments, settings: S, weekStart: new Date(2026, 10, 9) });
  assert.equal(w.leads, 2);
  assert.equal(w.conversion, 0.5);
  assert.equal(w.revenue, 250);
});

test('archivio e backup', async () => {
  useMemoryBackend();
  const c = await db.save('clients', { name: 'Test' });
  assert.ok(c.id && c.createdAt);
  const dump = await db.exportAll();
  await db.remove('clients', c.id);
  assert.equal((await db.all('clients')).length, 0);
  await db.importAll(dump);
  assert.equal((await db.all('clients'))[0].name, 'Test');
  await assert.rejects(() => db.importAll({ foo: 1 }));
});
