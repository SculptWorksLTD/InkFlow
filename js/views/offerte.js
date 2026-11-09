import { db } from '../db.js';
import { freeSlots, minToHHMM } from '../logic/schedule.js';
import { esc, fmtDate, fmtEuro, firstName, makeCode, parseYmd, waLink, ymd } from '../util.js';
import { formModal, modal, toast, badge, empty, copyText, $, $$ } from '../ui.js';
import { icon } from '../icons.js';

const TABS = [['lastminute', 'Last-minute'], ['offerte', 'Offerte e Flash Day'], ['gift', 'Gift card'], ['amici', 'Porta un amico']];

// Invio a più clienti: un pulsante WhatsApp per persona, con il nome già inserito.
async function broadcast(title, text, clients) {
  const list = clients.filter((c) => c.consentMarketing && c.phone);
  const personal = (c) => text.replace(/\{nome\}/g, firstName(c.name)).replace(/\{codice\}/g, c.referralCode || '');
  await modal({
    title, wide: true,
    body: `<p class="small muted">${list.length} clienti con consenso marketing e telefono. Tocca uno alla volta: WhatsApp si apre con il messaggio personalizzato. Per inviare a tutti insieme copia il testo in una lista broadcast di WhatsApp Business.</p>
      <div class="msg"><div class="text">${esc(text)}</div><button class="btn sm" data-copyall>${icon('copy', 14)} Copia testo</button></div>
      <div class="list" style="margin-top:10px">${list.map((c, i) => `<div class="row"><div class="grow"><div class="title">${esc(c.name)}</div><div class="sub">${esc(c.phone)}</div></div>
        <a class="btn wa sm" target="_blank" rel="noopener" data-i="${i}" href="${waLink(c.phone, personal(c))}">${icon('wa', 16)} Invia</a></div>`).join('') || empty('Nessun cliente con consenso marketing.')}</div>`,
    actions: [{ label: 'Chiudi' }],
    onMount: (w) => {
      $('[data-copyall]', w).onclick = () => copyText(text.replace(/\{nome\}/g, '').replace(/^Ciao\s*!/, 'Ciao!'));
      $$('[data-i]', w).forEach((a) => a.addEventListener('click', () => { a.classList.remove('wa'); a.textContent = 'Inviato'; }));
    },
  });
}

function lastMinute(data) {
  const slots = freeSlots({ appointments: data.appointments, settings: data.settings, from: new Date(), days: 7, minMinutes: 120 });
  const text = (sel) => `Ciao {nome}! Da ${data.settings.studioName} si sono liberati dei posti: ${sel.map((s) => `${fmtDate(parseYmd(s.date), { weekday: true })} alle ${minToHHMM(s.startMin)}`).join(', ')}. Per chi prenota entro 48 ore i flash sono a prezzo fisso scontato. Ti mando i disegni?`;
  return {
    html: `<p class="muted">Slot di almeno 2 ore liberi nei prossimi 7 giorni, calcolati dall'agenda e dagli orari dello studio.</p>
      <div class="list">${slots.length ? slots.map((s, i) => `<label class="row"><input type="checkbox" data-slot="${i}" ${i < 3 ? 'checked' : ''} style="width:20px;min-height:0">
        <div class="grow"><div class="title">${esc(fmtDate(parseYmd(s.date), { weekday: true }))}</div><div class="sub">dalle ${minToHHMM(s.startMin)} alle ${minToHHMM(s.endMin)}</div></div></label>`).join('') : empty('Agenda piena nei prossimi 7 giorni.')}</div>
      ${slots.length ? '<div class="inline" style="margin-top:12px"><button class="btn primary" id="lmSend">Avvisa i clienti</button><button class="btn" id="lmStory">Testo per la storia</button></div>' : ''}`,
    bind: (el) => {
      const sel = () => $$('[data-slot]', el).filter((c) => c.checked).map((c) => slots[Number(c.dataset.slot)]);
      const b = $('#lmSend', el);
      if (b) b.onclick = () => { const s = sel(); if (!s.length) return toast('Scegli almeno uno slot'); broadcast('Offerta last-minute', text(s), data.clients); };
      const st = $('#lmStory', el);
      if (st) st.onclick = () => copyText(`POSTI LIBERI\n${sel().map((s) => `${fmtDate(parseYmd(s.date), { weekday: true })} · ${minToHHMM(s.startMin)}`).join('\n')}\nScrivici in DM 🖤`);
    },
  };
}

