import { dueMessages, todayTasks, RULES } from '../logic/automations.js';
import { freeSlots, occupancy } from '../logic/schedule.js';
import { monthRevenue } from '../logic/stats.js';
import { logMessage } from '../store.js';
import { db } from '../db.js';
import { esc, fmtDate, fmtEuro, fmtPct, fmtTime, startOfWeek, waLink, ymd } from '../util.js';
import { badge, copyText, empty, toast, $$ } from '../ui.js';
import { icon } from '../icons.js';

const RULE = Object.fromEntries(RULES.map((r) => [r.id, r]));

export async function render(el, { data }) {
  const s = data.settings;
  const now = new Date();
  const today = ymd(now);
  const byClient = new Map(data.clients.map((c) => [c.id, c]));
  const queue = dueMessages({ ...data, today: now });
  const tasks = todayTasks({ ...data, today: now });
  const lastBackup = await db.getKV('lastBackup', null);
  const hasData = data.clients.length + data.appointments.length > 0;
  if (hasData && (!lastBackup || Date.now() - new Date(lastBackup) > 7 * 864e5)) {
    tasks.push({ icon: 'download', text: lastBackup ? 'Backup più vecchio di una settimana: scaricane uno nuovo' : 'Non hai ancora fatto un backup dei dati', href: '#/impostazioni' });
  }
  const todays = data.appointments.filter((a) => ymd(new Date(a.start)) === today && !['annullato'].includes(a.status));
  const occ = occupancy({ appointments: data.appointments, settings: s, from: startOfWeek(now), days: 7 });
  const slots = freeSlots({ appointments: data.appointments, settings: s, from: now, days: 3, minMinutes: 120 });
  const freeHours = Math.round(slots.reduce((a, x) => a + (x.endMin - x.startMin), 0) / 60);
  const newLeads = data.leads.filter((l) => l.status === 'nuova').length;
  const setup = [
    !s.reviewLink && 'il link alle recensioni Google',
    s.artists.length === 1 && s.artists[0] === 'Studio' && 'i nomi dei tatuatori',
  ].filter(Boolean);
  const hello = now.getHours() < 13 ? 'Buongiorno' : now.getHours() < 18 ? 'Buon pomeriggio' : 'Buonasera';

  el.innerHTML = `
    <div class="page-head"><div><h1>${hello}</h1><p class="muted" style="margin:2px 0 0">${esc(fmtDate(now, { weekday: true }))} · ${esc(s.studioName)}</p></div>
      <div class="actions"><a class="btn" href="#/richieste/nuova">${icon('plus', 16)} Richiesta</a><a class="btn primary" href="#/agenda/nuovo">${icon('plus', 16)} Appuntamento</a></div></div>
    ${setup.length ? `<div class="tip" style="margin-bottom:14px">Per far funzionare tutte le automazioni inserisci ${setup.join(' e ')} in <a href="#/impostazioni">Impostazioni</a>.</div>` : ''}
    <div class="kpis">
      <a class="kpi" href="#/agenda" style="text-decoration:none;color:inherit"><div class="v">${todays.length}</div><div class="l">Appuntamenti oggi</div></a>
      <a class="kpi" href="#/richieste" style="text-decoration:none;color:inherit"><div class="v">${newLeads}</div><div class="l">Richieste da rispondere</div></a>
      <div class="kpi"><div class="v">${fmtPct(occ.rate)}</div><div class="l">Agenda piena questa settimana</div><div class="s">${Math.round(occ.busyHours)} su ${Math.round(occ.openHours)} ore</div></div>
      <div class="kpi"><div class="v">${fmtEuro(monthRevenue(data.appointments, now))}</div><div class="l">Incassato questo mese</div></div>
    </div>

    ${tasks.length ? `<div class="section"><h2>Da fare</h2></div><div class="list">${tasks.map((t) =>
      `<a class="row click" href="${t.href}" style="text-decoration:none;color:inherit">${icon(t.icon)}<div class="grow">${esc(t.text)}</div><span class="muted">›</span></a>`).join('')}</div>` : ''}

    <div class="section"><h2>Messaggi pronti <span class="muted small">${queue.length}</span></h2>
      <span class="small muted">Tocca Invia: si apre WhatsApp con il testo già scritto</span></div>
    <div class="stack" id="queue">${queue.length ? queue.map((m, i) => `
      <div class="msg">
        <div class="head"><div><strong>${esc(m.name || 'Senza nome')}</strong> ${badge(RULE[m.ruleId]?.label || m.ruleId, m.ruleId === 'acconto' || m.ruleId === 'followupLead' ? 'warn' : 'accent')}</div>
          <span class="small muted">${esc(RULE[m.ruleId]?.why || '')}</span></div>
        <div class="text">${esc(m.text)}</div>
        <div class="acts">
          ${m.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(m.phone, m.text)}" data-send="${i}">${icon('wa', 16)} Invia</a>` : `<span class="badge warn">manca il telefono</span>`}
          <button class="btn sm" data-copy="${i}">${icon('copy', 14)} Copia</button>
          <button class="btn sm ghost" data-done="${i}">${icon('check', 14)} Già fatto</button>
          <button class="btn sm ghost" data-skip="${i}">Salta</button>
        </div>
      </div>`).join('') : empty('Nessun messaggio da inviare oggi. Le automazioni ti preparano qui promemoria, cure, recensioni e richiami appena servono.')}</div>

    <div class="section"><h2>Oggi in studio</h2><a href="#/agenda" class="small">Agenda ›</a></div>
    <div class="list">${todays.length ? todays.map((a) => {
      const c = byClient.get(a.clientId) || {};
      return `<div class="row"><span class="time">${fmtTime(a.start)}</span><div class="grow"><div class="title">${esc(c.name || '?')}</div>
        <div class="sub">${esc(a.type)}${a.description ? ' · ' + esc(a.description) : ''}${a.artist ? ' · ' + esc(a.artist) : ''}</div></div>
        ${a.deposit > 0 && !a.depositPaid && a.status !== 'completato' ? badge('acconto mancante', 'warn') : ''}
        ${a.status === 'completato' ? badge('fatto', 'good') : ''}</div>`;
    }).join('') : empty('Nessun appuntamento oggi.')}</div>

    ${freeHours >= 2 ? `<div class="section"><h2>Ore libere nei prossimi 3 giorni: ${freeHours}</h2></div>
      <div class="tip">Riempile con un'offerta last-minute ai clienti con consenso e una storia con gli slot liberi. <a href="#/offerte">Prepara l'offerta ›</a></div>` : ''}
  `;

  const handle = async (i, status) => { await logMessage(queue[i], status); };
  $$('[data-send]', el).forEach((b) => b.addEventListener('click', () => { setTimeout(() => handle(Number(b.dataset.send), 'inviato'), 400); }));
  $$('[data-copy]', el).forEach((b) => { b.onclick = () => copyText(queue[Number(b.dataset.copy)].text); });
  $$('[data-done]', el).forEach((b) => { b.onclick = () => handle(Number(b.dataset.done), 'inviato'); });
  $$('[data-skip]', el).forEach((b) => { b.onclick = async () => { await handle(Number(b.dataset.skip), 'saltato'); toast('Saltato'); }; });
}
