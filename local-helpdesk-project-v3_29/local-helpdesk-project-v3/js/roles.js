/**
 * roles.js — управление ролями пользователей
 */

const Roles = (() => {
  const ROLES = { admin: 3, technician: 2, user: 1 };

  function current()       { return Storage.get('hd_role', 'user'); }
  function set(role)       { if (ROLES[role] !== undefined) Storage.set('hd_role', role); }
  function isAdmin()       { return current() === 'admin'; }
  function isTechnician()  { return ROLES[current()] >= ROLES['technician']; }
  function can(action) {
    const perms = {
      edit_ticket:   isTechnician(),
      delete_ticket: isAdmin(),
      edit_stock:    isTechnician(),
      view_helpdesk: isTechnician(),
    };
    return !!perms[action];
  }

  return { current, set, isAdmin, isTechnician, can };
})();

window.Roles = Roles;
