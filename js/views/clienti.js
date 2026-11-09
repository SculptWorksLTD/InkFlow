import { db } from '../db.js';
import { saveClient } from '../store.js';
import { SOURCES, APPT_STATUS } from '../logic/defaults.js';
import { esc, fmtDate, fmtEuro, waLink, sum } from '../util.js';
import { formModal, modal, confirmBox, badge, empty, toast, $, $$ } from '../ui.js';
import { icon } from '../icons.js';

export const CLIENT_FIELDS = [
  { name: 'name', label: 'Nome e cognome', required: true },
  { name: 'phone', label: 'Telefono', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'instagram', label: 'Instagram', placeholder: '@utente' },
  { name: 'birthday', label: 'Data di nascita', type: 'date', hint: 'Per gli auguri automatici' },
  { name: 'source', label: 'Come ci ha trovato', type: 'select', options: SOURCES },
  { name: 'referredBy', label: 'Codice amico usato', placeholder: 'es. GIUL123' },
  { name: 'tags', label: 'Etichette', placeholder: 'fine line, cover-up, VIP' },
  { name: 'notes', label: 'Note (allergie, pelle, preferenze)', type: 'textarea', rows: 3 },
  { name: 'consentMarketing', label: 'Consenso a ricevere offerte e messaggi promozionali (GDPR)', type: 'checkbox' },
  { name: 'consentPhoto', label: 'Consenso a pubblicare foto dei lavori', type: 'checkbox' },
];

export async function editClient(client = {}) {
  const v = await formModal({
    title: client.id ? 'Modifica cliente' : 'Nuovo cliente', fields: CLIENT_FIELDS, values: client, wide: true,
    extraActions: client.id ? [{ label: 'Elimina', kind: 'danger', onClick: async () => {
      if (await confirmBox(`Eliminare ${client.name}? Gli appuntamenti restano in agenda.`, 'Elimina', true)) {
        await db.remove('clients', client.id); toast('Cliente eliminato'); return 'deleted';
      }
      return false;
    } }] : [],
  });
  if (!v || v === 'deleted') return null;
  return saveClient({ ...client, ...v });
}

