/**
 * storage.js — хранилище с синхронизацией через JSONBin.io
 *
 * НАСТРОЙКА (один раз):
 * 1. Зарегистрируйтесь на https://jsonbin.io (бесплатно)
 * 2. Создайте bin с начальным JSON: {"tickets":[],"cartstock":{},"replacements":[],"overrides":{}}
 * 3. Скопируйте BIN_ID и API_KEY в CONFIG ниже
 *
 * Пока CONFIG не заполнен — работает через localStorage (только локально).
 */

const CONFIG = {
  BIN_ID:  '6a2d3b13da38895dfeb9bdf1',
  API_KEY: '$2a$10$f63xB98VcO..SoUEwpXEzOVrg3H3hAUPG99SP7QMGq1y5uvcVTTmu',
  SYNC_INTERVAL: 30000,
};

const Storage = (() => {

  // ── Локальный кэш (всегда актуален, пишем сразу) ─────────────────────────────
  let _cache = null;

  function _defaultData() {
    return { tickets: [], cartstock: {}, replacements: [], overrides: {} };
  }

  function _fromLocal() {
    try { return JSON.parse(localStorage.getItem('hd_data') || 'null') || _defaultData(); }
    catch { return _defaultData(); }
  }
  function _toLocal(data) {
    try { localStorage.setItem('hd_data', JSON.stringify(data)); } catch {}
  }

  function _data() {
    if (!_cache) _cache = _fromLocal();
    return _cache;
  }
  function _save() {
    _toLocal(_cache);
    // Async push to JSONBin (fire-and-forget)
    if (CONFIG.BIN_ID && CONFIG.API_KEY) _push();
  }

  // ── JSONBin API ───────────────────────────────────────────────────────────────
  let _syncing = false;
  let _pendingSync = false;

  async function _push() {
    if (_syncing) { _pendingSync = true; return; }
    _syncing = true;
    try {
      await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.API_KEY,
          'X-Bin-Versioning': 'false',
        },
        body: JSON.stringify(_cache),
      });
    } catch (e) { console.warn('JSONBin push failed:', e); }
    _syncing = false;
    if (_pendingSync) { _pendingSync = false; _push(); }
  }

  async function _pull() {
    if (!CONFIG.BIN_ID || !CONFIG.API_KEY) return;
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}/latest`, {
        headers: { 'X-Master-Key': CONFIG.API_KEY },
      });
      if (!res.ok) return;
      const json = await res.json();
      const remote = json.record || {};
      // Merge: remote is source of truth, but add any local tickets not yet in remote
      if (remote.tickets) {
        // Add local tickets missing from remote (created offline)
        const remoteIds = new Set((remote.tickets || []).map(t => t.id));
        const localOnly = (_cache.tickets || []).filter(t => !remoteIds.has(t.id));
        remote.tickets = [...localOnly, ...(remote.tickets || [])];
      }
      _cache = { ..._defaultData(), ...remote };
      _toLocal(_cache);
      _notifyListeners();
    } catch (e) { console.warn('JSONBin pull failed:', e); }
  }

  // ── Change listeners (для авто-обновления UI) ─────────────────────────────────
  const _listeners = new Set();
  function _notifyListeners() { _listeners.forEach(fn => fn()); }
  function onSync(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }

  // ── Public init ───────────────────────────────────────────────────────────────
  async function init() {
    _cache = _fromLocal();
    await _pull();  // первичная синхронизация

    if (CONFIG.BIN_ID && CONFIG.API_KEY && CONFIG.SYNC_INTERVAL > 0) {
      setInterval(_pull, CONFIG.SYNC_INTERVAL);
    }

    // Seed stock
    if (!_data().stockSeeded) {
      // Будет вызван из app.js
    }
  }

  function isConfigured() {
    return !!(CONFIG.BIN_ID && CONFIG.API_KEY);
  }

  // ── Tickets ─────────────────────────────────────────────────────────────────
  const tickets = {
    all:    ()    => _data().tickets || [],
    find:   (id)  => tickets.all().find(t => t.id === id) || null,
    add(t) {
      _data().tickets.unshift(t);
      _save();
    },
    update(id, fields) {
      const a = tickets.all(), i = a.findIndex(t => t.id === id);
      if (i >= 0) { a[i] = { ...a[i], ...fields }; _save(); }
    },
    remove(id) {
      _data().tickets = tickets.all().filter(t => t.id !== id);
      _save();
    },
  };

  // ── Cart stock — по артикулу картриджа ──────────────────────────────────────
  const cart = {
    _s: () => _data().cartstock || {},

    getByArticle(article) {
      if (!article) return null;
      const v = cart._s()[article];
      return v !== undefined ? Number(v) : null;
    },
    getByPrinter(pr) {
      return cart.getByArticle(pr.cartridge);
    },
    setByArticle(article, n) {
      if (!article) return;
      _data().cartstock[article] = Math.max(0, n);
      _save();
    },
    adjustByArticle(article, delta) {
      const cur = cart.getByArticle(article);
      cart.setByArticle(article, (cur === null ? 0 : cur) + delta);
    },
    // Обёртки для inventory (adj-кнопки по артикулу уже используют data-art)
    getByPid(pid, printers) {
      const pr = (printers || App.state.printers).find(p => p.id === +pid);
      return pr ? cart.getByPrinter(pr) : null;
    },
    adjustByPid(pid, delta, printers) {
      const pr = (printers || App.state.printers).find(p => p.id === +pid);
      if (pr && pr.cartridge) cart.adjustByArticle(pr.cartridge, delta);
    },
    seedOnce(seedByArticle) {
      if (_data().stockSeeded) return;
      const s = cart._s();
      for (const art in seedByArticle) {
        if (s[art] === undefined) s[art] = seedByArticle[art];
      }
      _data().stockSeeded = true;
      _save();
    },
  };

  // ── Replacements ─────────────────────────────────────────────────────────────
  const replacements = {
    all:  () => _data().replacements || [],
    add(entry) {
      _data().replacements.unshift(entry);
      _save();
    },
    today(pid) {
      const t = new Date().toLocaleDateString('ru-RU');
      return replacements.all()
        .filter(r => String(r.printerId) === String(pid) && (r.created || '').startsWith(t))
        .reduce((s, r) => s + (r.qty || 1), 0);
    },
    total(pid) {
      return replacements.all()
        .filter(r => String(r.printerId) === String(pid))
        .reduce((s, r) => s + (r.qty || 1), 0);
    },
    todayByArticle(article) {
      const t = new Date().toLocaleDateString('ru-RU');
      return replacements.all()
        .filter(r => r.cartridge === article && (r.created || '').startsWith(t))
        .reduce((s, r) => s + (r.qty || 1), 0);
    },
    totalByArticle(article) {
      return replacements.all()
        .filter(r => r.cartridge === article)
        .reduce((s, r) => s + (r.qty || 1), 0);
    },
  };

  // ── Overrides ─────────────────────────────────────────────────────────────────
  const overrides = {
    _d: () => _data().overrides || {},
    get(name)         { return overrides._d()[name] || {}; },
    set(name, fields) { _data().overrides[name] = { ...overrides.get(name), ...fields }; _save(); },
    clear(name)       { delete _data().overrides[name]; _save(); },
    hasAny(name)      { return Object.keys(overrides.get(name)).length > 0; },
  };

  // ── Legacy localStorage helpers (для совместимости) ───────────────────────────
  function get(key, def = null) {
    try { const v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); }
    catch { return def; }
  }
  function set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  return { init, isConfigured, onSync, pull: _pull, tickets, cart, replacements, overrides, get, set };
})();

window.Storage = Storage;
