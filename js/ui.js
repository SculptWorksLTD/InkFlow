// Strumenti di interfaccia: moduli generati da uno schema, finestre, notifiche, download.

import { esc } from './util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(msg, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

// ---------- campi ----------
// Campo: { name, label, type: text|tel|email|number|date|datetime-local|textarea|select|checkbox|chips, options, required, hint, full }
export function fieldHtml(f, value) {
  const v = value ?? f.default ?? '';
  const id = `f_${f.name}`;
  const req = f.required ? 'required' : '';
  const cls = `field${f.full || f.type === 'textarea' ? ' full' : ''}`;
  const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '';
  if (f.type === 'checkbox') {
    return `<label class="${cls} check"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}> <span>${esc(f.label)}</span>${hint}</label>`;
  }
  let input;
  if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  } else if (f.type === 'select') {
    const opts = (f.options || []).map((o) => {
      const [val, lab] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
    }).join('');
    input = `<select id="${id}" name="${f.name}" ${req}>${f.empty !== false ? '<option value="">—</option>' : ''}${opts}</select>`;
  } else {
    const list = f.datalist ? `list="${id}_dl"` : '';
    const dl = f.datalist ? `<datalist id="${id}_dl">${f.datalist.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${list} ${f.step ? `step="${f.step}"` : ''} placeholder="${esc(f.placeholder || '')}" ${f.type === 'number' ? 'inputmode="decimal"' : ''}>${dl}`;
  }
  return `<label class="${cls}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}${hint}</label>`;
}

export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === 'checkbox') out[f.name] = el.checked;
    else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
    else out[f.name] = el.value.trim();
  }
  return out;
}

// ---------- finestra modale ----------
export function modal({ title, body, actions = [], wide = false, onMount }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Chiudi">✕</button></header>
      <div class="modal-body">${body}</div>
      <footer>${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-act="${i}" type="${a.submit ? 'submit' : 'button'}">${esc(a.label)}</button>`).join('')}</footer>
    </div>`;
    const close = (val) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', async (e) => {
      if (e.target === wrap || e.target.closest('[data-close]')) return close(null);
      const b = e.target.closest('[data-act]');
      if (!b) return;
      e.preventDefault();
      const a = actions[Number(b.dataset.act)];
      if (!a.onClick) return close(a.value ?? null);
      const r = await a.onClick(wrap);
      if (r !== false) close(r ?? a.value ?? true);
    });
    document.body.appendChild(wrap);
    onMount && onMount(wrap, close);
    const first = wrap.querySelector('input:not([type=checkbox]),textarea,select');
    if (first && window.matchMedia('(pointer:fine)').matches) first.focus();
  });
}

// Modulo in una finestra: restituisce i valori o null se annullato.
export function formModal({ title, fields, values = {}, saveLabel = 'Salva', extraActions = [], wide, intro = '', onMount }) {
  const body = `${intro}<form class="grid-form" novalidate>${fields.map((f) => fieldHtml(f, values[f.name])).join('')}</form>`;
  return modal({
    title, wide, body, onMount,
    actions: [
      ...extraActions,
      { label: 'Annulla', value: null },
      {
        label: saveLabel, kind: 'primary', submit: true,
        onClick: (wrap) => {
          const form = wrap.querySelector('form');
          const missing = fields.filter((f) => f.required && !String(form.elements[f.name]?.value || '').trim());
          if (missing.length) { toast(`Compila: ${missing.map((f) => f.label).join(', ')}`); return false; }
          return readForm(form, fields);
        },
      },
    ],
  });
}

export function confirmBox(text, okLabel = 'Conferma', danger = false) {
  return modal({ title: 'Conferma', body: `<p>${esc(text)}</p>`, actions: [{ label: 'Annulla', value: false }, { label: okLabel, kind: danger ? 'danger' : 'primary', value: true }] });
}

export function download(filename, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiato'); } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copiato'); } catch { toast('Copia non riuscita'); }
    ta.remove();
  }
}

export const badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
export const empty = (text, cta = '') => `<div class="empty"><p>${esc(text)}</p>${cta}</div>`;
