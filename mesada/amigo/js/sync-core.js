/* Núcleo PURO da sincronização (sem rede, sem DOM) — testável no Node.
 *
 * Modelo na nuvem (Firestore), tudo dentro de families/{uid}:
 *   families/{uid}                      -> "meta": { v, data: JSON(core.meta + order), appVersion, by, updatedAt }
 *   families/{uid}/children/{childId}   -> { data: JSON(criança SEM histórico, fotos como referência) }
 *   families/{uid}/history/{childId}_{YYYY-MM} -> { childId, month, entries: { [entryId]: JSON(entrada) } }
 *   families/{uid}/photos/{photoId}     -> { data: dataURL, createdAt }
 * Assim nenhum documento chega perto de 1 MB (histórico dividido por mês; fotos separadas).
 *
 * Conflitos: merge de 3 vias (base = última versão da nuvem que este aparelho conhece).
 *  - Saldos (potes, conta do banco, valor guardado nos objetivos) são CONTADORES: somam-se as
 *    diferenças dos dois lados (pai paga no iPhone + filho gasta no iPad offline => as duas coisas valem).
 *  - Listas com id (crianças, objetivos, aplicações, tarefas) são mescladas por id; apagar vence.
 *  - Demais campos: último a gravar vence, por entidade (updatedAt da criança / dos ajustes gerais).
 *  - Histórico: só acrescenta, mesclado por id (nunca se perde lançamento).
 *  - Juros do mesmo mês creditados nos dois aparelhos contam uma vez só (interestLog). */
