/* Regras de negócio puras (sem DOM, sem persistência).
 * Todos os valores em CENTAVOS (inteiros) para evitar erros de arredondamento.
 * Cada função recebe o estado e o altera; quem chama (Store.update) persiste. */
(function (g) {
  'use strict';

  const POTS = {
    simple: ['tithe', 'save', 'spend'],
    complete: ['tithe', 'emergency', 'invest', 'goals', 'free']
  };
  const DEFAULT_PCTS = {
    simple: { tithe: 10, save: 45, spend: 45 },
    complete: { tithe: 10, emergency: 10, invest: 30, goals: 30, free: 20 }
  };
  const TITHE_PCT = 10;
  const EMERGENCY_MULTIPLIER = 3;
  const DEFAULT_ALLOWANCE = 2600; // R$ 26,00
  const DEFAULT_RATES = { liquid: 1, lock3: 2, lock6: 2.5 }; // % ao mês
  const TIERS = { liquid: 0, lock3: 3, lock6: 6 }; // meses travados
  const SCHEMA_VERSION = 1;

  let clock = () => Date.now();
  function now() { return clock(); }
  function setClock(fn) { clock = fn || (() => Date.now()); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- datas ----------
  function monthKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthKeyDiff(a, b) { // meses de a até b
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return (by - ay) * 12 + (bm - am);
  }
  function addMonthsKey(k, n) {
    const [y, m] = k.split('-').map(Number);
    const t = (y * 12 + (m - 1)) + n;
    return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
  }
  function fullMonthsBetween(aTs, bTs) {
    const a = new Date(aTs), b = new Date(bTs);
    let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return Math.max(0, m);
  }
  function addMonthsTs(ts, n) {
    const d = new Date(ts);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.getTime();
  }

  // ---------- estado inicial ----------
  function emptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: now(),
      updatedAt: now(),
      parent: { passwordHash: null, lang: 'pt' },
      bankRates: clone(DEFAULT_RATES),
      settings: { unlockAllMissions: false },
      children: []
    };
  }

  function defaultChores(lang) {
    const pt = lang !== 'en';
    return {
      standard: [
        { id: uid(), name: pt ? 'Arrumar o quarto' : 'Tidy up the bedroom', perCycle: 4, done: 0 },
        { id: uid(), name: pt ? 'Guardar os brinquedos' : 'Put toys away', perCycle: 4, done: 0 },
        { id: uid(), name: pt ? 'Fazer o dever de casa' : 'Do homework', perCycle: 4, done: 0 }
      ],
      extra: [
        { id: uid(), name: pt ? 'Lavar o carro com o papai' : 'Wash the car with Dad', value: 500 },
        { id: uid(), name: pt ? 'Ajudar na cozinha' : 'Help in the kitchen', value: 200 },
        { id: uid(), name: pt ? 'Regar as plantas' : 'Water the plants', value: 100 }
      ]
    };
  }

  function createChild(state, data) {
    const lang = data.lang || state.parent.lang || 'pt';
    const child = {
      id: uid(),
      name: (data.name || '').trim() || 'Criança',
      avatar: data.avatar || '🦁',
      color: data.color || '#7c4dff',
      pinHash: data.pinHash || null,
      lang,
      type: data.type === 'simple' ? 'simple' : 'complete',
      allowance: Number.isFinite(data.allowance) ? data.allowance : DEFAULT_ALLOWANCE,
      pcts: clone(DEFAULT_PCTS),
      pots: { tithe: 0, save: 0, spend: 0, emergency: 0, goals: 0, free: 0 },
      bank: { liquid: { balance: 0, lastAccrual: monthKey(now()) }, deposits: [] },
      goals: [],
      chores: defaultChores(lang),
      medals: {},          // missionId -> { stars: 2|3, ts }
      history: [],
      createdAt: now(),
      lastPaidAt: null
    };
    if (data.pcts) setPcts(child, child.type, data.pcts);
    state.children.push(child);
    return child;
  }

  function getChild(state, id) {
    const c = state.children.find(c => c.id === id);
    if (!c) throw new Error('child not found');
    return c;
  }

  function addHistory(child, entry) {
    const e = Object.assign({ id: uid(), ts: now() }, entry);
    child.history.unshift(e);
    if (child.history.length > 2000) child.history.length = 2000;
    return e;
  }

  // ---------- porcentagens ----------
  function validatePcts(type, pcts) {
    const keys = POTS[type];
    let sum = 0;
    for (const k of keys) {
      const v = Number(pcts[k]);
      if (!Number.isFinite(v) || v < 0 || v > 100) return 'invalid';
      sum += v;
    }
    if (Number(pcts.tithe) !== TITHE_PCT) return 'tithe';
    if (Math.abs(sum - 100) > 0.0001) return 'sum';
    return null;
  }
  function setPcts(child, type, pcts) {
    const p = { tithe: TITHE_PCT };
    POTS[type].forEach(k => { if (k !== 'tithe') p[k] = Number(pcts[k]); });
    const err = validatePcts(type, p);
    if (err) throw new Error('pcts:' + err);
    child.pcts[type] = p;
  }

  // ---------- reserva de emergência ----------
  function emergencyGoal(child) { return child.allowance * EMERGENCY_MULTIPLIER; }
  function emergencyReached(child) { return child.pots.emergency >= emergencyGoal(child); }

  // ---------- divisão ----------
  /* Divide um valor nos potes do tipo atual. Retorna { tithe:.., ... , overflow } em centavos.
   * Dízimo sempre exatamente 10% (arredondado); sobra de centavos vai para o último pote.
   * No Completo, a parte da Emergência que passar da meta (3 mesadas) vai para Investir. */
  function computeSplit(child, amount) {
    const type = child.type;
    const keys = POTS[type];
    const pcts = child.pcts[type];
    const out = {};
    let used = 0;
    keys.forEach(k => {
      const v = k === 'tithe' ? Math.round(amount * TITHE_PCT / 100) : Math.floor(amount * pcts[k] / 100);
      out[k] = v; used += v;
    });
    out[keys[keys.length - 1]] += amount - used;
    let overflow = 0;
    if (type === 'complete') {
      const room = Math.max(0, emergencyGoal(child) - child.pots.emergency);
      if (out.emergency > room) {
        overflow = out.emergency - room;
        out.emergency = room;
        out.invest += overflow;
      }
    }
    out.overflow = overflow;
    return out;
  }

  function addToPot(child, key, cents) {
    if (key === 'invest') child.bank.liquid.balance += cents;
    else child.pots[key] += cents;
  }
  function potBalance(child, key) {
    if (key === 'invest') return child.bank.liquid.balance;
    return child.pots[key] || 0;
  }

  function applyIncome(state, childId, amount, kind, note, extra) {
    const child = getChild(state, childId);
    amount = Math.round(amount);
    if (!(amount > 0)) throw new Error('amount');
    const split = computeSplit(child, amount);
    POTS[child.type].forEach(k => addToPot(child, k, split[k]));
    return addHistory(child, Object.assign({ kind, amount, note: note || '', split }, extra || {}));
  }

  // ---------- tarefas e mesada ----------
  function choreRatio(child) {
    const std = child.chores.standard;
    const total = std.reduce((s, c) => s + Math.max(0, c.perCycle), 0);
    if (!total) return 1;
    const done = std.reduce((s, c) => s + Math.min(c.done, Math.max(0, c.perCycle)), 0);
    return done / total;
  }
  function allowanceDue(child) { return Math.round(child.allowance * choreRatio(child)); }

  function markStandard(state, childId, choreId, delta) {
    const child = getChild(state, childId);
    const c = child.chores.standard.find(c => c.id === choreId);
    if (!c) throw new Error('chore');
    c.done = Math.max(0, Math.min(c.perCycle, c.done + delta));
    return c;
  }

  function payAllowance(state, childId, amount) {
    const child = getChild(state, childId);
    const due = allowanceDue(child);
    const pay = Number.isFinite(amount) ? Math.round(amount) : due;
    const summary = child.chores.standard.map(c => ({ name: c.name, done: c.done, perCycle: c.perCycle }));
    const e = applyIncome(state, childId, pay, 'allowance', '', { chores: summary, full: child.allowance, due });
    child.chores.standard.forEach(c => { c.done = 0; });
    child.lastPaidAt = now();
    return e;
  }

  function payExtra(state, childId, name, value) {
    return applyIncome(state, childId, value, 'extra', name);
  }

  // ---------- saques e dízimo ----------
  function withdraw(state, childId, pot, amount, note) {
    const child = getChild(state, childId);
    amount = Math.round(amount);
    if (pot === 'tithe') throw new Error('tithe');
    if (!(amount > 0)) throw new Error('amount');
    if (potBalance(child, pot) < amount) throw new Error('balance');
    addToPot(child, pot, -amount);
    return addHistory(child, { kind: 'withdraw', pot, amount, note: note || '' });
  }

  function deliverTithe(state, childId) {
    const child = getChild(state, childId);
    const amount = child.pots.tithe;
    if (!(amount > 0)) throw new Error('amount');
    child.pots.tithe = 0;
    return addHistory(child, { kind: 'tithe', pot: 'tithe', amount });
  }

  function adjustPot(state, childId, pot, newBalance, note) {
    const child = getChild(state, childId);
    newBalance = Math.max(0, Math.round(newBalance));
    const old = potBalance(child, pot);
    addToPot(child, pot, newBalance - old);
    return addHistory(child, { kind: 'adjust', pot, amount: newBalance - old, note: note || '' });
  }

  // ---------- Banco do Papai ----------
  function depositValue(dep, at) {
    const m = Math.min(fullMonthsBetween(dep.start, at === undefined ? now() : at), dep.months);
    return Math.round(dep.principal * Math.pow(1 + dep.rate / 100, m));
  }
  function depositMatured(dep, at) {
    return fullMonthsBetween(dep.start, at === undefined ? now() : at) >= dep.months;
  }
  function bankTotal(child) {
    return child.bank.liquid.balance + child.bank.deposits.reduce((s, d) => s + depositValue(d), 0);
  }

  /* Juros da conta com liquidez diária: creditados no dia 1º de cada mês (compostos). */
  function accrueChild(state, child) {
    const cur = monthKey(now());
    const liq = child.bank.liquid;
    const n = monthKeyDiff(liq.lastAccrual, cur);
    if (n <= 0) { if (n < 0) liq.lastAccrual = cur; return 0; }
    const rate = state.bankRates.liquid / 100;
    let total = 0;
    for (let i = 1; i <= n; i++) {
      const interest = Math.round(liq.balance * rate);
      if (interest > 0) {
        const mk = addMonthsKey(liq.lastAccrual, i);
        liq.balance += interest; total += interest;
        // id determinístico + registro por mês: se dois aparelhos creditarem o mesmo mês offline,
        // a sincronização reconhece que é o mesmo evento e conta os juros uma vez só.
        liq.interestLog = liq.interestLog || {};
        liq.interestLog[mk] = interest;
        const keys = Object.keys(liq.interestLog).sort();
        while (keys.length > 24) delete liq.interestLog[keys.shift()];
        addHistory(child, { id: 'int-' + child.id + '-' + mk, kind: 'interest', pot: 'invest', amount: interest, note: mk });
      }
    }
    liq.lastAccrual = cur;
    return total;
  }
  function accrueAll(state) {
    let t = 0;
    state.children.forEach(c => { if (c.type === 'complete') t += accrueChild(state, c); else c.bank.liquid.lastAccrual = monthKey(now()); });
    return t;
  }

  function lockDeposit(state, childId, tier, amount) {
    const child = getChild(state, childId);
    amount = Math.round(amount);
    if (!(tier === 'lock3' || tier === 'lock6')) throw new Error('tier');
    if (!(amount > 0)) throw new Error('amount');
    if (child.bank.liquid.balance < amount) throw new Error('balance');
    child.bank.liquid.balance -= amount;
    const dep = { id: uid(), tier, principal: amount, rate: state.bankRates[tier], months: TIERS[tier], start: now() };
    child.bank.deposits.push(dep);
    addHistory(child, { kind: 'bankLock', pot: 'invest', amount, tier, rate: dep.rate });
    return dep;
  }

  function redeemDeposit(state, childId, depId, opts) {
    const child = getChild(state, childId);
    const i = child.bank.deposits.findIndex(d => d.id === depId);
    if (i < 0) throw new Error('deposit');
    const dep = child.bank.deposits[i];
    const matured = depositMatured(dep);
    const noPenalty = opts && opts.noPenalty;
    const value = matured || noPenalty ? depositValue(dep) : dep.principal;
    child.bank.deposits.splice(i, 1);
    child.bank.liquid.balance += value;
    addHistory(child, { kind: 'bankRedeem', pot: 'invest', amount: value, principal: dep.principal, early: !matured && !noPenalty, tier: dep.tier });
    return { value, early: !matured && !noPenalty, lost: matured ? 0 : depositValue(dep) - dep.principal };
  }

  /* Projeção mês a mês: saldo inicial + aporte mensal, juros compostos. */
  function projection(startCents, monthlyCents, ratePct, months) {
    const pts = [startCents];
    let v = startCents;
    for (let i = 1; i <= months; i++) {
      v = v * (1 + ratePct / 100) + monthlyCents;
      pts.push(Math.round(v));
    }
    return pts;
  }

  // ---------- objetivos ----------
  function addGoal(state, childId, data) {
    const child = getChild(state, childId);
    const goal = {
      id: uid(), name: (data.name || '').trim() || '?', photo: data.photo || null,
      target: Math.round(data.target), saved: 0, deadline: data.deadline || null,
      createdAt: now(), reachedAt: null, purchasedAt: null, emoji: data.emoji || '🎁'
    };
    if (!(goal.target > 0)) throw new Error('target');
    child.goals.push(goal);
    addHistory(child, { kind: 'goalNew', amount: goal.target, note: goal.name });
    return goal;
  }
  function allocateGoal(state, childId, goalId, amount) {
    const child = getChild(state, childId);
    const goal = child.goals.find(g => g.id === goalId);
    if (!goal) throw new Error('goal');
    amount = Math.round(amount);
    if (amount > 0) {
      const room = goal.target - goal.saved;
      if (room <= 0) throw new Error('full');
      amount = Math.min(amount, room, child.pots.goals);
      if (amount <= 0) throw new Error('balance');
      child.pots.goals -= amount; goal.saved += amount;
      addHistory(child, { kind: 'goalAlloc', pot: 'goals', amount, note: goal.name });
    } else if (amount < 0) {
      const take = Math.min(-amount, goal.saved);
      if (take <= 0) throw new Error('amount');
      goal.saved -= take; child.pots.goals += take; amount = -take;
      addHistory(child, { kind: 'goalUnalloc', pot: 'goals', amount: take, note: goal.name });
    }
    const justReached = !goal.reachedAt && goal.saved >= goal.target;
    if (goal.saved >= goal.target) { if (!goal.reachedAt) goal.reachedAt = now(); } else goal.reachedAt = null;
    return { goal, justReached, moved: amount };
  }
  function purchaseGoal(state, childId, goalId) {
    const child = getChild(state, childId);
    const goal = child.goals.find(g => g.id === goalId);
    if (!goal) throw new Error('goal');
    goal.purchasedAt = now();
    addHistory(child, { kind: 'goalBuy', pot: 'goals', amount: goal.saved, note: goal.name });
    return goal;
  }
  function deleteGoal(state, childId, goalId) {
    const child = getChild(state, childId);
    const i = child.goals.findIndex(g => g.id === goalId);
    if (i < 0) return;
    const goal = child.goals[i];
    if (!goal.purchasedAt) child.pots.goals += goal.saved;
    child.goals.splice(i, 1);
  }

  // ---------- trocar tipo ----------
  /* Simples -> Completo: Guardar vai para Objetivos, Gastar vai para Livre.
   * Completo -> Simples: Emergência + Objetivos (inclusive o já separado) + Banco (resgatado sem multa) vão para Guardar; Livre vai para Gastar. */
  function changeType(state, childId, newType) {
    const child = getChild(state, childId);
    if (child.type === newType) return;
    const p = child.pots;
    if (newType === 'complete') {
      p.goals += p.save; p.save = 0;
      p.free += p.spend; p.spend = 0;
      child.bank.liquid.lastAccrual = monthKey(now());
    } else {
      child.bank.deposits.slice().forEach(d => redeemDeposit(state, childId, d.id, { noPenalty: true }));
      let saved = child.goals.filter(g => !g.purchasedAt).reduce((s, g) => s + g.saved, 0);
      child.goals.forEach(g => { if (!g.purchasedAt) { g.saved = 0; g.reachedAt = null; } });
      p.save += p.emergency + p.goals + saved + child.bank.liquid.balance;
      p.emergency = 0; p.goals = 0; child.bank.liquid.balance = 0;
      p.spend += p.free; p.free = 0;
    }
    child.type = newType;
    addHistory(child, { kind: 'typeChange', amount: 0, note: newType });
  }

  function totalBalance(child) {
    return POTS[child.type].reduce((s, k) => s + (k === 'invest' ? bankTotal(child) : child.pots[k]), 0)
      + (child.type === 'complete' ? child.goals.filter(g => !g.purchasedAt).reduce((s, g) => s + g.saved, 0) : 0);
  }

  // ---------- missões ----------
  function weeksSince(ts) { return Math.floor((now() - ts) / (7 * 864e5)); }
  function missionUnlocked(state, child, index) {
    if (state.settings && state.settings.unlockAllMissions) return true;
    return index <= weeksSince(child.createdAt);
  }
  function awardMedal(state, childId, missionId, correct) {
    const child = getChild(state, childId);
    if (correct < 2) return null;
    const stars = correct >= 3 ? 3 : 2;
    const prev = child.medals[missionId];
    if (!prev || prev.stars < stars) {
      child.medals[missionId] = { stars, ts: now() };
      addHistory(child, { kind: 'medal', amount: 0, note: missionId, stars });
      return { stars, upgraded: true };
    }
    return { stars: prev.stars, upgraded: false };
  }

  // ---------- migração / validação de backup ----------
  function migrate(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.children)) throw new Error('backup');
    s.schemaVersion = s.schemaVersion || 1;
    s.parent = s.parent || { passwordHash: null, lang: 'pt' };
    s.bankRates = Object.assign(clone(DEFAULT_RATES), s.bankRates || {});
    s.settings = Object.assign({ unlockAllMissions: false }, s.settings || {});
    s.children.forEach(c => {
      c.pots = Object.assign({ tithe: 0, save: 0, spend: 0, emergency: 0, goals: 0, free: 0 }, c.pots || {});
      c.pcts = Object.assign(clone(DEFAULT_PCTS), c.pcts || {});
      c.bank = c.bank || { liquid: { balance: 0, lastAccrual: monthKey(now()) }, deposits: [] };
      c.goals = c.goals || []; c.history = c.history || []; c.medals = c.medals || {};
      c.chores = c.chores || { standard: [], extra: [] };
      if (!c.bank.liquid.interestLog) c.bank.liquid.interestLog = {};
    });
    return s;
  }

  g.Logic = {
    POTS, DEFAULT_PCTS, TITHE_PCT, EMERGENCY_MULTIPLIER, DEFAULT_ALLOWANCE, DEFAULT_RATES, TIERS, SCHEMA_VERSION,
    now, setClock, uid, clone, monthKey, monthKeyDiff, addMonthsKey, fullMonthsBetween, addMonthsTs,
    emptyState, createChild, getChild, addHistory, validatePcts, setPcts,
    emergencyGoal, emergencyReached, computeSplit, applyIncome, potBalance,
    choreRatio, allowanceDue, markStandard, payAllowance, payExtra,
    withdraw, deliverTithe, adjustPot,
    depositValue, depositMatured, bankTotal, accrueChild, accrueAll, lockDeposit, redeemDeposit, projection,
    addGoal, allocateGoal, purchaseGoal, deleteGoal, changeType, totalBalance,
    weeksSince, missionUnlocked, awardMedal, migrate
  };
})(typeof window !== 'undefined' ? window : globalThis);
