/**
 * cartridges.js — замена картриджей, учёт склада по артикулу
 *
 * Склад хранится по артикулу (pr.cartridge), а не по ID принтера.
 * Замена у любого принтера с этим картриджем уменьшает общий остаток.
 */

const Cartridges = (() => {

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function getCount(pr) {
    return Storage.cart.getByArticle(pr.cartridge);
  }
  function stockCls(n) {
    if (n === null) return '';
    return n === 0 ? 'zero' : n <= 2 ? 'low' : '';
  }

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
        const cnt = getCount(pr);
        const todayCnt = Storage.replacements.today(pr.id);
        const cntCls = stockCls(cnt);
        const cntTxt = cnt === null ? '?' : String(cnt);

        item.innerHTML = `
          <div class="crc-top">
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
          window._crcSelectedDevice = `${pr.brand} ${pr.model}${pr.location ? ' (' + pr.location + (pr.cabinet ? ' каб.' + pr.cabinet : '') + ')' : ''}`;
        });

        // Wire replace button
        const btn = item.querySelector('#crb_' + pr.id);
        if (btn) {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            const cur = getCount(pr);
            if (cur !== null && cur <= 0) { renderItem(); return; }

            // ── Списываем 1 с общего остатка по артикулу ──
            Storage.cart.adjustByArticle(pr.cartridge, -1);

            // Log
            Storage.replacements.add({
              ts:          Date.now(),
              created:     App.nowStr(),
              printerId:   pr.id,
              printerName: `${pr.brand} ${pr.model}`,
              location:    pr.location  || '',
              cabinet:     pr.cabinet   || '',
              cartridge:   pr.cartridge || '',
              owner:       pr.owner     || '',
              person:      personName   || '',
              qty:         1,
            });

            // Select this printer
            card.querySelectorAll('.crc-item').forEach(i => i.classList.remove('selected'));
            card.querySelectorAll('.device-radio').forEach(r => r.classList.remove('on'));
            item.classList.add('selected');
            item.querySelector('.device-radio').classList.add('on');
            window._crcSelectedDevice = `${pr.brand} ${pr.model}${pr.location ? ' (' + pr.location + ')' : ''}`;

            // Flash and re-render ALL items with same cartridge (shared stock)
            btn.textContent = '✅ Списано!';
            btn.style.background = 'var(--gn)';
            btn.disabled = true;

            // Re-render all items in this card that share same cartridge article
            card.querySelectorAll('.crc-item').forEach(otherItem => {
              const otherId = +otherItem.dataset.pid;
              const otherPr = App.state.printers.find(p => p.id === otherId);
              if (otherPr && otherPr.cartridge === pr.cartridge && otherId !== pr.id) {
                // Refresh stock display for siblings immediately
                const cnt2 = getCount(otherPr);
                const valEl = otherItem.querySelector('.crc-stock-val');
                if (valEl) {
                  valEl.textContent = cnt2 === null ? '?' : String(cnt2);
                  valEl.className = 'crc-stock-val ' + stockCls(cnt2);
                }
              }
            });

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

  function getSelectedDevice() { return window._crcSelectedDevice || null; }
  function resetSelected()     { window._crcSelectedDevice = null; }

  // ── Stock table (helpdesk / inventory) ────────────────────────────────────────
  // Группировка по артикулу — одна строка на уникальный картридж
  function renderStockTable({ tbodyId, searchQ = '', filter = 'all' }) {
    const q = (searchQ || '').toLowerCase();

    // Build unique articles from printers
    const THERMAL_BRANDS = ['Zebra','Зебра','SATO','Honeywell','CST','Mertech','Мертех'];
    const articleMap = {};
    const thermalMap = {};
    App.state.printers.forEach(pr => {
      const art = (pr.cartridge || '').trim();
      if (!art || art === '—') return;
      const isThermal = THERMAL_BRANDS.includes(pr.brand);
      const map = isThermal ? thermalMap : articleMap;
      if (!map[art]) {
        map[art] = { article: art, printers: [], cnt: Storage.cart.getByArticle(art) };
      }
      map[art].printers.push(pr);
    });

    let rows = Object.values(articleMap).filter(row => {
      const cnt = row.cnt;
      if (filter === 'low'  && !(cnt !== null && cnt > 0 && cnt <= 2)) return false;
      if (filter === 'zero' && cnt !== 0)   return false;
      if (filter === 'unk'  && cnt !== null) return false;
      if (q) {
        return row.article.toLowerCase().includes(q) ||
          row.printers.some(p => (p.model||'').toLowerCase().includes(q) || (p.location||'').toLowerCase().includes(q) || (p.owner||'').toLowerCase().includes(q));
      }
      return true;
    });

    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:24px">Ничего не найдено</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const cnt   = row.cnt;
      const tod   = Storage.replacements.todayByArticle(row.article);
      const tot   = Storage.replacements.totalByArticle(row.article);
      const names = [...new Set(row.printers.map(p => `${p.brand} ${p.model}`))].join(', ');
      const owners = [...new Set(row.printers.map(p => p.owner).filter(Boolean))].join(', ');
      return `<tr>
        <td style="font-size:12px;color:var(--accent);font-weight:600">${UI.esc(row.article)}</td>
        <td style="font-size:12px;color:var(--t2)">${UI.esc(names)}<div class="td-sub">${row.printers.length} принт.</div></td>
        <td style="font-size:12px;color:var(--t2)">${UI.esc(owners || '—')}</td>
        <td style="text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:5px">
            <button class="adj-btn" data-art="${UI.esc(row.article)}" data-d="-1">−</button>
            <span id="hcc_${UI.esc(row.article)}">${UI.stockHTML(cnt)}</span>
            <button class="adj-btn" data-art="${UI.esc(row.article)}" data-d="1">+</button>
          </div>
        </td>
        <td style="text-align:center;font-weight:600;color:${tod ? 'var(--accent)' : 'var(--t3)'}">${tod || '—'}</td>
        <td style="text-align:center;color:var(--t2)">${tot || '—'}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.adj-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const art = btn.dataset.art;
        Storage.cart.adjustByArticle(art, +btn.dataset.d);
        const el = document.getElementById('hcc_' + art);
        if (el) el.innerHTML = UI.stockHTML(Storage.cart.getByArticle(art));
      });
    });

    // ── Термопринтеры — раскрывающийся блок ──────────────────────────────────
    const thermalRows = Object.values(thermalMap).filter(row => {
      const cnt = row.cnt;
      if (filter === 'low'  && !(cnt !== null && cnt > 0 && cnt <= 2)) return false;
      if (filter === 'zero' && cnt !== 0)   return false;
      if (filter === 'unk'  && cnt !== null) return false;
      if (q) return row.article.toLowerCase().includes(q) ||
        row.printers.some(p => (p.model||'').toLowerCase().includes(q) || (p.owner||'').toLowerCase().includes(q));
      return true;
    });

    // Remove old thermal toggle if exists
    const oldToggle = document.getElementById('thermalToggleRow');
    if (oldToggle) oldToggle.remove();

    if (thermalRows.length > 0) {
      const toggleRow = document.createElement('tr');
      toggleRow.id = 'thermalToggleRow';
      toggleRow.innerHTML = '<td colspan="6" style="padding:0">' +
        '<button id="btnThermalToggle" style="width:100%;padding:8px 12px;background:#F8F9FB;border:none;border-top:1px solid var(--bd);cursor:pointer;font-size:12px;font-weight:600;color:var(--t2);text-align:left;font-family:var(--font)">' +
        '🏷️ Термопринтеры (' + thermalRows.length + ')  ▼' +
        '</button></td>';
      tbody.appendChild(toggleRow);

      const thermalHtml = thermalRows.map(row => {
        const cnt   = row.cnt;
        const tod   = Storage.replacements.todayByArticle(row.article);
        const tot   = Storage.replacements.totalByArticle(row.article);
        const names = [...new Set(row.printers.map(p => p.brand + ' ' + p.model))].join(', ');
        const owners = [...new Set(row.printers.map(p => p.owner).filter(Boolean))].join(', ');
        return '<tr class="thermal-row" style="display:none">' +
          '<td style="font-size:12px;font-weight:600;color:var(--t2)">' + UI.esc(row.article) + '</td>' +
          '<td style="font-size:12px;color:var(--t2)">' + UI.esc(names) + '<div class="td-sub">' + row.printers.length + ' принт.</div></td>' +
          '<td style="font-size:12px;color:var(--t2)">' + UI.esc(owners||'—') + '</td>' +
          '<td style="text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:5px">' +
          '<button class="adj-btn" data-art="' + UI.esc(row.article) + '" data-d="-1">−</button>' +
          '<span id="hcc_' + UI.esc(row.article) + '">' + UI.stockHTML(cnt) + '</span>' +
          '<button class="adj-btn" data-art="' + UI.esc(row.article) + '" data-d="1">+</button>' +
          '</div></td>' +
          '<td style="text-align:center;font-weight:600;color:' + (tod?'var(--accent)':'var(--t3)') + '">' + (tod||'—') + '</td>' +
          '<td style="text-align:center;color:var(--t2)">' + (tot||'—') + '</td>' +
          '</tr>';
      }).join('');

      const thermalContainer = document.createElement('tbody');
      thermalContainer.id = 'thermalTbody';
      thermalContainer.innerHTML = thermalHtml;
      tbody.parentNode.appendChild(thermalContainer);

      // Wire toggle
      document.getElementById('btnThermalToggle').addEventListener('click', function() {
        const rows = document.querySelectorAll('.thermal-row');
        const open = rows[0] && rows[0].style.display !== 'none';
        rows.forEach(r => r.style.display = open ? 'none' : '');
        this.textContent = '🏷️ Термопринтеры (' + thermalRows.length + ')  ' + (open ? '▼' : '▲');
      });

      // Wire adj-btns for thermal rows
      thermalContainer.querySelectorAll('.adj-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const art = btn.dataset.art;
          Storage.cart.adjustByArticle(art, +btn.dataset.d);
          const el = document.getElementById('hcc_' + art);
          if (el) el.innerHTML = UI.stockHTML(Storage.cart.getByArticle(art));
        });
      });
    }
  }

  // ── Replacements log ──────────────────────────────────────────────────────────
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

  // ── Stats cards ───────────────────────────────────────────────────────────────
  function renderCartStats(containerId) {
    // Unique articles
    const articles = [...new Set(App.state.printers.map(p => p.cartridge).filter(Boolean))];
    const reps = Storage.replacements.all();
    const today = new Date().toLocaleDateString('ru-RU');
    const todaySum = reps.filter(r => (r.created || '').startsWith(today)).reduce((s, r) => s + (r.qty || 1), 0);
    const zeroCnt  = articles.filter(a => Storage.cart.getByArticle(a) === 0).length;
    const lowCnt   = articles.filter(a => { const c = Storage.cart.getByArticle(a); return c !== null && c > 0 && c <= 2; }).length;

    document.getElementById(containerId).innerHTML =
      UI.statCard(App.state.printers.length, 'Принтеров') +
      UI.statCard(zeroCnt, 'Нет картриджа', 'var(--rd)') +
      UI.statCard(lowCnt,  'Критично ≤2', 'var(--am)') +
      UI.statCard(todaySum, 'Замен сегодня', 'var(--gn)');
  }

  // ── CSV stock ─────────────────────────────────────────────────────────────────
  function exportStockCsv() {
    const articleMap = {};
    App.state.printers.forEach(pr => {
      const art = (pr.cartridge || '').trim();
      if (!art || art === '—') return;
      if (!articleMap[art]) articleMap[art] = { article: art, printers: [] };
      articleMap[art].printers.push(pr);
    });

    const headers = ['Артикул/картридж','Принтеры','Кол-во принтеров','На складе','Замен сегодня','Замен всего'];
    const rows = Object.values(articleMap).map(row => {
      const cnt   = Storage.cart.getByArticle(row.article);
      const names = [...new Set(row.printers.map(p => `${p.brand} ${p.model}`))].join('; ');
      return [row.article, names, row.printers.length, cnt === null ? 'н/д' : cnt,
              Storage.replacements.todayByArticle(row.article),
              Storage.replacements.totalByArticle(row.article)];
    });
    UI.downloadCsv(rows, headers, 'cartridges_' + new Date().toISOString().slice(0,10) + '.csv');
  }

  return {
    renderReplaceCards, getSelectedDevice, resetSelected,
    renderStockTable, renderRepLog, renderCartStats, exportStockCsv,
  };
})();

window.Cartridges = Cartridges;