export async function showClient(id, data) {
  const c = data.clients.find((x) => x.id === id);
  if (!c) return;
  const appts = data.appointments.filter((a) => a.clientId === id).reverse();
  const msgs = data.messages.filter((m) => m.clientId === id && m.status === 'inviato').sort((a, b) => b.at.localeCompare(a.at));
  const referred = data.clients.filter((x) => x.referredBy && x.referredBy.toUpperCase() === (c.referralCode || '').toUpperCase());
  const spent = sum(appts.filter((a) => a.status === 'completato'), (a) => a.price);
  const body = `
    <div class="inline" style="margin-bottom:10px">
      ${c.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(c.phone, '')}">${icon('wa', 16)} WhatsApp</a>` : ''}
      ${c.phone ? `<a class="btn sm" href="tel:${esc(c.phone)}">Chiama</a>` : ''}
      ${c.instagram ? `<a class="btn sm" target="_blank" rel="noopener" href="https://instagram.com/${esc(c.instagram.replace('@', ''))}">Instagram</a>` : ''}
      <button class="btn sm" data-edit>Modifica</button>
      <a class="btn sm primary" href="#/agenda/nuovo/${c.id}" data-close>Nuovo appuntamento</a>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="v">${appts.filter((a) => a.status === 'completato').length}</div><div class="l">Sedute</div></div>
      <div class="kpi"><div class="v">${fmtEuro(spent)}</div><div class="l">Speso in totale</div></div>
      <div class="kpi"><div class="v">${referred.length}</div><div class="l">Amici portati</div><div class="s">Codice ${esc(c.referralCode || '–')}</div></div>
    </div>
    <p class="small muted" style="margin-top:10px">
      ${esc(c.source || 'Fonte non indicata')} · ${c.consentMarketing ? badge('consenso marketing', 'good') : badge('niente marketing', 'warn')}
      ${c.consentPhoto ? badge('foto ok', 'good') : ''} ${c.birthday ? '· nato il ' + fmtDate(c.birthday) : ''}
    </p>
    ${c.notes ? `<div class="tip">${esc(c.notes)}</div>` : ''}
    <h3 style="margin-top:16px">Appuntamenti</h3>
    ${appts.length ? `<table class="t"><tr><th>Data</th><th>Lavoro</th><th>Stato</th><th class="num">Prezzo</th></tr>${appts.map((a) =>
      `<tr><td>${fmtDate(a.start)} ${new Date(a.start).getFullYear()}</td><td>${esc(a.type)} ${esc(a.description || '')}</td><td>${esc(APPT_STATUS[a.status] || a.status)}</td><td class="num">${a.price ? fmtEuro(a.price) : ''}</td></tr>`).join('')}</table>` : '<p class="muted">Nessun appuntamento.</p>'}
    <h3 style="margin-top:16px">Messaggi automatici inviati</h3>
    ${msgs.length ? msgs.slice(0, 12).map((m) => `<p class="small">${fmtDate(m.at)} · ${esc(m.ruleId)}</p>`).join('') : '<p class="muted small">Nessuno.</p>'}`;
  await modal({
    title: c.name, wide: true, body, actions: [{ label: 'Chiudi' }],
    onMount: (wrap, close) => {
      $('[data-edit]', wrap).onclick = async () => { close(); await editClient(c); };
    },
  });
}

export async function render(el, { data, params }) {
  const q = (sessionStorage.getItem('cliQ') || '').toLowerCase();
  const filter = sessionStorage.getItem('cliF') || 'tutti';
  const lastDone = new Map();
  for (const a of data.appointments) if (a.status === 'completato') lastDone.set(a.clientId, a.start);
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString();
  const filters = {
    tutti: () => true,
    consenso: (c) => c.consentMarketing,
    dormienti: (c) => lastDone.has(c.id) && lastDone.get(c.id) < yearAgo,
    mai: (c) => !lastDone.has(c.id),
  };
  const list = data.clients.filter(filters[filter] || filters.tutti).filter((c) =>
    !q || [c.name, c.phone, c.instagram, c.tags, c.email].join(' ').toLowerCase().includes(q));

  el.innerHTML = `
    <div class="page-head"><h1>Clienti <span class="muted small">${data.clients.length}</span></h1>
      <div class="actions"><input class="search" type="search" placeholder="Cerca nome, telefono, etichetta" value="${esc(q)}" id="q">
      <button class="btn primary" id="add">${icon('plus', 16)} Nuovo cliente</button></div></div>
    <div class="tabs">${[['tutti', 'Tutti'], ['consenso', 'Con consenso marketing'], ['dormienti', 'Fermi da oltre un anno'], ['mai', 'Mai tatuati qui']]
      .map(([k, l]) => `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="list">${list.length ? list.map((c) => `
      <div class="row click" data-id="${c.id}">
        <div class="grow"><div class="title">${esc(c.name)}</div>
        <div class="sub">${esc(c.phone || '')} ${c.instagram ? '· ' + esc(c.instagram) : ''} ${lastDone.has(c.id) ? '· ultima seduta ' + fmtDate(lastDone.get(c.id)) : ''}</div></div>
        ${c.consentMarketing ? badge('marketing', 'good') : ''}
        ${c.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(c.phone, '')}" data-stop>${icon('wa', 16)}</a>` : ''}
      </div>`).join('') : empty(data.clients.length ? 'Nessun cliente con questi filtri.' : 'Ancora nessun cliente. Aggiungili a mano o arriveranno dalle richieste.')}</div>`;

  $('#q', el).oninput = (e) => { sessionStorage.setItem('cliQ', e.target.value); clearTimeout(el._t); el._t = setTimeout(() => render(el, { data, params }).then(() => { const i = $('#q', el); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
  $$('[data-f]', el).forEach((b) => { b.onclick = () => { sessionStorage.setItem('cliF', b.dataset.f); render(el, { data, params }); }; });
  $('#add', el).onclick = () => editClient();
  $$('.row[data-id]', el).forEach((r) => { r.onclick = (e) => { if (e.target.closest('[data-stop]')) return; showClient(r.dataset.id, data); }; });
  if (params[0]) { history.replaceState(null, '', '#/clienti'); showClient(params[0], data); }
}
