import { db } from '../db.js';
import { saveSettings, resetSettingsCache, requestFormUrl } from '../store.js';
import { DEFAULT_SETTINGS, PLACEHOLDERS } from '../logic/defaults.js';
import { RULES } from '../logic/automations.js';
import { esc, WEEKDAYS, ymd } from '../util.js';
import { readForm, fieldHtml, toast, download, confirmBox, copyText, $, $$ } from '../ui.js';
import { icon } from '../icons.js';
import { VERSION } from '../version.js';

const STUDIO = [
  { name: 'studioName', label: 'Nome studio', required: true },
  { name: 'phone', label: 'Telefono / WhatsApp dello studio', type: 'tel' },
  { name: 'address', label: 'Indirizzo' },
  { name: 'zone', label: 'Zona (per didascalie e hashtag)' },
  { name: 'foundedYear', label: 'Anno di apertura', type: 'number', hint: 'Gli anni di esperienza sono il vantaggio sugli studi nuovi: finiscono in didascalie e modulo' },
  { name: 'minPrice', label: 'Prezzo minimo di un tatuaggio (€)', type: 'number', hint: 'Mostrato nel modulo richieste: "tatuaggi da X €" filtra chi cerca solo il prezzo più basso' },
  { name: 'instagram', label: 'Instagram dello studio' },
  { name: 'reviewLink', label: 'Link recensione Google', hint: 'Google Business Profile → "Chiedi recensioni" → copia link', full: true },
  { name: 'bookingLink', label: 'Link prenotazione online (Fresha, Setmore…)', full: true },
  { name: 'artistsText', label: 'Tatuatori (separati da virgola)', full: true },
  { name: 'defaultDeposit', label: 'Acconto standard (€)', type: 'number' },
  { name: 'avgTicket', label: 'Prezzo medio di un lavoro (€)', type: 'number' },
  { name: 'targetCostPerBooking', label: 'Costo massimo per appuntamento da sponsorizzata (€)', type: 'number' },
  { name: 'referralReward', label: 'Premio porta un amico (€)', type: 'number' },
  { name: 'hashtags', label: 'Hashtag fissi', type: 'textarea', rows: 2 },
  { name: 'anthropicKey', label: 'Chiave API Claude (facoltativa, per scrivere didascalie con l\'IA)', type: 'password', full: true, hint: 'Resta solo su questo dispositivo. Senza chiave le didascalie usano i modelli integrati.' },
];

