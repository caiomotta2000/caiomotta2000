/* Store: ÚNICO ponto de persistência do app.
 * O resto do app só usa Store.get(), Store.update(fn), Store.subscribe(cb),
 * Store.exportJSON(), Store.importJSON().
 *
 * v1.1: o localStorage é SEMPRE o cache principal (local-first: funciona offline e sem nuvem).
 * A sincronização (js/sync.js) fica por fora: recebe aviso de cada mudança local
 * (onLocalChange) e entrega dados mesclados da nuvem com Store.applyRemote(state).
 * Cada update carimba updatedAt na criança que mudou e metaUpdatedAt quando mudam
 * os ajustes gerais (senha, idioma, taxas...) — usado no "último a gravar vence". */
(function (g) {
  'use strict';
  const KEY = 'mesada-amigo:v1';

  const LocalStorageAdapter = {
    name: 'local',
    available() { try { const k = '__t'; g.localStorage.setItem(k, '1'); g.localStorage.removeItem(k); return true; } catch (e) { return false; } },
    async load() {
      const raw = g.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    },
    async save(state) { g.localStorage.setItem(KEY, JSON.stringify(state)); },
    subscribe(onRemote) {
      // outra aba do mesmo aparelho
      const h = e => { if (e.key === KEY && e.newValue) onRemote(JSON.parse(e.newValue)); };
      g.addEventListener('storage', h);
      return () => g.removeEventListener('storage', h);
    }
  };

  // Fallback em memória (ex.: modo privado sem localStorage)
  const MemoryAdapter = { name: 'memory', _s: null, available() { return true; }, async load() { return this._s; }, async save(s) { this._s = JSON.parse(JSON.stringify(s)); }, subscribe() { return () => {}; } };

  let adapter = null;
  let state = null;
  const listeners = new Set();
  const changeHooks = new Set();
  let unsub = null;

  function pickAdapter() {
    if (LocalStorageAdapter.available()) return LocalStorageAdapter;
    return MemoryAdapter;
  }

  // assinatura leve de cada entidade (histórico entra só pelo tamanho + último id, para ser barato)
  function childSig(c) {
    const h = c.history || [];
    const o = Object.assign({}, c, { history: h.length + ':' + (h[0] ? h[0].id : ''), updatedAt: 0 });
    return JSON.stringify(o);
  }
  function metaSig(s) {
    return JSON.stringify({ p: Object.assign({}, s.parent, { lang: 0 }), r: s.bankRates, st: Object.assign({}, s.settings, { lastSeenVersion: 0 }), sv: s.schemaVersion });
  }
  function snapshotSigs(s) {
    const m = new Map();
    (s.children || []).forEach(c => m.set(c.id, childSig(c)));
    return { meta: metaSig(s), children: m, order: (s.children || []).map(c => c.id).join(',') };
  }
  function stampChanges(before, s) {
    const t = g.Logic.now();
    let changed = false;
    (s.children || []).forEach(c => {
      if (before.children.get(c.id) !== childSig(c)) { c.updatedAt = t; changed = true; }
    });
    if (before.meta !== metaSig(s)) { s.metaUpdatedAt = t; changed = true; }
    if (before.order !== (s.children || []).map(c => c.id).join(',')) { s.metaUpdatedAt = t; changed = true; }
    if (before.children.size !== (s.children || []).length) changed = true;
    return changed;
  }
  function stampAll(s) {
    const t = g.Logic.now();
    s.metaUpdatedAt = t;
    (s.children || []).forEach(c => { c.updatedAt = t; });
  }

  async function init(customAdapter) {
    adapter = customAdapter || pickAdapter();
    let loaded = null;
    try { loaded = await adapter.load(); } catch (e) {
      console.error('Store load failed, falling back', e);
      adapter = MemoryAdapter;
      loaded = await adapter.load();
    }
    state = loaded ? g.Logic.migrate(loaded) : g.Logic.emptyState();
    const before = snapshotSigs(state);
    const accrued = g.Logic.accrueAll(state) > 0;
    if (accrued) stampChanges(before, state);
    if (accrued || !loaded) await flush();
    if (unsub) unsub();
    unsub = adapter.subscribe ? adapter.subscribe(remote => { state = g.Logic.migrate(remote); emit({ remote: true }); }) : null;
    emit();
    if (accrued) notifyChange();
    return state;
  }

  function get() { return state; }

  async function flush() {
    state.updatedAt = g.Logic.now();
    try { await adapter.save(state); } catch (e) { console.error('Store save failed', e); throw e; }
  }

  /* Aplica uma mutação. Se a função lançar erro, o estado volta ao que era. */
  function update(fn) {
    const backup = JSON.stringify(state);
    const before = snapshotSigs(state);
    let result;
    try { result = fn(state); } catch (e) { state = JSON.parse(backup); throw e; }
    const changed = stampChanges(before, state);
    flush().catch(e => { if (g.onStoreError) g.onStoreError(e); });
    emit();
    if (changed) notifyChange();
    return result;
  }

  /* Estado vindo da nuvem (já mesclado pela sincronização): grava no cache local SEM avisar a sincronização. */
  async function applyRemote(newState) {
    state = g.Logic.migrate(newState);
    try { await flush(); } catch (e) { if (g.onStoreError) g.onStoreError(e); }
    emit({ remote: true });
  }

  function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
  function emit(meta) { listeners.forEach(cb => { try { cb(state, meta || {}); } catch (e) { console.error(e); } }); }
  function onLocalChange(cb) { changeHooks.add(cb); return () => changeHooks.delete(cb); }
  function notifyChange() { changeHooks.forEach(cb => { try { cb(state); } catch (e) { console.error(e); } }); }

  function exportJSON() {
    return JSON.stringify({ app: 'mesada-lili', appVersion: g.APP_VERSION, exportedAt: new Date().toISOString(), state }, null, 2);
  }
  async function importJSON(text) {
    const obj = JSON.parse(text);
    const s = g.Logic.migrate(obj && obj.state ? obj.state : obj);
    stampAll(s); // o backup importado passa a ser a versão mais nova
    state = s;
    await flush();
    emit();
    notifyChange();
  }

  /* Somente para testes / reset total */
  async function reset() { state = g.Logic.emptyState(); stampAll(state); await flush(); emit(); notifyChange(); }

  g.Store = { init, get, update, subscribe, onLocalChange, applyRemote, flush, exportJSON, importJSON, reset, adapterName: () => adapter && adapter.name, LocalStorageAdapter, MemoryAdapter, KEY };
})(typeof window !== 'undefined' ? window : globalThis);
