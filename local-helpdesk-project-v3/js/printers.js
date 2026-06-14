/**
 * printers.js — выбор принтера в форме заявки
 */

const Printers = (() => {
  let _selectedDevice = null;
  let _pBrand = 'all';
  let _pSearch = '';
  let _cat = '';

  function selected() { return _selectedDevice; }
  function reset()    { _selectedDevice = null; _pBrand = 'all'; _pSearch = ''; }

  // ── Render simple device list (PC / Network) ──────────────────────────────────
  function renderSimple(containerId, devices) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    _selectedDevice = null;
    wrap.style.cssText = 'border:1.5px solid var(--bd);border-radius:var(--r);overflow:hidden';
    wrap.innerHTML = devices.map((d, i) => `
      <div class="printer-item" data-i="${i}">
        <div class="device-radio" id="dr_${i}"></div>
        <div style="font-size:18px;width:26px;text-align:center;flex-shrink:0">${d.icon}</div>
        <div>
          <div class="pi-name">${UI.esc(d.name)}</div>
          ${d.sub ? `<div class="pi-sub">${UI.esc(d.sub)}</div>` : ''}
        </div>
      </div>`
    ).join('');
    wrap.querySelectorAll('.printer-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        wrap.querySelectorAll('.printer-item').forEach(x => x.classList.remove('selected'));
        wrap.querySelectorAll('.device-radio').forEach(r => r.classList.remove('on'));
        item.classList.add('selected');
        document.getElementById('dr_' + i).classList.add('on');
        _selectedDevice = devices[i].name;
      });
    });
  }

  // ── Render printer list (from printers.json) ──────────────────────────────────
  function renderList(containerId, cat, personName) {
    _cat = cat;
    const isLabel = pr => ['Zebra','SATO','Honeywell','CST','Mertech'].includes(pr.brand);
    const matchCat = pr => (cat === 'Принтер / МФУ' ? !isLabel(pr) : true);

    const mine = App.state.printers.filter(pr =>
      matchCat(pr) && pr.owner && pr.owner.trim() === (personName || '').trim()
    );

    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    _selectedDevice = null;
    wrap.style = '';

    if (!mine.length) {
      // No assigned printers — hide section
      const section = document.getElementById('deviceSection');
      if (section) section.style.display = 'none';
      return;
    }

    const div = document.createElement('div');
    div.className = 'printer-wrap';

    // Search input
    const si = document.createElement('input');
    si.className = 'printer-search';
    si.placeholder = 'Поиск: модель, место…';
    si.autocomplete = 'off';
    si.addEventListener('input', () => { _pSearch = si.value; _draw(div, mine, si); });
    div.appendChild(si);

    // Brand pills
    const brands = ['all', ...[...new Set(mine.map(p => p.brand).filter(Boolean))]];
    if (brands.length > 2) {
      const pr = document.createElement('div');
      pr.className = 'pf-row';
      brands.forEach(b => {
        const pill = document.createElement('button');
        pill.className = 'pf-pill' + (b === 'all' ? ' active' : '');
        pill.textContent = b === 'all' ? 'Все' : b;
        pill.addEventListener('click', () => {
          _pBrand = b;
          pr.querySelectorAll('.pf-pill').forEach(x => x.classList.remove('active'));
          pill.classList.add('active');
          _draw(div, mine, si);
        });
        pr.appendChild(pill);
      });
      div.appendChild(pr);
    }

    const ul = document.createElement('div');
    ul.id = '_printerList';
    div.appendChild(ul);
    wrap.innerHTML = '';
    wrap.appendChild(div);
    _draw(div, mine, si);
  }

  function _draw(wrap, mine, si) {
    const q = (_pSearch || '').toLowerCase();
    const rows = mine.filter(pr => {
      if (_pBrand !== 'all' && pr.brand !== _pBrand) return false;
      if (q) return ['model','location','owner','cartridge'].some(k => (pr[k] || '').toLowerCase().includes(q));
      return true;
    });

    const ul = wrap.querySelector('#_printerList');
    if (!ul) return;

    if (!rows.length) {
      ul.innerHTML = '<div style="padding:14px;text-align:center;color:var(--t3);font-size:13px">Ничего не найдено</div>';
      return;
    }

    const isLabelBrand = pr => ['Zebra','SATO','Honeywell','CST','Mertech'].includes(pr.brand);

    ul.innerHTML = rows.map(pr => {
      const cnt = Storage.cart.get(pr.id);
      const cntTxt = cnt === null ? '—' : cnt;
      const cntCls = cnt !== null && cnt === 0 ? ' zero' : cnt !== null && cnt <= 2 ? ' low' : '';
      const lbl = isLabelBrand(pr) ? 'Риббон' : 'Картридж';
      return `<div class="printer-item" data-pid="${pr.id}">
        <div class="device-radio" id="dpr_${pr.id}"></div>
        <div style="font-size:18px;width:26px;text-align:center;flex-shrink:0">${UI.brandIcon(pr.brand)}</div>
        <div class="pi-info">
          <div class="pi-name">${UI.esc(pr.brand)} ${UI.esc(pr.model)}</div>
          <div class="pi-sub">${UI.esc(pr.location || '')}${pr.cabinet ? ' · каб.' + UI.esc(pr.cabinet) : ''}</div>
          <div class="pi-cart">${UI.esc(pr.cartridge || '—')}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
          <div class="cart-stock">
            <span class="cart-label">${lbl}:</span>
            <span class="cart-count${cntCls}" id="cc_${pr.id}">${cntTxt}</span>
          </div>
        </div>
      </div>`;
    }).join('');

    ul.querySelectorAll('.printer-item').forEach(item => {
      item.addEventListener('click', () => {
        ul.querySelectorAll('.printer-item').forEach(i => { i.classList.remove('selected'); i.querySelector('.device-radio')?.classList.remove('on'); });
        item.classList.add('selected');
        item.querySelector('.device-radio')?.classList.add('on');
        const pr = App.state.printers.find(p => p.id === +item.dataset.pid);
        if (pr) _selectedDevice = `${UI.esc(pr.brand)} ${UI.esc(pr.model)}${pr.location ? ' (' + pr.location + (pr.cabinet ? ' каб.' + pr.cabinet : '') + ')' : ''}`;
      });
    });
  }

  return { selected, reset, renderSimple, renderList };
})();

window.Printers = Printers;
