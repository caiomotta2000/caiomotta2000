/* Utilidades de interface: modais, toasts, confete, contagem animada, imagens, hash. */
(function (g) {
  'use strict';
  const doc = g.document;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, kind) {
    const root = doc.getElementById('toast-root');
    const el = doc.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2800);
  }

  let modalStack = [];
  /* Abre um modal com HTML. Retorna o elemento .modal-card. onClose opcional. */
  function openModal(html, opts) {
    opts = opts || {};
    const root = doc.getElementById('modal-root');
    const wrap = doc.createElement('div');
    wrap.className = 'modal-wrap' + (opts.full ? ' full' : '');
    wrap.innerHTML = `<div class="modal-card ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    const entry = { wrap, onClose: opts.onClose };
    modalStack.push(entry);
    if (!opts.sticky) wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
    const first = wrap.querySelector('[autofocus]');
    if (first && !('ontouchstart' in g)) setTimeout(() => first.focus(), 50);
    return wrap.querySelector('.modal-card');
  }
  function closeModal() {
    const entry = modalStack.pop();
    if (!entry) return;
    entry.wrap.classList.remove('show');
    setTimeout(() => entry.wrap.remove(), 250);
    if (entry.onClose) entry.onClose();
  }
  function closeAllModals() { while (modalStack.length) closeModal(); }

  function confirmDialog(text, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      let answered = false;
      const card = openModal(`
        <div class="confirm-body">
          ${opts.lili ? `<div class="confirm-lili">${g.liliSVG({ size: 70, mood: 'wow', coin: false })}</div>` : ''}
          <p class="confirm-text">${esc(text)}</p>
          <div class="btn-row">
            <button class="btn ghost" data-ans="0">${esc(opts.no || g.t('cancel'))}</button>
            <button class="btn ${opts.danger ? 'danger' : 'primary'}" data-ans="1">${esc(opts.yes || g.t('confirm'))}</button>
          </div>
        </div>`, { onClose: () => { if (!answered) resolve(false); } });
      card.querySelectorAll('[data-ans]').forEach(b => b.addEventListener('click', () => {
        answered = true; resolve(b.dataset.ans === '1'); closeModal();
      }));
    });
  }

  function confetti(n) {
    if (g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = doc.getElementById('fx-root');
    const colors = ['#ff7043', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc', '#ec407a'];
    for (let i = 0; i < (n || 90); i++) {
      const p = doc.createElement('i');
      p.className = 'confetti';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.6 + 's';
      p.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      if (i % 3 === 0) p.style.borderRadius = '50%';
      root.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  /* Anima números: elementos com data-count="centavos" */
  function animateCounts(root) {
    const els = (root || doc).querySelectorAll('[data-count]');
    const reduce = g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.forEach(el => {
      const target = Number(el.dataset.count) || 0;
      const from = Number(el.dataset.from || 0);
      if (reduce || target === from) { el.textContent = g.i18n.money(target); return; }
      const dur = 900, t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = g.i18n.money(Math.round(from + (target - from) * e));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* Reduz uma foto para data URL JPEG (lado maior = max px) */
  function resizeImage(file, max, quality) {
    max = max || 480; quality = quality || 0.72;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = doc.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function sha256(text) {
    const salt = 'mesada-lili|';
    if (g.crypto && g.crypto.subtle && g.TextEncoder) {
      const buf = await g.crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + text));
      return 'sha256:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // fallback (contexto não seguro): hash simples FNV-1a, só para não guardar texto puro
    let h = 0x811c9dc5;
    for (const ch of salt + text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv:' + h.toString(16);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    doc.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function vibrate(ms) { try { g.navigator.vibrate && g.navigator.vibrate(ms || 15); } catch (e) { /* iOS ignora */ } }

  g.UI = { esc, toast, openModal, closeModal, closeAllModals, confirmDialog, confetti, animateCounts, resizeImage, sha256, download, vibrate };
})(window);
