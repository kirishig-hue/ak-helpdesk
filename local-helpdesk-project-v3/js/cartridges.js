/**
 * cartridges.js — замена картриджей, учёт склада, журнал замен
 */

const Cartridges = (() => {
  // ── Render replacement cards (ticket form) ────────────────────────────────────
  function renderReplaceCards(containerId, printers, personName) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.style = '';

    const card = document.createElement('div');
    card.style.cssText = 'border:1.5px solid var(--bd);border-radius:var(--r);overflow:hidden';

    printers.forEach(pr => {
      const isLabel = ['Zebra','SATO','Honeywell','CST','Mertech'].includes(pr.brand);
      const lbl = isLabel ? 'Риббон/лента' : 'Картридж';

      const item = document.createElement('div');
      item.className = 'crc-item';
      item.dataset.pid = pr.id;

      function renderItem() {
        const cnt = Storage.cart.get(pr.id);
        const todayCnt = Storage.replacements.today(pr.id);
        const cntCls = cnt === null ? '' : cnt === 0 ? 'zero' : cnt <= 2 ? 'low' : 'ok';
        const cntTxt = cnt === null ? '?' : String(cnt);

        item.innerHTML = `
          <div class="crc-top" data-pid="${pr.id}">
            <div class="device-radio" id="crcr_${pr.id}"></div>
            <div style="font-size:20px;width:26px;text-align:center;flex-shrink:0">${UI.brandIcon(pr.brand)}</div>
            <div class="pi-info">
              <div class="pi-name">${UI.esc(pr.brand)} ${UI.esc(pr.model)}</div>
              <div class="pi-sub">${UI.esc(pr.location || '')}${pr.cabinet ? ' · каб.' + UI.esc(pr.cabinet) : ''}</div>
              <div class="pi-cart">${UI.esc(lbl)}: ${UI.esc(pr.cartridge || '—')}</div>
            </div>
          </div>
          <div class="crc-stock-row">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="cart-label">На складе:</span>
              <span class="crc-stock-val ${cntCls}">${cntTxt}</span>
              <span class="cart-label">шт.</span>
            </div>
            ${cnt === 0
              ? '<span style="padding:8px 12px;background:var(--rdb);color:var(--rd);border-radius:9px;font-size:12px;font-weight:600">⚠ Нет на складе</span>'
              : `<button class="crc-replace-btn" id="crb_${pr.id}">✅ Заменить</button>`
            }
          </div>
          ${todayCnt > 0 ? `<div class="crc-replaced">Сегодня заменено: ${todayCnt} шт.</div>` : ''}`;

        // Wire select
        item.querySelector('.crc-top').addEventListener('click', () => {
          card.querySelectorAll('.crc-item').forEach(i => i.classList.remove('selected'));
          card.querySelectorAll('.device-radio').forEach(r => r.classList.remove('on'));
          item.classList.add('selected');
          item.querySelector('.device-radio').classList.add('on');
          window._crcSelectedDevice = `${pr.brand} ${pr.model}${pr.location ? ' (' + pr.location + ')' : ''}`;
        });

        // Wire replace button
        const btn = item.querySelector('#crb_' + pr.id);
        if (btn) {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            const cur = Storage.cart.get(pr.id);
            if (cur !== null && cur <= 0) return;

            // Deduct from stock
            Storage.cart.adjust(pr.id, -1);

            // Log replacement
            Storage.replacements.add({
              ts:          Date.now(),
              created:     App.nowStr(),
              printerId:   pr.id,
              printerName: `${pr.brand} ${pr.model}`,
              location:    pr.location || '',
              cabinet:     pr.cabinet  || '',
              cartridge:   pr.cartridge || '',
              owner:       pr.owner    || '',
              person:      personName  || '',
              qty:         1,
            });

            // Select this printer
            card.querySelectorAll('.crc-item').forEach(i => i.classList.remove('selected'));
            card.querySelectorAll('.device-radio').forEach(r => r.classList.remove('on'));
            item.classList.add('selected');
            item.querySelector('.device-radio').classList.add('on');
            window._crcSelectedDevice = `${pr.brand} ${pr.model}${pr.location ? ' (' + pr.location + ')' : ''}`;

            // Flash confirmation
            btn.textContent = '✅ Списано!';
            btn.style.background = 'var(--gn)';
            btn.disabled = true;
            setTimeout(renderItem, 1200);
          });
        }
      }

      renderItem();
      card.appendChild(item);
    });

    wrap.innerHTML = '';
    wrap.appendChild(card);
  }

  function getSelectedDevice() {
    return window._crcSelectedDevice || null;
  }
  function resetSelected() {
    window._crcSelectedDevice = null;
  }

  // ── Render stock table (helpdesk cart tab) ────────────────────────────────────
  function renderStockTable({ tbodyId, searchQ = '', filter = 'all' }) {
    const q = searchQ.toLowerCase();
    const rows = App.state.printers.filter(pr => {
      const cnt = Storage.cart.get(pr.id);
      if (filter === 'low'  && !(cnt !== null && cnt > 0 && cnt <= 2)) return false;
      if (filter === 'zero' && cnt !== 0)   return false;
      if (filter === 'unk'  && cnt !== null) return false;
      if (q) return ['model','location','owner','cartridge'].some(k => (pr[k] || '').toLowerCase().includes(q));
      return true;
    });

    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--t3);padding:24px">Ничего не найдено</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(pr => {
      const cnt = Storage.cart.get(pr.id);
      const tod = Storage.replacements.today(pr.id);
      const tot = Storage.replacements.total(pr.id);
      return `<tr>
        <td><div class="td-name">${UI.esc(pr.brand)} ${UI.esc(pr.model)}</div><div class="td-sub">${UI.esc(pr.type || '')}</div></td>
        <td style="font-size:12px;color:var(--t2)">${UI.esc(pr.location || '')}${pr.cabinet ? '<br>каб.' + UI.esc(pr.cabinet) : ''}</td>
        <td style="font-size:12px;color:var(--t2)">${UI.esc(pr.owner || '—')}</td>
        <td style="font-size:11px;color:var(--accent)">${UI.esc(pr.cartridge || '—')}</td>
        <td style="text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:5px">
            <button class="adj-btn" data-pid="${pr.id}" data-d="-1">−</button>
            <span id="hcc_${pr.id}">${UI.stockHTML(cnt)}</span>
            <button class="adj-btn" data-pid="${pr.id}" data-d="1">+</button>
          </div>
        </td>
        <td style="text-align:center;font-weight:600;color:${tod ? 'var(--accent)' : 'var(--t3)'}">${tod || '—'}</td>
        <td style="text-align:center;color:var(--t2)">${tot || '—'}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.adj-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = +btn.dataset.pid;
        Storage.cart.adjust(pid, +btn.dataset.d);
        const el = document.getElementById('hcc_' + pid);
        if (el) el.innerHTML = UI.stockHTML(Storage.cart.get(pid));
      });
    });
  }

  // ── Render replacements log ───────────────────────────────────────────────────
  function renderRepLog({ tbodyId, tableId, emptyId, limit = 100 }) {
    const reps = Storage.replacements.all();
    if (tableId) document.getElementById(tableId).style.display = reps.length ? 'table' : 'none';
    if (emptyId) document.getElementById(emptyId).style.display = reps.length ? 'none'  : 'block';
    if (!reps.length) return;
    document.getElementById(tbodyId).innerHTML = reps.slice(0, limit).map(r =>
      `<tr>
        <td style="font-size:12px;white-space:nowrap">${UI.esc(r.created || '')}</td>
        <td>${UI.esc(r.person || '—')}</td>
        <td style="font-size:12px">${UI.esc(r.printerName || '')}${r.location ? `<br><span class="text-muted" style="font-size:11px">${UI.esc(r.location)}</span>` : ''}</td>
        <td style="font-size:11px;color:var(--accent)">${UI.esc(r.cartridge || '—')}</td>
        <td style="text-align:center;font-weight:700">${r.qty || 1}</td>
      </tr>`
    ).join('');
  }

  // ── Render stats cards (cart tab) ─────────────────────────────────────────────
  function renderCartStats(containerId) {
    const printers = App.state.printers;
    const reps = Storage.replacements.all();
    const today = new Date().toLocaleDateString('ru-RU');
    const todaySum = reps.filter(r => (r.created || '').startsWith(today)).reduce((s, r) => s + (r.qty || 1), 0);
    const zeroCnt = printers.filter(p => Storage.cart.get(p.id) === 0).length;
    const lowCnt  = printers.filter(p => { const c = Storage.cart.get(p.id); return c !== null && c > 0 && c <= 2; }).length;

    document.getElementById(containerId).innerHTML =
      UI.statCard(printers.length, 'Принтеров') +
      UI.statCard(zeroCnt, 'Нет картриджа', 'var(--rd)') +
      UI.statCard(lowCnt, 'Критично ≤2', 'var(--am)') +
      UI.statCard(todaySum, 'Замен сегодня', 'var(--gn)');
  }

  // ── CSV export (stock) ────────────────────────────────────────────────────────
  function exportStockCsv() {
    const headers = ['#','Бренд','Модель','Расположение','Кабинет','Владелец','Картридж','На складе','Сегодня','Всего'];
    const rows = App.state.printers.map(pr => {
      const cnt = Storage.cart.get(pr.id);
      return [pr.id, pr.brand, pr.model, pr.location, pr.cabinet, pr.owner, pr.cartridge,
              cnt === null ? 'н/д' : cnt, Storage.replacements.today(pr.id), Storage.replacements.total(pr.id)];
    });
    UI.downloadCsv(rows, headers, 'cartridges_' + new Date().toISOString().slice(0,10) + '.csv');
  }

  return { renderReplaceCards, getSelectedDevice, resetSelected, renderStockTable, renderRepLog, renderCartStats, exportStockCsv };
})();

window.Cartridges = Cartridges;
