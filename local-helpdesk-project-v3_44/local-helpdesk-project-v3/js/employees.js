/**
 * employees.js — поиск сотрудников, карточка профиля, редактирование данных
 */

const Employees = (() => {
  // ── Search ───────────────────────────────────────────────────────────────────
  function search(query, employees) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [];
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.login  || '').toLowerCase().includes(q) ||
      (e.dept   || '').toLowerCase().includes(q) ||
      (e.email  || '').toLowerCase().includes(q)
    ).slice(0, 14);
  }

  // ── Profile card HTML ─────────────────────────────────────────────────────────
  function profileCardHTML(emp) {
    const color = UI.avatarColor(emp.name);
    const ini   = UI.initials(emp.name);
    const ov    = Storage.overrides.get(emp.name);
    const hasOv = Object.keys(ov).length > 0;

    function infoItem(label, val, mono = false) {
      const empty = !val;
      return `<div class="info-item">
        <div class="info-label">${UI.esc(label)}</div>
        <div class="info-val${mono ? ' mono' : ''}${empty ? ' empty' : ''}">${empty ? '—' : UI.esc(val)}</div>
      </div>`;
    }

    return `
      <div class="profile-head">
        <div class="avatar" style="width:52px;height:52px;font-size:18px;background:${color}">${ini}</div>
        <div>
          <div class="profile-name">${UI.esc(emp.name)}${hasOv ? '<span class="badge-edited" title="Данные изменены"></span>' : ''}</div>
          ${emp.position ? `<div class="profile-position">${UI.esc(emp.position)}</div>` : ''}
          <div class="profile-dept">${UI.esc(emp.dept || '—')}</div>
        </div>
      </div>
      <div class="profile-divider"></div>
      <div class="info-grid">
        ${infoItem('Компьютер', emp.computer, true)}
        ${infoItem('Логин',     emp.login,    true)}
        ${infoItem('Мобильный', emp.mobile)}
        ${infoItem('Доб. номер', emp.ext)}

        ${infoItem('E-Mail',    emp.email)}
      </div>`;
  }

  // ── Modal: view employee ──────────────────────────────────────────────────────
  function openViewModal(empOrig) {
    const emp = App.mergeOverride(empOrig);
    const ov  = Storage.overrides.get(empOrig.name);
    const color = UI.avatarColor(emp.name);
    const ini   = UI.initials(emp.name);

    function row(icon, label, val, href) {
      if (!val) return '';
      const changed = ov[label.toLowerCase().replace(/\s/g, '_')] !== undefined;
      const dot = changed ? '<span class="badge-edited"></span>' : '';
      const link = href ? `<a href="${UI.esc(href)}">${UI.esc(val)}</a>` : UI.esc(val);
      return `<div class="modal-row">
        <span class="modal-label">${UI.esc(label)}${dot}</span>
        <span class="modal-val">${link}</span>
      </div>`;
    }

    const html = `
      <div class="modal-head">
        <div style="display:flex;align-items:flex-start;gap:12px;min-width:0">
          <div class="avatar" style="width:44px;height:44px;font-size:15px;background:${color};flex-shrink:0">${ini}</div>
          <div style="min-width:0">
            <div class="modal-title">${UI.esc(emp.name)}</div>
            ${emp.position ? `<div style="font-size:12px;color:var(--accent);font-weight:500">${UI.esc(emp.position)}</div>` : ''}
            <div class="modal-sub">${UI.esc(emp.dept || '—')}</div>
          </div>
        </div>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-section-title">Контакты</div>
        ${row('📱','Мобильный', emp.mobile, emp.mobile ? 'tel:' + emp.mobile.replace(/[^\d+]/g,'') : '')}
        ${row('☎️','Рабочий',   emp.work_phone, emp.work_phone ? 'tel:' + emp.work_phone.replace(/[^\d+]/g,'') : '')}
        ${emp.ext ? `<div class="modal-row"><span class="modal-label">Добавочный</span><span class="modal-val"><b>${UI.esc(emp.ext)}</b></span></div>` : ''}
        ${row('✉️','E-Mail', emp.email, emp.email ? 'mailto:' + emp.email : '')}
        <div class="modal-section-title" style="margin-top:12px">Дополнительно</div>
        ${emp.birthday ? `<div class="modal-row"><span class="modal-label">День рождения</span><span class="modal-val">🎂 ${UI.esc(emp.birthday)}</span></div>` : ''}
        ${emp.login ? `<div class="modal-row"><span class="modal-label">Логин</span><span class="modal-val mono">${UI.esc(emp.login)}</span></div>` : ''}
        ${emp.computer ? `<div class="modal-row"><span class="modal-label">Компьютер</span><span class="modal-val mono">${UI.esc(emp.computer)}</span></div>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" id="empEditBtn" style="flex:1">✏️ Редактировать</button>
        <button class="btn btn-ghost" style="background:var(--accent);color:#fff;flex:1" id="empVcfBtn">📥 VCF</button>
      </div>`;

    UI.modal.open(html);
    document.getElementById('empEditBtn').addEventListener('click', () => openEditModal(empOrig));
    document.getElementById('empVcfBtn').addEventListener('click',  () => exportVcf([App.mergeOverride(empOrig)]));
  }

  // ── Modal: edit employee ──────────────────────────────────────────────────────
  function openEditModal(empOrig) {
    const cur = App.mergeOverride(empOrig);
    const ov  = Storage.overrides.get(empOrig.name);

    const html = `
      <div class="modal-head">
        <div><div class="modal-title">Редактирование</div><div class="modal-sub">${UI.esc(empOrig.name)}</div></div>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        ${editField('Имя',            'ef_name',       cur.name)}
        ${editField('Мобильный',      'ef_mobile',     cur.mobile)}
        ${editField('Рабочий тел.',   'ef_work_phone', cur.work_phone)}
        ${editField('Добавочный',     'ef_ext',        cur.ext)}
        ${editField('Логин',          'ef_login',      cur.login, true)}
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="efSave" style="flex:1">✅ Сохранить</button>
        ${Object.keys(ov).length ? '<button class="btn btn-danger" id="efReset">Сбросить</button>' : ''}
        <button class="btn btn-secondary" id="efCancel">Отмена</button>
      </div>`;

    UI.modal.open(html);

    document.getElementById('efSave').addEventListener('click', () => {
      const fields = {};
      ['name','mobile','work_phone','ext','login'].forEach(f => {
        fields[f] = (document.getElementById('ef_' + f)?.value || '').trim();
      });
      Storage.overrides.set(empOrig.name, fields);
      UI.toast('Данные сохранены');
      UI.modal.close();
      if (typeof onEmployeeUpdated === 'function') onEmployeeUpdated();
    });

    document.getElementById('efCancel')?.addEventListener('click', () => openViewModal(empOrig));
    document.getElementById('efReset')?.addEventListener('click', () => {
      Storage.overrides.clear(empOrig.name);
      UI.toast('Данные сброшены');
      UI.modal.close();
      if (typeof onEmployeeUpdated === 'function') onEmployeeUpdated();
    });
  }

  function editField(label, id, val, mono = false) {
    return `<div class="form-group">
      <label class="form-label" for="${id}">${UI.esc(label)}</label>
      <input class="form-input${mono ? ' mono' : ''}" id="${id}" value="${UI.esc(val || '')}">
    </div>`;
  }

  // ── VCF export ────────────────────────────────────────────────────────────────
  function makeVcard(p) {
    const parts = p.name.trim().split(/\s+/);
    const last  = parts[0] || '';
    const first = parts.slice(1).join(' ') || '';

    function qp(str) {
      if (!str) return '';
      const utf8 = unescape(encodeURIComponent(str));
      let out = '';
      for (let i = 0; i < utf8.length; i++) {
        const c = utf8.charCodeAt(i);
        out += c > 127 || c === 61 ? '=' + c.toString(16).toUpperCase().padStart(2,'0') : utf8[i];
      }
      return out;
    }
    function hasNonAscii(s) { return /[^\x00-\x7F]/.test(s || ''); }
    function tf(tag, val) {
      if (!val) return null;
      return hasNonAscii(val)
        ? `${tag};CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${qp(val)}`
        : `${tag}:${val}`;
    }

    const nVal = `${last};${first};;;`;
    const lines = ['BEGIN:VCARD','VERSION:2.1'];
    lines.push(hasNonAscii(nVal) ? `N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${qp(nVal)}` : `N:${nVal}`);
    const fnLine = tf('FN', p.name); if (fnLine) lines.push(fnLine);
    if (p.position) { const t = tf('TITLE', p.position); if (t) lines.push(t); }
    const orgVal = `АК-Сервис${p.dept ? ';' + p.dept : ''}`;
    lines.push(`ORG;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${qp(orgVal)}`);
    if (p.mobile)     lines.push(`TEL;TYPE=CELL:${p.mobile.replace(/[^\d+]/g,'')}`);
    if (p.work_phone) lines.push(`TEL;TYPE=WORK:${p.work_phone.replace(/[^\d+]/g,'')}`);
    if (p.ext)        lines.push(`TEL;TYPE=WORK,x-extension:${p.ext}`);
    if (p.email)      lines.push(`EMAIL;INTERNET:${p.email}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  function exportVcf(people, filename) {
    const content = people.map(makeVcard).join('\r\n');
    UI.download(
      new Uint8Array([0xEF,0xBB,0xBF]).reduce((s,b)=>s+String.fromCharCode(b),'') + content,
      'text/vcard;charset=utf-8',
      filename || (people.length === 1 ? people[0].name.replace(/\s+/g,'_') + '.vcf' : 'ak_service.vcf')
    );
  }

  return { search, profileCardHTML, openViewModal, openEditModal, exportVcf };
})();

window.Employees = Employees;
