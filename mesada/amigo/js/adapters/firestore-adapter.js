/* Transporte Firebase (Auth e-mail/senha + Firestore) para js/sync.js.
 *
 * O SDK modular do Firebase é baixado do CDN gstatic SOMENTE quando a sincronização
 * é usada (load()). Sem conta conectada o app não faz nenhuma chamada de rede.
 *
 * Contrato (o mock dos testes, tests/mock-adapter.js, segue o mesmo):
 *   configured()                         -> bool (há config do Firebase)
 *   async load()                         -> carrega SDK + inicializa (idempotente)
 *   async getUser()                      -> { uid, email } | null (sessão salva no aparelho)
 *   async signUp(email, pw) / signIn(email, pw) -> { uid, email }
 *   async signOut(); async sendReset(email, lang); async verifyPassword(email, pw) -> true
 *   async readAll(uid)                   -> raw { meta, children:{id:doc}, history:{id:doc}, photos:{id:doc} }
 *   listen(uid, onData(raw, {fromCache}), onError) -> unsubscribe
 *   async transact(uid, childIds, fn)    -> fn(current {meta, children}) devolve { ops:{meta,set,del}, result }; grava ops e retorna result
 *   async addHistory(uid, docs)          -> set com merge (só acrescenta entradas)
 *   async putPhotos(uid, {id:dataURL}); async deletePhotos(uid, ids); async deleteHistoryDocs(uid, ids)
 *   async replaceAll(uid, { meta, children, history, photos }) -> nuvem passa a ser exatamente isso */
