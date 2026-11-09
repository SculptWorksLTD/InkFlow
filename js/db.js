// Archivio locale: IndexedDB nel browser, memoria nei test.
// Tutte le funzioni sono asincrone e restituiscono copie dei record.

export const STORES = [
  'clients', 'leads', 'appointments', 'messages',
  'posts', 'campaigns', 'offers', 'giftcards', 'kv',
];

const DB_NAME = 'inkflow';
const DB_VERSION = 1;

export function uid(prefix = '') {
  const r = Math.random().toString(36).slice(2, 8);
  return prefix + Date.now().toString(36) + r;
}

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

// ---------- memoria (test / fallback) ----------
function memoryBackend() {
  const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return {
    async all(store) { return [...data[store].values()].map(clone); },
    async get(store, id) { return clone(data[store].get(id)); },
    async put(store, rec) { data[store].set(rec.id, clone(rec)); return clone(rec); },
    async del(store, id) { data[store].delete(id); },
    async clear(store) { data[store].clear(); },
  };
}

// ---------- IndexedDB ----------
function idbBackend() {
  let dbp;
  const open = () => {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  };
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let result;
      const req = fn(os);
      if (req) req.onsuccess = () => { result = req.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  return {
    all: (s) => tx(s, 'readonly', (os) => os.getAll()).then((r) => r || []),
    get: (s, id) => tx(s, 'readonly', (os) => os.get(id)),
    put: (s, rec) => tx(s, 'readwrite', (os) => os.put(clone(rec))).then(() => clone(rec)),
    del: (s, id) => tx(s, 'readwrite', (os) => os.delete(id)),
    clear: (s) => tx(s, 'readwrite', (os) => os.clear()),
  };
}

const hasIDB = typeof indexedDB !== 'undefined';
let backend = hasIDB ? idbBackend() : memoryBackend();
const listeners = new Set();

export function useMemoryBackend() { backend = memoryBackend(); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (store) => listeners.forEach((fn) => { try { fn(store); } catch (e) { console.error(e); } });

export const db = {
  all: (store) => backend.all(store),
  get: (store, id) => backend.get(store, id),
  async save(store, rec) {
    const now = new Date().toISOString();
    const r = { ...rec, id: rec.id || uid(store[0]), updatedAt: now };
    if (!r.createdAt) r.createdAt = now;
    await backend.put(store, r);
    emit(store);
    return r;
  },
  async remove(store, id) { await backend.del(store, id); emit(store); },
  async getKV(key, fallback) {
    const r = await backend.get('kv', key);
    return r ? r.value : fallback;
  },
  async setKV(key, value) { await backend.put('kv', { id: key, value }); emit('kv'); },

  // Backup completo in un unico oggetto JSON.
  async exportAll() {
    const out = { app: 'InkFlow', format: 1, exportedAt: new Date().toISOString(), data: {} };
    for (const s of STORES) out.data[s] = await backend.all(s);
    return out;
  },
  async importAll(dump, { replace = true } = {}) {
    if (!dump || dump.app !== 'InkFlow' || !dump.data) throw new Error('File di backup non valido');
    for (const s of STORES) {
      if (!Array.isArray(dump.data[s])) continue;
      if (replace) await backend.clear(s);
      for (const rec of dump.data[s]) if (rec && rec.id) await backend.put(s, rec);
    }
    emit('*');
  },
};

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* ignorato */ }
  return false;
}
