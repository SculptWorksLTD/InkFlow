import { db } from '../db.js';
import { FORMATS, planWeek, captionFor, aiPrompt } from '../logic/content.js';
import { POST_STATUS } from '../logic/defaults.js';
import { addDays, buildIcs, daysBetween, esc, fmtDate, parseYmd, startOfWeek, ymd } from '../util.js';
import { formModal, modal, toast, copyText, download, badge, empty, $, $$ } from '../ui.js';
import { icon } from '../icons.js';

async function askAI(prompt, key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key,
      'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Errore IA ${res.status}`);
  const j = await res.json();
  return (j.content || []).map((c) => c.text || '').join('\n');
}

async function editPost(post, data) {
  const work = data.appointments.find((a) => a.id === post.appointmentId) || {};
  const recent = data.appointments.filter((a) => a.status === 'completato').slice(-15).reverse();
  const fields = [
    { name: 'date', label: 'Giorno', type: 'date', required: true },
    { name: 'format', label: 'Formato', type: 'select', options: Object.entries(FORMATS).map(([k, f]) => [k, f.label]), empty: false },
    { name: 'status', label: 'Stato', type: 'select', options: Object.entries(POST_STATUS), empty: false },
    { name: 'appointmentId', label: 'Lavoro collegato', type: 'select', options: recent.map((a) => [a.id, `${fmtDate(a.start)} · ${a.description || a.type}`]) },
    { name: 'caption', label: 'Didascalia', type: 'textarea', rows: 8 },
  ];
  let variant = 0;
  const v = await formModal({
    title: post.id ? 'Contenuto' : 'Nuovo contenuto', fields, values: { status: 'idea', ...post }, wide: true,
    intro: `<div class="tip" style="margin-bottom:12px" id="how">${esc(FORMATS[post.format || 'timelapse'].how)}</div>`,
    extraActions: [
      ...(post.id ? [{ label: 'Elimina', kind: 'danger', onClick: async () => { await db.remove('posts', post.id); return 'deleted'; } }] : []),
      { label: 'Copia didascalia', onClick: (w) => { copyText(w.querySelector('[name=caption]').value); return false; } },
      { label: 'Didascalia', onClick: (w) => {
        const f = w.querySelector('form');
        const wk = data.appointments.find((a) => a.id === f.appointmentId.value) || work;
        f.caption.value = captionFor({ format: f.format.value, work: wk, settings: data.settings, variant: variant++ });
        return false;
      } },
      ...(data.settings.anthropicKey ? [{ label: 'Scrivi con IA', onClick: async (w) => {
        const f = w.querySelector('form');
        const wk = data.appointments.find((a) => a.id === f.appointmentId.value) || work;
        toast('Sto scrivendo…');
        try { f.caption.value = await askAI(aiPrompt({ format: f.format.value, work: wk, settings: data.settings }), data.settings.anthropicKey); }
        catch (e) { toast(e.message); }
        return false;
      } }] : []),
    ],
    onMount: (w) => {
      const f = w.querySelector('form');
      f.format.onchange = () => { $('#how', w).textContent = FORMATS[f.format.value].how; };
    },
  });
  if (!v || v === 'deleted') return;
  await db.save('posts', { ...post, ...v, title: FORMATS[v.format].label });
  toast('Salvato');
}

