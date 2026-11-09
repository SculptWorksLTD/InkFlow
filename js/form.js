// Modulo pubblico delle richieste. Non salva nulla: compone un messaggio WhatsApp strutturato
// che lo studio incolla nell'app (Richieste → Incolla da WhatsApp).
// Parametri nel link: ?t=<telefono studio>&s=<nome studio>&a=<indirizzo>

import { fieldHtml, readForm, toast } from './ui.js';
import { formatRequest } from './logic/leadParse.js';
import { DEFAULT_SETTINGS, STYLES } from './logic/defaults.js';
import { waLink, esc } from './util.js';

const q = new URLSearchParams(location.search);
const phone = q.get('t') || DEFAULT_SETTINGS.phone;
const studio = q.get('s') || DEFAULT_SETTINGS.studioName;
const addr = q.get('a') || DEFAULT_SETTINGS.address;

document.getElementById('studio').textContent = `${studio}: richiedi il tuo tatuaggio`;
document.title = `Richiesta tatuaggio · ${studio}`;
document.getElementById('addr').innerHTML = `${esc(studio)} · ${esc(addr)}`;

const FIELDS = [
  { name: 'name', label: 'Nome', required: true },
  { name: 'phone', label: 'Telefono', type: 'tel', required: true },
  { name: 'idea', label: 'Che tatuaggio vorresti?', type: 'textarea', rows: 3, required: true, placeholder: 'Soggetto, significato, reference…' },
  { name: 'bodyPart', label: 'Zona del corpo', placeholder: 'es. avambraccio interno' },
  { name: 'sizeCm', label: 'Misura indicativa (cm)', type: 'number' },
  { name: 'style', label: 'Stile', type: 'select', options: STYLES },
  { name: 'budget', label: 'Budget indicativo', type: 'select', options: ['fino a 100 €', '100-200 €', '200-400 €', '400-800 €', 'oltre 800 €', 'non so'] },
  { name: 'availability', label: 'Quando saresti disponibile?', placeholder: 'es. sabati, dopo le 17' },
  { name: 'source', label: 'Come ci hai trovato?', type: 'select', options: ['Instagram', 'Google', 'Passaparola', 'Passaggio in negozio', 'TikTok', 'Altro'] },
  { name: 'instagram', label: 'Il tuo Instagram (facoltativo)' },
  { name: 'privacy', label: 'Acconsento al trattamento dei dati per ricevere il preventivo', type: 'checkbox', required: true },
];

const form = document.getElementById('f');
form.innerHTML = FIELDS.map((f) => fieldHtml(f)).join('') + '<button class="btn primary full" style="grid-column:1/-1" type="submit">Invia su WhatsApp</button>';
let link = '';
form.onsubmit = (e) => {
  e.preventDefault();
  const v = readForm(form, FIELDS);
  const missing = FIELDS.filter((f) => f.required && !(f.type === 'checkbox' ? v[f.name] : String(v[f.name] ?? '').trim()));
  if (missing.length) { toast(`Manca: ${missing.map((f) => f.label).join(', ')}`); return; }
  delete v.privacy;
  link = waLink(phone, formatRequest(v));
  window.open(link, '_blank');
  document.getElementById('done').classList.add('show');
};
document.getElementById('again').onclick = (e) => { e.preventDefault(); if (link) location.href = link; };
