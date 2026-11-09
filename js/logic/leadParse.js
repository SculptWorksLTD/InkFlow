// Il modulo pubblico delle richieste manda allo studio un messaggio WhatsApp strutturato.
// Qui lo si incolla e diventa una richiesta in automatico.

export const FIELDS = [
  ['name', 'Nome'], ['phone', 'Telefono'], ['idea', 'Idea'], ['bodyPart', 'Zona'],
  ['sizeCm', 'Misura'], ['style', 'Stile'], ['budget', 'Budget'],
  ['availability', 'Disponibilità'], ['source', 'Come ci hai trovato'], ['instagram', 'Instagram'],
];

export function formatRequest(data) {
  const lines = ['NUOVA RICHIESTA TATUAGGIO'];
  for (const [k, label] of FIELDS) if (data[k]) lines.push(`${label}: ${String(data[k]).replace(/\n/g, ' ')}`);
  return lines.join('\n');
}

export function parseRequest(text) {
  const out = {};
  const byLabel = Object.fromEntries(FIELDS.map(([k, l]) => [l.toLowerCase(), k]));
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/^[\s*•\-–]+/, '').replace(/\*/g, '');
    const i = line.indexOf(':');
    if (i < 1) continue;
    const key = byLabel[line.slice(0, i).trim().toLowerCase()];
    const val = line.slice(i + 1).trim();
    if (key && val) out[key] = val;
  }
  if (out.sizeCm) out.sizeCm = out.sizeCm.replace(/[^\d.,x ]/gi, '').trim();
  return out;
}
