/**
 * mileage.js — учёт пробега принтеров (счётчик страниц, замен)
 * Расширяет данные о заменах картриджей статистикой использования.
 */

const Mileage = (() => {
  // ── Per-printer stats ─────────────────────────────────────────────────────────
  function stats(printerId) {
    const reps  = Storage.replacements.all().filter(r => String(r.printerId) === String(printerId));
    const total = reps.reduce((s, r) => s + (r.qty || 1), 0);
    const last  = reps.length ? reps[0] : null;
    const avgDays = _avgDaysBetweenReplacements(reps);
    const nextEst = _estimateNextReplacement(last, avgDays);

    return { total, last, avgDays, nextEst };
  }

  function _avgDaysBetweenReplacements(reps) {
    if (reps.length < 2) return null;
    const sorted = [...reps].sort((a, b) => a.ts - b.ts);
    let sumDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      sumDays += (sorted[i].ts - sorted[i-1].ts) / 86400000;
    }
    return Math.round(sumDays / (sorted.length - 1));
  }

  function _estimateNextReplacement(last, avgDays) {
    if (!last || !avgDays) return null;
    const next = new Date(last.ts + avgDays * 86400000);
    return next.toLocaleDateString('ru-RU');
  }

  // ── Summary table rows ────────────────────────────────────────────────────────
  function summaryRows(printers) {
    return printers.map(pr => {
      const s = stats(pr.id);
      return {
        id:       pr.id,
        name:     `${pr.brand} ${pr.model}`,
        location: pr.location || '',
        total:    s.total,
        lastDate: s.last ? s.last.created : '—',
        avgDays:  s.avgDays !== null ? `${s.avgDays} дн.` : '—',
        nextEst:  s.nextEst || '—',
      };
    });
  }

  // ── CSV export ────────────────────────────────────────────────────────────────
  function exportCsv() {
    const headers = ['Принтер','Расположение','Всего замен','Последняя замена','Ср. интервал (дн.)','Следующая замена (ест.)'];
    const rows = summaryRows(App.state.printers).map(r =>
      [r.name, r.location, r.total, r.lastDate, r.avgDays, r.nextEst]
    );
    UI.downloadCsv(rows, headers, 'mileage_' + new Date().toISOString().slice(0,10) + '.csv');
  }

  return { stats, summaryRows, exportCsv };
})();

window.Mileage = Mileage;
