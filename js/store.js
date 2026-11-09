// Accesso ai dati per le schermate: impostazioni, caricamento completo, operazioni ricorrenti.

import { db } from './db.js';
import { DEFAULT_SETTINGS } from './logic/defaults.js';
import { makeCode } from './util.js';

let settingsCache = null;

export async function getSettings() {
  if (settingsCache) return settingsCache;
  const saved = await db.getKV('settings', {});
  settingsCache = {
    ...structuredClone(DEFAULT_SETTINGS), ...saved,
    templates: { ...DEFAULT_SETTINGS.templates, ...(saved.templates || {}) },
  };
  return settingsCache;
}
export async function saveSettings(patch) {
  const cur = await getSettings();
  settingsCache = { ...cur, ...patch, templates: { ...cur.templates, ...(patch.templates || {}) } };
  await db.setKV('settings', settingsCache);
  return settingsCache;
}
export function resetSettingsCache() { settingsCache = null; }

export async function loadAll() {
  const [clients, leads, appointments, messages, posts, campaigns, offers, giftcards, settings] = await Promise.all([
    db.all('clients'), db.all('leads'), db.all('appointments'), db.all('messages'),
    db.all('posts'), db.all('campaigns'), db.all('offers'), db.all('giftcards'), getSettings(),
  ]);
  clients.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  appointments.sort((a, b) => a.start.localeCompare(b.start));
  return { clients, leads, appointments, messages, posts, campaigns, offers, giftcards, settings };
}

// Salva un cliente assegnandogli un codice "porta un amico" se non lo ha.
export async function saveClient(c) {
  if (!c.referralCode) {
    const existing = new Set((await db.all('clients')).map((x) => x.referralCode).filter(Boolean));
    c.referralCode = makeCode(c.name, existing);
  }
  if (c.consentMarketing && !c.consentDate) c.consentDate = new Date().toISOString();
  if (!c.consentMarketing) c.consentDate = null;
  return db.save('clients', c);
}

// Registra che un messaggio automatico è stato inviato o saltato.
export function logMessage(item, status = 'inviato') {
  return db.save('messages', {
    key: item.key, ruleId: item.ruleId, clientId: item.clientId, refId: item.refId,
    status, at: new Date().toISOString(), text: status === 'inviato' ? item.text : '',
  });
}

// Link del modulo pubblico delle richieste, con i dati dello studio.
export function requestFormUrl(s) {
  const u = new URL('richiesta.html', location.href);
  u.hash = '';
  const digits = String(s.phone || '').replace(/\D/g, '');
  if (digits) u.searchParams.set('t', digits.startsWith('39') || String(s.phone).trim().startsWith('+') ? digits : '39' + digits);
  u.searchParams.set('s', s.studioName);
  if (s.address) u.searchParams.set('a', s.address);
  if (s.foundedYear) u.searchParams.set('y', s.foundedYear);
  if (s.minPrice) u.searchParams.set('p', s.minPrice);
  return u.href;
}

// Trova il cliente dal telefono o ne crea uno nuovo a partire da una richiesta.
export async function clientFromLead(lead) {
  const clients = await db.all('clients');
  const digits = (s) => String(s || '').replace(/\D/g, '').slice(-9);
  const match = lead.phone && clients.find((c) => digits(c.phone) && digits(c.phone) === digits(lead.phone));
  if (match) return match;
  return saveClient({
    name: lead.name || 'Senza nome', phone: lead.phone || '', instagram: lead.instagram || '',
    source: lead.source || '', consentMarketing: false, notes: '', referredBy: lead.referralCode || '',
  });
}
