/**
 * sla.js — SLA расчёты (время реакции, просрочка)
 */

const SLA = (() => {
  function getPriority(name) {
    return (App.state.sla.priorities || {})[name] || { response_min: 60, resolve_min: 480 };
  }

  function msToMin(ms) { return ms / 60000; }

  function isBreached(ticket) {
    if (!ticket.ts) return false;
    const sla = getPriority(ticket.priority);
    const elapsed = msToMin(Date.now() - ticket.ts);
    if (ticket.status === 'Новая' || ticket.status === 'В работе') {
      return elapsed > sla.resolve_min;
    }
    return false;
  }

  function responseBreached(ticket) {
    if (!ticket.ts || ticket.status !== 'Новая') return false;
    const sla = getPriority(ticket.priority);
    return msToMin(Date.now() - ticket.ts) > sla.response_min;
  }

  function elapsedLabel(ticket) {
    if (!ticket.ts) return '';
    const min = Math.floor(msToMin(Date.now() - ticket.ts));
    if (min < 60) return `${min} мин.`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h} ч. ${m} мин.`;
  }

  function slaIndicator(ticket) {
    if (isBreached(ticket)) return '<span style="color:var(--rd);font-weight:600;font-size:11px">⚠ Просрочено</span>';
    if (responseBreached(ticket)) return '<span style="color:var(--am);font-weight:600;font-size:11px">⏱ Ждёт ответа</span>';
    return '';
  }

  return { getPriority, isBreached, responseBreached, elapsedLabel, slaIndicator };
})();

window.SLA = SLA;