export async function render(el, { data }) {
  const s = data.settings;
  const lastBackup = await db.getKV('lastBackup', null);
  const formUrl = requestFormUrl(s);
  const studioVals = { ...s, artistsText: s.artists.join(', ') };

  el.innerHTML = `
    <div class="page-head"><h1>Impostazioni</h1><span class="muted small">Versione ${esc(VERSION)} · si aggiorna da sola</span></div>

    <div class="section"><h2>Studio</h2></div>
    <form class="card grid-form" id="studio">${STUDIO.map((f) => fieldHtml(f, studioVals[f.name])).join('')}
      <div class="full"><button class="btn primary" type="submit">Salva</button></div></form>

    <div class="section"><h2>Orari di apertura</h2></div>
    <form class="card" id="hours"><div class="stack">${WEEKDAYS.map((d, i) => {
      const h = s.hours[i];
      return `<div class="inline"><label class="inline" style="min-width:150px"><input type="checkbox" name="o${i}" ${h ? 'checked' : ''} style="width:20px;min-height:0"> ${d}</label>
        <input type="time" name="a${i}" value="${h?.open || '11:00'}" style="width:auto"> – <input type="time" name="c${i}" value="${h?.close || '19:30'}" style="width:auto"></div>`;
    }).join('')}</div><p><button class="btn primary" type="submit">Salva orari</button></p></form>

    <div class="section"><h2>Modulo richieste per i clienti</h2></div>
    <div class="card"><p>Mettilo nella bio di Instagram, su Google e nella risposta automatica di WhatsApp Business. Il cliente compila e ti arriva un messaggio WhatsApp già ordinato, che incolli in Richieste.</p>
      <p class="small" style="word-break:break-all"><a href="${esc(formUrl)}" target="_blank" rel="noopener">${esc(formUrl)}</a></p>
      <div class="inline"><button class="btn" id="copyForm">${icon('copy', 14)} Copia link</button></div></div>

    <div class="section"><h2>Messaggi automatici</h2></div>
    <form class="card" id="tpl"><p class="small muted">Segnaposto disponibili: ${esc(PLACEHOLDERS)}</p>
      <div class="stack">${RULES.map((r) => fieldHtml({ name: r.id, label: `${r.label} – ${r.why}`, type: 'textarea', rows: 3 }, s.templates[r.id])).join('')}</div>
      <p class="inline"><button class="btn primary" type="submit">Salva messaggi</button><button class="btn ghost" type="button" id="tplReset">Ripristina originali</button></p></form>

    <div class="section"><h2>Backup e dispositivi</h2></div>
    <div class="card"><p>I dati restano su questo dispositivo, anche offline. Per usarli su un altro dispositivo esporta il backup e importalo lì. Fai un backup almeno una volta a settimana e salvalo su Drive, iCloud o una chiavetta.</p>
      <p class="small muted">Ultimo backup: ${lastBackup ? esc(new Date(lastBackup).toLocaleString('it-IT')) : 'mai'}</p>
      <div class="inline"><button class="btn primary" id="exp">${icon('download', 16)} Scarica backup</button>
        <label class="btn">Importa backup<input type="file" accept="application/json,.json" id="imp" hidden></label>
        <button class="btn danger" id="wipe">Cancella tutti i dati</button></div></div>

    <div class="section"><h2>Installa l'app</h2></div>
    <div class="card small">
      <p><strong>iPhone:</strong> apri questa pagina con Safari → tasto Condividi → "Aggiungi alla schermata Home".</p>
      <p><strong>Android:</strong> Chrome → menu ⋮ → "Installa app".</p>
      <p><strong>Windows e Mac:</strong> Chrome o Edge → icona di installazione nella barra dell'indirizzo (oppure menu → "Installa InkFlow").</p>
      <p class="muted">Gli aggiornamenti arrivano da soli: a ogni nuova versione l'app si aggiorna appena la riapri.</p></div>`;

  $('#studio', el).onsubmit = async (e) => {
    e.preventDefault();
    const v = readForm(e.target, STUDIO);
    v.artists = v.artistsText.split(',').map((x) => x.trim()).filter(Boolean);
    if (!v.artists.length) v.artists = ['Studio'];
    delete v.artistsText;
    await saveSettings(v); toast('Impostazioni salvate');
  };
  $('#hours', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const hours = WEEKDAYS.map((_, i) => (f[`o${i}`].checked ? { open: f[`a${i}`].value, close: f[`c${i}`].value } : null));
    await saveSettings({ hours }); toast('Orari salvati');
  };
  $('#tpl', el).onsubmit = async (e) => {
    e.preventDefault();
    const templates = Object.fromEntries(RULES.map((r) => [r.id, e.target.elements[r.id].value]));
    await saveSettings({ templates }); toast('Messaggi salvati');
  };
  $('#tplReset', el).onclick = async () => { if (await confirmBox('Ripristinare tutti i messaggi originali?')) { await saveSettings({ templates: { ...DEFAULT_SETTINGS.templates } }); toast('Ripristinati'); } };
  $('#copyForm', el).onclick = () => copyText(formUrl);
  $('#exp', el).onclick = async () => {
    const dump = await db.exportAll();
    download(`inkflow-backup-${ymd()}.json`, JSON.stringify(dump), 'application/json');
    await db.setKV('lastBackup', new Date().toISOString());
  };
  $('#imp', el).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!await confirmBox('Importare il backup? I dati attuali su questo dispositivo verranno sostituiti.', 'Importa', true)) return;
    try { await db.importAll(JSON.parse(await file.text())); resetSettingsCache(); toast('Backup importato'); } catch (err) { toast(err.message); }
  };
  $('#wipe', el).onclick = async () => {
    if (!await confirmBox('Cancellare TUTTI i dati da questo dispositivo? Fai prima un backup.', 'Cancella tutto', true)) return;
    await db.importAll({ app: 'InkFlow', data: Object.fromEntries(['clients', 'leads', 'appointments', 'messages', 'posts', 'campaigns', 'offers', 'giftcards', 'kv'].map((k) => [k, []])) });
    resetSettingsCache(); toast('Dati cancellati');
  };
}
