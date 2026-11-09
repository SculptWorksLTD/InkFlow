import { weeklySeries, sourceBreakdown, weekStats } from '../logic/stats.js';
import { addDays, esc, fmtDate, fmtEuro, fmtPct, groupCount, parseYmd, startOfWeek } from '../util.js';
import { empty } from '../ui.js';

function bars(rows, key, fmt) {
  const max = Math.max(1, ...rows.map((r) => r[key] || 0));
  return `<div class="bars">${rows.map((r) => `<div class="b" title="${esc(fmt(r[key]))}"><span class="val">${esc(fmt(r[key]))}</span>
    <div class="bar" style="height:${Math.round(((r[key] || 0) / max) * 100)}%"></div><span class="lab">${parseYmd(r.week).getDate()}/${parseYmd(r.week).getMonth() + 1}</span></div>`).join('')}</div>`;
}

export async function render(el, { data }) {
  const series = weeklySeries(data, 8);
  const cur = weekStats({ ...data, weekStart: startOfWeek() });
  const prev = weekStats({ ...data, weekStart: addDays(startOfWeek(), -7) });
  const src = sourceBreakdown(data);
  const lost = Object.entries(groupCount(data.leads.filter((l) => l.status === 'persa'), (l) => l.lostReason)).sort((a, b) => b[1] - a[1]);
  const trend = (a, b) => (b == null || a == null || b === 0 ? '' : a >= b ? ` <span style="color:var(--good)">▲</span>` : ` <span style="color:var(--bad)">▼</span>`);
  const msgSent = data.messages.filter((m) => m.status === 'inviato');
  const byRule = groupCount(msgSent, (m) => m.ruleId);

  el.innerHTML = `
    <div class="page-head"><h1>Statistiche</h1><span class="muted small">settimana dal ${fmtDate(startOfWeek())}</span></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${cur.leads}${trend(cur.leads, prev.leads)}</div><div class="l">Richieste ricevute</div><div class="s">settimana scorsa ${prev.leads}</div></div>
      <div class="kpi"><div class="v">${fmtPct(cur.conversion)}</div><div class="l">Richieste diventate appuntamenti</div><div class="s">obiettivo: almeno 1 su 3</div></div>
      <div class="kpi"><div class="v">${fmtEuro(cur.revenue)}${trend(cur.revenue, prev.revenue)}</div><div class="l">Incasso sedute</div><div class="s">${cur.sessions} sedute · ${cur.noshow} non presentati</div></div>
      <div class="kpi"><div class="v">${fmtPct(cur.occ.rate)}</div><div class="l">Agenda piena</div><div class="s">${Math.round(cur.occ.openHours - cur.occ.busyHours)} ore libere</div></div>
      <div class="kpi"><div class="v">${byRule.recensione || 0}</div><div class="l">Recensioni richieste (totale)</div></div>
    </div>
    <div class="grid" style="margin-top:14px">
      <div class="card"><h3>Richieste per settimana</h3>${bars(series, 'leads', (v) => String(v || 0))}</div>
      <div class="card"><h3>Incasso per settimana</h3>${bars(series, 'revenue', (v) => (v ? Math.round(v / 100) / 10 + 'k' : '0'))}</div>
      <div class="card"><h3>Agenda piena</h3>${bars(series, 'occRate', (v) => fmtPct(v))}</div>
    </div>
    <div class="section"><h2>Da dove arrivano i clienti</h2></div>
    <div class="card">${src.length ? `<table class="t"><tr><th>Fonte</th><th class="num">Richieste</th><th class="num">Prenotate</th><th class="num">Conversione</th></tr>${src.map((r) =>
      `<tr><td>${esc(r.source)}</td><td class="num">${r.leads}</td><td class="num">${r.booked}</td><td class="num">${r.leads ? fmtPct(r.booked / r.leads) : '–'}</td></tr>`).join('')}</table>
      <p class="small muted" style="margin-top:8px">Sposta tempo e budget sulla fonte con più prenotazioni, non con più richieste.</p>` : empty('Servono le prime richieste con la fonte indicata.')}</div>
    <div class="grid" style="margin-top:14px">
      <div class="card"><h3>Perché perdiamo le richieste</h3>${lost.length ? `<table class="t">${lost.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')}</table>
        <p class="small muted">Se vince "Non ha più risposto", il problema è la velocità di risposta, non il prezzo.</p>` : '<p class="muted small">Nessuna richiesta persa registrata.</p>'}</div>
      <div class="card"><h3>Automazioni inviate</h3>${Object.keys(byRule).length ? `<table class="t">${Object.entries(byRule).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')}</table>` : '<p class="muted small">Ancora nessun messaggio inviato.</p>'}</div>
    </div>`;
}