const OFFER_FIELDS = [
  { name: 'type', label: 'Tipo', type: 'select', options: [['flashday', 'Flash Day'], ['pacchetto', 'Pacchetto'], ['sconto', 'Sconto con codice'], ['evento', 'Evento / guest artist']], empty: false },
  { name: 'title', label: 'Titolo', required: true },
  { name: 'date', label: 'Data evento / inizio', type: 'date' },
  { name: 'validTo', label: 'Valida fino al', type: 'date' },
  { name: 'price', label: 'Prezzo (€)', type: 'number' },
  { name: 'code', label: 'Codice', hint: 'Da scrivere nell\'appuntamento quando viene usato' },
  { name: 'details', label: 'Dettagli', type: 'textarea', rows: 3, placeholder: 'es. 20 flash da 10 cm a prezzo fisso, primo arrivato primo servito' },
  { name: 'message', label: 'Messaggio ai clienti', type: 'textarea', rows: 4, hint: 'Usa {nome} per il nome' },
];

function offers(data) {
  const used = (code) => code ? data.appointments.filter((a) => (a.giftCode || '').toUpperCase() === code.toUpperCase()).length : 0;
  const list = [...data.offers].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return {
    html: `<div class="inline" style="margin-bottom:12px"><button class="btn primary" id="newFlash">Organizza un Flash Day</button><button class="btn" id="newOffer">${icon('plus', 16)} Altra offerta</button></div>
      <div class="tip" style="margin-bottom:12px">Flash Day: 15-20 disegni a prezzo fisso in un giorno solo. Crea fila, contenuti e clienti nuovi. Annuncialo 10 giorni prima, sponsorizzalo negli ultimi 5 e mandalo ai clienti con consenso. Evita gli sconti sul listino: abbassano il valore del tuo lavoro.</div>
      <div class="list">${list.length ? list.map((o) => `<div class="row click" data-o="${o.id}"><div class="grow"><div class="title">${esc(o.title)}</div>
        <div class="sub">${o.date ? fmtDate(o.date) : ''}${o.validTo ? ' → ' + fmtDate(o.validTo) : ''}${o.price ? ' · ' + fmtEuro(o.price) : ''}${o.code ? ' · codice ' + esc(o.code) : ''}</div></div>
        ${o.code ? badge(`usato ${used(o.code)} volte`, 'accent') : ''}${o.validTo && o.validTo < ymd() ? badge('scaduta') : ''}
        <button class="btn sm" data-bc="${o.id}">${icon('wa', 14)} Invia</button></div>`).join('') : empty('Nessuna offerta.')}</div>`,
    bind: (el) => {
      const edit = async (o) => {
        const v = await formModal({ title: o.id ? o.title : 'Nuova offerta', fields: OFFER_FIELDS, values: o, wide: true,
          extraActions: o.id ? [{ label: 'Elimina', kind: 'danger', onClick: async () => { await db.remove('offers', o.id); return 'deleted'; } }] : [] });
        if (v && v !== 'deleted') { await db.save('offers', { ...o, ...v, code: (v.code || '').toUpperCase() }); toast('Offerta salvata'); }
      };
      $('#newFlash', el).onclick = () => {
        const d = new Date(Date.now() + 14 * 864e5);
        while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
        edit({ type: 'flashday', title: `Flash Day ${fmtDate(d)}`, date: ymd(d), validTo: ymd(d), price: 80, code: 'FLASHDAY',
          details: '20 flash fino a 10 cm a prezzo fisso, solo su presentazione, primo arrivato primo servito.',
          message: `Ciao {nome}! Sabato ${fmtDate(d)} da ${data.settings.studioName} c'è il Flash Day: 20 disegni a 80 € fino a 10 cm, solo quel giorno. Vuoi vedere i disegni in anteprima e bloccare il tuo?` });
      };
      $('#newOffer', el).onclick = () => edit({ type: 'pacchetto' });
      $$('[data-o]', el).forEach((r) => { r.onclick = (e) => { if (e.target.closest('[data-bc]')) return; edit(data.offers.find((o) => o.id === r.dataset.o)); }; });
      $$('[data-bc]', el).forEach((b) => { b.onclick = () => { const o = data.offers.find((x) => x.id === b.dataset.bc); broadcast(o.title, o.message || `Ciao {nome}! ${o.title}: ${o.details || ''}`, data.clients); }; });
    },
  };
}

const GIFT_FIELDS = [
  { name: 'amount', label: 'Valore (€)', type: 'number', required: true },
  { name: 'balance', label: 'Credito residuo (€)', type: 'number' },
  { name: 'buyer', label: 'Acquistata da' },
  { name: 'recipient', label: 'Per' },
  { name: 'expires', label: 'Scadenza', type: 'date' },
  { name: 'paid', label: 'Pagata', type: 'checkbox' },
];

