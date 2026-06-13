/**
 * devices.js — управление техникой пользователя
 * Позволяет добавлять/редактировать/удалять устройства в личном кабинете.
 * Данные хранятся в Storage.devices и синхронизируются через JSONBin.
 */

const Devices = (() => {

  // ── Типы устройств ────────────────────────────────────────────────────────────
  const TYPES = [
    { id: 'pc',       icon: '🖥️',  label: 'Компьютер / ПК' },
    { id: 'laptop',   icon: '💻',  label: 'Ноутбук' },
    { id: 'monitor',  icon: '🖥',  label: 'Монитор' },
    { id: 'printer',  icon: '🖨️',  label: 'Принтер / МФУ' },
    { id: 'label',    icon: '🏷️',  label: 'Принтер этикеток' },
    { id: 'phone',    icon: '☎️',  label: 'IP-телефон' },
    { id: 'scanner',  icon: '📠',  label: 'Сканер / ТСД' },
    { id: 'ups',      icon: '🔋',  label: 'ИБП' },
    { id: 'other',    icon: '🔧',  label: 'Другое' },
  ];

  function typeByID(id) { return TYPES.find(t => t.id === id) || TYPES[TYPES.length - 1]; }

  // ── Render section in profile page ───────────────────────────────────────────
  function renderSection(containerId, employeeName) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;

    const list = Storage.devices.forEmployee(employeeName);

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:16px;font-weight:700">Моя техника
          <span style="font-size:13px;color:var(--t3);font-weight:400;margin-left:6px">(${list.length})</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="addDeviceBtn">+ Добавить</button>
      </div>
      ${list.length === 0
        ? `<div style="background:var(--bg);border-radius:var(--r);padding:16px;text-align:center;color:var(--t3);font-size:13px;margin-bottom:14px">
             Техника ещё не добавлена
           </div>`
        : `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
             ${list.map(d => deviceCardHTML(d, employeeName)).join('')}
           </div>`
      }`;

    document.getElementById('addDeviceBtn').addEventListener('click', () => {
      openEditModal(null, employeeName, () => renderSection(containerId, employeeName));
    });

    wrap.querySelectorAll('[data-dev-edit]').forEach(btn => {
      const id = +btn.dataset.devEdit;
      btn.addEventListener('click', () => {
        const dev = list.find(d => d.id === id);
        if (dev) openEditModal(dev, employeeName, () => renderSection(containerId, employeeName));
      });
    });

    wrap.querySelectorAll('[data-dev-del]').forEach(btn => {
      const id = +btn.dataset.devDel;
      btn.addEventListener('click', () => {
        if (!confirm('Удалить устройство?')) return;
        Storage.devices.remove(employeeName, id);
        renderSection(containerId, employeeName);
        UI.toast('Устройство удалено');
      });
    });
  }

  function deviceCardHTML(d, employeeName) {
    const t = typeByID(d.type);
    return `
      <div style="background:#fff;border:1.5px solid var(--bd);border-radius:var(--r);padding:12px 14px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="font-size:22px;flex-shrink:0;width:28px;text-align:center">${t.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--tx)">${UI.esc(d.brand || '')} ${UI.esc(d.model || '')}</div>
            <div style="font-size:11px;color:var(--accent);margin-top:1px">${t.label}</div>
            ${d.serial ? `<div style="font-size:11px;color:var(--t3);margin-top:2px">S/N: <span class="mono">${UI.esc(d.serial)}</span></div>` : ''}
            ${d.inv    ? `<div style="font-size:11px;color:var(--t3)">Инв. №: <span class="mono">${UI.esc(d.inv)}</span></div>` : ''}
            ${d.location ? `<div style="font-size:11px;color:var(--t3)">📍 ${UI.esc(d.location)}</div>` : ''}
            ${d.note   ? `<div style="font-size:11px;color:var(--t2);margin-top:3px;line-height:1.4">${UI.esc(d.note)}</div>` : ''}
            <div style="font-size:10px;color:var(--t3);margin-top:4px">Добавлено: ${UI.esc(d.added || '')}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm" data-dev-edit="${d.id}" style="padding:4px 10px">✏️</button>
            <button class="btn btn-sm" data-dev-del="${d.id}" style="padding:4px 10px;background:var(--rdb);color:var(--rd);border:1px solid #FECACA">🗑</button>
          </div>
        </div>
      </div>`;
  }

  // ── Edit modal ────────────────────────────────────────────────────────────────
  function openEditModal(device, employeeName, onSave) {
    const isNew = !device;
    const d = device || {};

    const typeOptions = TYPES.map(t =>
      `<option value="${t.id}" ${d.type === t.id ? 'selected' : ''}>${t.icon} ${t.label}</option>`
    ).join('');

    const html = `
      <div class="modal-head">
        <div>
          <div class="modal-title">${isNew ? '+ Добавить устройство' : 'Редактировать устройство'}</div>
          <div class="modal-sub">${UI.esc(employeeName)}</div>
        </div>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Тип устройства</label>
          <select class="form-input" id="df_type">${typeOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Производитель</label>
          <input class="form-input" id="df_brand" value="${UI.esc(d.brand || '')}" placeholder="HP, Canon, Dell…">
        </div>
        <div class="form-group">
          <label class="form-label">Модель</label>
          <input class="form-input" id="df_model" value="${UI.esc(d.model || '')}" placeholder="LaserJet Pro M426fdw…">
        </div>
        <div class="form-group">
          <label class="form-label">Серийный номер</label>
          <input class="form-input mono" id="df_serial" value="${UI.esc(d.serial || '')}" placeholder="SN123456789">
        </div>
        <div class="form-group">
          <label class="form-label">Инвентарный номер</label>
          <input class="form-input mono" id="df_inv" value="${UI.esc(d.inv || '')}" placeholder="ОС-00001">
        </div>
        <div class="form-group">
          <label class="form-label">Расположение / кабинет</label>
          <input class="form-input" id="df_location" value="${UI.esc(d.location || '')}" placeholder="Офис 305, стол у окна">
        </div>
        <div class="form-group" style="border:none">
          <label class="form-label">Примечание</label>
          <textarea class="form-input" id="df_note" rows="2" placeholder="Дополнительная информация…">${UI.esc(d.note || '')}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="dfSave" style="flex:1">
          ${isNew ? '✅ Добавить' : '✅ Сохранить'}
        </button>
        <button class="btn btn-secondary" id="dfCancel">Отмена</button>
      </div>`;

    UI.modal.open(html);

    document.getElementById('dfCancel').addEventListener('click', () => UI.modal.close());
    document.getElementById('dfSave').addEventListener('click', () => {
      const fields = {
        type:     document.getElementById('df_type').value,
        brand:    document.getElementById('df_brand').value.trim(),
        model:    document.getElementById('df_model').value.trim(),
        serial:   document.getElementById('df_serial').value.trim(),
        inv:      document.getElementById('df_inv').value.trim(),
        location: document.getElementById('df_location').value.trim(),
        note:     document.getElementById('df_note').value.trim(),
      };
      if (!fields.model) {
        document.getElementById('df_model').style.borderColor = 'var(--rd)';
        document.getElementById('df_model').focus();
        return;
      }
      if (isNew) {
        Storage.devices.add(employeeName, fields);
        UI.toast('Устройство добавлено');
      } else {
        Storage.devices.update(employeeName, device.id, fields);
        UI.toast('Данные сохранены');
      }
      UI.modal.close();
      if (onSave) onSave();
    });
  }

  // ── Export all devices (для инвентаризации) ────────────────────────────────
  function exportCsv() {
    const headers = ['Сотрудник','Тип','Производитель','Модель','Серийный №','Инв. №','Расположение','Примечание','Добавлено'];
    const rows = Storage.devices.all().map(d => {
      const t = typeByID(d.type);
      return [d.owner, t.label, d.brand, d.model, d.serial, d.inv, d.location, d.note, d.added];
    });
    UI.downloadCsv(rows, headers, 'inventory_' + new Date().toISOString().slice(0,10) + '.csv');
  }

  return { TYPES, renderSection, openEditModal, exportCsv };
})();

window.Devices = Devices;
