// js/auth.js — Session management and authentication logic

const AUTH = {
  setSession: function(username, role) {
    sessionStorage.setItem('dco_session', JSON.stringify({ username, role }));
  },

  getSession: function() {
    const raw = sessionStorage.getItem('dco_session');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
  },

  logout: function() {
    sessionStorage.removeItem('dco_session');
    window.location.href = 'index.html';
  },

  requireAuth: function() {
    const session = this.getSession();
    if (!session) { window.location.href = 'index.html'; return null; }
    return session;
  },

  isSuperuser: function() {
    const session = this.getSession();
    return session && session.role === 'superuser';
  },

  validate: function(username, password) {
    const userConfig = CONFIG.USERS[username];
    if (!userConfig) return { success: false, error: 'Invalid username or password.' };
    if (userConfig.passwordHash !== btoa(password)) return { success: false, error: 'Invalid username or password.' };
    return { success: true, role: userConfig.role };
  }
};