export async function render(el, { data }) {
  const offset = Number(sessionStorage.getItem('cWeek') || 0);
  const ws = addDays(startOfWeek(), offset * 7);
  const from = ymd(ws);
  const to = ymd(addDays(ws, 7));
  const week = data.posts.filter((p) => p.date >= from && p.date < to).sort((a, b) => a.date.localeCompare(b.date));
  const published30 = data.posts.filter((p) => p.status === 'pubblicato' && daysBetween(parseYmd(p.date), new Date()) <= 30).length;
  // lavori recenti con consenso foto, non ancora usati in un contenuto
  const used = new Set(data.posts.map((p) => p.appointmentId).filter(Boolean));
  const consent = new Set(data.clients.filter((c) => c.consentPhoto).map((c) => c.id));
  const fresh = data.appointments.filter((a) => a.status === 'completato' && consent.has(a.clientId) && !used.has(a.id)
    && daysBetween(new Date(a.start), new Date()) <= 45).reverse();

  el.innerHTML = `
    <div class="page-head"><h1>Contenuti</h1>
      <div class="actions"><button class="btn" id="ics">${icon('download', 16)} Promemoria sul telefono</button>
      <button class="btn" id="add">${icon('plus', 16)} Contenuto</button>
      <button class="btn primary" id="gen">Prepara la settimana</button></div></div>
    <div class="kpis" style="margin-bottom:14px">
      <div class="kpi"><div class="v">${published30}</div><div class="l">Pubblicati negli ultimi 30 giorni</div><div class="s">Obiettivo: 20 (5 a settimana)</div></div>
      <div class="kpi"><div class="v">${fresh.length}</div><div class="l">Lavori con consenso foto non ancora usati</div></div>
    </div>
    <div class="tip" style="margin-bottom:14px">Il metodo: telefono sul treppiede a ogni seduta, il lunedì 30 minuti per programmare tutto con Meta Business Suite (gratis). Solo il tuo lavoro: time-lapse, prima/dopo, guariti, flash e 16 anni di storia dello studio. Niente balletti, niente facce in camera se non vuoi.</div>
    <div class="inline" style="margin-bottom:12px">
      <button class="btn sm" data-w="-1">‹</button><strong>Settimana dal ${fmtDate(ws)}</strong><button class="btn sm" data-w="1">›</button>
      ${offset ? '<button class="btn sm ghost" data-w="0">Questa settimana</button>' : ''}</div>
    <div class="list">${week.length ? week.map((p) => `
      <div class="row click" data-id="${p.id}">
        <div class="when"><strong>${esc(fmtDate(parseYmd(p.date), { weekday: true }))}</strong></div>
        <div class="grow"><div class="title">${esc(FORMATS[p.format]?.label || p.title)}</div>
          <div class="sub">${(() => { const w = data.appointments.find((a) => a.id === p.appointmentId); return w ? `Lavoro: ${esc(w.description || w.type)} · ` : ''; })()}${esc((p.platforms || []).join(', '))}${p.caption ? ' · didascalia pronta' : ''}</div></div>
        ${badge(POST_STATUS[p.status] || p.status, p.status === 'pubblicato' ? 'good' : p.status === 'idea' ? '' : 'accent')}
        ${p.status !== 'pubblicato' ? `<button class="btn sm" data-pub="${p.id}">${icon('check', 14)}</button>` : ''}
      </div>`).join('') : empty('Settimana vuota. Tocca "Prepara la settimana": ti crea 5 contenuti collegati ai lavori recenti.')}</div>

    <div class="section"><h2>I formati che usiamo</h2></div>
    <div class="grid">${Object.values(FORMATS).map((f) => `<div class="card"><h3>${esc(f.label)}</h3><p class="small muted">${esc(f.goal)}</p><p class="small">${esc(f.how)}</p></div>`).join('')}</div>`;

  $$('[data-w]', el).forEach((b) => { b.onclick = () => { const w = Number(b.dataset.w); sessionStorage.setItem('cWeek', w === 0 ? 0 : offset + w); render(el, { data }); }; });
  $('#add', el).onclick = () => editPost({ date: ymd(), format: 'timelapse' }, data);
  $$('.row[data-id]', el).forEach((r) => { r.onclick = (e) => { if (e.target.closest('[data-pub]')) return; editPost(data.posts.find((p) => p.id === r.dataset.id), data); }; });
  $$('[data-pub]', el).forEach((b) => { b.onclick = async () => { const p = data.posts.find((x) => x.id === b.dataset.pub); await db.save('posts', { ...p, status: 'pubblicato' }); }; });
  $('#gen', el).onclick = async () => {
    const weekIndex = Math.floor(daysBetween(new Date(2026, 0, 5), ws) / 7);
    const plan = planWeek({ weekStart: ws, recentWork: fresh, existing: week, weekIndex });
    if (!plan.length) { toast('La settimana è già pianificata'); return; }
    for (const p of plan) {
      const work = data.appointments.find((a) => a.id === p.appointmentId) || {};
      delete p._i;
      await db.save('posts', { ...p, caption: captionFor({ format: p.format, work, settings: data.settings }) });
    }
    toast(`${plan.length} contenuti pronti con didascalia`);
  };
  $('#ics', el).onclick = () => {
    const upcoming = data.posts.filter((p) => p.date >= ymd() && p.status !== 'pubblicato');
    if (!upcoming.length) { toast('Nessun contenuto in programma'); return; }
    const events = upcoming.map((p) => { const d = parseYmd(p.date); d.setHours(10, 0, 0, 0); return { id: p.id, start: d, durationMin: 15, alarmMin: 0, title: `Pubblica: ${FORMATS[p.format]?.label}`, description: p.caption || '' }; });
    download('inkflow-contenuti.ics', buildIcs(events, 'Contenuti social'), 'text/calendar');
    toast('Apri il file: ogni contenuto diventa un promemoria alle 10');
  };
}
