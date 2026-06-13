/**
 * ui.js — общие UI-утилиты: экранирование, badges, модал, скачивание, toast
 */

const UI = (() => {

  // ── Escape HTML ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Avatars ──────────────────────────────────────────────────────────────────
  const COLORS = ['#1A56A0','#2563EB','#7C3AED','#DB2777','#DC2626','#D97706','#059669','#0891B2','#4338CA','#9333EA'];
  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return COLORS[Math.abs(h) % COLORS.length];
  }
  function initials(name) {
    const p = (name || '').trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (name || '??').slice(0, 2).toUpperCase();
  }
  function avatarEl(name, size = 40, fontSize = 14) {
    const div = document.createElement('div');
    div.className = 'avatar';
    div.style.cssText = `width:${size}px;height:${size}px;font-size:${fontSize}px;background:${avatarColor(name)}`;
    div.textContent = initials(name);
    return div;
  }

  // ── Badges ───────────────────────────────────────────────────────────────────
  const statusMap = {
    'Новая':    { cls: 'badge-new',    em: '🔵' },
    'В работе': { cls: 'badge-inwork', em: '🟡' },
    'Решено':   { cls: 'badge-done',   em: '✅' },
    'Закрыта':  { cls: 'badge-closed', em: '⬜' },
  };
  const prioMap = {
    'Высокий': { cls: 'badge-phigh', em: '🔴' },
    'Средний':  { cls: 'badge-pmid',  em: '🟡' },
    'Низкий':   { cls: 'badge-plow',  em: '🟢' },
  };

  function statusBadge(s) {
    const d = statusMap[s] || statusMap['Новая'];
    return `<span class="badge ${d.cls}">${d.em} ${esc(s || 'Новая')}</span>`;
  }
  function prioBadge(p) {
    const d = prioMap[p] || prioMap['Средний'];
    return `<span class="badge ${d.cls}">${d.em} ${esc(p || 'Средний')}</span>`;
  }
  function stockHTML(n) {
    if (n === null) return '<span class="text-muted" style="font-weight:600">?</span>';
    const c = n === 0 ? 'zero' : n <= 2 ? 'low' : '';
    return `<span class="cart-count${c ? ' ' + c : ''}" style="font-size:16px">${n}</span>`;
  }

  // ── Stat card ─────────────────────────────────────────────────────────────────
  function statCard(val, label, color = '') {
    return `<div class="stat-card"><div class="stat-val"${color ? ` style="color:${color}"` : ''}>${val}</div><div class="stat-label">${esc(label)}</div></div>`;
  }

  // ── Modal ─────────────────────────────────────────────────────────────────────
  const modal = {
    _overlay: null,
    _modal: null,

    init() {
      this._overlay = document.getElementById('overlay');
      this._modal   = document.getElementById('modal');
      if (this._overlay) {
        this._overlay.addEventListener('click', e => {
          if (e.target === this._overlay) this.close();
        });
      }
      document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    },

    open(html) {
      if (!this._modal || !this._overlay) return;
      this._modal.innerHTML = html;
      this._overlay.style.display = 'flex';
      // wire close button
      const btn = this._modal.querySelector('.modal-close');
      if (btn) btn.addEventListener('click', () => this.close());
    },

    close() {
      if (this._overlay) this._overlay.style.display = 'none';
    },

    get el() { return this._modal; },
  };

  // ── Bottom sheet (mobile) ─────────────────────────────────────────────────────
  const sheet = {
    _overlay: null,
    _sheet: null,
    init() {
      this._overlay = document.getElementById('sheetOverlay');
      this._sheet   = document.getElementById('sheet');
      if (this._overlay) {
        this._overlay.addEventListener('click', e => {
          if (e.target === this._overlay) this.close();
        });
      }
    },
    open(html) {
      if (!this._sheet || !this._overlay) return;
      this._sheet.innerHTML = '<div class="handle"></div>' + html;
      this._overlay.style.display = 'flex';
    },
    close() {
      if (this._overlay) this._overlay.style.display = 'none';
    },
  };

  // ── Modal row helpers ─────────────────────────────────────────────────────────
  function modalRow(label, val, html = false) {
    if (!val && val !== 0) return '';
    const v = html ? val : esc(val);
    return `<div class="modal-row"><span class="modal-label">${esc(label)}</span><span class="modal-val">${v}</span></div>`;
  }

  // ── Download helper ───────────────────────────────────────────────────────────
  function download(content, type, filename) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadCsv(rows, headers, filename) {
    const bom = '\uFEFF';
    const body = [headers, ...rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';'))].join('\n');
    download(bom + body, 'text/csv;charset=utf-8', filename);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  function toast(msg, type = 'success', duration = 2500) {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed','bottom:20px','right:20px','z-index:9999',
      'padding:10px 18px','border-radius:10px','font-size:13px','font-weight:600',
      'box-shadow:0 4px 16px rgba(0,0,0,.15)','transition:opacity .3s',
      type === 'error' ? 'background:#FEF2F2;color:#DC2626' : 'background:#DCFCE7;color:#166534',
    ].join(';');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
  }

  // ── Sort helper ───────────────────────────────────────────────────────────────
  function wireSortHeaders(tableId, onSort) {
    let sortC = 'ts', sortD = -1;
    document.querySelectorAll(`#${tableId} th[data-c]`).forEach(th => {
      th.addEventListener('click', () => {
        const c = th.dataset.c;
        sortD = c === sortC ? -sortD : -1;
        sortC = c;
        document.querySelectorAll(`#${tableId} th`).forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(sortD === 1 ? 'sort-asc' : 'sort-desc');
        onSort(sortC, sortD);
      });
    });
  }

  // ── Filter pills / buttons ────────────────────────────────────────────────────
  function wireFilterGroup(groupId, onChange) {
    document.querySelectorAll(`#${groupId} [data-s]`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${groupId} [data-s]`).forEach(b => b.classList.remove('active', 'on'));
        btn.classList.add('active', 'on');
        onChange(btn.dataset.s);
      });
    });
  }

  // ── Brand icon ───────────────────────────────────────────────────────────────
  function brandIcon(brand) {
    const b = (brand || '').toLowerCase();
    if (['zebra','sato','honeywell','cst','mertech'].includes(b)) return '🏷️';
    if (b === 'canon') return '📠';
    return '🖨️';
  }

  return {
    esc, avatarColor, initials, avatarEl,
    statusBadge, prioBadge, stockHTML, statCard,
    modal, sheet, modalRow,
    download, downloadCsv, toast,
    wireSortHeaders, wireFilterGroup, brandIcon,
  };
})();

window.UI = UI;
