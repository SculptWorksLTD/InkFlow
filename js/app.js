// Guscio dell'app: navigazione, caricamento delle schermate, aggiornamento automatico.

import { onChange, requestPersistence } from './db.js';
import { loadAll } from './store.js';
import { icon } from './icons.js';
import { $, toast } from './ui.js';
import { VERSION } from './version.js';

const ROUTES = {
  oggi: { label: 'Oggi', load: () => import('./views/oggi.js') },
  richieste: { label: 'Richieste', load: () => import('./views/richieste.js') },
  agenda: { label: 'Agenda', load: () => import('./views/agenda.js') },
  clienti: { label: 'Clienti', load: () => import('./views/clienti.js') },
  contenuti: { label: 'Contenuti', load: () => import('./views/contenuti.js') },
  sponsorizzate: { label: 'Sponsorizzate', load: () => import('./views/sponsorizzate.js') },
  offerte: { label: 'Offerte', load: () => import('./views/offerte.js') },
  statistiche: { label: 'Statistiche', load: () => import('./views/statistiche.js') },
  impostazioni: { label: 'Impostazioni', load: () => import('./views/impostazioni.js') },
};
// Barra in basso su telefono: le 4 voci più usate + "Altro".
const MOBILE_MAIN = ['oggi', 'agenda', 'richieste', 'clienti'];

function navHtml(active) {
  const side = Object.entries(ROUTES).map(([k, r]) =>
    `<a href="#/${k}" class="${k === active ? 'on' : ''}">${icon(k)}<span>${r.label}</span></a>`).join('');
  const more = !MOBILE_MAIN.includes(active);
  const bottom = MOBILE_MAIN.map((k) =>
    `<a href="#/${k}" class="${k === active ? 'on' : ''}">${icon(k)}<span>${ROUTES[k].label}</span></a>`).join('')
    + `<a href="#/altro" class="${more ? 'on' : ''}">${icon('altro')}<span>Altro</span></a>`;
  $('#side').innerHTML = `<div class="brand">InkFlow</div>${side}<div class="ver">v. ${VERSION}</div>`;
  $('#bottom').innerHTML = bottom;
}

function moreMenu() {
  const items = Object.entries(ROUTES).filter(([k]) => !MOBILE_MAIN.includes(k));
  return `<div class="page-head"><h1>Altro</h1></div><div class="more-grid">${items.map(([k, r]) =>
    `<a class="card more" href="#/${k}">${icon(k, 28)}<span>${r.label}</span></a>`).join('')}</div>
    <p class="muted center small">Versione ${VERSION}</p>`;
}

let rendering = false;
let pending = false;

export async function render() {
  if (rendering) { pending = true; return; }
  rendering = true;
  try {
    const [route, ...params] = (location.hash.replace(/^#\/?/, '') || 'oggi').split('/');
    const main = $('#main');
    navHtml(route);
    if (route === 'altro') { main.innerHTML = moreMenu(); return; }
    const r = ROUTES[route];
    if (!r) { location.hash = '#/oggi'; return; }
    document.title = `${r.label} · InkFlow`;
    const [mod, data] = await Promise.all([r.load(), loadAll()]);
    const scroll = main.dataset.route === route ? window.scrollY : 0;
    main.dataset.route = route;
    await mod.render(main, { data, params, rerender: render });
    window.scrollTo(0, scroll);
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="card error"><h2>Qualcosa è andato storto</h2><pre>${String(e.message || e)}</pre></div>`;
  } finally {
    rendering = false;
    if (pending) { pending = false; render(); }
  }
}

// ---------- aggiornamento automatico ----------
// Ogni pubblicazione cambia la versione del service worker: l'app la scarica in background
// e si ricarica da sola appena non c'è una finestra aperta (così non si perde quello che si sta scrivendo).
function setupUpdates() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const apply = (worker) => {
      const go = () => worker.postMessage('SKIP_WAITING');
      if (!document.querySelector('.modal-wrap')) { toast('Aggiornamento installato'); setTimeout(go, 800); return; }
      const t = setInterval(() => { if (!document.querySelector('.modal-wrap')) { clearInterval(t); go(); } }, 2000);
    };
    if (reg.waiting && navigator.serviceWorker.controller) apply(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) apply(w);
      });
    });
    const check = () => reg.update().catch(() => {});
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch((e) => console.warn('SW non registrato', e));
}

// ---------- avvio ----------
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
let t;
onChange(() => { clearTimeout(t); t = setTimeout(render, 50); });
setupUpdates();
requestPersistence();
render();
