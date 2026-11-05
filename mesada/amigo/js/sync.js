/* Sincronização na nuvem (opcional) — controlador.
 *
 * Local-first: o Store continua gravando no localStorage; isto aqui só espelha na nuvem.
 * Sem conta da família conectada, NADA de rede acontece (o SDK do Firebase nem é baixado).
 *
 * createSync({ adapter, store, storage, now, isOnline, deviceId }) -> objeto Sync
 *   adapter: transporte (js/adapters/firestore-adapter.js; nos testes, tests/mock-adapter.js)
 *   store:   { get(), applyRemote(state), onLocalChange(cb) }
 *   storage: { getItem, setItem, removeItem } (localStorage)
 *
 * Status: 'off' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error' | 'signedOut' */
(function (g) {
  'use strict';
  const C = g.SyncCore || (typeof require === 'function' ? require('./sync-core.js') : null);
  const REC_KEY = 'mesada-amigo:sync';
  const PRE_SYNC_BACKUP_KEY = 'mesada-amigo:pre-sync-backup';
  const PHOTO_GRACE_MS = 10 * 60 * 1000;

  function createSync(opts) {
    const adapter = opts.adapter;
    const store = opts.store;
    const storage = opts.storage;
    const now = opts.now || (() => Date.now());
    const isOnline = opts.isOnline || (() => true);
    const setTimer = opts.setTimeout || ((f, ms) => setTimeout(f, ms));
    const debounceMs = opts.debounceMs === undefined ? 800 : opts.debounceMs;

    let rec = loadRec();
    let status = rec.enabled ? 'connecting' : 'off';
    let lastError = null;
    let unlisten = null;
    let remote = null;          // { core, history, photos, photoMeta, fromCache }
    let remoteReady = false;
    let pushing = null;
    let pendingRemote = null;
    let pushTimer = null;
    let retryTimer = null;
    const statusListeners = new Set();
    let started = false;

    function loadRec() {
      let r = null;
      try { r = JSON.parse(storage.getItem(REC_KEY) || 'null'); } catch (e) { r = null; }
      r = r || {};
      if (!r.deviceId) r.deviceId = opts.deviceId || ('d' + Math.random().toString(36).slice(2, 10));
      return r;
    }
    function saveRec() { try { storage.setItem(REC_KEY, JSON.stringify(rec)); } catch (e) { console.error('sync rec save', e); } }

    function setStatus(s, err) {
      status = s; lastError = err || (s === 'error' ? lastError : null);
      statusListeners.forEach(cb => { try { cb(info()); } catch (e) { console.error(e); } });
    }
    function info() {
      return { status, enabled: !!rec.enabled, email: rec.email || null, uid: rec.uid || null, lastSyncAt: rec.lastSyncAt || null, error: lastError, dirty: !!rec.dirty };
    }
    function onStatus(cb) { statusListeners.add(cb); return () => statusListeners.delete(cb); }

    function errCode(e) {
      const c = (e && (e.code || e.message)) || String(e);
      return String(c).replace(/^auth\//, '').replace(/^firestore\//, '');
    }
    function isNetErr(e) {
      const c = errCode(e);
      return /unavailable|network|offline|failed-precondition|deadline|sdk-load|Failed to fetch|import/i.test(c);
    }

    // ---------- integração de dados remotos ----------
    function localParts() { return C.toCloud(store.get()); }

    function build(core, historyByChild, photos) {
      return C.fromCloud(core, historyByChild, photos, store.get());
    }

    function receive(raw, meta) {
      const fromCache = !!(meta && meta.fromCache);
      const core = C.docsToCore(raw);
      if (!core && fromCache) return; // cache vazio: espera o servidor
      remote = {
        core,
        history: C.docsToHistory(raw),
        photos: C.docsToPhotos(raw),
        photoMeta: raw.photos || {},
        historyDocIds: Object.keys(raw.history || {}),
        fromCache
      };
      remoteReady = true;
      if (pushing) { pendingRemote = true; return; }
      integrate();
    }

    async function integrate() {
      if (!remote) return;
      const lp = localParts();
      if (!remote.core) {
        // nuvem vazia (ex.: dados apagados no console): este aparelho manda o que tem
        rec.base = null; rec.dirty = true; saveRec();
        schedulePush(0);
        return;
      }
      const merged = C.merge3(rec.base, lp.core, remote.core);
      const ids = Object.keys(merged.children);
      const hist = C.mergeHistoryByChild(lp.history, remote.history, ids);
      const photos = Object.assign({}, remote.photos, lp.photos);
      const next = build(merged, hist, photos);
      rec.base = remote.core;
      const needPush = !C.eq(merged, remote.core) || Object.keys(C.historyToUpload(pickIds(lp.history, ids), remote.history)).length > 0;
      if (needPush) rec.dirty = true;
      saveRec();
      if (!C.eq(stateSig(next), stateSig(store.get()))) await store.applyRemote(next);
      if (needPush) schedulePush(debounceMs);
      else if (!pushing) { rec.dirty = false; rec.lastSyncAt = now(); saveRec(); setStatus(remote.fromCache || !isOnline() ? 'offline' : 'synced'); }
    }
    function pickIds(obj, ids) { const o = {}; ids.forEach(id => { if (obj[id]) o[id] = obj[id]; }); return o; }
    function stateSig(s) { const x = C.clone(s); delete x.updatedAt; return x; }

    // ---------- envio ----------
    function schedulePush(ms) {
      if (!rec.enabled) return;
      clearTimeout(pushTimer);
      pushTimer = setTimer(() => { push().catch(() => {}); }, ms === undefined ? debounceMs : ms);
    }

    async function push() {
      if (!rec.enabled || !rec.uid) return;
      if (pushing) return pushing.catch(() => {}).then(() => { if (rec.dirty) return push(); });
      if (!remoteReady) return; // espera a primeira leitura da nuvem
      pushing = doPush();
      try { await pushing; } finally {
        pushing = null;
        if (pendingRemote) { pendingRemote = null; await integrate(); }
      }
    }

    async function doPush() {
      if (!isOnline()) { setStatus('offline'); return; }
      setStatus('syncing');
      const start = localParts();
      const base = rec.base || null;
      try {
        // 1) fotos novas (antes do core, para a referência nunca apontar para foto inexistente)
        const refs = C.photoRefs(start.core);
        const newPhotos = {};
        refs.forEach(id => {
          if (!(remote && remote.photos[id]) && start.photos[id]) {
            if (C.bytes(start.photos[id]) > C.MAX_DOC_BYTES) { console.warn('photo too big, kept local only', id); return; }
            newPhotos[id] = start.photos[id];
          }
        });
        if (Object.keys(newPhotos).length) await adapter.putPhotos(rec.uid, newPhotos);
        // 2) histórico novo (só acrescenta, gravação idempotente)
        const hist = C.historyToUpload(start.history, (remote && remote.history) || {});
        if (Object.keys(hist).length) await adapter.addHistory(rec.uid, hist);
        // 3) core numa transação: lê a nuvem atual, mescla, grava só o que mudou
        const extraIds = new Set(Object.keys(start.core.children).concat(base ? Object.keys(base.children) : []));
        const merged = await adapter.transact(rec.uid, [...extraIds], current => {
          const curCore = C.docsToCore(current);
          const m = C.merge3(curCore ? base : null, start.core, curCore);
          const docs = C.coreToDocs(m);
          C.checkSize(docs);
          const ops = { meta: null, set: {}, del: [] };
          const curMeta = current.meta && current.meta.data;
          if (curMeta !== docs.meta.data) ops.meta = Object.assign({}, docs.meta, { by: rec.deviceId });
          Object.keys(docs.children).forEach(id => {
            const cur = current.children[id];
            if (!cur || cur.data !== docs.children[id].data) ops.set[id] = docs.children[id];
          });
          Object.keys(current.children).forEach(id => { if (current.children[id] && !docs.children[id]) ops.del.push(id); });
          return { ops, result: m };
        });
        // 4) limpeza (melhor esforço): histórico de criança apagada, fotos sem uso
        const removed = base ? Object.keys(base.children).filter(id => !merged.children[id]) : [];
        if (removed.length && remote) {
          const docIds = (remote.historyDocIds || []).filter(d => removed.some(id => d.startsWith(id + '_')));
          if (docIds.length && adapter.deleteHistoryDocs) await adapter.deleteHistoryDocs(rec.uid, docIds).catch(() => {});
        }
        if (remote && adapter.deletePhotos) {
          const used = C.photoRefs(merged);
          const stale = Object.keys(remote.photoMeta || {}).filter(id => !used.has(id) && (now() - ((remote.photoMeta[id] || {}).createdAt || 0)) > PHOTO_GRACE_MS);
          if (stale.length) await adapter.deletePhotos(rec.uid, stale).catch(() => {});
        }
        // 5) atualiza base e reaplica mudanças locais feitas durante o envio
        rec.base = merged;
        const nowParts = localParts();
        let nextCore = merged;
        const changedMeanwhile = !C.eq(nowParts.core, start.core);
        if (changedMeanwhile) nextCore = C.merge3(start.core, nowParts.core, merged);
        const ids = Object.keys(nextCore.children);
        const histAll = C.mergeHistoryByChild(nowParts.history, (remote && remote.history) || {}, ids);
        const photos = Object.assign({}, remote ? remote.photos : {}, nowParts.photos);
        const next = build(nextCore, histAll, photos);
        if (!C.eq(stateSig(next), stateSig(store.get()))) await store.applyRemote(next);
        const histPending = Object.keys(C.historyToUpload(nowParts.history, start.history)).length > 0;
        rec.dirty = changedMeanwhile || histPending;
        rec.lastSyncAt = now();
        saveRec();
        setStatus(rec.dirty ? 'syncing' : (isOnline() ? 'synced' : 'offline'));
        if (rec.dirty) schedulePush(debounceMs);
      } catch (e) {
        if (isNetErr(e)) { setStatus('offline'); scheduleRetry(); }
        else { console.error('sync push failed', e); setStatus('error', errCode(e)); scheduleRetry(30000); }
        throw e;
      }
    }

    function scheduleRetry(ms) {
      clearTimeout(retryTimer);
      retryTimer = setTimer(() => { if (rec.enabled && rec.dirty) push().catch(() => {}); }, ms || 15000);
    }

    // ---------- ciclo de vida ----------
    async function attach() {
      if (unlisten) { unlisten(); unlisten = null; }
      remoteReady = false; remote = null;
      setStatus(isOnline() ? 'connecting' : 'offline');
      unlisten = adapter.listen(rec.uid, receive, err => {
        if (isNetErr(err)) setStatus('offline');
        else { setStatus('error', errCode(err)); if (/permission|unauth/i.test(errCode(err))) setStatus('signedOut', errCode(err)); }
      });
    }

    async function start() {
      if (started) return info();
      started = true;
      store.onLocalChange(() => {
        if (!rec.enabled) return;
        rec.dirty = true; saveRec();
        if (status === 'synced') setStatus('syncing');
        schedulePush(debounceMs);
      });
      if (!rec.enabled) { setStatus('off'); return info(); }
      try {
        await adapter.load();
        const user = await adapter.getUser();
        if (!user || user.uid !== rec.uid) { setStatus('signedOut'); return info(); }
        await attach();
        if (rec.dirty) schedulePush(debounceMs);
      } catch (e) {
        if (isNetErr(e)) { setStatus('offline'); scheduleStartRetry(); }
        else setStatus('error', errCode(e));
      }
      return info();
    }
    let startRetry = null;
    function scheduleStartRetry() {
      clearTimeout(startRetry);
      startRetry = setTimer(() => { started = false; startAgain(); }, 20000);
    }
    async function startAgain() {
      // reconexão após falha de carregar o SDK (ex.: abriu offline)
      started = true;
      try {
        await adapter.load();
        const user = await adapter.getUser();
        if (!user || user.uid !== rec.uid) { setStatus('signedOut'); return; }
        await attach();
        if (rec.dirty) schedulePush(debounceMs);
      } catch (e) { if (isNetErr(e)) { setStatus('offline'); scheduleStartRetry(); } else setStatus('error', errCode(e)); }
    }
    function wentOffline() { if (rec.enabled) setStatus('offline'); }
    function wentOnline() {
      if (!rec.enabled) return;
      if (!unlisten) { clearTimeout(startRetry); startAgain(); return; }
      if (rec.dirty) schedulePush(300);
    }

    function localHasData() {
      const s = store.get();
      // só a senha do pai (aparelho novo) não conta como "dados": a nuvem é usada sem perguntar
      return !!(s && s.children.length);
    }
    function keepPreSyncBackup() {
      try { storage.setItem(PRE_SYNC_BACKUP_KEY, JSON.stringify({ savedAt: now(), state: store.get() })); } catch (e) { /* sem espaço: segue */ }
    }

    function enable(user, email) {
      rec.enabled = true; rec.uid = user.uid; rec.email = email || user.email; rec.lastSyncAt = null;
      saveRec();
    }

    /* Escreve TODO o estado deste aparelho na nuvem (nuvem vazia ou "substituir pela deste aparelho"). */
    async function uploadAll() {
      const lp = localParts();
      const docs = C.coreToDocs(lp.core);
      C.checkSize(docs);
      await adapter.replaceAll(rec.uid, {
        meta: Object.assign({}, docs.meta, { by: rec.deviceId }),
        children: docs.children,
        history: C.allHistoryDocs(lp.history),
        photos: lp.photos
      });
      rec.base = lp.core; rec.dirty = false; rec.lastSyncAt = now(); saveRec();
    }

    async function useCloud(raw) {
      keepPreSyncBackup();
      const core = C.docsToCore(raw);
      const next = build(core, C.docsToHistory(raw), C.docsToPhotos(raw));
      rec.base = core; rec.dirty = false; rec.lastSyncAt = now(); saveRec();
      await store.applyRemote(next);
    }

    /* Cria a conta da família e sobe os dados deste aparelho. */
    async function createAccount(email, password) {
      setStatus('connecting');
      try {
        await adapter.load();
        const user = await adapter.signUp(email, password);
        enable(user, email);
        await uploadAll();
        await attach();
        return { ok: true };
      } catch (e) { failConnect(e); throw e; }
    }

    /* Entra numa conta existente. Se houver dados na nuvem E neste aparelho, devolve needsChoice. */
    let pendingRaw = null;
    async function signIn(email, password) {
      setStatus('connecting');
      try {
        await adapter.load();
        const user = await adapter.signIn(email, password);
        const raw = await adapter.readAll(user.uid);
        rec.uid = user.uid; rec.email = email || user.email; saveRec();
        if (!raw || !raw.meta) { enable(user, email); await uploadAll(); await attach(); return { ok: true, uploaded: true }; }
        if (localHasData() && !C.eq(C.toCloud(store.get()).core.children, C.docsToCore(raw).children)) {
          pendingRaw = { raw, user, email };
          setStatus('off');
          return { ok: true, needsChoice: true, cloudChildren: Object.values(C.docsToCore(raw).children).map(c => c.name) };
        }
        enable(user, email); await useCloud(raw); await attach();
        return { ok: true, usedCloud: true };
      } catch (e) { failConnect(e); throw e; }
    }
    /* Resposta à pergunta: 'cloud' (padrão) usa os dados da nuvem; 'local' substitui a nuvem pelos deste aparelho. */
    async function chooseInitial(choice) {
      if (!pendingRaw) throw new Error('nothing-pending');
      const { raw, user, email } = pendingRaw; pendingRaw = null;
      setStatus('connecting');
      try {
        enable(user, email);
        if (choice === 'local') await uploadAll(); else await useCloud(raw);
        await attach();
        return { ok: true };
      } catch (e) { failConnect(e); throw e; }
    }
    async function cancelChoice() { pendingRaw = null; try { await adapter.signOut(); } catch (e) { /* ok */ } rec = { deviceId: rec.deviceId }; saveRec(); setStatus('off'); }

    function failConnect(e) {
      if (!rec.enabled) { setStatus('off'); lastError = errCode(e); }
      else if (isNetErr(e)) setStatus('offline');
      else setStatus('error', errCode(e));
    }

    /* Para de sincronizar neste aparelho (dados locais ficam). */
    async function signOut() {
      if (unlisten) { unlisten(); unlisten = null; }
      clearTimeout(pushTimer); clearTimeout(retryTimer); clearTimeout(startRetry);
      try { await adapter.signOut(); } catch (e) { /* offline: tudo bem */ }
      rec = { deviceId: rec.deviceId }; saveRec();
      remote = null; remoteReady = false;
      setStatus('off');
    }
    /* Reconectar quando a sessão expirou (status signedOut). */
    async function reconnect(password) {
      await adapter.load();
      const user = await adapter.signIn(rec.email, password);
      if (user.uid !== rec.uid) throw new Error('wrong-account');
      await attach();
      if (rec.dirty) schedulePush(0);
    }

    async function sendPasswordReset(email) {
      await adapter.load();
      return adapter.sendReset(email || rec.email);
    }
    /* Confere a senha da conta da família (para recuperar a senha local do pai). */
    async function verifyFamilyPassword(password) {
      if (!rec.enabled || !rec.email) throw new Error('not-enabled');
      await adapter.load();
      return adapter.verifyPassword(rec.email, password);
    }

    async function syncNow() {
      if (!rec.enabled) return;
      if (!unlisten) { await startAgain(); return; }
      rec.dirty = true; saveRec();
      clearTimeout(pushTimer);
      return push();
    }

    return {
      start, info, onStatus, createAccount, signIn, chooseInitial, cancelChoice, signOut, reconnect,
      sendPasswordReset, verifyFamilyPassword, syncNow, wentOnline, wentOffline, push,
      // testes
      _rec: () => rec, _remote: () => remote, _flush: () => pushing || Promise.resolve()
    };
  }

  const api = { createSync, REC_KEY, PRE_SYNC_BACKUP_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.SyncFactory = api;

  // ---------- instância do navegador ----------
  if (typeof window !== 'undefined' && g.Store && g.document) {
    const adapter = g.SYNC_ADAPTER || g.FirestoreAdapter;
    if (adapter && (!adapter.configured || adapter.configured())) {
      g.Sync = createSync({
        adapter, store: g.Store, storage: g.localStorage,
        isOnline: () => g.navigator.onLine !== false
      });
      g.addEventListener('online', () => g.Sync.wentOnline());
      g.addEventListener('offline', () => g.Sync.wentOffline());
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