function gifts(data) {
  const list = [...data.giftcards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = list.reduce((s, g) => s + (Number(g.balance) || 0), 0);
  return {
    html: `<div class="inline" style="margin-bottom:12px"><button class="btn primary" id="newGift">${icon('plus', 16)} Nuova gift card</button></div>
      <div class="tip" style="margin-bottom:12px">Le gift card si incassano subito anche nei mesi lenti: spingile da fine novembre a Natale e prima di San Valentino. Credito ancora da usare: <strong>${fmtEuro(total)}</strong>.</div>
      <div class="list">${list.length ? list.map((g) => `<div class="row click" data-g="${g.id}"><div class="grow"><div class="title">${esc(g.code)} · ${fmtEuro(g.amount)}</div>
        <div class="sub">${esc(g.recipient || '')}${g.buyer ? ' da ' + esc(g.buyer) : ''}${g.expires ? ' · scade ' + fmtDate(g.expires) : ''}</div></div>
        ${badge(`residuo ${fmtEuro(g.balance)}`, g.balance > 0 ? 'good' : '')} ${g.paid ? '' : badge('da incassare', 'warn')}
        <button class="btn sm" data-txt="${g.id}">${icon('copy', 14)} Testo</button></div>`).join('') : empty('Nessuna gift card emessa.')}</div>`,
    bind: (el) => {
      const edit = async (g) => {
        const v = await formModal({ title: g.id ? `Gift card ${g.code}` : 'Nuova gift card', fields: GIFT_FIELDS, values: g,
          extraActions: g.id ? [{ label: 'Elimina', kind: 'danger', onClick: async () => { await db.remove('giftcards', g.id); return 'deleted'; } }] : [] });
        if (!v || v === 'deleted') return;
        const code = g.code || makeCode('GIFT', new Set(data.giftcards.map((x) => x.code)));
        await db.save('giftcards', { ...g, ...v, code, balance: v.balance ?? v.amount });
        toast(`Gift card ${code} salvata`);
      };
      $('#newGift', el).onclick = () => edit({ amount: 100, expires: ymd(new Date(Date.now() + 365 * 864e5)), paid: true });
      $$('[data-g]', el).forEach((r) => { r.onclick = (e) => { if (e.target.closest('[data-txt]')) return; edit(data.giftcards.find((g) => g.id === r.dataset.g)); }; });
      $$('[data-txt]', el).forEach((b) => { b.onclick = () => { const g = data.giftcards.find((x) => x.id === b.dataset.txt);
        copyText(`🎁 Gift card ${data.settings.studioName}\nValore: ${fmtEuro(g.amount)}${g.recipient ? `\nPer: ${g.recipient}` : ''}\nCodice: ${g.code}${g.expires ? `\nValida fino al ${fmtDate(g.expires)} ${new Date(g.expires).getFullYear()}` : ''}\n${data.settings.address}`); }; });
    },
  };
}

function friends(data) {
  const reward = data.settings.referralReward || 20;
  const rows = data.clients.filter((c) => c.referralCode).map((c) => {
    const brought = data.clients.filter((x) => x.referredBy && x.referredBy.toUpperCase() === c.referralCode.toUpperCase());
    const converted = brought.filter((b) => data.appointments.some((a) => a.clientId === b.id && a.status === 'completato'));
    return { c, brought, converted };
  }).filter((r) => r.brought.length).sort((a, b) => b.converted.length - a.converted.length);
  const tpl = data.settings.templates.amico;
  return {
    html: `<div class="tip" style="margin-bottom:12px">Ogni cliente ha un codice personale. Chi arriva con il codice ha ${fmtEuro(reward)} di sconto, chi lo ha portato ${fmtEuro(reward)} sul prossimo lavoro. Il messaggio parte da solo 45 giorni dopo il tatuaggio (sezione Oggi). Stampa il codice anche sul biglietto da visita con il QR.</div>
      <h3>Chi porta più amici</h3>
      ${rows.length ? `<table class="t"><tr><th>Cliente</th><th>Codice</th><th class="num">Amici arrivati</th><th class="num">Tatuati</th><th class="num">Premio maturato</th></tr>${rows.map((r) =>
        `<tr><td>${esc(r.c.name)}</td><td>${esc(r.c.referralCode)}</td><td class="num">${r.brought.length}</td><td class="num">${r.converted.length}</td><td class="num">${fmtEuro(r.converted.length * reward)}</td></tr>`).join('')}</table>`
        : empty('Ancora nessun amico arrivato con un codice. Quando registri un cliente nuovo, scrivi il codice nel campo "Codice amico usato".')}
      <div class="inline" style="margin-top:12px"><button class="btn" id="bcFriends">${icon('wa', 16)} Ricorda il programma a tutti</button></div>`,
    bind: (el) => {
      $('#bcFriends', el).onclick = () => broadcast('Porta un amico', tpl.replace('{studio}', data.settings.studioName).replace(/\{premio\}/g, fmtEuro(reward)), data.clients);
    },
  };
}

export async function render(el, { data }) {
  const tab = sessionStorage.getItem('offTab') || 'lastminute';
  const part = { lastminute: lastMinute, offerte: offers, gift: gifts, amici: friends }[tab](data);
  el.innerHTML = `<div class="page-head"><h1>Offerte</h1></div>
    <div class="tabs">${TABS.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="part">${part.html}</div>`;
  $$('[data-t]', el).forEach((b) => { b.onclick = () => { sessionStorage.setItem('offTab', b.dataset.t); render(el, { data }); }; });
  part.bind(el);
}