(function (g) {
  'use strict';
  const SDK = 'https://www.gstatic.com/firebasejs/12.6.0/';
  let F = null;          // funções do SDK
  let app = null, auth = null, db = null;
  let loading = null;

  function cfg() { return g.FIREBASE_CONFIG || {}; }

  async function load() {
    if (db) return;
    if (loading) return loading;
    loading = (async () => {
      const [appM, authM, fsM] = await Promise.all([
        import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')
      ]).catch(e => { const err = new Error('sdk-load'); err.code = 'sdk-load'; err.cause = e; throw err; });
      F = Object.assign({}, appM, authM, fsM);
      app = F.getApps().length ? F.getApp() : F.initializeApp(cfg().firebase);
      auth = F.getAuth(app);
      try {
        // cache persistente (IndexedDB) com várias abas; se o navegador não deixar, cai para memória
        db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
      } catch (e) {
        console.warn('Firestore persistence unavailable, using memory cache', e);
        try { db = F.initializeFirestore(app, { localCache: F.memoryLocalCache() }); } catch (e2) { db = F.getFirestore(app); }
      }
    })();
    try { await loading; } catch (e) { loading = null; throw e; }
  }

  function user(u) { return u ? { uid: u.uid, email: u.email } : null; }
  const famRef = uid => F.doc(db, 'families', uid);
  const sub = (uid, name) => F.collection(db, 'families', uid, name);
  const subDoc = (uid, name, id) => F.doc(db, 'families', uid, name, id);
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

  function snapMap(qs) { const o = {}; qs.forEach(d => { o[d.id] = d.data(); }); return o; }

  async function chunkedBatches(ops) { // ops: [fn(batch)]
    for (let i = 0; i < ops.length; i += 400) {
      const b = F.writeBatch(db);
      ops.slice(i, i + 400).forEach(fn => fn(b));
      await b.commit();
    }
  }

  g.FirestoreAdapter = {
    name: 'firestore',
    configured() { const c = cfg(); return !!(c.enabled && c.firebase && c.firebase.apiKey && c.firebase.projectId); },
    available() { return false; }, // compat. v1.0: o Store nunca usa o Firestore direto
    load,
    async getUser() {
      await load();
      if (auth.authStateReady) await auth.authStateReady();
      return user(auth.currentUser);
    },
    async signUp(email, pw) { await load(); const c = await F.createUserWithEmailAndPassword(auth, email, pw); return user(c.user); },
    async signIn(email, pw) { await load(); const c = await F.signInWithEmailAndPassword(auth, email, pw); return user(c.user); },
    async signOut() { if (!auth) return; await F.signOut(auth); },
    async sendReset(email, lang) { await load(); auth.languageCode = lang === 'en' ? 'en' : 'pt-BR'; await F.sendPasswordResetEmail(auth, email); return true; },
    async verifyPassword(email, pw) {
      await load();
      const cred = F.EmailAuthProvider.credential(email, pw);
      if (auth.currentUser) await F.reauthenticateWithCredential(auth.currentUser, cred);
      else await F.signInWithEmailAndPassword(auth, email, pw);
      return true;
    },

    async readAll(uid) {
      await load();
      const [m, c, h, p] = await Promise.all([F.getDoc(famRef(uid)), F.getDocs(sub(uid, 'children')), F.getDocs(sub(uid, 'history')), F.getDocs(sub(uid, 'photos'))]);
      return { meta: m.exists() ? m.data() : null, children: snapMap(c), history: snapMap(h), photos: snapMap(p) };
    },

    listen(uid, onData, onError) {
      const parts = { meta: undefined, children: undefined, history: undefined, photos: undefined };
      const cache = { meta: true, children: true, history: true, photos: true };
      const emit = () => {
        if (Object.values(parts).some(v => v === undefined)) return;
        onData({ meta: parts.meta, children: parts.children, history: parts.history, photos: parts.photos }, { fromCache: Object.values(cache).some(Boolean) });
      };
      const opts = { includeMetadataChanges: true };
      const err = e => onError && onError(e);
      const uns = [
        F.onSnapshot(famRef(uid), opts, s => { parts.meta = s.exists() ? s.data() : null; cache.meta = s.metadata.fromCache; emit(); }, err),
        F.onSnapshot(sub(uid, 'children'), opts, s => { parts.children = snapMap(s); cache.children = s.metadata.fromCache; emit(); }, err),
        F.onSnapshot(sub(uid, 'history'), opts, s => { parts.history = snapMap(s); cache.history = s.metadata.fromCache; emit(); }, err),
        F.onSnapshot(sub(uid, 'photos'), opts, s => { parts.photos = snapMap(s); cache.photos = s.metadata.fromCache; emit(); }, err)
      ];
      return () => uns.forEach(u => u());
    },

    async transact(uid, childIds, fn) {
      await load();
      return F.runTransaction(db, async tx => {
        const ms = await tx.get(famRef(uid));
        const meta = ms.exists() ? ms.data() : null;
        const ids = new Set(childIds || []);
        if (meta && meta.data) { try { (JSON.parse(meta.data).order || []).forEach(id => ids.add(id)); } catch (e) { /* ignora */ } }
        const children = {};
        for (const id of ids) { const s = await tx.get(subDoc(uid, 'children', id)); if (s.exists()) children[id] = s.data(); }
        const { ops, result } = fn({ meta, children });
        const ts = F.serverTimestamp();
        if (ops.meta) tx.set(famRef(uid), Object.assign({}, ops.meta, { updatedAt: ts, appVersion: g.APP_VERSION || '' }));
        Object.keys(ops.set).forEach(id => tx.set(subDoc(uid, 'children', id), Object.assign({}, ops.set[id], { updatedAt: ts })));
        ops.del.forEach(id => tx.delete(subDoc(uid, 'children', id)));
        return result;
      });
    },

    async addHistory(uid, docs) {
      await load();
      // com o cache persistente a gravação fica na fila mesmo offline; não espera o servidor mais que 4 s
      const w = Promise.all(Object.keys(docs).map(id => F.setDoc(subDoc(uid, 'history', id), docs[id], { merge: true })));
      w.catch(e => console.warn('history write', e));
      await withTimeout(w, 4000);
    },
    async putPhotos(uid, photos) {
      await load();
      const w = Promise.all(Object.keys(photos).map(id => F.setDoc(subDoc(uid, 'photos', id), { data: photos[id], createdAt: Date.now() })));
      w.catch(e => console.warn('photo write', e));
      await withTimeout(w, 8000);
    },
    async deletePhotos(uid, ids) { await load(); await withTimeout(Promise.all(ids.map(id => F.deleteDoc(subDoc(uid, 'photos', id)))), 4000); },
    async deleteHistoryDocs(uid, ids) { await load(); await withTimeout(Promise.all(ids.map(id => F.deleteDoc(subDoc(uid, 'history', id)))), 4000); },

    async replaceAll(uid, payload) {
      await load();
      const cur = await this.readAll(uid);
      const ops = [];
      const ts = F.serverTimestamp();
      Object.keys(cur.children).forEach(id => { if (!payload.children[id]) ops.push(b => b.delete(subDoc(uid, 'children', id))); });
      Object.keys(cur.history).forEach(id => { if (!payload.history[id]) ops.push(b => b.delete(subDoc(uid, 'history', id))); });
      Object.keys(cur.photos).forEach(id => { if (!payload.photos[id]) ops.push(b => b.delete(subDoc(uid, 'photos', id))); });
      Object.keys(payload.children).forEach(id => ops.push(b => b.set(subDoc(uid, 'children', id), Object.assign({}, payload.children[id], { updatedAt: ts }))));
      Object.keys(payload.history).forEach(id => ops.push(b => b.set(subDoc(uid, 'history', id), payload.history[id])));
      // fotos podem ser grandes: uma por lote para não passar do limite de 10 MB por requisição
      await chunkedBatches(ops);
      for (const id of Object.keys(payload.photos)) {
        if (!cur.photos[id]) await F.setDoc(subDoc(uid, 'photos', id), { data: payload.photos[id], createdAt: Date.now() });
      }
      await F.setDoc(famRef(uid), Object.assign({}, payload.meta, { updatedAt: ts, appVersion: g.APP_VERSION || '' }));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