(function (g) {
  'use strict';

  const LOCAL_ONLY_SETTINGS = ['lastSeenVersion'];
  const PHOTO_PREFIX = 'cloudphoto:';
  const HISTORY_CAP = 2000;
  const MAX_DOC_BYTES = 900 * 1024;

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function stable(o) { // JSON com chaves ordenadas (comparação estável)
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    if (isObj(o)) return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
    return JSON.stringify(o === undefined ? null : o);
  }
  function eq(a, b) { if (a === b) return true; if (a === undefined || b === undefined) return false; return stable(a) === stable(b); }
  function bytes(str) { // tamanho aproximado em UTF-8
    let n = 0; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xd800 && c < 0xdc00) ? (i++, 4) : 3; }
    return n;
  }

  // hash FNV-1a 64 bits (em dois 32) -> id de foto estável pelo conteúdo
  function hash(str) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
  }

  // ---------------- estado local <-> core ----------------
  /* core = { meta, order, children: {id: criança sem histórico} } + photos {id: dataURL} + history {childId: [entradas]} */
  function toCloud(state) {
    const photos = {};
    const children = {};
    const history = {};
    const order = [];
    (state.children || []).forEach(c => {
      const cc = clone(c);
      history[c.id] = cc.history || [];
      delete cc.history;
      (cc.goals || []).forEach(gl => {
        if (typeof gl.photo === 'string' && gl.photo.startsWith('data:')) {
          const id = hash(gl.photo);
          photos[id] = gl.photo;
          gl.photo = PHOTO_PREFIX + id;
        }
      });
      children[c.id] = cc;
      order.push(c.id);
    });
    const settings = clone(state.settings || {});
    LOCAL_ONLY_SETTINGS.forEach(k => delete settings[k]);
    const meta = {
      schemaVersion: state.schemaVersion || 1,
      createdAt: state.createdAt || null,
      updatedAt: state.metaUpdatedAt || 0,
      parent: (() => { const pr = clone(state.parent || {}); delete pr.lang; return pr; })(), // idioma da tela inicial é de cada aparelho
      bankRates: clone(state.bankRates || {}),
      settings
    };
    return { core: { meta, order, children }, photos, history };
  }

  function photoRefs(core) {
    const ids = new Set();
    Object.values(core.children || {}).forEach(c => (c.goals || []).forEach(gl => {
      if (typeof gl.photo === 'string' && gl.photo.startsWith(PHOTO_PREFIX)) ids.add(gl.photo.slice(PHOTO_PREFIX.length));
    }));
    return ids;
  }

  /* Monta o estado do app a partir do core + histórico + fotos. localState fornece campos só-locais. */
  function fromCloud(core, historyByChild, photoData, localState) {
    const st = {
      schemaVersion: core.meta.schemaVersion || 1,
      createdAt: core.meta.createdAt || Date.now(),
      updatedAt: Date.now(),
      metaUpdatedAt: core.meta.updatedAt || 0,
      parent: clone(core.meta.parent),
      bankRates: clone(core.meta.bankRates),
      settings: clone(core.meta.settings || {}),
      children: []
    };
    st.parent.lang = (localState && localState.parent && localState.parent.lang) || st.parent.lang || 'pt';
    if (localState && localState.settings) LOCAL_ONLY_SETTINGS.forEach(k => { if (localState.settings[k] !== undefined) st.settings[k] = localState.settings[k]; });
    const ids = orderedIds(core);
    ids.forEach(id => {
      const c = clone(core.children[id]);
      (c.goals || []).forEach(gl => {
        if (typeof gl.photo === 'string' && gl.photo.startsWith(PHOTO_PREFIX)) {
          const pid = gl.photo.slice(PHOTO_PREFIX.length);
          if (photoData && photoData[pid]) gl.photo = photoData[pid]; // senão fica a referência (UI mostra o emoji)
        }
      });
      c.history = sortHistory((historyByChild && historyByChild[id]) || []);
      st.children.push(c);
    });
    return st;
  }

  function orderedIds(core) {
    const ids = (core.order || []).filter(id => core.children[id]);
    Object.keys(core.children).forEach(id => { if (!ids.includes(id)) ids.push(id); });
    return ids;
  }

  function sortHistory(list) {
    const arr = list.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0) || String(b.id).localeCompare(String(a.id)));
    if (arr.length > HISTORY_CAP) arr.length = HISTORY_CAP;
    return arr;
  }

  /* União do histórico por id (só acrescenta). */
  function mergeHistory(a, b) {
    const map = new Map();
    (a || []).forEach(e => map.set(e.id, e));
    (b || []).forEach(e => { if (!map.has(e.id)) map.set(e.id, e); });
    return sortHistory([...map.values()]);
  }
  function mergeHistoryByChild(local, remote, childIds) {
    const out = {};
    childIds.forEach(id => { out[id] = mergeHistory(local[id], remote[id]); });
    return out;
  }

  // ---------------- merge de 3 vias ----------------
  function isCounterPath(p) {
    const s = p.join('/');
    return /^children\/[^/]+\/pots\/[^/]+$/.test(s) ||
      /^children\/[^/]+\/bank\/liquid\/balance$/.test(s) ||
      /^children\/[^/]+\/goals\/[^/]+\/saved$/.test(s);
  }
  function hasIds(arr) { return Array.isArray(arr) && arr.length > 0 && arr.every(x => isObj(x) && x.id !== undefined); }

  function lwwLocal(ctx) { return ctx.localNewer; }

  function merge(b, l, r, path, ctx) {
    if (eq(l, r)) return clone(l);
    if (eq(b, l)) return clone(r);
    if (eq(b, r)) return clone(l);
    // os dois lados mudaram
    if (l === undefined || r === undefined) {
      if (b !== undefined) return undefined; // um lado apagou: apagar vence
      return clone(l === undefined ? r : l);
    }
    if (typeof l === 'number' && typeof r === 'number' && isCounterPath(path)) {
      const base = typeof b === 'number' ? b : 0;
      return Math.max(0, base + (l - base) + (r - base));
    }
    if (path[path.length - 1] === 'updatedAt' && typeof l === 'number' && typeof r === 'number') return Math.max(l, r);
    const arrL = Array.isArray(l), arrR = Array.isArray(r);
    if (arrL && arrR && (hasIds(l) || hasIds(r)) && (l.length === 0 || hasIds(l)) && (r.length === 0 || hasIds(r))) {
      const bArr = Array.isArray(b) && (b.length === 0 || hasIds(b)) ? b : [];
      return mergeById(bArr, l, r, path, ctx);
    }
    if (isObj(l) && isObj(r)) {
      let c2 = ctx;
      if (path.length === 2 && path[0] === 'children') c2 = Object.assign({}, ctx, { localNewer: (l.updatedAt || 0) >= (r.updatedAt || 0) });
      if (path.length === 1 && path[0] === 'meta') c2 = Object.assign({}, ctx, { localNewer: (l.updatedAt || 0) >= (r.updatedAt || 0) });
      const bo = isObj(b) ? b : {};
      const out = {};
      new Set([...Object.keys(l), ...Object.keys(r)]).forEach(k => {
        const v = merge(bo[k], l[k], r[k], path.concat(k), c2);
        if (v !== undefined) out[k] = v;
      });
      if (path.length === 2 && path[0] === 'children') fixInterest(isObj(b) ? b : null, l, r, out);
      return out;
    }
    return clone(lwwLocal(ctx) ? l : r);
  }

  function mergeById(b, l, r, path, ctx) {
    const idx = a => { const m = new Map(); a.forEach(x => m.set(String(x.id), x)); return m; };
    const bm = idx(b), lm = idx(l), rm = idx(r);
    const ids = [];
    (lwwLocal(ctx) ? [l, r] : [r, l]).forEach(a => a.forEach(x => { const k = String(x.id); if (!ids.includes(k)) ids.push(k); }));
    const out = [];
    ids.forEach(id => {
      const v = merge(bm.get(id), lm.get(id), rm.get(id), path.concat(id), ctx);
      if (v !== undefined) out.push(v);
    });
    return out;
  }

  /* Se os dois lados creditaram juros do MESMO mês (a partir da mesma base), desconta uma vez. */
  function fixInterest(b, l, r, out) {
    const ll = l.bank && l.bank.liquid && l.bank.liquid.interestLog || {};
    const rl = r.bank && r.bank.liquid && r.bank.liquid.interestLog || {};
    const bl = b && b.bank && b.bank.liquid && b.bank.liquid.interestLog || {};
    if (!out.bank || !out.bank.liquid) return;
    out.bank.liquid.interestLog = out.bank.liquid.interestLog || {};
    let fix = 0;
    Object.keys(ll).forEach(m => {
      if (bl[m] === undefined && rl[m] !== undefined) { fix += rl[m]; out.bank.liquid.interestLog[m] = ll[m]; }
    });
    if (fix) out.bank.liquid.balance = Math.max(0, out.bank.liquid.balance - fix);
  }

  /* base: último core da nuvem conhecido (ou null); local; remote. Retorna o core mesclado. */
  function merge3(base, local, remote) {
    if (!remote) return clone(local);
    if (!local) return clone(remote);
    const out = merge(base || undefined, local, remote, [], { localNewer: false });
    out.meta = out.meta || clone(remote.meta);
    out.children = out.children || {};
    out.order = (out.order || []).filter(id => out.children[id]);
    Object.keys(out.children).forEach(id => { if (!out.order.includes(id)) out.order.push(id); });
    return out;
  }

  // ---------------- documentos ----------------
  function historyDocId(childId, month) { return childId + '_' + month; }
  function monthOf(ts) { const d = new Date(ts || 0); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); }

  /* Converte core em escritas para a transação, comparando com o que está na nuvem. */
  function coreToDocs(core) {
    const meta = { v: 1, data: JSON.stringify({ meta: core.meta, order: core.order }) };
    const children = {};
    Object.keys(core.children).forEach(id => { children[id] = { data: JSON.stringify(core.children[id]) }; });
    return { meta, children };
  }
  function checkSize(docs) {
    if (bytes(docs.meta.data) > MAX_DOC_BYTES) throw new Error('docTooBig');
    Object.values(docs.children).forEach(d => { if (bytes(d.data) > MAX_DOC_BYTES) throw new Error('docTooBig'); });
  }
  /* Lê os documentos crus { meta, children:{id:{data}}, history:{docId:{childId,entries}}, photos:{id:{data}} } */
  function docsToCore(raw) {
    if (!raw || !raw.meta || !raw.meta.data) return null;
    const m = JSON.parse(raw.meta.data);
    const children = {};
    Object.keys(raw.children || {}).forEach(id => {
      const d = raw.children[id];
      if (d && d.data) children[id] = JSON.parse(d.data);
    });
    // só crianças listadas na ordem (documento de criança apagada que sobrou é ignorado)
    const listed = {};
    (m.order || []).forEach(id => { if (children[id]) listed[id] = children[id]; });
    return { meta: m.meta, order: (m.order || []).filter(id => listed[id]), children: listed };
  }
  function docsToHistory(raw) {
    const out = {};
    Object.values(raw && raw.history || {}).forEach(d => {
      if (!d || !d.childId || !d.entries) return;
      const arr = out[d.childId] || (out[d.childId] = []);
      Object.values(d.entries).forEach(s => { try { arr.push(typeof s === 'string' ? JSON.parse(s) : s); } catch (e) { /* ignora */ } });
    });
    return out;
  }
  function docsToPhotos(raw) {
    const out = {};
    Object.keys(raw && raw.photos || {}).forEach(id => { const d = raw.photos[id]; if (d && d.data) out[id] = d.data; });
    return out;
  }
  /* Entradas de histórico locais que a nuvem ainda não tem, agrupadas por documento mensal. */
  function historyToUpload(localHist, remoteHist) {
    const docs = {};
    Object.keys(localHist).forEach(cid => {
      const known = new Set((remoteHist[cid] || []).map(e => e.id));
      localHist[cid].forEach(e => {
        if (known.has(e.id)) return;
        const id = historyDocId(cid, monthOf(e.ts));
        const d = docs[id] || (docs[id] = { childId: cid, month: monthOf(e.ts), entries: {} });
        d.entries[e.id] = JSON.stringify(e);
      });
    });
    return docs;
  }
  function allHistoryDocs(hist) { return historyToUpload(hist, {}); }

  function emptyCore() { return null; }

  const SyncCore = {
    PHOTO_PREFIX, HISTORY_CAP, MAX_DOC_BYTES, LOCAL_ONLY_SETTINGS,
    clone, eq, stable, hash, bytes,
    toCloud, fromCloud, photoRefs, mergeHistory, mergeHistoryByChild, sortHistory, merge3,
    coreToDocs, checkSize, docsToCore, docsToHistory, docsToPhotos, historyToUpload, allHistoryDocs,
    historyDocId, monthOf, emptyCore, orderedIds
  };
  g.SyncCore = SyncCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = SyncCore;
})(typeof window !== 'undefined' ? window : globalThis);
