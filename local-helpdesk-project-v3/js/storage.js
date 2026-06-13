/**
 * storage.js — все операции с localStorage
 * Ключи: hd_tickets, hd_cartstock, hd_replacements, hd_overrides, hd_stock_seeded
 */

const Storage = (() => {
  function get(key, def = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? def : JSON.parse(v);
    } catch { return def; }
  }
  function set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  // ── Tickets ─────────────────────────────────────────────────────────────────
  const tickets = {
    all:    ()      => get('hd_tickets', []),
    save:   (arr)   => set('hd_tickets', arr),
    find:   (id)    => tickets.all().find(t => t.id === id) || null,
    add(ticket) {
      const arr = tickets.all();
      arr.unshift(ticket);
      tickets.save(arr);
    },
    update(id, fields) {
      const arr = tickets.all();
      const i = arr.findIndex(t => t.id === id);
      if (i >= 0) { arr[i] = { ...arr[i], ...fields }; tickets.save(arr); }
    },
    remove(id) {
      tickets.save(tickets.all().filter(t => t.id !== id));
    },
  };

  // ── Cart stock ───────────────────────────────────────────────────────────────
  const cart = {
    all:          ()          => get('hd_cartstock', {}),
    save:         (s)         => set('hd_cartstock', s),
    get(pid) {
      const v = cart.all()[String(pid)];
      return v !== undefined ? Number(v) : null;
    },
    set(pid, n) {
      const s = cart.all();
      s[String(pid)] = Math.max(0, n);
      cart.save(s);
    },
    adjust(pid, delta) {
      cart.set(pid, (cart.get(pid) || 0) + delta);
    },
    seedOnce(seedData) {
      if (get('hd_stock_seeded', false)) return;
      const s = cart.all();
      for (const k in seedData) {
        if (s[k] === undefined) s[k] = seedData[k];
      }
      cart.save(s);
      set('hd_stock_seeded', true);
    },
  };

  // ── Replacements log ─────────────────────────────────────────────────────────
  const replacements = {
    all:  ()       => get('hd_replacements', []),
    save: (arr)    => set('hd_replacements', arr),
    add(entry) {
      const arr = replacements.all();
      arr.unshift(entry);
      replacements.save(arr);
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
  };

  // ── Employee overrides ───────────────────────────────────────────────────────
  const overrides = {
    all:          ()          => get('hd_overrides', {}),
    get(name)     { return overrides.all()[name] || {}; },
    set(name, fields) {
      const d = overrides.all();
      d[name] = { ...d[name], ...fields };
      set('hd_overrides', d);
    },
    clear(name)   { const d = overrides.all(); delete d[name]; set('hd_overrides', d); },
    hasAny(name)  { return Object.keys(overrides.get(name)).length > 0; },
  };

  return { get, set, remove, tickets, cart, replacements, overrides };
})();

// Make available globally
window.Storage = Storage;
