import { db } from '../db.js';
import { clientFromLead } from '../store.js';
import { APPT_STATUS, APPT_TYPES, STYLES } from '../logic/defaults.js';
import { addDays, buildIcs, esc, fmtDate, fmtEuro, fmtTime, parseYmd, startOfWeek, waLink, WEEKDAYS, ymd } from '../util.js';
import { formModal, confirmBox, toast, download, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { FORMATS } from '../logic/content.js';

function fields(data, settings) {
  return [
    { name: 'clientName', label: 'Cliente', required: true, datalist: data.clients.map((c) => c.name), hint: 'Scrivi un nome nuovo per creare il cliente' },
    { name: 'phone', label: 'Telefono (se cliente nuovo)', type: 'tel' },
    { name: 'date', label: 'Giorno', type: 'date', required: true },
    { name: 'time', label: 'Ora', type: 'time', required: true },
    { name: 'durationMin', label: 'Durata (minuti)', type: 'number', step: 15, default: 120 },
    { name: 'type', label: 'Tipo', type: 'select', options: APPT_TYPES, empty: false },
    { name: 'artist', label: 'Tatuatore', type: 'select', options: settings.artists, empty: false },
    { name: 'status', label: 'Stato', type: 'select', options: Object.entries(APPT_STATUS), empty: false, default: 'prenotato' },
    { name: 'description', label: 'Descrizione lavoro', placeholder: 'es. rosa fine line sul polso', full: true },
    { name: 'style', label: 'Stile', type: 'select', options: STYLES },
    { name: 'bodyPart', label: 'Zona del corpo' },
    { name: 'price', label: 'Prezzo (€)', type: 'number' },
    { name: 'deposit', label: 'Acconto (€)', type: 'number', default: settings.defaultDeposit },
    { name: 'depositPaid', label: 'Acconto ricevuto', type: 'checkbox' },
    { name: 'giftCode', label: 'Codice usato (amico, offerta, gift card)' },
    { name: 'notes', label: 'Note', type: 'textarea', rows: 2 },
  ];
}

export async function editAppointment(appt = {}, data, { lead, clientId } = {}) {
  const s = data.settings;
  const client = data.clients.find((c) => c.id === (appt.clientId || clientId));
  const start = appt.start ? new Date(appt.start) : null;
  const values = {
    ...appt,
    clientName: client?.name || lead?.name || '',
    phone: client?.phone || lead?.phone || '',
    date: start ? ymd(start) : '',
    time: start ? fmtTime(start) : '',
    description: appt.description ?? lead?.idea ?? '',
    style: appt.style ?? lead?.style ?? '',
    bodyPart: appt.bodyPart ?? lead?.bodyPart ?? '',
    price: appt.price ?? lead?.quote ?? null,
  };
  const F = fields(data, s);
  const v = await formModal({
    title: appt.id ? 'Modifica appuntamento' : 'Nuovo appuntamento', fields: F, values, wide: true,
    extraActions: appt.id ? [{ label: 'Elimina', kind: 'danger', onClick: async () => {
      if (await confirmBox('Eliminare questo appuntamento?', 'Elimina', true)) { await db.remove('appointments', appt.id); return 'deleted'; }
      return false;
    } }] : [],
  });
  if (!v || v === 'deleted') return null;

  let c = data.clients.find((x) => x.name.toLowerCase() === v.clientName.toLowerCase());
  if (!c) c = await clientFromLead({ name: v.clientName, phone: v.phone, source: lead?.source, instagram: lead?.instagram });
  const [h, m] = v.time.split(':').map(Number);
  const d = parseYmd(v.date); d.setHours(h, m, 0, 0);
  const rec = { ...appt, ...v, clientId: c.id, start: d.toISOString(), leadId: appt.leadId || lead?.id || null };
  delete rec.clientName; delete rec.phone; delete rec.date; delete rec.time;
  const saved = await db.save('appointments', rec);
  if (lead) await db.save('leads', { ...lead, status: 'prenotata', clientId: c.id });
  toast('Appuntamento salvato');
  return saved;
}

export async function render(el, { data, params }) {
  if (params[0] === 'nuovo') {
    history.replaceState(null, '', '#/agenda');
    editAppointment({}, data, { clientId: params[1] });
  }
  const offset = Number(sessionStorage.getItem('agWeek') || 0);
  const ws = addDays(startOfWeek(), offset * 7);
  const today = ymd();
  const byClient = new Map(data.clients.map((c) => [c.id, c]));
  const days = [...Array(7)].map((_, i) => ymd(addDays(ws, i)));
  const apptsBy = (d) => data.appointments.filter((a) => ymd(new Date(a.start)) === d);
  const postsBy = (d) => data.posts.filter((p) => p.date === d);
  const open = data.appointments.filter((a) => ['prenotato', 'confermato'].includes(a.status) && ymd(new Date(a.start)) < today);
  const noDeposit = data.appointments.filter((a) => ['prenotato', 'confermato'].includes(a.status) && ymd(new Date(a.start)) >= today && a.deposit > 0 && !a.depositPaid);

  el.innerHTML = `
    <div class="page-head"><h1>Agenda</h1>
      <div class="actions">
        <button class="btn" id="ics" title="Scarica il calendario per il telefono">${icon('download', 16)} Esporta nel calendario</button>
        <button class="btn primary" id="add">${icon('plus', 16)} Nuovo appuntamento</button></div></div>
    <div class="inline" style="margin-bottom:12px">
      <button class="btn sm" data-w="-1">‹</button>
      <strong>Settimana dal ${fmtDate(ws)}</strong>
      <button class="btn sm" data-w="1">›</button>
      ${offset ? '<button class="btn sm ghost" data-w="0">Oggi</button>' : ''}
    </div>
    ${open.length ? `<div class="tip" style="margin-bottom:12px">Ci sono ${open.length} appuntamenti passati ancora aperti: segnali come completati per far partire cura, recensione e ritorno.
      <div class="list" style="margin-top:8px">${open.map((a) => `<div class="inline"><span>${fmtDate(a.start)} · ${esc(byClient.get(a.clientId)?.name || '')}</span>
      <button class="btn sm" data-done="${a.id}">${icon('check', 14)} Completato</button><button class="btn sm ghost" data-noshow="${a.id}">Non presentato</button></div>`).join('')}</div></div>` : ''}
    ${noDeposit.length ? `<p class="small muted">Senza acconto: ${noDeposit.map((a) => esc(byClient.get(a.clientId)?.name || '')).join(', ')}</p>` : ''}
    <div class="week">${days.map((d, i) => `
      <div class="day ${d === today ? 'today' : ''}"><h4>${WEEKDAYS[i]} ${parseYmd(d).getDate()}</h4>
        ${apptsBy(d).map((a) => `<div class="ev ${a.status}" data-id="${a.id}"><strong>${fmtTime(a.start)}</strong> ${esc(byClient.get(a.clientId)?.name || '?')}<br>
          <span class="muted">${esc(a.type)}${a.description ? ' · ' + esc(a.description) : ''}${a.price ? ' · ' + fmtEuro(a.price) : ''}</span>
          ${a.deposit > 0 && !a.depositPaid && ['prenotato', 'confermato'].includes(a.status) ? '<br><span class="badge warn">acconto</span>' : ''}</div>`).join('')}
        ${postsBy(d).map((p) => `<a class="ev post" href="#/contenuti" style="display:block;text-decoration:none;color:inherit">📸 ${esc(FORMATS[p.format]?.label || p.title)}</a>`).join('')}
      </div>`).join('')}</div>`;

  $$('[data-w]', el).forEach((b) => { b.onclick = () => { const w = Number(b.dataset.w); sessionStorage.setItem('agWeek', w === 0 ? 0 : offset + w); render(el, { data, params: [] }); }; });
  $('#add', el).onclick = () => editAppointment({}, data);
  $$('.ev[data-id]', el).forEach((e) => { e.onclick = () => editAppointment(data.appointments.find((a) => a.id === e.dataset.id), data); });
  $$('[data-done]', el).forEach((b) => { b.onclick = async () => { const a = data.appointments.find((x) => x.id === b.dataset.done); await db.save('appointments', { ...a, status: 'completato' }); toast('Completato: le automazioni sono partite'); }; });
  $$('[data-noshow]', el).forEach((b) => { b.onclick = async () => { const a = data.appointments.find((x) => x.id === b.dataset.noshow); await db.save('appointments', { ...a, status: 'noshow' }); }; });
  $('#ics', el).onclick = () => {
    const from = new Date(Date.now() - 864e5);
    const events = data.appointments.filter((a) => new Date(a.start) >= from && !['annullato', 'noshow'].includes(a.status)).map((a) => {
      const c = byClient.get(a.clientId) || {};
      return {
        id: a.id, start: a.start, durationMin: a.durationMin || 60, alarmMin: 60,
        title: `${a.type}: ${c.name || ''}`,
        description: [a.description, c.phone && `Tel ${c.phone}`, c.phone && waLink(c.phone, ''), a.deposit && `Acconto ${a.depositPaid ? 'ricevuto' : 'DA RICEVERE'}`].filter(Boolean).join('\n'),
      };
    });
    download('inkflow-agenda.ics', buildIcs(events, `${data.settings.studioName} – agenda`), 'text/calendar');
    toast('Apri il file per aggiungere gli appuntamenti al calendario');
  };
}
