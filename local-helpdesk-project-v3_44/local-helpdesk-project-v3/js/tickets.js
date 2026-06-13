/**
 * tickets.js — создание, фильтрация, рендер заявок
 */

const Tickets = (() => {
  // ── State ────────────────────────────────────────────────────────────────────
  let _filterStatus = 'all';
  let _searchQ      = '';
  let _sortC        = 'ts';
  let _sortD        = -1;

  // ── Filter + sort ─────────────────────────────────────────────────────────────
  function filtered(tickets) {
    return tickets.filter(t => {
      if (_filterStatus !== 'all' && t.status !== _filterStatus) return false;
      if (!_searchQ) return true;
      const q = _searchQ.toLowerCase();
      return ['name','description','category','id','dept'].some(k => (t[k] || '').toLowerCase().includes(q));
    }).sort((a, b) => {
      const av = _sortC === 'ts' ? +a.ts : (a[_sortC] || '');
      const bv = _sortC === 'ts' ? +b.ts : (b[_sortC] || '');
      return av < bv ? -_sortD : av > bv ? _sortD : 0;
    });
  }

  // ── Create ticket ─────────────────────────────────────────────────────────────
  function create({ person, category, device, priority, description }) {
    const ticket = {
      id:          App.genId(),
      created:     App.nowStr(),
      ts:          Date.now(),
      name:        person.name,
      dept:        person.dept        || '',
      position:    person.position    || '',
      mobile:      person.mobile      || '',
      work_phone:  person.work_phone  || '',
      ext:         person.ext         || '',
      computer:    person.computer    || '',
      login:       person.login       || '',
      email:       person.email       || '',
      category,
      device:      device || '',
      priority,
      description,
      status:      'Новая',
    };
    Storage.tickets.add(ticket);
    return ticket;
  }

  // ── Render table (helpdesk) ───────────────────────────────────────────────────
  function renderTable({ tbodyId, emptyId, tableId, onRowClick }) {
    const rows = filtered(Storage.tickets.all());
    const tbody = document.getElementById(tbodyId);
    if (emptyId) document.getElementById(emptyId).style.display = rows.length ? 'none' : 'block';
    if (tableId) document.getElementById(tableId).style.display = rows.length ? 'table' : 'none';

    tbody.innerHTML = rows.map(t =>
      `<tr class="clickable" data-id="${UI.esc(t.id)}">
        <td class="mono text-muted">${UI.esc(t.id)}</td>
        <td style="white-space:nowrap;font-size:12px;color:var(--t2)">${UI.esc(t.created)}</td>
        <td><div class="td-name">${UI.esc(t.name)}</div><div class="td-sub">${UI.esc(t.dept || '')}${t.ext ? ' · доб.' + t.ext : ''}</div></td>
        <td>${UI.esc(t.category)}${t.device ? `<div class="td-sub">${UI.esc(t.device)}</div>` : ''}</td>
        <td>${UI.prioBadge(t.priority)}</td>
        <td class="td-truncate" title="${UI.esc(t.description)}">${UI.esc(t.description)}</td>
        <td>${UI.statusBadge(t.status)}</td>
      </tr>`
    ).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const t = Storage.tickets.find(tr.dataset.id);
        if (t && onRowClick) onRowClick(t);
      });
    });
    return rows;
  }

  // ── Render mini-list (user's tickets) ────────────────────────────────────────
  function renderUserList({ containerId, personName, filterStatus = 'all', searchQ = '', onDetail, onDuplicate }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let rows = Storage.tickets.all()
      .filter(t => t.name === personName)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));

    if (filterStatus !== 'all') rows = rows.filter(t => t.status === filterStatus);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      rows = rows.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category    || '').toLowerCase().includes(q) ||
        (t.id          || '').toLowerCase().includes(q)
      );
    }

    if (!rows.length) {
      container.innerHTML = '<div class="empty-state" style="padding:30px 20px"><p>Заявок нет</p></div>';
      return;
    }

    container.innerHTML = rows.map(t => `
      <div class="ticket-card" data-tid="${UI.esc(t.id)}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
          <span class="mono text-muted">${UI.esc(t.id)}</span>
          <span class="text-muted" style="font-size:11px">${UI.esc(t.created)}</span>
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:2px">${UI.esc(t.category)}${t.device ? ' · ' + UI.esc(t.device) : ''}</div>
        <div style="font-size:12px;color:var(--t2);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(t.description)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">${UI.statusBadge(t.status)}${UI.prioBadge(t.priority)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-secondary btn-sm" data-action="detail">🔍 Подробнее</button>
          <button class="btn btn-sm" style="background:#F0FDF4;color:var(--gn);border:1px solid #BBF7D0" data-action="dup">📋 Дублировать</button>
        </div>
      </div>`
    ).join('');

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const card = btn.closest('[data-tid]');
        const t = Storage.tickets.find(card.dataset.tid);
        if (!t) return;
        if (btn.dataset.action === 'detail'     && onDetail)    onDetail(t);
        if (btn.dataset.action === 'dup'        && onDuplicate) onDuplicate(t);
      });
    });
  }

  // ── Detail modal (helpdesk) ───────────────────────────────────────────────────
  function openDetailModal(t, onStatusChange, onDelete) {
    function row(l, v) { return UI.modalRow(l, v); }
    const statuses = [
      { s:'Новая',    cls:'sb-new',    em:'🔵' },
      { s:'В работе', cls:'sb-inwork', em:'🟡' },
      { s:'Решено',   cls:'sb-done',   em:'✅' },
      { s:'Закрыта',  cls:'sb-closed', em:'⬜' },
    ];

    const html = `
      <div class="modal-head">
        <div><div class="modal-title">${UI.esc(t.id)}</div><div class="modal-sub">${UI.esc(t.created)} · ${UI.esc(t.name)}</div></div>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-section-title">Сотрудник</div>
        ${row('Имя', t.name)}${row('Отдел', t.dept)}${row('Должность', t.position)}
        ${row('Мобильный', t.mobile)}${row('Рабочий', t.work_phone)}${row('Добавочный', t.ext)}
        ${row('Компьютер', t.computer)}${row('Логин', t.login)}${row('E-Mail', t.email)}
        <div class="modal-section-title" style="margin-top:12px">Заявка</div>
        ${row('Категория', t.category)}${row('Устройство', t.device)}
        <div class="modal-row"><span class="modal-label">Приоритет</span><span class="modal-val">${UI.prioBadge(t.priority)}</span></div>
        <div class="modal-row"><span class="modal-label">Статус</span><span class="modal-val">${UI.statusBadge(t.status)}</span></div>
        <div class="modal-row" style="flex-direction:column;gap:6px">
          <span class="modal-label">Описание</span>
          <div class="modal-desc">${UI.esc(t.description)}</div>
        </div>
      </div>
      <div class="modal-foot" style="flex-direction:column">
        <div class="status-btns">
          ${statuses.map(x => `<button class="status-btn ${x.cls}${t.status === x.s ? ' active' : ''}" data-s="${UI.esc(x.s)}">${x.em} ${UI.esc(x.s)}</button>`).join('')}
        </div>
        <button class="btn btn-danger w-full" id="tkDel">🗑 Удалить заявку</button>
      </div>`;

    UI.modal.open(html);

    UI.modal.el.querySelectorAll('.status-btn[data-s]').forEach(btn => {
      btn.addEventListener('click', () => {
        Storage.tickets.update(t.id, { status: btn.dataset.s });
        UI.modal.close();
        if (onStatusChange) onStatusChange();
      });
    });
    document.getElementById('tkDel').addEventListener('click', () => {
      if (!confirm(`Удалить заявку ${t.id}?`)) return;
      Storage.tickets.remove(t.id);
      UI.modal.close();
      if (onDelete) onDelete();
    });
  }

  // ── Update filter counts ──────────────────────────────────────────────────────
  function updateFilterCounts(groupId) {
    const all = Storage.tickets.all();
    document.querySelectorAll(`#${groupId} [data-s]`).forEach(btn => {
      const s = btn.dataset.s;
      const c = s === 'all' ? all.length : all.filter(t => t.status === s).length;
      const base = { all:'Все', 'Новая':'Новые', 'В работе':'В работе', 'Решено':'Решено', 'Закрыта':'Закрыты' };
      btn.textContent = (base[s] || s) + ` (${c})`;
    });
  }

  // ── CSV export ────────────────────────────────────────────────────────────────
  function exportCsv() {
    const fields  = ['id','created','name','dept','position','mobile','ext','computer','login','category','device','priority','description','status'];
    const headers = ['Номер','Дата','Сотрудник','Отдел','Должность','Мобильный','Добавочный','Компьютер','Логин','Категория','Устройство','Приоритет','Описание','Статус'];
    const rows = filtered(Storage.tickets.all()).map(t => fields.map(f => t[f] ?? ''));
    UI.downloadCsv(rows, headers, 'helpdesk_' + new Date().toISOString().slice(0,10) + '.csv');
  }

  // ── Public setters ────────────────────────────────────────────────────────────
  function setFilter(s)  { _filterStatus = s; }
  function setSearch(q)  { _searchQ = q; }
  function setSort(c, d) { _sortC = c; _sortD = d; }

  return { filtered, create, renderTable, renderUserList, openDetailModal, updateFilterCounts, exportCsv, setFilter, setSearch, setSort };
})();

window.Tickets = Tickets;
