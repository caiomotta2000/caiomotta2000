/* App principal: telas, navegação e ações. Toda leitura/escrita de dados passa pelo Store. */
(function (g) {
  'use strict';
  const L = g.Logic, T = (k, v) => g.t(k, v), M = c => g.i18n.money(c), esc = g.UI.esc;
  const $app = () => document.getElementById('app');
  const S = () => g.Store.get();

  const POT_META = {
    tithe: { icon: '⛪', color: '#ffb300' }, save: { icon: '🐷', color: '#26a69a' }, spend: { icon: '🛍️', color: '#ff7043' },
    emergency: { icon: '🛟', color: '#e53935' }, invest: { icon: '🏦', color: '#43a047' }, goals: { icon: '🎯', color: '#8e24aa' }, free: { icon: '🎈', color: '#1e88e5' }
  };
  const AVATARS = ['🦁', '🐯', '🐼', '🦊', '🐸', '🐵', '🦄', '🐲', '🦖', '🐶', '🐱', '🐰', '🐧', '🚀', '⚽', '🎮'];
  const COLORS = ['#7c4dff', '#2979ff', '#00a896', '#ff6d00', '#e91e63', '#f9a825', '#43a047', '#6d4c41'];
  const H_ICON = { allowance: '💰', extra: '⭐', withdraw: '🛍️', tithe: '⛪', adjust: '🔧', interest: '📈', bankLock: '🔒', bankRedeem: '🔓', goalNew: '🎯', goalAlloc: '➕', goalUnalloc: '➖', goalBuy: '🎁', typeChange: '🔄', medal: '🏅' };
  const H_SIGN = { allowance: 1, extra: 1, interest: 1, withdraw: -1, tithe: -1, goalBuy: -1 };

  const ui = {
    screen: 'profiles', childId: null, parentOk: false, pChildId: null, pTab: 'money',
    histFilter: 'all', chartMonths: 12, counts: {}, mission: null, liliMsg: null
  };

  // ---------------- helpers ----------------
  function child() { return ui.childId ? S().children.find(c => c.id === ui.childId) : null; }
  function pChild() { return ui.pChildId ? S().children.find(c => c.id === ui.pChildId) : null; }
  function useLang(l) { g.i18n.setLang(l || 'pt'); }
  function count(key, cents) {
    const from = ui.counts[key] === undefined ? 0 : ui.counts[key];
    ui.counts[key] = cents;
    return `<span data-count="${cents}" data-from="${from}">${M(from)}</span>`;
  }
  function liliSays(text, mood, size) {
    return `<div class="lili-says"><div class="lili-wrap">${g.liliSVG({ size: size || 96, mood: mood || 'happy' })}</div><div class="bubble">${esc(text)}</div></div>`;
  }
  function act(fn) { // executa mutação com tratamento de erro
    try { return g.Store.update(fn); } catch (e) {
      const m = String(e.message || e);
      const map = { balance: 'notEnough', amount: 'invalidAmount', full: 'goalFull', target: 'invalidAmount' };
      g.UI.toast(T(map[m] || (m.startsWith('pcts') ? 'pctError' : 'invalidAmount')), 'error');
      return undefined;
    }
  }
  function amountField(name, cents, autofocus) {
    return `<input class="input money" name="${name}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${cents ? g.i18n.moneyInput(cents) : ''}" ${autofocus ? 'autofocus' : ''}>`;
  }
  function chips(values, includeAll) {
    return `<div class="chips">${values.map(v => `<button type="button" class="chip" data-chip="${v}">${M(v)}</button>`).join('')}${includeAll !== undefined ? `<button type="button" class="chip" data-chip="${includeAll}">${T('total')}</button>` : ''}</div>`;
  }
  function bindChips(card, inputName) {
    card.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => {
      card.querySelector(`[name="${inputName}"]`).value = g.i18n.moneyInput(Number(b.dataset.chip));
    }));
  }
  function progressBar(pct, color) {
    pct = Math.max(0, Math.min(100, pct));
    return `<div class="progress"><div class="progress-fill" style="--w:${pct}%;--c:${color || 'var(--accent)'}"></div></div>`;
  }
  function isPhoto(p) { return typeof p === 'string' && p.startsWith('data:image/'); }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d).getTime();
    const today = new Date(L.now()); today.setHours(0, 0, 0, 0);
    return Math.round((target - today.getTime()) / 864e5);
  }

  // ---------------- sincronização: helpers de interface ----------------
  const SYNC = () => g.Sync || null;
  function syncInfo() { return SYNC() ? SYNC().info() : { status: 'off', enabled: false }; }
  function cloudIcon() {
    const i = syncInfo();
    if (!i.enabled) return '';
    const label = T('cloudOn', { state: T('syncState_' + i.status) });
    return `<span class="cloud-ico st-${i.status}" role="img" title="${esc(label)}" aria-label="${esc(label)}">☁️</span>`;
  }
  function syncErrText(e) {
    const c = String((e && (e.code || e.message)) || e).replace(/^auth\//, '');
    const map = {
      'invalid-credential': 'invalid_credential', 'wrong-password': 'invalid_credential', 'user-not-found': 'invalid_credential', 'invalid-login-credentials': 'invalid_credential', 'missing-password': 'invalid_credential',
      'email-already-in-use': 'email_already_in_use', 'weak-password': 'weak_password', 'invalid-email': 'invalid_email', 'missing-email': 'invalid_email',
      'network-request-failed': 'network', unavailable: 'network', 'sdk-load': 'network', offline: 'network',
      'too-many-requests': 'too_many_requests', 'permission-denied': 'permission', docTooBig: 'too_big'
    };
    return map[c] ? T('syncErr_' + map[c]) : T('syncErr_generic', { code: c });
  }
  function syncStatusText(i) {
    let t = T('syncState_' + i.status);
    if (i.lastSyncAt && i.enabled) {
      const d = new Date(i.lastSyncAt);
      t += ' · ' + T('syncLast', { time: g.i18n.date(i.lastSyncAt) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') });
    }
    return t;
  }
  function refreshSyncUI() {
    const i = syncInfo();
    document.querySelectorAll('.cloud-ico').forEach(el => {
      el.className = 'cloud-ico st-' + i.status;
      const label = T('cloudOn', { state: T('syncState_' + i.status) });
      el.title = label; el.setAttribute('aria-label', label);
    });
    const st = document.getElementById('sync-status');
    if (st) { st.textContent = syncStatusText(i); st.className = 'sync-status st-' + i.status; }
    const card = document.getElementById('sync-card');
    if (card && card.dataset.mode !== syncCardMode(i)) card.outerHTML = syncCardHTML();
  }
  function syncCardMode(i) { return !i.enabled ? 'off' : i.status === 'signedOut' ? 'reauth' : 'on'; }
  function syncCardHTML() {
    const i = syncInfo();
    if (!SYNC()) return '';
    if (!i.enabled) {
      return `<section class="card sync-card" id="sync-card" data-mode="off">
        <h3>☁️ ${T('syncTitle')}</h3>
        <p class="muted">${T('syncIntro')}</p>
        <p class="sync-status st-off" id="sync-status">${esc(T('syncState_off'))}</p>
        <div class="btn-row left">
          <button class="btn primary" data-act="syncForm" data-mode="signin">🔑 ${T('syncSignIn')}</button>
          <button class="btn ghost" data-act="syncForm" data-mode="create">＋ ${T('syncCreate')}</button>
        </div>
        <p class="hint">${T('syncCreateHint')}</p>
      </section>`;
    }
    return `<section class="card sync-card" id="sync-card" data-mode="${syncCardMode(i)}">
      <h3>☁️ ${T('syncTitle')}</h3>
      <p class="muted">${esc(T('syncConnectedAs', { email: i.email || '' }))}</p>
      <p class="sync-status st-${i.status}" id="sync-status">${esc(syncStatusText(i))}</p>
      <div class="btn-row left">
        ${i.status === 'signedOut' ? `<button class="btn primary" data-act="syncReconnect">🔑 ${T('syncReconnect')}</button>` : `<button class="btn primary" data-act="syncNow">🔄 ${T('syncNow')}</button>`}
        <button class="btn ghost" data-act="syncResetLink">✉️ ${T('syncResetLink')}</button>
        <button class="btn ghost danger" data-act="syncSignOut">⏏️ ${T('syncSignOut')}</button>
      </div>
    </section>`;
  }
  let pendingRender = false;
  function remoteRender() {
    const a = document.activeElement;
    if (a && a.closest && a.closest('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
      if (!pendingRender) { pendingRender = true; a.addEventListener('blur', () => { pendingRender = false; setTimeout(render, 0); }, { once: true }); }
      return;
    }
    render();
  }

  function syncFormModal(mode) {
    const creating = mode === 'create';
    const card = g.UI.openModal(`
      <form class="sheet" id="sync-form" autocomplete="on">
        <h2>☁️ ${creating ? T('syncCreate') : T('syncSignIn')}</h2>
        <p class="muted">${creating ? T('syncCreateHint') : T('syncIntro')}</p>
        <label class="lbl">${T('syncEmail')}<input class="input" type="email" name="email" autocomplete="username" required></label>
        <label class="lbl">${T('syncPassword')}<input class="input" type="password" name="pw" autocomplete="${creating ? 'new-password' : 'current-password'}" required></label>
        ${creating ? `<input class="input" type="password" name="pw2" placeholder="${T('repeatPassword')}" autocomplete="new-password">` : `<button type="button" class="link" id="sync-forgot">${T('syncForgot')}</button>`}
        <p class="form-err" id="sync-err" role="alert"></p>
        <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${creating ? T('syncCreate') : T('syncSignIn')}</button></div>
      </form>`, { sticky: true });
    const f = card.querySelector('form');
    const err = card.querySelector('#sync-err');
    const busy = on => { f.querySelectorAll('button,input').forEach(b => { b.disabled = on; }); f.classList.toggle('busy', on); };
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      const email = f.email.value.trim(), pw = f.pw.value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = T('syncErr_invalid_email'); return; }
      if (pw.length < 6) { err.textContent = T('syncErr_weak_password'); return; }
      if (creating && pw !== f.pw2.value) { err.textContent = T('passwordsDiffer'); return; }
      busy(true);
      try {
        if (creating) {
          await SYNC().createAccount(email, pw);
          g.UI.closeModal(); g.UI.toast(T('syncUploaded')); render();
        } else {
          const pwBefore = S().parent.passwordHash;
          const r = await SYNC().signIn(email, pw);
          g.UI.closeModal();
          if (r.needsChoice) return syncChoiceModal(r.cloudChildren || []);
          g.UI.toast(r.uploaded ? T('syncUploaded') : T('syncDone')); render();
          if (r.usedCloud && pwBefore && pwBefore !== S().parent.passwordHash) setTimeout(() => g.UI.toast(T('syncParentPwNote')), 2900);
        }
      } catch (ex) { busy(false); err.textContent = syncErrText(ex); }
    });
    const fg = card.querySelector('#sync-forgot');
    if (fg) fg.addEventListener('click', async () => {
      err.textContent = '';
      const email = f.email.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = T('syncErr_invalid_email'); f.email.focus(); return; }
      try { await SYNC().sendPasswordReset(email); g.UI.toast(T('syncResetSent', { email })); } catch (ex) { err.textContent = syncErrText(ex); }
    });
  }

  function syncChoiceModal(names) {
    const card = g.UI.openModal(`
      <div class="sheet sync-choice">
        <h2>☁️ ${T('syncChoiceTitle')}</h2>
        <p>${esc(T('syncChoiceText', { names: names.join(', ') || '—' }))}</p>
        <div class="choice-col">
          <button class="btn primary big" data-choice="cloud">☁️ ${T('syncUseCloud')}</button>
          <button class="btn ghost danger" data-choice="local">📱 ${T('syncUseLocal')}</button>
          <button class="btn ghost" data-choice="cancel">${T('cancel')}</button>
        </div>
        <p class="hint">${T('syncChoiceHint')}</p>
      </div>`, { sticky: true });
    card.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', async () => {
      const ch = b.dataset.choice;
      if (ch === 'cancel') { await SYNC().cancelChoice(); g.UI.closeModal(); render(); return; }
      if (ch === 'local' && !(await g.UI.confirmDialog(T('syncUseLocalConfirm'), { danger: true }))) return;
      card.querySelectorAll('button').forEach(x => { x.disabled = true; });
      try { await SYNC().chooseInitial(ch); g.UI.closeModal(); g.UI.toast(T('syncDone')); render(); }
      catch (ex) { card.querySelectorAll('button').forEach(x => { x.disabled = false; }); g.UI.toast(syncErrText(ex), 'error'); }
    }));
  }

  function forgotParentModal() {
    const i = syncInfo();
    if (!i.enabled) {
      g.UI.openModal(`<div class="sheet"><h2>🔑 ${T('forgotTitle')}</h2><p>${T('forgotNeedSync')}</p><div class="btn-row"><button class="btn primary" data-close>${T('ok')}</button></div></div>`);
      return;
    }
    const card = g.UI.openModal(`
      <form class="sheet" id="forgot-form" autocomplete="off">
        <h2>🔑 ${T('forgotTitle')}</h2>
        <p class="muted">${esc(T('forgotHint', { email: i.email }))}</p>
        <input class="input" type="password" name="fam" placeholder="${T('familyPassword')}" autocomplete="current-password">
        <input class="input" type="password" name="pw" placeholder="${T('newPassword')}" autocomplete="new-password">
        <input class="input" type="password" name="pw2" placeholder="${T('repeatPassword')}" autocomplete="new-password">
        <button type="button" class="link" id="forgot-fam">${T('forgotFamilyToo')}</button>
        <p class="form-err" id="forgot-err" role="alert"></p>
        <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('save')}</button></div>
      </form>`, { sticky: true });
    const f = card.querySelector('form'), err = card.querySelector('#forgot-err');
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      if (f.pw.value.length < 4) { err.textContent = T('passwordShort'); return; }
      if (f.pw.value !== f.pw2.value) { err.textContent = T('passwordsDiffer'); return; }
      try { await SYNC().verifyFamilyPassword(f.fam.value); } catch (ex) { err.textContent = syncErrText(ex); return; }
      const h = await g.UI.sha256(f.pw.value);
      act(s => { s.parent.passwordHash = h; });
      g.UI.closeModal(); g.UI.toast(T('forgotDone'));
      ui.parentOk = true; go('parent');
    });
    card.querySelector('#forgot-fam').addEventListener('click', async () => {
      try { await SYNC().sendPasswordReset(); g.UI.toast(T('syncResetSent', { email: i.email })); } catch (ex) { err.textContent = syncErrText(ex); }
    });
  }

  // ---------------- navegação ----------------
  function go(screen, params) {
    Object.assign(ui, params || {});
    ui.screen = screen;
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const s = S();
    const c = child();
    if (['kidHome', 'bank', 'goals', 'missions', 'mission', 'kidHistory'].includes(ui.screen)) {
      if (!c) { ui.screen = 'profiles'; }
      else {
        useLang(c.lang);
        if (c.type === 'simple' && (ui.screen === 'bank' || ui.screen === 'goals')) ui.screen = 'kidHome';
      }
    }
    if (['parent', 'parentChild'].includes(ui.screen) && !ui.parentOk) ui.screen = 'parentLogin';
    if (['profiles', 'parentLogin', 'parent', 'parentChild'].includes(ui.screen)) useLang(s.parent.lang);
    const fn = SCREENS[ui.screen] || SCREENS.profiles;
    document.body.dataset.screen = ui.screen;
    document.body.style.setProperty('--kid', c && !ui.screen.startsWith('parent') && ui.screen !== 'profiles' ? c.color : '#7c4dff');
    $app().innerHTML = fn();
    g.UI.animateCounts($app());
    const after = AFTER[ui.screen];
    if (after) after();
  }

  // ---------------- tela: perfis ----------------
  const SCREENS = {};
  const AFTER = {};

  SCREENS.profiles = function () {
    const s = S();
    const kids = s.children.map(c => `
      <button class="profile-card" data-act="openChild" data-id="${c.id}" style="--c:${c.color}">
        <span class="avatar xl">${esc(c.avatar)}</span>
        <span class="profile-name">${esc(c.name)}</span>
        <span class="profile-sub">${c.pinHash ? '🔒 ' : ''}${T('type_' + c.type)}</span>
      </button>`).join('');
    return `
      <div class="screen profiles">
        <div class="top-right">${cloudIcon()}<button class="pill" data-act="parentLang">🌐 ${T('switchLang')}</button></div>
        <div class="hero">
          <div class="hero-lili">${g.liliSVG({ size: 150 })}</div>
          <h1 class="app-title">${T('appName')}</h1>
          <p class="hero-q">${T('whoIsUsing')}</p>
        </div>
        ${s.children.length ? `<div class="profile-grid">${kids}</div>` : `<div class="empty-card">${liliSays(T('noChildrenYet'), 'wow', 80)}</div>`}
        <div class="center"><button class="btn parent-btn" data-act="toParent">🔒 ${T('parentArea')}</button></div>
        ${footer()}
      </div>`;
  };

  function footer() {
    return `<footer class="app-footer"><button class="link" data-act="whatsNew">✨ ${T('whatsNew')}</button><span>·</span><span class="ver">v${g.APP_VERSION}</span></footer>`;
  }

  // ---------------- crianças: casca ----------------
  function kidShell(content, active) {
    const c = child();
    const tabs = [['kidHome', '🏠', 'tab_home']];
    if (c.type === 'complete') { tabs.push(['bank', '🏦', 'tab_bank']); tabs.push(['goals', '🎯', 'tab_goals']); }
    tabs.push(['missions', '🦉', 'tab_missions']); tabs.push(['kidHistory', '📜', 'tab_history']);
    return `
      <header class="topbar">
        <button class="icon-btn" data-act="exitKid" aria-label="${T('exit')}">⬅</button>
        <div class="who"><span class="avatar sm">${esc(c.avatar)}</span><b>${esc(c.name)}</b>${cloudIcon()}</div>
        <button class="pill" data-act="kidLang">🌐 ${T('switchLang')}</button>
      </header>
      <main class="kid-main">${content}</main>
      <nav class="tabbar">${tabs.map(([s, i, k]) => `<button class="tab ${active === s ? 'on' : ''}" data-act="nav" data-to="${s}"><span class="tab-i">${i}</span><span class="tab-l">${T(k)}</span></button>`).join('')}</nav>`;
  }

  function pickLiliMsg(c) {
    const s = S();
    const name = c.name;
    if (c.pots.tithe > 0) return T('liliTipTithe', { name });
    const idx = currentMissionIndex(c);
    if (idx >= 0 && !c.medals[g.MISSIONS[idx].id]) return T('liliMission', { name });
    if (c.type === 'complete' && L.emergencyReached(c)) return T('liliTipEmergency', { name });
    const opts = ['liliHello', 'liliHello2', 'liliHello3'];
    return T(opts[Math.floor(L.now() / 864e5) % 3], { name });
  }

  // ---------------- tela: início da criança ----------------
  SCREENS.kidHome = function () {
    const c = child();
    const pots = L.POTS[c.type];
    const total = L.totalBalance(c);
    const medals = Object.keys(c.medals).length;
    const cards = pots.map(k => potCard(c, k)).join('');
    return kidShell(`
      <section class="kid-hero">
        ${liliSays(pickLiliMsg(c), 'happy', 130)}
        <div class="total-card">
          <span class="total-label">${T('totalMoney')}</span>
          <span class="total-value">${count('total', total)}</span>
          <button class="medal-chip" data-act="nav" data-to="missions">🏅 ${T('medalsCount', { n: medals })}</button>
        </div>
      </section>
      <h2 class="section-title">${T('myPots')}</h2>
      <section class="pot-grid pots-${pots.length}">${cards}</section>
      ${footer()}`, 'kidHome');
  };

  function potCard(c, k) {
    const meta = POT_META[k];
    let bal = k === 'invest' ? L.bankTotal(c) : c.pots[k];
    let extra = '', action = '';
    if (k === 'tithe') {
      extra = `<small>${c.pots.tithe > 0 ? '💛 ' + T('titheHint') : '✅ ' + T('titheAllDelivered')}</small>`;
      action = `<button class="btn pot-btn" data-act="deliverTithe" ${c.pots.tithe > 0 ? '' : 'disabled'}>🙏 ${T('deliverTithe')}</button>`;
    } else if (k === 'emergency') {
      const goal = L.emergencyGoal(c);
      extra = `${progressBar(goal ? c.pots.emergency / goal * 100 : 0, meta.color)}<small>${L.emergencyReached(c) ? T('emergencyComplete') : T('emergencyGoal', { value: M(goal) })}</small>`;
      action = `<button class="btn pot-btn" data-act="withdraw" data-pot="emergency">${T('spendBtn')}</button>`;
    } else if (k === 'invest') {
      const locked = c.bank.deposits.reduce((s, d) => s + L.depositValue(d), 0);
      extra = `<small>💧 ${T('tier_liquid')}: ${M(c.bank.liquid.balance)}<br>🔒 ${T('lockedTotal')}: ${M(locked)}</small>`;
      action = `<button class="btn pot-btn" data-act="nav" data-to="bank">${T('goToBank')}</button>`;
    } else if (k === 'goals') {
      const inGoals = c.goals.filter(g => !g.purchasedAt).reduce((s, g) => s + g.saved, 0);
      bal = c.pots.goals + inGoals;
      const n = c.goals.filter(g => !g.purchasedAt).length;
      extra = `<small>${n ? c.goals.filter(g => !g.purchasedAt).slice(0, 3).map(g => esc(g.name)).join(' · ') : T('noGoals')}</small>`;
      action = `<button class="btn pot-btn" data-act="nav" data-to="goals">${T('goToGoals')}</button>`;
    } else {
      action = `<button class="btn pot-btn" data-act="withdraw" data-pot="${k}">${T('spendBtn')}</button>`;
    }
    return `
      <article class="pot pot-${k}" style="--c:${meta.color}">
        <div class="pot-head"><span class="pot-icon">${meta.icon}</span><div><h3>${T('pot_' + k)}</h3><p>${T('potDesc_' + k)}</p></div></div>
        <div class="jar"><div class="jar-fill" style="--h:${Math.min(100, bal / Math.max(1, c.allowance * 3) * 100)}%"></div><span class="pot-bal">${count('pot-' + k, bal)}</span></div>
        ${extra}
        ${action}
      </article>`;
  }

  // ---------------- tela: banco ----------------
  function monthlyInvest(c) {
    const p = c.pcts.complete;
    let pct = p.invest + (L.emergencyReached(c) ? p.emergency : 0);
    return Math.round(c.allowance * pct / 100);
  }

  SCREENS.bank = function () {
    const c = child(), s = S();
    const r = s.bankRates;
    const liq = c.bank.liquid.balance;
    const next = Math.round(liq * r.liquid / 100);
    const deps = c.bank.deposits.map(d => {
      const val = L.depositValue(d);
      const elapsed = Math.min(d.months, L.fullMonthsBetween(d.start, L.now()));
      const matured = L.depositMatured(d);
      return `
        <div class="deposit ${matured ? 'matured' : ''}">
          <div class="dep-top"><b>${d.tier === 'lock3' ? '🔒 3' : '🔒 6'} · ${T('perMonth', { rate: fmtRate(d.rate) })}</b><span>${matured ? T('matured') : T('maturesOn', { date: g.i18n.date(L.addMonthsTs(d.start, d.months)) })}</span></div>
          ${progressBar(elapsed / d.months * 100, matured ? '#43a047' : '#42a5f5')}
          <div class="dep-vals"><span>${T('principal')}: <b>${M(d.principal)}</b></span><span>${T('currentValue')}: <b class="green">${M(val)}</b></span></div>
          <button class="btn small ${matured ? 'primary' : 'ghost'}" data-act="redeem" data-id="${d.id}">${T('redeem')}</button>
        </div>`;
    }).join('');
    return kidShell(`
      <section class="bank-hero">
        ${liliSays(T('liliBank', { name: c.name }), 'happy', 120)}
        <div class="total-card bank"><span class="total-label">🏦 ${T('bankTotal')}</span><span class="total-value">${count('bank', L.bankTotal(c))}</span></div>
      </section>
      <section class="bank-grid">
        <article class="card liquid">
          <h3>💧 ${T('liquidAccount')}</h3>
          <p class="muted">${T('liquidDesc', { rate: fmtRate(r.liquid) })}</p>
          <div class="big-money">${count('liq', liq)}</div>
          ${next > 0 ? `<p class="hint">📈 ${T('interestNextMonth', { value: M(next) })}</p>` : ''}
          <button class="btn ghost" data-act="withdraw" data-pot="invest">${T('withdrawBank')}</button>
        </article>
        ${['lock3', 'lock6'].map(tier => `
          <article class="card tier tier-${tier}">
            <h3>🔒 ${T('tier_' + tier)}</h3>
            <div class="rate-badge">${fmtRate(r[tier])}%<small>/${g.i18n.getLang() === 'pt' ? 'mês' : 'mo'}</small></div>
            <p class="muted">${T('tierDesc_' + tier, { rate: fmtRate(r[tier]) })}</p>
            <button class="btn primary" data-act="lock" data-tier="${tier}" ${liq > 0 ? '' : 'disabled'}>${T('invest')}</button>
          </article>`).join('')}
      </section>
      <h2 class="section-title">${T('myDeposits')}</h2>
      <section class="deposits">${deps || `<p class="empty">${T('noDeposits')}</p>`}</section>
      <section class="card chart-card">
        <h3>${T('chartTitle')}</h3>
        <div id="chart-area">${chartHTML(c)}</div>
      </section>`, 'bank');
  };

  function fmtRate(r) { return String(r).replace('.', g.i18n.getLang() === 'pt' ? ',' : '.'); }

  function chartHTML(c) {
    const r = S().bankRates;
    const months = ui.chartMonths;
    let start = L.bankTotal(c), monthly = monthlyInvest(c), example = false;
    if (start === 0 && monthly === 0) { start = 10000; example = true; }
    const series = [
      { key: 'noInterest', color: '#9e9e9e', dash: true, pts: L.projection(start, monthly, 0, months), label: T('noInterest') },
      { key: 'liquid', color: '#43a047', pts: L.projection(start, monthly, r.liquid, months), label: `${T('tier_liquid')} (${fmtRate(r.liquid)}%)` },
      { key: 'lock3', color: '#1e88e5', pts: L.projection(start, monthly, r.lock3, months), label: `${T('tier_lock3')} (${fmtRate(r.lock3)}%)` },
      { key: 'lock6', color: '#8e24aa', pts: L.projection(start, monthly, r.lock6, months), label: `${T('tier_lock6')} (${fmtRate(r.lock6)}%)` }
    ];
    const W = 1000, Hh = 400, pl = 118, pr = 24, pt = 20, pb = 40;
    const max = Math.max(...series.map(s => s.pts[s.pts.length - 1])) * 1.08 || 1;
    const x = i => pl + (W - pl - pr) * i / months;
    const y = v => pt + (Hh - pt - pb) * (1 - v / max);
    const grid = [0, 0.25, 0.5, 0.75, 1].map(k => {
      const v = max * k; const yy = y(v);
      return `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" class="grid"/><text x="${pl - 8}" y="${yy + 4}" text-anchor="end" class="axis">${esc(M(Math.round(v / 100) * 100))}</text>`;
    }).join('');
    const step = months <= 12 ? (months <= 6 ? 1 : 2) : (months <= 24 ? 4 : 6);
    const xl = [];
    for (let i = 0; i <= months; i += step) xl.push(`<text x="${x(i)}" y="${Hh - 10}" text-anchor="middle" class="axis">${i}</text>`);
    const lines = series.map(s => `<polyline class="line ${s.dash ? 'dash' : ''}" fill="none" stroke="${s.color}" stroke-width="${s.dash ? 3 : 4}" points="${s.pts.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ')}"/><circle cx="${x(months)}" cy="${y(s.pts[months])}" r="6" fill="${s.color}"/>`).join('');
    const base = series[0].pts[months];
    return `
      <p class="muted">${example ? '💡 ' + T('chartExample') + ' · ' : ''}${T('chartSub', { start: M(start), monthly: M(monthly) })}</p>
      <div class="chips months">${[6, 12, 24, 36].map(m => `<button class="chip ${m === months ? 'on' : ''}" data-act="chartMonths" data-m="${m}">${T('chartMonths', { n: m })}</button>`).join('')}</div>
      <svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(T('chartTitle'))}">${grid}${xl.join('')}${lines}</svg>
      <div class="legend">${series.map(s => `<div class="leg"><i style="background:${s.color}"></i><span>${esc(s.label)}</span><b>${M(s.pts[months])}</b>${s.key !== 'noInterest' ? `<small class="green">+${M(s.pts[months] - base)}</small>` : ''}</div>`).join('')}</div>
      <p class="hint">${T('chartEnd', { n: months })}: ${T('interestEarned', { value: M(series[3].pts[months] - base) })} (${T('tier_lock6')})</p>`;
  }

  // ---------------- tela: objetivos ----------------
  SCREENS.goals = function () {
    const c = child();
    const active = c.goals.filter(g => !g.purchasedAt);
    const bought = c.goals.filter(g => g.purchasedAt);
    const cards = active.map(gl => {
      const pct = gl.target ? gl.saved / gl.target * 100 : 0;
      const reached = gl.saved >= gl.target;
      const days = daysUntil(gl.deadline);
      let when = '';
      if (days !== null && !reached) {
        if (days < 0) when = `<span class="tag late">⏰ ${T('goalLate')}</span>`;
        else {
          const weeks = Math.max(1, Math.ceil(days / 7));
          when = `<span class="tag">📅 ${T('goalDaysLeft', { n: days })}</span><small class="muted">${T('goalPerWeek', { value: M(Math.ceil((gl.target - gl.saved) / weeks)) })}</small>`;
        }
      }
      return `
        <article class="goal ${reached ? 'reached' : ''}">
          <div class="goal-photo">${isPhoto(gl.photo) ? `<img src="${gl.photo}" alt="">` : `<span>${esc(gl.emoji || '🎁')}</span>`}${reached ? '<div class="goal-badge">🏆</div>' : ''}</div>
          <div class="goal-body">
            <div class="goal-top"><h3>${esc(gl.name)}</h3><button class="icon-btn small" data-act="deleteGoal" data-id="${gl.id}" aria-label="${T('delete')}">🗑️</button></div>
            ${progressBar(pct, reached ? '#43a047' : '#8e24aa')}
            <div class="goal-nums"><b>${T('goalProgress', { saved: M(gl.saved), target: M(gl.target) })}</b><span>${reached ? T('goalReached') : T('goalMissing', { value: M(gl.target - gl.saved) })}</span></div>
            <div class="goal-when">${when}</div>
            <div class="btn-row left">
              ${reached ? `<button class="btn primary" data-act="buyGoal" data-id="${gl.id}">🛍️ ${T('goalBought')}</button>`
                : `<button class="btn primary" data-act="allocGoal" data-id="${gl.id}" ${c.pots.goals > 0 ? '' : 'disabled'}>➕ ${T('allocate')}</button>`}
              <button class="btn ghost" data-act="unallocGoal" data-id="${gl.id}" ${gl.saved > 0 ? '' : 'disabled'}>➖ ${T('unallocate')}</button>
            </div>
          </div>
        </article>`;
    }).join('');
    return kidShell(`
      <section class="goals-hero">
        ${liliSays(T('liliGoals', { name: c.name }), 'happy', 120)}
        <div class="total-card goals"><span class="total-label">🎯 ${T('goalsPotAvail', { value: '' })}</span><span class="total-value">${count('goalsPot', c.pots.goals)}</span>
          <button class="btn primary" data-act="newGoal">＋ ${T('newGoal')}</button></div>
      </section>
      <section class="goal-list">${cards || `<p class="empty">${T('noGoals')}</p>`}</section>
      ${bought.length ? `<h2 class="section-title">🌟 ${T('purchasedGoals')}</h2><section class="bought">${bought.map(gl => `<div class="bought-item">${isPhoto(gl.photo) ? `<img src="${gl.photo}" alt="">` : `<span>${esc(gl.emoji || '🎁')}</span>`}<b>${esc(gl.name)}</b><small>${M(gl.target)} · ${g.i18n.date(gl.purchasedAt)}</small></div>`).join('')}</section>` : ''}
      `, 'goals');
  };

  // ---------------- tela: missões ----------------
  function currentMissionIndex(c) {
    const n = g.MISSIONS.length;
    const w = Math.min(n - 1, L.weeksSince(c.createdAt));
    return w;
  }

  SCREENS.missions = function () {
    const c = child(), s = S();
    const lang = g.i18n.getLang();
    const cur = currentMissionIndex(c);
    const medals = Object.keys(c.medals).length;
    const list = g.MISSIONS.map((m, i) => {
      const unlocked = L.missionUnlocked(s, c, i);
      const medal = c.medals[m.id];
      return `
        <article class="mission ${unlocked ? '' : 'locked'} ${i === cur && !medal ? 'current' : ''}" style="--c:${m.color}">
          <div class="mission-emoji">${unlocked ? m.emoji : '🔒'}</div>
          <div class="mission-body">
            ${i === cur ? `<span class="tag week">⭐ ${T('missionOfWeek')}</span>` : ''}
            <h3>${esc(m.title[lang])}</h3>
            <p class="muted">${unlocked ? (medal ? (medal.stars === 3 ? T('medalGold') : T('medalSilver')) : '') : T('missionLocked', { n: i + 1 })}</p>
          </div>
          ${unlocked ? `<button class="btn ${medal ? 'ghost small' : 'primary'}" data-act="startMission" data-id="${m.id}">${medal ? '🔁 ' + T('missionReplay') : T('missionStart') + ' ➜'}</button>` : ''}
        </article>`;
    }).join('');
    return kidShell(`
      <section class="missions-hero">
        ${liliSays(T('liliMissionsIntro', { name: c.name }), 'wink', 120)}
        <div class="total-card medals"><span class="total-label">${T('myMedals')}</span><span class="total-value">🏅 ${medals}/${g.MISSIONS.length}</span>
          <div class="medal-row">${g.MISSIONS.map(m => `<span class="medal ${c.medals[m.id] ? 'got' : ''}" title="${esc(m.title[lang])}">${c.medals[m.id] ? (c.medals[m.id].stars === 3 ? '🥇' : '🥈') : '⚪'}</span>`).join('')}</div>
        </div>
      </section>
      <section class="mission-list">${list}</section>`, 'missions');
  };

  SCREENS.mission = function () {
    const c = child();
    const st = ui.mission;
    const m = g.MISSIONS.find(x => x.id === st.id);
    const lang = g.i18n.getLang();
    const fill = s => s.replace(/\{name\}/g, c.name);
    let body = '';
    const totalSteps = m.slides.length + m.quiz.length;
    if (st.phase === 'slides') {
      const sl = m.slides[st.step];
      body = `
        <div class="lesson">
          <div class="lesson-lili">${g.liliSVG({ size: 170, mood: st.step === 1 ? 'wow' : 'happy' })}</div>
          <div class="lesson-bubble"><p>${esc(fill(sl[lang]))}</p></div>
        </div>
        <div class="btn-row"><button class="btn primary big" data-act="missionNext">${st.step < m.slides.length - 1 ? T('next') + ' ➜' : '🧠 ' + T('quizTime')}</button></div>`;
    } else if (st.phase === 'quiz' || st.phase === 'feedback') {
      const q = m.quiz[st.step];
      const answered = st.phase === 'feedback';
      const chosen = st.answers[st.step];
      body = `
        <div class="quiz">
          <p class="muted">${T('questionOf', { n: st.step + 1, total: m.quiz.length })}</p>
          <h2 class="quiz-q">${esc(q.q[lang])}</h2>
          <div class="options">${q.options[lang].map((o, i) => {
            let cls = '';
            if (answered) { if (i === q.answer) cls = 'right'; else if (i === chosen) cls = 'wrong'; }
            return `<button class="option ${cls}" data-act="missionAnswer" data-i="${i}" ${answered ? 'disabled' : ''}><span class="opt-letter">${'ABC'[i]}</span>${esc(o)}</button>`;
          }).join('')}</div>
          ${answered ? `<div class="feedback ${chosen === q.answer ? 'ok' : 'no'}">${chosen === q.answer ? T('correct') : T('wrong', { answer: q.options[lang][q.answer] })}</div>
          <div class="btn-row"><button class="btn primary big" data-act="missionNext">${T('next')} ➜</button></div>` : ''}
        </div>`;
    } else {
      const right = st.answers.filter((a, i) => a === m.quiz[i].answer).length;
      const res = st.result;
      body = `
        <div class="result">
          <div class="result-medal">${res ? (res.stars === 3 ? '🥇' : '🥈') : '💪'}</div>
          ${liliSays(res ? T('liliProud', { name: c.name }) : T('tryAgain'), res ? 'wink' : 'wow', 110)}
          <h2>${T('resultTitle')}</h2>
          <p class="big">${T('resultScore', { n: right, total: m.quiz.length })}</p>
          ${res ? `<p class="medal-text">${res.stars === 3 ? T('medalGold') : T('medalSilver')}</p>` : ''}
          <div class="btn-row">
            <button class="btn ghost" data-act="startMission" data-id="${m.id}">🔁 ${T('missionReplay')}</button>
            <button class="btn primary" data-act="nav" data-to="missions">${T('done')} ✓</button>
          </div>
        </div>`;
    }
    const stepNo = st.phase === 'slides' ? st.step : (st.phase === 'result' ? totalSteps : m.slides.length + st.step);
    return `
      <div class="mission-screen" style="--c:${m.color}">
        <header class="mission-top">
          <button class="icon-btn" data-act="nav" data-to="missions" aria-label="${T('close')}">✕</button>
          <div class="mission-title">${m.emoji} ${esc(m.title[lang])}</div>
          <div class="steps">${progressBar(stepNo / totalSteps * 100, m.color)}</div>
        </header>
        <main class="mission-main">${body}</main>
      </div>`;
  };

  // ---------------- histórico ----------------
  function historyHTML(c, filter, showChild) {
    let items = c.history;
    if (filter && filter !== 'all') items = items.filter(h => h.kind === filter);
    if (!items.length) return `<p class="empty">${T('emptyHistory')}</p>`;
    return `<ul class="history">${items.slice(0, 300).map(h => {
      const sign = H_SIGN[h.kind] || 0;
      let note = h.note || '';
      if (h.kind === 'medal') { const m = g.MISSIONS.find(x => x.id === h.note); note = m ? m.title[g.i18n.getLang()] + (h.stars === 3 ? ' 🥇' : ' 🥈') : ''; }
      if (h.kind === 'typeChange') note = T('type_' + h.note);
      if (h.kind === 'bankRedeem' && h.early) note = T('early');
      if (h.kind === 'bankLock') note = T('tier_' + h.tier);
      const pot = h.pot ? T('pot_' + h.pot) : '';
      const splitTxt = h.split ? L.POTS[h.split.emergency !== undefined || h.split.invest !== undefined ? 'complete' : 'simple'].filter(k => h.split[k]).map(k => `${POT_META[k].icon} ${M(h.split[k])}`).join('  ') : '';
      return `<li class="h-item">
        <span class="h-icon">${H_ICON[h.kind] || '•'}</span>
        <div class="h-main"><b>${T('h_' + h.kind)}</b>${note ? ` · <span>${esc(note)}</span>` : ''}${pot && !h.split ? ` <small class="muted">(${esc(pot)})</small>` : ''}
          ${splitTxt ? `<div class="h-split">${splitTxt}</div>` : ''}
          <small class="muted">${g.i18n.dateTime(h.ts)}</small></div>
        ${h.amount ? `<span class="h-amt ${sign > 0 ? 'pos' : sign < 0 ? 'neg' : ''}">${sign > 0 ? '+' : sign < 0 ? '−' : ''}${M(Math.abs(h.amount))}</span>` : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  SCREENS.kidHistory = function () {
    const c = child();
    return kidShell(`<h2 class="section-title">📜 ${T('history')}</h2><section class="card">${historyHTML(c, 'all')}</section>`, 'kidHistory');
  };

  // ---------------- área do pai ----------------
  SCREENS.parentLogin = function () {
    const s = S();
    const creating = !s.parent.passwordHash;
    return `
      <div class="screen parent-login">
        <div class="top-left"><button class="icon-btn" data-act="toProfiles">⬅</button></div>
        <div class="top-right"><button class="pill" data-act="parentLang">🌐 ${T('switchLang')}</button></div>
        <div class="login-card card">
          ${g.liliSVG({ size: 100, coin: false })}
          <h2>🔒 ${creating ? T('createPassword') : T('parentLogin')}</h2>
          ${creating ? `<p class="muted">${T('createPasswordHint')}</p>` : ''}
          <form id="login-form" autocomplete="off">
            <input class="input" type="password" name="pw" placeholder="${T('parentPassword')}" autofocus>
            ${creating ? `<input class="input" type="password" name="pw2" placeholder="${T('repeatPassword')}">` : ''}
            <button class="btn primary big" type="submit">${creating ? T('save') : T('enter')}</button>
          </form>
          ${creating ? '' : `<button class="link forgot-link" data-act="forgotParent">${T('forgotParentPassword')}</button>`}
        </div>
      </div>`;
  };
  AFTER.parentLogin = function () {
    const f = document.getElementById('login-form');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const s = S();
      const pw = f.pw.value;
      if (!s.parent.passwordHash) {
        if (pw.length < 4) return g.UI.toast(T('passwordShort'), 'error');
        if (pw !== f.pw2.value) return g.UI.toast(T('passwordsDiffer'), 'error');
        const h = await g.UI.sha256(pw);
        act(st => { st.parent.passwordHash = h; });
        ui.parentOk = true; go('parent');
      } else {
        const h = await g.UI.sha256(pw);
        if (h === s.parent.passwordHash) { ui.parentOk = true; go('parent'); }
        else { g.UI.toast(T('wrongPassword'), 'error'); f.pw.value = ''; f.classList.add('shake'); setTimeout(() => f.classList.remove('shake'), 500); }
      }
    });
  };

  function parentHeader(title, backAct) {
    return `<header class="topbar parent">
      <button class="icon-btn" data-act="${backAct}">⬅</button>
      <div class="who"><b>${title}</b>${cloudIcon()}</div>
      <button class="pill" data-act="parentLang">🌐 ${T('switchLang')}</button>
    </header>`;
  }

  SCREENS.parent = function () {
    const s = S();
    const kids = s.children.map(c => {
      const due = L.allowanceDue(c);
      return `
      <article class="card kid-row" style="--c:${c.color}">
        <button class="kid-row-main" data-act="pChild" data-id="${c.id}">
          <span class="avatar md">${esc(c.avatar)}</span>
          <div><b>${esc(c.name)}</b><small class="muted">${T('type_' + c.type)} · ${M(c.allowance)}/${g.i18n.getLang() === 'pt' ? 'mês' : 'mo'}</small>
          <small class="muted">${c.lastPaidAt ? T('lastPaid', { date: g.i18n.date(c.lastPaidAt) }) : T('neverPaid')}</small></div>
          <div class="kid-row-total">${M(L.totalBalance(c))}</div>
        </button>
        <div class="kid-row-chores">${T('choresProgress', { pct: Math.round(L.choreRatio(c) * 100) })} ${progressBar(L.choreRatio(c) * 100, c.color)}</div>
        <div class="btn-row left">
          <button class="btn primary" data-act="pChild" data-id="${c.id}" data-tab="money">💰 ${T('payAllowance')} (${M(due)})</button>
          <button class="btn ghost" data-act="pChild" data-id="${c.id}" data-tab="chores">✅ ${T('tabChores')}</button>
        </div>
      </article>`;
    }).join('');
    const r = s.bankRates;
    return `
      ${parentHeader('🔒 ' + T('parentArea'), 'exitParent')}
      <main class="parent-main">
        <h2 class="section-title">${T('children')}</h2>
        ${kids}
        <button class="btn add-btn" data-act="newChild">＋ ${T('addChild')}</button>

        <h2 class="section-title">⚙️ ${T('settings')}</h2>
        <section class="card">
          <h3>🏦 ${T('bankRates')}</h3>
          <form id="rates-form" class="rates">
            <label>${T('tier_liquid')}<input class="input" name="liquid" inputmode="decimal" value="${fmtRate(r.liquid)}"></label>
            <label>${T('tier_lock3')}<input class="input" name="lock3" inputmode="decimal" value="${fmtRate(r.lock3)}"></label>
            <label>${T('tier_lock6')}<input class="input" name="lock6" inputmode="decimal" value="${fmtRate(r.lock6)}"></label>
            <button class="btn primary" type="submit">${T('save')}</button>
          </form>
          <p class="hint">${T('ratesHint')}</p>
        </section>
        <section class="card">
          <label class="switch-row"><input type="checkbox" id="unlock-all" ${s.settings.unlockAllMissions ? 'checked' : ''}><span>🦉 ${T('unlockAll')}</span></label>
        </section>
        ${syncCardHTML()}
        <section class="card">
          <h3>💾 ${T('backup')}</h3>
          <p class="hint">${T('backupHint')}</p>
          <div class="btn-row left">
            <button class="btn primary" data-act="exportBackup">⬇️ ${T('exportBackup')}</button>
            <label class="btn ghost file-btn">⬆️ ${T('importBackup')}<input type="file" id="import-file" accept="application/json,.json" hidden></label>
          </div>
        </section>
        <section class="card">
          <div class="btn-row left">
            <button class="btn ghost" data-act="changePassword">🔑 ${T('changePassword')}</button>
            <button class="btn ghost" data-act="whatsNew">✨ ${T('whatsNew')} · v${g.APP_VERSION}</button>
          </div>
          <p class="hint">${T('addToHome')}</p>
        </section>
        ${footer()}
      </main>`;
  };
  AFTER.parent = function () {
    const f = document.getElementById('rates-form');
    f.addEventListener('submit', e => {
      e.preventDefault();
      const vals = {};
      for (const k of ['liquid', 'lock3', 'lock6']) {
        const v = parseFloat(String(f[k].value).replace(',', '.'));
        if (!(v >= 0 && v <= 20)) return g.UI.toast(T('invalidAmount'), 'error');
        vals[k] = v;
      }
      act(s => { s.bankRates = vals; }); g.UI.toast(T('saved'));
    });
    document.getElementById('unlock-all').addEventListener('change', e => { act(s => { s.settings.unlockAllMissions = e.target.checked; }); });
    document.getElementById('import-file').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      if (!(await g.UI.confirmDialog(T('importConfirm'), { danger: true }))) return;
      try { await g.Store.importJSON(text); g.UI.toast(T('importDone')); render(); } catch (err) { g.UI.toast(T('importError'), 'error'); }
      e.target.value = '';
    });
  };

  SCREENS.parentChild = function () {
    const c = pChild();
    if (!c) { ui.screen = 'parent'; return SCREENS.parent(); }
    const tabs = [['money', '💰', 'tabMoney'], ['chores', '✅', 'tabChores'], ['profile', '👤', 'tabProfile'], ['history', '📜', 'tabHistory']];
    let body = '';
    if (ui.pTab === 'money') body = parentMoneyTab(c);
    else if (ui.pTab === 'chores') body = parentChoresTab(c);
    else if (ui.pTab === 'profile') body = `<section class="card">${profileFormHTML(c)}</section>`;
    else body = parentHistoryTab(c);
    return `
      ${parentHeader(`<span class="avatar sm">${esc(c.avatar)}</span> ${esc(c.name)}`, 'toParentHome')}
      <nav class="ptabs">${tabs.map(([k, i, l]) => `<button class="ptab ${ui.pTab === k ? 'on' : ''}" data-act="pTab" data-tab="${k}">${i} ${T(l)}</button>`).join('')}</nav>
      <main class="parent-main">${body}</main>`;
  };

  function splitPreviewHTML(c, amount) {
    if (!(amount > 0)) return '';
    const sp = L.computeSplit(c, amount);
    return `<div class="split">${L.POTS[c.type].map(k => `<div class="split-item" style="--c:${POT_META[k].color}"><span>${POT_META[k].icon} ${T('pot_' + k)}</span><b>${M(sp[k])}</b></div>`).join('')}</div>
      ${sp.overflow ? `<p class="hint">🛟 ${T('overflowNote', { value: M(sp.overflow) })}</p>` : ''}`;
  }

  function parentMoneyTab(c) {
    const due = L.allowanceDue(c);
    const ratio = L.choreRatio(c);
    const pots = L.POTS[c.type];
    return `
      <section class="card pay-card">
        <h3>💰 ${T('payAllowance')}</h3>
        <p class="muted">${T('allowanceFull', { value: M(c.allowance) })} · ${T('choresProgress', { pct: Math.round(ratio * 100) })}</p>
        ${progressBar(ratio * 100, c.color)}
        <form id="pay-form">
          <label class="lbl">${T('allowanceDue')}</label>
          <div class="pay-row">${amountField('amount', due)}<button class="btn primary big" type="submit">✓ ${T('payAllowance')}</button></div>
          <div id="split-preview"><h4>${T('splitPreview')}</h4>${splitPreviewHTML(c, due)}</div>
        </form>
      </section>
      <section class="card">
        <h3>⭐ ${T('extraChores')}</h3>
        <p class="muted">${T('extraChoresHint')}</p>
        <div class="extra-list">${c.chores.extra.map(x => `<button class="btn extra" data-act="payExtra" data-id="${x.id}">✓ ${esc(x.name)} <b>${M(x.value)}</b></button>`).join('') || `<p class="empty">—</p>`}</div>
        <button class="btn ghost" data-act="oneOff">＋ ${T('oneOff')}</button>
      </section>
      <section class="card">
        <h3>🫙 ${T('myPotsParent')}</h3>
        <div class="split">${pots.map(k => `<div class="split-item" style="--c:${POT_META[k].color}"><span>${POT_META[k].icon} ${T('pot_' + k)}</span><b>${M(k === 'invest' ? L.bankTotal(c) : c.pots[k])}</b></div>`).join('')}
        ${c.type === 'complete' ? `<div class="split-item" style="--c:#8e24aa"><span>🎯 ${T('inGoals')}</span><b>${M(c.goals.filter(g => !g.purchasedAt).reduce((s, g) => s + g.saved, 0))}</b></div>` : ''}</div>
        <p class="total-line">${T('total')}: <b>${M(L.totalBalance(c))}</b></p>
        <button class="btn ghost" data-act="adjust">🔧 ${T('adjustBalances')}</button>
      </section>`;
  }
  AFTER.parentChild = function () {
    if (ui.pTab === 'money') {
      const c = pChild();
      const f = document.getElementById('pay-form');
      const prev = document.getElementById('split-preview');
      f.amount.addEventListener('input', () => {
        const v = g.i18n.parseMoney(f.amount.value);
        prev.innerHTML = `<h4>${T('splitPreview')}</h4>` + splitPreviewHTML(c, v);
      });
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const v = g.i18n.parseMoney(f.amount.value);
        if (!(v > 0)) return g.UI.toast(T('invalidAmount'), 'error');
        if (!(await g.UI.confirmDialog(T('payConfirm', { value: M(v), name: c.name })))) return;
        if (act(s => L.payAllowance(s, c.id, v))) { g.UI.toast(T('paidDone', { value: M(v) })); g.UI.confetti(40); render(); }
      });
    }
    if (ui.pTab === 'profile') bindProfileForm(pChild());
    if (ui.pTab === 'history') {
      const sel = document.getElementById('hist-filter');
      sel.addEventListener('change', () => { ui.histFilter = sel.value; render(); });
    }
  };

  function parentChoresTab(c) {
    return `
      <section class="card">
        <h3>✅ ${T('standardChores')}</h3>
        <p class="muted">${T('standardChoresHint')}</p>
        <p><b>${T('choresProgress', { pct: Math.round(L.choreRatio(c) * 100) })}</b> → ${T('allowanceDue')}: <b>${M(L.allowanceDue(c))}</b> / ${M(c.allowance)}</p>
        <ul class="chores">${c.chores.standard.map(ch => `
          <li class="chore">
            <div class="chore-name"><b>${esc(ch.name)}</b><small class="muted">${ch.done}/${ch.perCycle} ${T('timesPerMonth')}</small>${progressBar(ch.perCycle ? ch.done / ch.perCycle * 100 : 0, c.color)}</div>
            <div class="counter">
              <button class="round-btn" data-act="choreMinus" data-id="${ch.id}" aria-label="-1">−</button>
              <span>${ch.done}</span>
              <button class="round-btn plus" data-act="chorePlus" data-id="${ch.id}" aria-label="+1">＋</button>
            </div>
            <button class="icon-btn small" data-act="editChore" data-kind="standard" data-id="${ch.id}">✏️</button>
          </li>`).join('') || `<p class="empty">—</p>`}</ul>
        <button class="btn ghost" data-act="addChore" data-kind="standard">＋ ${T('addChore')}</button>
      </section>
      <section class="card">
        <h3>⭐ ${T('extraChores')}</h3>
        <p class="muted">${T('extraChoresHint')}</p>
        <ul class="chores">${c.chores.extra.map(x => `
          <li class="chore">
            <div class="chore-name"><b>${esc(x.name)}</b><small class="muted">${M(x.value)}</small></div>
            <button class="btn primary small" data-act="payExtra" data-id="${x.id}">✓ ${T('choreDoneExtra')}</button>
            <button class="icon-btn small" data-act="editChore" data-kind="extra" data-id="${x.id}">✏️</button>
          </li>`).join('') || `<p class="empty">—</p>`}</ul>
        <button class="btn ghost" data-act="addChore" data-kind="extra">＋ ${T('addChore')}</button>
      </section>`;
  }

  function parentHistoryTab(c) {
    const kinds = ['all', 'allowance', 'extra', 'withdraw', 'tithe', 'interest', 'bankLock', 'bankRedeem', 'goalNew', 'goalAlloc', 'goalUnalloc', 'goalBuy', 'medal', 'adjust', 'typeChange'];
    return `<section class="card">
      <div class="hist-head"><h3>📜 ${T('fullHistory')}</h3>
      <select id="hist-filter" class="input select">${kinds.map(k => `<option value="${k}" ${ui.histFilter === k ? 'selected' : ''}>${k === 'all' ? T('allKinds') : T('h_' + k)}</option>`).join('')}</select></div>
      ${historyHTML(c, ui.histFilter)}</section>`;
  }

  // ---------- formulário de perfil (criar/editar) ----------
  function profileFormHTML(c) {
    const isNew = !c;
    const d = c || { name: '', avatar: AVATARS[0], color: COLORS[0], lang: S().parent.lang, type: 'complete', allowance: L.DEFAULT_ALLOWANCE, pcts: L.DEFAULT_PCTS, pinHash: null };
    const pctGroup = type => `
      <div class="pct-group" data-type="${type}" ${d.type === type ? '' : 'hidden'}>
        ${L.POTS[type].map(k => `<label class="pct">${POT_META[k].icon} ${T('pot_' + k)}<span class="pct-in"><input class="input" name="pct_${type}_${k}" inputmode="numeric" value="${d.pcts[type][k]}" ${k === 'tithe' ? 'readonly' : ''}>%</span></label>`).join('')}
        <p class="hint pct-sum"></p>
      </div>`;
    return `
      <form id="profile-form" class="profile-form" autocomplete="off">
        <h3>${isNew ? '＋ ' + T('newChild') : '👤 ' + T('editChild')}</h3>
        <label class="lbl">${T('childName')}<input class="input" name="name" value="${esc(d.name)}" required maxlength="24"></label>
        <label class="lbl">${T('avatar')}</label>
        <div class="avatar-pick">${AVATARS.map(a => `<label><input type="radio" name="avatar" value="${a}" ${a === d.avatar ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>
        <div class="color-pick">${COLORS.map(col => `<label><input type="radio" name="color" value="${col}" ${col === d.color ? 'checked' : ''}><span style="background:${col}"></span></label>`).join('')}</div>
        <label class="lbl">${T('pinOptional')}<input class="input" name="pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="${!isNew && d.pinHash ? '••••' : ''}"></label>
        ${!isNew && d.pinHash ? `<small class="muted">${T('pinKeep')}</small> <label class="switch-row inline"><input type="checkbox" name="removePin"><span>${T('removePin')}</span></label>` : ''}
        <label class="lbl">${T('childLang')}</label>
        <div class="seg"><label><input type="radio" name="lang" value="pt" ${d.lang === 'pt' ? 'checked' : ''}><span>🇧🇷 Português</span></label><label><input type="radio" name="lang" value="en" ${d.lang === 'en' ? 'checked' : ''}><span>🇺🇸 English</span></label></div>
        <label class="lbl">${T('appType')}</label>
        <div class="type-pick">${['simple', 'complete'].map(tp => `<label><input type="radio" name="type" value="${tp}" ${d.type === tp ? 'checked' : ''}><span><b>${T('type_' + tp)}</b><small>${T('typeDesc_' + tp)}</small></span></label>`).join('')}</div>
        <label class="lbl">${T('monthlyAllowance')}${amountField('allowance', d.allowance)}</label>
        <label class="lbl">${T('percentages')} <small class="muted">· ${T('titheFixed')}</small></label>
        ${pctGroup('simple')}${pctGroup('complete')}
        <div class="btn-row">
          ${isNew ? `<button type="button" class="btn ghost" data-close>${T('cancel')}</button>` : `<button type="button" class="btn danger ghost" data-act="deleteChild" data-id="${c.id}">🗑️ ${T('deleteChild')}</button>`}
          <button type="submit" class="btn primary">${T('save')}</button>
        </div>
      </form>`;
  }

  function bindProfileForm(c, onDone) {
    const f = document.getElementById('profile-form');
    const typeOf = () => f.querySelector('[name=type]:checked').value;
    const upd = () => {
      const tp = typeOf();
      f.querySelectorAll('.pct-group').forEach(gp => { gp.hidden = gp.dataset.type !== tp; });
      const gp = f.querySelector(`.pct-group[data-type="${tp}"]`);
      const sum = L.POTS[tp].reduce((s, k) => s + (Number(f[`pct_${tp}_${k}`].value) || 0), 0);
      const el = gp.querySelector('.pct-sum');
      el.textContent = T('pctSum', { sum });
      el.classList.toggle('bad', sum !== 100);
    };
    f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const tp = typeOf();
      const name = f.name.value.trim();
      if (!name) return g.UI.toast(T('childName') + '?', 'error');
      const allowance = g.i18n.parseMoney(f.allowance.value);
      if (!(allowance >= 0)) return g.UI.toast(T('invalidAmount'), 'error');
      const pcts = {}; L.POTS[tp].forEach(k => { pcts[k] = Number(f[`pct_${tp}_${k}`].value); });
      if (L.validatePcts(tp, pcts)) return g.UI.toast(T('pctError'), 'error');
      const pin = f.pin.value.trim();
      if (pin && !/^\d{4}$/.test(pin)) return g.UI.toast(T('pinOptional'), 'error');
      const pinHash = pin ? await g.UI.sha256('pin:' + pin) : null;
      const data = { name, avatar: f.querySelector('[name=avatar]:checked').value, color: f.querySelector('[name=color]:checked').value, lang: f.querySelector('[name=lang]:checked').value, type: tp, allowance };
      if (!c) {
        const created = act(s => { const ch = L.createChild(s, Object.assign({}, data, { pinHash })); L.setPcts(ch, tp, pcts); return ch; });
        if (created) { g.UI.closeModal(); g.UI.toast(T('saved')); ui.pChildId = created.id; ui.pTab = 'money'; go('parentChild'); }
        return;
      }
      if (c.type !== tp && !(await g.UI.confirmDialog(T('typeChangeConfirm')))) return;
      const ok = act(s => {
        const ch = L.getChild(s, c.id);
        if (ch.type !== tp) L.changeType(s, ch.id, tp);
        Object.assign(ch, { name: data.name, avatar: data.avatar, color: data.color, lang: data.lang, allowance: data.allowance });
        L.setPcts(ch, tp, pcts);
        if (pinHash) ch.pinHash = pinHash; else if (f.removePin && f.removePin.checked) ch.pinHash = null;
        return true;
      });
      if (ok) { g.UI.toast(T('saved')); render(); }
    });
  }

  // ---------------- modais da criança ----------------
  function withdrawModal(pot) {
    const c = child();
    const bal = L.potBalance(c, pot);
    const warn = pot === 'emergency' ? T('liliEmergencyWithdraw') : T('liliWithdraw', { name: c.name });
    const card = g.UI.openModal(`
      <form class="sheet" id="wd-form">
        <h2>${POT_META[pot].icon} ${T('withdrawTitle', { pot: T('pot_' + pot) })}</h2>
        ${liliSays(warn, 'wow', 70)}
        <p class="muted">${T('available', { value: M(bal) })}</p>
        <label class="lbl">${T('amount')}</label>${amountField('amount', 0, true)}
        ${chips([100, 200, 500, 1000].filter(v => v <= bal), bal > 0 ? bal : undefined)}
        <label class="lbl">${T('withdrawWhat')}<input class="input" name="note" maxlength="40" placeholder="${T('withdrawPlaceholder')}"></label>
        <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('confirm')}</button></div>
      </form>`);
    bindChips(card, 'amount');
    card.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const v = g.i18n.parseMoney(e.target.amount.value);
      if (!(v > 0)) return g.UI.toast(T('invalidAmount'), 'error');
      if (act(s => L.withdraw(s, c.id, pot, v, e.target.note.value.trim()))) {
        g.UI.closeModal(); g.UI.toast(T('withdrawDone', { value: M(v), pot: T('pot_' + pot) })); render();
      }
    });
  }

  function lockModal(tier) {
    const c = child(), s = S();
    const liq = c.bank.liquid.balance;
    const card = g.UI.openModal(`
      <form class="sheet">
        <h2>🔒 ${T('investTitle', { tier: T('tier_' + tier) })}</h2>
        <p>${T('tierDesc_' + tier, { rate: fmtRate(s.bankRates[tier]) })}</p>
        <p class="muted">${T('investFrom', { value: M(liq) })}</p>
        <label class="lbl">${T('amount')}</label>${amountField('amount', 0, true)}
        ${chips([500, 1000, 2000].filter(v => v <= liq), liq)}
        <p class="hint" id="lock-proj"></p>
        <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('invest')}</button></div>
      </form>`);
    bindChips(card, 'amount');
    const f = card.querySelector('form');
    const proj = () => {
      const v = g.i18n.parseMoney(f.amount.value);
      const months = L.TIERS[tier];
      card.querySelector('#lock-proj').textContent = v > 0 ? T('lockProjection', { n: months, value: M(Math.round(v * Math.pow(1 + s.bankRates[tier] / 100, months))) }) : '';
    };
    f.addEventListener('input', proj); card.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', proj));
    f.addEventListener('submit', e => {
      e.preventDefault();
      const v = g.i18n.parseMoney(f.amount.value);
      if (!(v > 0)) return g.UI.toast(T('invalidAmount'), 'error');
      if (act(st => L.lockDeposit(st, c.id, tier, v))) { g.UI.closeModal(); g.UI.confetti(30); render(); }
    });
  }

  function goalModal() {
    const c = child();
    let photo = null;
    const card = g.UI.openModal(`
      <form class="sheet">
        <h2>🎯 ${T('newGoal')}</h2>
        <div class="photo-pick">
          <div class="photo-prev"><span>📷</span></div>
          <label class="btn ghost file-btn">📷 ${T('choosePhoto')}<input type="file" accept="image/*" name="photo" hidden></label>
        </div>
        <label class="lbl">${T('goalName')}<input class="input" name="name" maxlength="30" placeholder="${T('goalNamePh')}" required></label>
        <label class="lbl">${T('goalTarget')}</label>${amountField('target', 0)}
        <label class="lbl">${T('goalDeadline')}<input class="input" type="date" name="deadline"></label>
        <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('save')}</button></div>
      </form>`);
    const f = card.querySelector('form');
    f.photo.addEventListener('change', async () => {
      const file = f.photo.files[0]; if (!file) return;
      try { photo = await g.UI.resizeImage(file, 480, 0.72); card.querySelector('.photo-prev').innerHTML = `<img src="${photo}" alt="">`; } catch (e) { g.UI.toast('📷 ?', 'error'); }
    });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const target = g.i18n.parseMoney(f.target.value);
      if (!f.name.value.trim()) return g.UI.toast(T('goalName'), 'error');
      if (!(target > 0)) return g.UI.toast(T('invalidAmount'), 'error');
      if (act(s => L.addGoal(s, c.id, { name: f.name.value, target, deadline: f.deadline.value || null, photo }))) { g.UI.closeModal(); render(); }
    });
  }

  function allocModal(goalId, sign) {
    const c = child();
    const gl = c.goals.find(x => x.id === goalId);
    const max = sign > 0 ? Math.min(c.pots.goals, gl.target - gl.saved) : gl.saved;
    const card = g.UI.openModal(`
      <form class="sheet">
        <h2>${sign > 0 ? '➕ ' + T('allocateTitle', { name: esc(gl.name) }) : '➖ ' + T('unallocateTitle', { name: esc(gl.name) })}</h2>
        <p class="muted">${sign > 0 ? T('goalsPotAvail', { value: M(c.pots.goals) }) : T('goalProgress', { saved: M(gl.saved), target: M(gl.target) })}</p>
        <label class="lbl">${T('amount')}</label>${amountField('amount', 0, true)}
        ${chips([100, 200, 500, 1000].filter(v => v < max), max > 0 ? max : undefined)}
        <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('confirm')}</button></div>
      </form>`);
    bindChips(card, 'amount');
    card.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const v = g.i18n.parseMoney(e.target.amount.value);
      if (!(v > 0)) return g.UI.toast(T('invalidAmount'), 'error');
      const res = act(s => L.allocateGoal(s, c.id, goalId, sign * v));
      if (!res) return;
      g.UI.closeModal(); render();
      if (res.justReached) celebrate(T('liliGoalDone', { name: c.name }));
    });
  }

  function celebrate(text) {
    g.UI.confetti(120); g.UI.vibrate(40);
    g.UI.openModal(`<div class="celebrate">${g.liliSVG({ size: 150, mood: 'wink' })}<h2>${esc(text)}</h2><button class="btn primary big" data-close>🎉 ${T('ok')}</button></div>`);
  }

  function pinModal(c) {
    let entered = '';
    const card = g.UI.openModal(`
      <div class="pin-pad">
        <span class="avatar lg">${esc(c.avatar)}</span>
        <h2>${T('enterPin', { name: esc(c.name) })}</h2>
        <div class="pin-dots">${'<i></i>'.repeat(4)}</div>
        <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✕'].map(k => `<button class="key" data-k="${k}">${k}</button>`).join('')}</div>
      </div>`, { cls: 'pin-card' });
    const dots = card.querySelectorAll('.pin-dots i');
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < entered.length));
    card.querySelectorAll('.key').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.k;
      if (k === '✕') return g.UI.closeModal();
      if (k === '⌫') entered = entered.slice(0, -1); else if (entered.length < 4) entered += k;
      paint(); g.UI.vibrate(8);
      if (entered.length === 4) {
        const h = await g.UI.sha256('pin:' + entered);
        if (h === c.pinHash) { g.UI.closeModal(); enterKid(c.id); }
        else { card.querySelector('.pin-dots').classList.add('shake'); g.UI.toast(T('wrongPin'), 'error'); setTimeout(() => { entered = ''; paint(); card.querySelector('.pin-dots').classList.remove('shake'); }, 450); }
      }
    }));
  }

  function enterKid(id) { ui.counts = {}; go('kidHome', { childId: id }); }

  function whatsNewModal() {
    const lang = g.i18n.getLang();
    g.UI.openModal(`
      <div class="sheet whatsnew">
        <h2>✨ ${T('whatsNewTitle')}</h2>
        <p class="muted">${T('currentVersion', { v: 'v' + g.APP_VERSION })}</p>
        ${g.CHANGELOG.map(v => `<div class="cl-entry"><h3>v${v.version} <small class="muted">${g.i18n.date(new Date(v.date + 'T12:00:00').getTime())}</small></h3><ul>${v[lang].map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
        <div class="btn-row"><button class="btn primary" data-close>${T('ok')}</button></div>
      </div>`);
    act(s => { s.settings.lastSeenVersion = g.APP_VERSION; });
  }

  // ---------------- ações ----------------
  const ACTIONS = {
    openChild(d) { const c = S().children.find(x => x.id === d.id); if (!c) return; if (c.pinHash) pinModal(c); else enterKid(c.id); },
    toParent() { go(ui.parentOk ? 'parent' : 'parentLogin'); },
    toProfiles() { go('profiles'); },
    exitKid() { ui.childId = null; go('profiles'); },
    exitParent() { ui.parentOk = false; go('profiles'); },
    toParentHome() { go('parent'); },
    parentLang() { act(s => { s.parent.lang = s.parent.lang === 'pt' ? 'en' : 'pt'; }); render(); },
    kidLang() { const c = child(); act(s => { const ch = L.getChild(s, c.id); ch.lang = ch.lang === 'pt' ? 'en' : 'pt'; }); render(); },
    nav(d) { if (d.to === 'missions') ui.mission = null; go(d.to); },
    whatsNew() { whatsNewModal(); },
    withdraw(d) { withdrawModal(d.pot); },
    async deliverTithe() {
      const c = child();
      if (!(c.pots.tithe > 0)) return g.UI.toast(T('titheNothing'));
      if (!(await g.UI.confirmDialog(T('titheConfirm', { value: M(c.pots.tithe) }), { yes: '🙏 ' + T('yes'), no: T('no') }))) return;
      if (act(s => L.deliverTithe(s, c.id))) { render(); celebrate(T('titheDelivered')); }
    },
    lock(d) { lockModal(d.tier); },
    async redeem(d) {
      const c = child();
      const dep = c.bank.deposits.find(x => x.id === d.id);
      if (!dep) return;
      if (!L.depositMatured(dep)) {
        const val = L.depositValue(dep);
        if (!(await g.UI.confirmDialog(T('redeemEarlyWarn', { principal: M(dep.principal), lost: M(val - dep.principal) }), { lili: true, danger: true, yes: T('redeem'), no: T('cancel') }))) return;
      }
      const r = act(s => L.redeemDeposit(s, c.id, d.id));
      if (r) { g.UI.toast(T('redeemDone', { value: M(r.value) })); if (!r.early) g.UI.confetti(50); render(); }
    },
    chartMonths(d) { ui.chartMonths = Number(d.m); const c = child(); document.getElementById('chart-area').innerHTML = chartHTML(c); },
    newGoal() { goalModal(); },
    allocGoal(d) { allocModal(d.id, 1); },
    unallocGoal(d) { allocModal(d.id, -1); },
    async buyGoal(d) {
      const c = child(); const gl = c.goals.find(x => x.id === d.id);
      if (!(await g.UI.confirmDialog(T('buyConfirm', { name: gl.name, value: M(gl.saved) })))) return;
      if (act(s => L.purchaseGoal(s, c.id, d.id))) { render(); celebrate(T('goalBoughtDone')); }
    },
    async deleteGoal(d) {
      const c = child(); const gl = c.goals.find(x => x.id === d.id);
      if (!(await g.UI.confirmDialog(T('goalDeleteConfirm', { name: gl.name }), { danger: true, yes: T('delete') }))) return;
      act(s => L.deleteGoal(s, c.id, d.id)); render();
    },
    startMission(d) { ui.mission = { id: d.id, phase: 'slides', step: 0, answers: [] }; go('mission'); },
    missionNext() {
      const st = ui.mission; const m = g.MISSIONS.find(x => x.id === st.id);
      if (st.phase === 'slides') { if (st.step < m.slides.length - 1) st.step++; else { st.phase = 'quiz'; st.step = 0; } }
      else if (st.phase === 'feedback') {
        if (st.step < m.quiz.length - 1) { st.step++; st.phase = 'quiz'; }
        else {
          const right = st.answers.filter((a, i) => a === m.quiz[i].answer).length;
          const c = child();
          st.result = act(s => L.awardMedal(s, c.id, m.id, right)) || null;
          st.phase = 'result';
          if (st.result) setTimeout(() => g.UI.confetti(st.result.stars === 3 ? 120 : 60), 150);
        }
      }
      render();
    },
    missionAnswer(d) {
      const st = ui.mission; const m = g.MISSIONS.find(x => x.id === st.id);
      st.answers[st.step] = Number(d.i); st.phase = 'feedback';
      g.UI.vibrate(Number(d.i) === m.quiz[st.step].answer ? 20 : 60);
      render();
    },
    // pai
    pChild(d) { ui.pChildId = d.id; ui.pTab = d.tab || 'money'; ui.histFilter = 'all'; go('parentChild'); },
    pTab(d) { ui.pTab = d.tab; render(); },
    newChild() { g.UI.openModal(profileFormHTML(null), { cls: 'wide', sticky: true }); bindProfileForm(null); },
    async deleteChild(d) {
      const c = S().children.find(x => x.id === d.id);
      if (!(await g.UI.confirmDialog(T('deleteChildConfirm', { name: c.name }), { danger: true, yes: T('delete') }))) return;
      act(s => { s.children = s.children.filter(x => x.id !== d.id); }); go('parent');
    },
    chorePlus(d) { act(s => L.markStandard(s, ui.pChildId, d.id, 1)); g.UI.vibrate(10); render(); },
    choreMinus(d) { act(s => L.markStandard(s, ui.pChildId, d.id, -1)); render(); },
    async payExtra(d) {
      const c = pChild(); const x = c.chores.extra.find(e => e.id === d.id);
      if (!(await g.UI.confirmDialog(T('extraConfirm', { name: x.name, value: M(x.value), child: c.name })))) return;
      if (act(s => L.payExtra(s, c.id, x.name, x.value))) { g.UI.toast(T('extraPaid', { name: x.name, value: M(x.value) })); render(); }
    },
    oneOff() {
      const c = pChild();
      const card = g.UI.openModal(`
        <form class="sheet"><h2>⭐ ${T('oneOff')}</h2>
          <label class="lbl">${T('description')}<input class="input" name="name" maxlength="40" required></label>
          <label class="lbl">${T('amount')}</label>${amountField('value', 0)}
          <div id="oo-prev"></div>
          <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('confirm')}</button></div>
        </form>`);
      const f = card.querySelector('form');
      f.value.addEventListener('input', () => { card.querySelector('#oo-prev').innerHTML = splitPreviewHTML(c, g.i18n.parseMoney(f.value.value)); });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const v = g.i18n.parseMoney(f.value.value);
        if (!(v > 0) || !f.name.value.trim()) return g.UI.toast(T('invalidAmount'), 'error');
        if (act(s => L.payExtra(s, c.id, f.name.value.trim(), v))) { g.UI.closeModal(); g.UI.toast(T('extraPaid', { name: f.name.value.trim(), value: M(v) })); render(); }
      });
    },
    addChore(d) { choreModal(d.kind, null); },
    editChore(d) { choreModal(d.kind, d.id); },
    adjust() {
      const c = pChild();
      const pots = L.POTS[c.type];
      const card = g.UI.openModal(`
        <form class="sheet"><h2>🔧 ${T('adjustBalances')}</h2>
          <p class="hint">${T('adjustHint')}</p>
          ${pots.map(k => `<label class="lbl adj">${POT_META[k].icon} ${T(k === 'invest' ? 'liquidAccount' : 'pot_' + k)}${amountField('p_' + k, L.potBalance(c, k))}</label>`).join('')}
          <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('save')}</button></div>
        </form>`, { sticky: true });
      card.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const vals = {};
        for (const k of pots) { const v = g.i18n.parseMoney(e.target['p_' + k].value || '0'); if (!(v >= 0)) return g.UI.toast(T('invalidAmount'), 'error'); vals[k] = v; }
        act(s => { pots.forEach(k => { if (vals[k] !== L.potBalance(L.getChild(s, c.id), k)) L.adjustPot(s, c.id, k, vals[k]); }); });
        g.UI.closeModal(); g.UI.toast(T('adjustDone')); render();
      });
    },
    syncForm(d) { syncFormModal(d.mode); },
    forgotParent() { forgotParentModal(); },
    async syncNow() { try { await SYNC().syncNow(); } catch (e) { g.UI.toast(syncErrText(e), 'error'); } refreshSyncUI(); },
    async syncResetLink() { try { await SYNC().sendPasswordReset(); g.UI.toast(T('syncResetSent', { email: syncInfo().email })); } catch (e) { g.UI.toast(syncErrText(e), 'error'); } },
    async syncSignOut() {
      if (!(await g.UI.confirmDialog(T('syncSignOutConfirm'), { danger: true, yes: T('syncSignOut') }))) return;
      await SYNC().signOut(); render();
    },
    syncReconnect() {
      const i = syncInfo();
      const card = g.UI.openModal(`
        <form class="sheet"><h2>☁️ ${T('syncReconnect')}</h2><p class="muted">${esc(i.email || '')}</p>
          <input class="input" type="password" name="pw" placeholder="${T('familyPassword')}" autocomplete="current-password">
          <p class="form-err" role="alert"></p>
          <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('syncSignIn')}</button></div>
        </form>`, { sticky: true });
      card.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        try { await SYNC().reconnect(e.target.pw.value); g.UI.closeModal(); g.UI.toast(T('syncDone')); render(); }
        catch (ex) { card.querySelector('.form-err').textContent = syncErrText(ex); }
      });
    },
    exportBackup() {
      const d = new Date(L.now());
      const name = `mesada-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      g.UI.download(name, g.Store.exportJSON());
    },
    changePassword() {
      const card = g.UI.openModal(`
        <form class="sheet"><h2>🔑 ${T('changePassword')}</h2>
          <input class="input" type="password" name="old" placeholder="${T('parentPassword')}">
          <input class="input" type="password" name="pw" placeholder="${T('newPassword')}">
          <input class="input" type="password" name="pw2" placeholder="${T('repeatPassword')}">
          <div class="btn-row"><button type="button" class="btn ghost" data-close>${T('cancel')}</button><button class="btn primary" type="submit">${T('save')}</button></div>
        </form>`, { sticky: true });
      card.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault(); const f = e.target;
        if ((await g.UI.sha256(f.old.value)) !== S().parent.passwordHash) return g.UI.toast(T('wrongPassword'), 'error');
        if (f.pw.value.length < 4) return g.UI.toast(T('passwordShort'), 'error');
        if (f.pw.value !== f.pw2.value) return g.UI.toast(T('passwordsDiffer'), 'error');
        const h = await g.UI.sha256(f.pw.value);
        act(s => { s.parent.passwordHash = h; }); g.UI.closeModal(); g.UI.toast(T('saved'));
      });
    }
  };

  function choreModal(kind, id) {
    const c = pChild();
    const list = c.chores[kind];
    const ch = id ? list.find(x => x.id === id) : null;
    const card = g.UI.openModal(`
      <form class="sheet"><h2>${ch ? '✏️ ' + T('edit') : '＋ ' + T('addChore')} · ${T(kind === 'standard' ? 'standardChores' : 'extraChores')}</h2>
        <label class="lbl">${T('choreName')}<input class="input" name="name" maxlength="40" value="${ch ? esc(ch.name) : ''}" required></label>
        ${kind === 'standard'
          ? `<label class="lbl">${T('choreTimes')}<input class="input" name="per" inputmode="numeric" value="${ch ? ch.perCycle : 4}"></label>`
          : `<label class="lbl">${T('choreValue')}</label>${amountField('value', ch ? ch.value : 200)}`}
        <div class="btn-row">
          ${ch ? `<button type="button" class="btn danger ghost" id="del-chore">🗑️ ${T('delete')}</button>` : `<button type="button" class="btn ghost" data-close>${T('cancel')}</button>`}
          <button class="btn primary" type="submit">${T('save')}</button>
        </div>
      </form>`);
    const f = card.querySelector('form');
    f.addEventListener('submit', e => {
      e.preventDefault();
      const name = f.name.value.trim(); if (!name) return;
      let extra;
      if (kind === 'standard') { const per = parseInt(f.per.value, 10); if (!(per >= 1 && per <= 31)) return g.UI.toast(T('invalidAmount'), 'error'); extra = { perCycle: per }; }
      else { const v = g.i18n.parseMoney(f.value.value); if (!(v > 0)) return g.UI.toast(T('invalidAmount'), 'error'); extra = { value: v }; }
      act(s => {
        const arr = L.getChild(s, c.id).chores[kind];
        if (ch) { const it = arr.find(x => x.id === ch.id); Object.assign(it, { name }, extra); if (it.done > it.perCycle) it.done = it.perCycle; }
        else arr.push(Object.assign({ id: L.uid(), name, done: 0 }, extra));
      });
      g.UI.closeModal(); render();
    });
    const del = card.querySelector('#del-chore');
    if (del) del.addEventListener('click', () => { act(s => { const ch2 = L.getChild(s, c.id); ch2.chores[kind] = ch2.chores[kind].filter(x => x.id !== ch.id); }); g.UI.closeModal(); render(); });
  }

  // ---------------- inicialização ----------------
  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el); }
  }

  async function boot() {
    document.addEventListener('click', onClick);
    g.onStoreError = () => g.UI.toast(T('saveError'), 'error');
    await g.Store.init();
    useLang(S().parent.lang);
    // dados que chegam de outro aparelho (nuvem) ou de outra aba
    g.Store.subscribe((st, meta) => { if (meta && meta.remote) remoteRender(); });
    if (SYNC()) {
      SYNC().onStatus(refreshSyncUI);
      SYNC().start().catch(e => console.warn('sync start', e)); // sem conta conectada: não faz nada
    }
    render();
    const s = S();
    if (s.children.length && s.settings.lastSeenVersion && s.settings.lastSeenVersion !== g.APP_VERSION) whatsNewModal();
    else if (!s.settings.lastSeenVersion) act(st => { st.settings.lastSeenVersion = g.APP_VERSION; });
    // recalcula juros quando o app volta ao primeiro plano (ex.: virou o mês)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { let n = 0; act(st => { n = L.accrueAll(st); }); if (n) render(); }
    });
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !g.__NO_SW__) {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw && nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              const b = document.createElement('button'); b.className = 'update-banner'; b.textContent = T('updateAvailable');
              b.onclick = () => { nw.postMessage('skipWaiting'); };
              document.body.appendChild(b);
            }
          });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }
  }

  g.App = { boot, go, render, ui, ACTIONS };
  document.addEventListener('DOMContentLoaded', boot);
})(window);
