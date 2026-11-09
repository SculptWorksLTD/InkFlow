import { db } from '../db.js';
import { requestFormUrl } from '../store.js';
import { LEAD_STATUS, SOURCES, STYLES } from '../logic/defaults.js';
import { parseRequest } from '../logic/leadParse.js';
import { freeSlots, minToHHMM } from '../logic/schedule.js';
import { daysBetween, esc, fillTemplate, firstName, fmtDate, fmtEuro, waLink, parseYmd } from '../util.js';
import { formModal, modal, toast, badge, copyText, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { editAppointment } from './agenda.js';

const LEAD_FIELDS = [
  { name: 'name', label: 'Nome', required: true },
  { name: 'phone', label: 'Telefono / WhatsApp', type: 'tel' },
  { name: 'instagram', label: 'Instagram' },
  { name: 'source', label: 'Come ci ha trovato', type: 'select', options: SOURCES },
  { name: 'idea', label: 'Idea', type: 'textarea', rows: 2, required: true },
  { name: 'bodyPart', label: 'Zona del corpo' },
  { name: 'sizeCm', label: 'Misura (cm)' },
  { name: 'style', label: 'Stile', type: 'select', options: STYLES },
  { name: 'budget', label: 'Budget indicato' },
  { name: 'availability', label: 'Disponibilità' },
  { name: 'quote', label: 'Preventivo (€)', type: 'number' },
  { name: 'referralCode', label: 'Codice amico' },
  { name: 'status', label: 'Stato', type: 'select', options: Object.entries(LEAD_STATUS), empty: false, default: 'nuova' },
  { name: 'lostReason', label: 'Se persa, perché?', type: 'select', options: ['Prezzo', 'Non ha più risposto', 'Date', 'Stile non nostro', 'Ha scelto un altro studio', 'Altro'] },
  { name: 'notes', label: 'Note', type: 'textarea', rows: 2 },
];

export async function editLead(lead = {}) {
  const v = await formModal({
    title: lead.id ? 'Richiesta' : 'Nuova richiesta', fields: LEAD_FIELDS, values: lead, wide: true,
    extraActions: lead.id ? [{ label: 'Elimina', kind: 'danger', onClick: async () => { await db.remove('leads', lead.id); return 'deleted'; } }] : [],
  });
  if (!v || v === 'deleted') return null;
  return db.save('leads', { ...lead, ...v });
}

function nextSlotsText(data) {
  const slots = freeSlots({ appointments: data.appointments, settings: data.settings, from: new Date(), days: 14, minMinutes: 120 }).slice(0, 3);
  return slots.map((s) => `${fmtDate(parseYmd(s.date), { weekday: true })} dalle ${minToHHMM(s.startMin)}`).join(', ');
}

// Risposte pronte: prima risposta, preventivo, proposta date.
function replies(lead, data) {
  const s = data.settings;
  const nome = firstName(lead.name);
  const slots = nextSlotsText(data);
  return [
    ['Prima risposta', `Ciao ${nome}! Grazie per averci scritto, l'idea (${lead.idea || 'il tatuaggio'}) ci piace. Per darti un preventivo preciso mi mandi una foto della zona e la misura indicativa in cm? Se preferisci passa in studio per una consulenza gratuita: ${s.address}.`],
    ['Preventivo', `Ciao ${nome}, per ${lead.idea || 'il tuo tatuaggio'}${lead.sizeCm ? ` di circa ${lead.sizeCm} cm` : ''} il prezzo è ${lead.quote ? fmtEuro(lead.quote) : '[prezzo]'}, disegno personalizzato incluso. Per fissare la data serve un acconto di ${fmtEuro(s.defaultDeposit)}, scalato dal totale.${slots ? ` Le prime date libere: ${slots}.` : ''} Quale ti va meglio?`],
    ['Proponi date', `Ciao ${nome}! Ho queste date libere: ${slots || '[date]'}. Te ne blocco una?`],
    ['Fuori stile', `Ciao ${nome}, grazie per averci pensato! Questo stile non è la nostra specialità e vogliamo che tu abbia il risultato migliore: ti consigliamo di cercare un artista specializzato. Se in futuro hai altre idee, siamo qui.`],
  ].map(([t, x]) => [t, fillTemplate(x, {})]);
}

async function leadActions(lead, data) {
  const age = daysBetween(new Date(lead.createdAt), new Date());
  const body = `
    <p><strong>${esc(lead.idea || '')}</strong></p>
    <p class="small muted">${[lead.bodyPart, lead.sizeCm && lead.sizeCm + ' cm', lead.style, lead.budget && 'budget ' + lead.budget, lead.availability].filter(Boolean).map(esc).join(' · ')}</p>
    <p class="small muted">Arrivata ${age === 0 ? 'oggi' : `${age} giorni fa`} da ${esc(lead.source || 'fonte non indicata')} · ${esc(LEAD_STATUS[lead.status])}</p>
    <h3 style="margin-top:14px">Rispondi con un tocco</h3>
    <div class="stack">${replies(lead, data).map(([t, x], i) => `<div class="msg"><div class="head"><strong>${t}</strong></div><div class="text">${esc(x)}</div>
      <div class="acts"><a class="btn wa sm" target="_blank" rel="noopener" data-reply="${i}" href="${waLink(lead.phone, x)}">${icon('wa', 16)} Invia</a><button class="btn sm" data-copy="${i}">${icon('copy', 14)} Copia</button></div></div>`).join('')}</div>`;
  const R = replies(lead, data);
  await modal({
    title: lead.name, wide: true, body,
    actions: [
      { label: 'Modifica', onClick: async () => { setTimeout(() => editLead(lead)); } },
      { label: 'Segna persa', onClick: async () => { await db.save('leads', { ...lead, status: 'persa' }); } },
      { label: 'Prenota', kind: 'primary', onClick: async () => { setTimeout(() => editAppointment({}, data, { lead })); } },
    ],
    onMount: (wrap) => {
      $$('[data-copy]', wrap).forEach((b) => { b.onclick = () => copyText(R[Number(b.dataset.copy)][1]); });
      $$('[data-reply]', wrap).forEach((b) => {
        b.addEventListener('click', () => {
          const next = Number(b.dataset.reply) === 1 ? 'preventivo' : (lead.status === 'nuova' ? 'contattata' : lead.status);
          db.save('leads', { ...lead, status: next });
        });
      });
    },
  });
}

async function pasteLead() {
  const v = await formModal({
    title: 'Incolla richiesta da WhatsApp',
    intro: '<p class="small muted">Incolla il messaggio che arriva dal modulo richieste (inizia con "NUOVA RICHIESTA TATUAGGIO"). I campi si compilano da soli.</p>',
    fields: [{ name: 'text', label: 'Messaggio', type: 'textarea', rows: 8, required: true }], saveLabel: 'Continua',
  });
  if (!v) return;
  const parsed = parseRequest(v.text);
  if (!parsed.name && !parsed.idea) { toast('Non riconosco il formato: compila a mano'); return editLead({ notes: v.text }); }
  if (parsed.source && !SOURCES.includes(parsed.source)) parsed.source = SOURCES.find((s) => s.toLowerCase().startsWith(parsed.source.toLowerCase().slice(0, 5))) || 'Altro';
  return editLead({ ...parsed, status: 'nuova' });
}

export async function render(el, { data, params }) {
  if (params[0] === 'nuova') { history.replaceState(null, '', '#/richieste'); editLead(); }
  const cols = Object.entries(LEAD_STATUS);
  const showOld = sessionStorage.getItem('leadOld') === '1';
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const leads = data.leads.filter((l) => showOld || !['prenotata', 'persa'].includes(l.status) || l.updatedAt > monthAgo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const formUrl = requestFormUrl(data.settings);

  el.innerHTML = `
    <div class="page-head"><h1>Richieste</h1>
      <div class="actions"><button class="btn" id="paste">Incolla da WhatsApp</button>
      <button class="btn primary" id="add">${icon('plus', 16)} Nuova richiesta</button></div></div>
    <div class="tip" style="margin-bottom:14px">Link del modulo richieste da mettere in bio e nella risposta automatica di WhatsApp:
      <a href="${esc(formUrl)}" target="_blank" rel="noopener">${esc(formUrl)}</a> <button class="btn sm" id="copyForm">${icon('copy', 14)} Copia</button></div>
    <div class="kanban">${cols.map(([k, label]) => {
      const items = leads.filter((l) => l.status === k);
      return `<div class="col"><h3><span>${label}</span><span>${items.length}</span></h3>${items.map((l) => {
        const idle = daysBetween(new Date(l.updatedAt || l.createdAt), new Date());
        const late = ['nuova', 'contattata', 'preventivo'].includes(k) && idle >= 2;
        return `<div class="row click" data-id="${l.id}"><div class="title">${esc(l.name)}</div>
          <div class="sub">${esc(l.idea || '')}</div>
          <div class="inline small" style="margin-top:6px">${l.source ? badge(l.source) : ''} ${l.quote ? badge(fmtEuro(l.quote), 'accent') : ''} ${late ? badge(`ferma da ${idle} gg`, 'warn') : ''} ${k === 'persa' && l.lostReason ? badge(l.lostReason, 'bad') : ''}</div></div>`;
      }).join('')}</div>`;
    }).join('')}</div>
    <p class="small"><label class="inline"><input type="checkbox" id="old" ${showOld ? 'checked' : ''} style="width:auto;min-height:0"> Mostra anche prenotate e perse più vecchie di 30 giorni</label></p>`;

  $('#add', el).onclick = () => editLead();
  $('#paste', el).onclick = () => pasteLead();
  $('#copyForm', el).onclick = () => copyText(formUrl);
  $('#old', el).onchange = (e) => { sessionStorage.setItem('leadOld', e.target.checked ? '1' : '0'); render(el, { data, params: [] }); };
  $$('.row[data-id]', el).forEach((r) => { r.onclick = () => leadActions(data.leads.find((l) => l.id === r.dataset.id), data); });
}
