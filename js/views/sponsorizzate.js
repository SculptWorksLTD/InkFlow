import { db } from '../db.js';
import { PLATFORMS, PRESETS, metrics, advice } from '../logic/ads.js';
import { esc, fmtDate, fmtEuro, fmtPct, sum, ymd } from '../util.js';
import { formModal, toast, badge, empty, copyText, $, $$ } from '../ui.js';
import { icon } from '../icons.js';

const FIELDS = [
  { name: 'name', label: 'Nome campagna', required: true, full: true },
  { name: 'platform', label: 'Piattaforma', type: 'select', options: PLATFORMS, empty: false },
  { name: 'status', label: 'Stato', type: 'select', options: [['attiva', 'Attiva'], ['ferma', 'Ferma']], empty: false },
  { name: 'start', label: 'Inizio', type: 'date', required: true },
  { name: 'end', label: 'Fine', type: 'date' },
  { name: 'dailyBudget', label: 'Budget al giorno (€)', type: 'number' },
  { name: 'spent', label: 'Speso finora (€)', type: 'number', hint: 'Lo leggi in Gestione inserzioni' },
  { name: 'messages', label: 'Messaggi / contatti ricevuti', type: 'number' },
  { name: 'bookings', label: 'Appuntamenti presi', type: 'number', hint: 'Si aggiorna da solo con le richieste da "Sponsorizzata"' },
  { name: 'revenue', label: 'Incasso da quegli appuntamenti (€)', type: 'number' },
  { name: 'setup', label: 'Come è impostata', type: 'textarea', rows: 4 },
];

async function edit(c = {}) {
  const v = await formModal({
    title: c.id ? c.name : 'Nuova campagna', fields: FIELDS, values: { platform: PLATFORMS[0], status: 'attiva', start: ymd(), ...c }, wide: true,
    extraActions: c.id ? [{ label: 'Elimina', kind: 'danger', onClick: async () => { await db.remove('campaigns', c.id); return 'deleted'; } }] : [],
  });
  if (!v || v === 'deleted') return;
  await db.save('campaigns', { ...c, ...v });
  toast('Campagna salvata');
}

export async function render(el, { data }) {
  const s = data.settings;
  // Appuntamenti attribuiti automaticamente: richieste con fonte "Sponsorizzata" prenotate nel periodo della campagna.
  const adLeads = data.leads.filter((l) => l.source === 'Sponsorizzata');
  const camps = data.campaigns.map((c) => {
    const inPeriod = adLeads.filter((l) => ymd(new Date(l.createdAt)) >= c.start && (!c.end || ymd(new Date(l.createdAt)) <= c.end));
    const auto = { messages: inPeriod.length, bookings: inPeriod.filter((l) => l.status === 'prenotata').length };
    const merged = { ...c, messages: Math.max(c.messages || 0, auto.messages), bookings: Math.max(c.bookings || 0, auto.bookings) };
    return { c, merged, m: metrics(merged), a: advice(merged, s) };
  }).sort((x, y) => (y.c.status === 'attiva') - (x.c.status === 'attiva') || y.c.start.localeCompare(x.c.start));
  const active = camps.filter((x) => x.c.status === 'attiva');
  const spent = sum(camps, (x) => x.m.spent);
  const bookings = sum(camps, (x) => x.m.bookings);

  el.innerHTML = `
    <div class="page-head"><h1>Sponsorizzate</h1><div class="actions"><button class="btn primary" id="add">${icon('plus', 16)} Nuova campagna</button></div></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${active.length}</div><div class="l">Campagne attive</div><div class="s">${fmtEuro(sum(active, (x) => x.c.dailyBudget))} al giorno</div></div>
      <div class="kpi"><div class="v">${fmtEuro(spent)}</div><div class="l">Speso in totale</div></div>
      <div class="kpi"><div class="v">${bookings}</div><div class="l">Appuntamenti portati</div></div>
      <div class="kpi"><div class="v">${bookings ? fmtEuro(spent / bookings) : '–'}</div><div class="l">Costo per appuntamento</div><div class="s">Obiettivo ${fmtEuro(s.targetCostPerBooking)}</div></div>
    </div>
    <div class="tip" style="margin:14px 0">La regola: si giudica solo il costo per appuntamento, mai i like. Le richieste con fonte "Sponsorizzata" vengono contate da sole. Inizia solo quando rispondi ai messaggi entro un'ora, altrimenti paghi contatti che vanno persi.</div>
    <div class="stack">${camps.length ? camps.map(({ c, m, a }) => `
      <div class="card click" data-id="${c.id}" style="cursor:pointer">
        <div class="inline" style="justify-content:space-between"><h3 style="margin:0">${esc(c.name)}</h3>
          <span>${badge(c.platform)} ${badge(c.status === 'attiva' ? 'attiva' : 'ferma', c.status === 'attiva' ? 'good' : '')}</span></div>
        <p class="small muted">dal ${fmtDate(c.start)}${c.end ? ' al ' + fmtDate(c.end) : ''} · ${fmtEuro(c.dailyBudget)} al giorno</p>
        <table class="t"><tr><th>Speso</th><th>Messaggi</th><th>Appuntamenti</th><th>€ per messaggio</th><th>€ per appuntamento</th><th>Resa</th></tr>
          <tr><td>${fmtEuro(m.spent)}</td><td>${m.msgs}</td><td>${m.bookings}</td><td>${m.costPerMessage != null ? fmtEuro(m.costPerMessage) : '–'}</td>
          <td>${m.costPerBooking != null ? fmtEuro(m.costPerBooking) : '–'}</td><td>${m.roas != null ? m.roas.toFixed(1) + 'x' : '–'}</td></tr></table>
        <div class="tip advice ${a.level}" style="margin-top:10px">${esc(a.text)}</div>
      </div>`).join('') : empty('Nessuna campagna. Parti da un modello qui sotto con 5-10 € al giorno.')}</div>
    <div class="section"><h2>Modelli pronti</h2></div>
    <div class="grid">${PRESETS.map((p, i) => `<div class="card"><h3>${esc(p.name)}</h3><p class="small muted">${esc(p.platform)} · ${fmtEuro(p.dailyBudget)} al giorno</p>
      <p class="small">${esc(p.setup)}</p><div class="inline"><button class="btn sm primary" data-preset="${i}">Usa</button><button class="btn sm" data-copy="${i}">${icon('copy', 14)} Copia impostazioni</button></div></div>`).join('')}</div>
    <p class="small muted" style="margin-top:14px">Le inserzioni si creano e si pagano su Meta (Gestione inserzioni) e Google Ads: qui le imposti, le misuri e ricevi il consiglio su cosa tenere o spegnere.</p>`;

  $('#add', el).onclick = () => edit();
  $$('[data-id]', el).forEach((d) => { d.onclick = () => edit(data.campaigns.find((c) => c.id === d.dataset.id)); });
  $$('[data-preset]', el).forEach((b) => { b.onclick = () => { const p = PRESETS[Number(b.dataset.preset)]; edit({ name: p.name, platform: p.platform, dailyBudget: p.dailyBudget, setup: p.setup, start: ymd(), status: 'attiva' }); }; });
  $$('[data-copy]', el).forEach((b) => { b.onclick = () => copyText(PRESETS[Number(b.dataset.copy)].setup); });
}
