/**
 * storage.js — хранилище с синхронизацией через JSONBin.io
 * JSONBin — источник правды. Все изменения сразу пишутся туда.
 */

const CONFIG = {
  BIN_ID:  '6a2d3b13da38895dfeb9bdf1',
  API_KEY: '$2a$10$f63xB98VcO..SoUEwpXEzOVrg3H3hAUPG99SP7QMGq1y5uvcVTTmu',
  SYNC_INTERVAL: 30000,
};

const Storage = (() => {

  // ── Кэш и localStorage ────────────────────────────────────────────────────────
  let _cache = null;

  function _default() {
    return { tickets: [], cartstock: {}, replacements: [], overrides: {}, devices: {}, stockSeeded: false };
  }
  function _fromLocal() {
    try { return JSON.parse(localStorage.getItem('hd_data') || 'null') || _default(); }
    catch { return _default(); }
  }
  function _toLocal(d) {
    try { localStorage.setItem('hd_data', JSON.stringify(d)); } catch {}
  }
  function _data() {
    if (!_cache) _cache = _fromLocal();
    return _cache;
  }

  // ── Push в JSONBin ────────────────────────────────────────────────────────────
  let _pushTimer = null;

  function _save() {
    _toLocal(_cache);
    // Debounce: ждём 300мс чтобы не спамить API при быстрых изменениях
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(_push, 300);
  }

  async function _push() {
    if (!CONFIG.BIN_ID || !CONFIG.API_KEY) return;
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': CONFIG.API_KEY,
          'X-Bin-Versioning': 'false',
        },
        body: JSON.stringify(_cache),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error('JSONBin push error:', res.status, txt);
        _notifyListeners('error');
        return;
      }
      _notifyListeners('ok');
    } catch (e) {
      console.error('JSONBin push failed:', e);
      _notifyListeners('error');
    }
  }

  // ── Pull из JSONBin ───────────────────────────────────────────────────────────
  async function _pull() {
    if (!CONFIG.BIN_ID || !CONFIG.API_KEY) return;
    try {
      _notifyListeners('syncing');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
      const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}/latest`, {
        headers: { 'X-Master-Key': CONFIG.API_KEY },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        console.error('JSONBin pull error:', res.status);
        _notifyListeners('error');
        return;
      }
      const json = await res.json();
      const remote = json.record || {};

      // Мерж: берём remote как источник правды
      // Но добавляем локальные tickets/replacements которых нет в remote
      const remoteTicketIds  = new Set((remote.tickets      || []).map(t => t.id));
      const remoteRepTs      = new Set((remote.replacements || []).map(r => r.ts));

      const localOnlyTickets = (_cache ? _cache.tickets      || [] : []).filter(t => !remoteTicketIds.has(t.id));
      const localOnlyReps    = (_cache ? _cache.replacements || [] : []).filter(r => !remoteRepTs.has(r.ts));

      _cache = {
        ..._default(),
        ...remote,
        tickets:      [...localOnlyTickets,  ...(remote.tickets      || [])],
        replacements: [...localOnlyReps,     ...(remote.replacements || [])],
      };

      // Если есть локальные данные которых нет в remote — пушим обратно
      if (localOnlyTickets.length > 0 || localOnlyReps.length > 0) {
        await _push();
      }

      _toLocal(_cache);
      _notifyListeners('ok');
    } catch (e) {
      console.error('JSONBin pull failed:', e);
      _notifyListeners('error');
    }
  }

  // ── Listeners (для UI-индикатора) ─────────────────────────────────────────────
  const _listeners = new Set();
  function _notifyListeners(state) { _listeners.forEach(fn => fn(state)); }
  function onSync(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }

  function isConfigured() { return !!(CONFIG.BIN_ID && CONFIG.API_KEY); }

  // ── Init ──────────────────────────────────────────────────────────────────────
  async function init() {
    _cache = _fromLocal();
    await _pull();
    if (isConfigured() && CONFIG.SYNC_INTERVAL > 0) {
      setInterval(_pull, CONFIG.SYNC_INTERVAL);
    }
  }

  // ── Tickets ───────────────────────────────────────────────────────────────────
  const tickets = {
    all:  ()    => _data().tickets || [],
    find: (id)  => tickets.all().find(t => t.id === id) || null,
    add(t)      { _data().tickets.unshift(t); _save(); },
    update(id, fields) {
      const a = tickets.all(), i = a.findIndex(t => t.id === id);
      if (i >= 0) { a[i] = { ...a[i], ...fields }; _save(); }
    },
    remove(id)  { _data().tickets = tickets.all().filter(t => t.id !== id); _save(); },
  };

  // ── Cart stock — по артикулу картриджа ───────────────────────────────────────
  const cart = {
    _s: () => {
      if (!_data().cartstock) _data().cartstock = {};
      return _data().cartstock;
    },
    getByArticle(article) {
      if (!article) return null;
      const v = cart._s()[article];
      return v !== undefined ? Number(v) : null;
    },
    getByPrinter(pr) { return cart.getByArticle(pr.cartridge); },
    setByArticle(article, n) {
      if (!article) return;
      cart._s()[article] = Math.max(0, n);
      _save();
    },
    adjustByArticle(article, delta) {
      const cur = cart.getByArticle(article);
      cart.setByArticle(article, (cur === null ? 0 : cur) + delta);
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

  // ── Replacements ──────────────────────────────────────────────────────────────
  const replacements = {
    all:  ()     => _data().replacements || [],
    add(entry)   { _data().replacements.unshift(entry); _save(); },
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
    _d: () => { if (!_data().overrides) _data().overrides = {}; return _data().overrides; },
    get(name)         { return overrides._d()[name] || {}; },
    set(name, fields) { overrides._d()[name] = { ...overrides.get(name), ...fields }; _save(); },
    clear(name)       { delete overrides._d()[name]; _save(); },
    hasAny(name)      { return Object.keys(overrides.get(name)).length > 0; },
  };

  // ── Devices (инвентарь техники пользователей) ───────────────────────────────
  // devices[employeeName] = [ {id, type, brand, model, serial, inv, location, note, added} ]
  const devices = {
    _d: () => { if (!_data().devices) _data().devices = {}; return _data().devices; },
    forEmployee(name)  { return devices._d()[name] || []; },
    set(name, list)    { devices._d()[name] = list; _save(); },
    add(name, device)  {
      const list = devices.forEmployee(name);
      list.push({ ...device, id: Date.now(), added: new Date().toLocaleDateString('ru-RU') });
      devices.set(name, list);
    },
    update(name, id, fields) {
      const list = devices.forEmployee(name).map(d => d.id === id ? { ...d, ...fields } : d);
      devices.set(name, list);
    },
    remove(name, id)   { devices.set(name, devices.forEmployee(name).filter(d => d.id !== id)); },
    // Все устройства всех сотрудников (для инвентаризации)
    all() {
      const result = [];
      const d = devices._d();
      for (const name in d) {
        (d[name] || []).forEach(dev => result.push({ ...dev, owner: name }));
      }
      return result;
    },
  };

  // ── Legacy helpers ────────────────────────────────────────────────────────────
  function get(key, def = null) {
    try { const v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); }
    catch { return def; }
  }
  function set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  return { init, isConfigured, onSync, pull: _pull, tickets, cart, replacements, overrides, devices, get, set };
})();

window.Storage = Storage;
