// Motore delle automazioni.
// Dati clienti, appuntamenti e storico messaggi, calcola i messaggi da inviare OGGI.
// Ogni messaggio ha una chiave unica (regola + riferimento): una volta segnato come
// inviato o saltato non viene più proposto.

import { daysBetween, fillTemplate, firstName, fmtDate, fmtTime, fmtEuro, ymd, parseYmd } from '../util.js';

export const RULES = [
  { id: 'promemoria', label: 'Promemoria appuntamento', why: 'Riduce chi non si presenta' },
  { id: 'acconto', label: 'Richiesta acconto', why: 'Senza acconto lo slot è a rischio' },
  { id: 'followupLead', label: 'Richiamo richiesta', why: 'Chi non riceve risposta va da un altro studio' },
  { id: 'cura', label: 'Istruzioni di cura', why: 'Guarigione migliore, cliente seguito' },
  { id: 'recensione', label: 'Richiesta recensione', why: 'Le recensioni Google portano clienti nuovi' },
  { id: 'fotoGuarita', label: 'Foto guarita e ritocco', why: 'Contenuto per i social e cliente fidelizzato' },
  { id: 'amico', label: 'Porta un amico', why: 'Passaparola con premio' },
  { id: 'ritorno', label: 'Secondo tatuaggio', why: 'Chi ne fa uno spesso ne fa un secondo' },
  { id: 'compleanno', label: 'Auguri di compleanno', why: 'Buono regalo personale' },
  { id: 'riattivazione', label: 'Riattivazione cliente', why: 'Clienti fermi da oltre un anno' },
];

// Finestre in giorni dopo l'appuntamento completato: [da, a].
// Se oggi cade nella finestra e il messaggio non è stato gestito, viene proposto.
export const WINDOWS = {
  cura: [0, 2],
  recensione: [3, 10],
  fotoGuarita: [28, 40],
  amico: [45, 60],
  ritorno: [90, 120],
};

const isActive = (a) => a.status === 'prenotato' || a.status === 'confermato';

export function buildVars(settings, client = {}, extra = {}) {
  return {
    nome: firstName(client.name),
    studio: settings.studioName,
    linkRecensione: settings.reviewLink || '[link recensione Google]',
    linkPrenotazione: settings.bookingLink || '',
    codice: client.referralCode || '',
    premio: fmtEuro(settings.referralReward || 20),
    ...extra,
  };
}

export function dueMessages({ clients = [], leads = [], appointments = [], messages = [], settings, today = new Date() }) {
  const handled = new Set(messages.map((m) => m.key));
  const byId = new Map(clients.map((c) => [c.id, c]));
  const todayStr = ymd(today);
  const out = [];
  const push = (ruleId, refId, client, extra = {}, meta = {}) => {
    const key = `${ruleId}:${refId}`;
    if (handled.has(key)) return;
    const tpl = settings.templates[ruleId];
    if (!tpl) return;
    out.push({
      key, ruleId, refId,
      clientId: client.id || null,
      name: client.name || meta.name || '',
      phone: client.phone || meta.phone || '',
      text: fillTemplate(tpl, buildVars(settings, client, extra)),
      ...meta,
    });
  };

  // Ultimo appuntamento completato e prossimo attivo, per cliente.
  const lastDone = new Map();
  const nextActive = new Map();
  for (const a of appointments) {
    if (a.status === 'completato') {
      const prev = lastDone.get(a.clientId);
      if (!prev || a.start > prev.start) lastDone.set(a.clientId, a);
    }
    if (isActive(a) && ymd(new Date(a.start)) >= todayStr) {
      const prev = nextActive.get(a.clientId);
      if (!prev || a.start < prev.start) nextActive.set(a.clientId, a);
    }
  }

  for (const a of appointments) {
    const c = byId.get(a.clientId) || {};
    const d = daysBetween(today, new Date(a.start)); // giorni che mancano all'appuntamento
    const when = { data: fmtDate(a.start, { weekday: true }), ora: fmtTime(a.start) };

    if (isActive(a)) {
      if (d >= 0 && d <= 1) push('promemoria', a.id, c, when, { due: 'entro domani' });
      if (!a.depositPaid && (a.deposit || 0) > 0 && d >= 0) {
        push('acconto', a.id, c, { ...when, acconto: fmtEuro(a.deposit) }, { due: 'acconto mancante' });
      }
    }

    if (a.status === 'completato') {
      const since = daysBetween(new Date(a.start), today);
      const inWin = (r) => since >= WINDOWS[r][0] && since <= WINDOWS[r][1];
      const isTattoo = a.type !== 'Consulenza';
      if (isTattoo && inWin('cura')) push('cura', a.id, c);
      if (isTattoo && inWin('recensione')) push('recensione', a.id, c);
      if (isTattoo && a.type !== 'Piercing' && inWin('fotoGuarita')) push('fotoGuarita', a.id, c);

      // Le regole di marketing valgono solo per l'ultimo appuntamento, con consenso e senza prenotazioni future.
      const isLast = lastDone.get(a.clientId)?.id === a.id;
      const free = !nextActive.has(a.clientId);
      if (isLast && free && c.consentMarketing) {
        if (inWin('amico') && c.referralCode) push('amico', a.id, c);
        if (inWin('ritorno')) push('ritorno', a.id, c);
      }
    }
  }

  for (const c of clients) {
    if (!c.consentMarketing) continue;
    if (c.birthday && c.birthday.slice(5, 10) === todayStr.slice(5, 10)) push('compleanno', `${c.id}:${todayStr.slice(0, 4)}`, c);
    const last = lastDone.get(c.id);
    if (last && !nextActive.has(c.id)) {
      const since = daysBetween(new Date(last.start), today);
      // una riattivazione ogni 6 mesi al massimo
      if (since >= 365) push('riattivazione', `${c.id}:${Math.floor(since / 182)}`, c);
    }
  }

  for (const l of leads) {
    if (!['nuova', 'contattata', 'preventivo'].includes(l.status)) continue;
    const idle = daysBetween(new Date(l.updatedAt || l.createdAt), today);
    if (idle >= 2 && idle <= 30) {
      const c = (l.clientId && byId.get(l.clientId)) || { name: l.name, phone: l.phone };
      // si ripropone se la richiesta viene aggiornata dopo un richiamo
      push('followupLead', `${l.id}:${ymd(new Date(l.updatedAt || l.createdAt))}`, c, { idea: l.idea || 'il tatuaggio' }, { leadId: l.id });
    }
  }

  const order = Object.fromEntries(RULES.map((r, i) => [r.id, i]));
  return out.sort((x, y) => order[x.ruleId] - order[y.ruleId]);
}

// Riepilogo per la schermata Oggi: cosa c'è da fare, in ordine di urgenza.
export function todayTasks({ leads = [], appointments = [], posts = [], today = new Date() }) {
  const t = ymd(today);
  const tasks = [];
  const fresh = leads.filter((l) => l.status === 'nuova');
  if (fresh.length) tasks.push({ icon: 'inbox', text: `${fresh.length} richieste nuove da rispondere`, href: '#/richieste' });
  const toClose = appointments.filter((a) => isActive(a) && new Date(a.start) < parseYmd(t));
  if (toClose.length) tasks.push({ icon: 'check', text: `${toClose.length} appuntamenti passati da chiudere (completato o non presentato)`, href: '#/agenda' });
  const postToday = posts.filter((p) => p.date === t && p.status !== 'pubblicato');
  if (postToday.length) tasks.push({ icon: 'camera', text: `${postToday.length} contenuti da pubblicare oggi`, href: '#/contenuti' });
  return tasks;
}
