// js/auth.js
// Session management and authentication logic

const AUTH = {
  // Store session data in sessionStorage
  setSession: function(username, role, githubToken) {
    const session = { username, role, githubToken: githubToken || '' };
    sessionStorage.setItem('dco_session', JSON.stringify(session));
  },

  // Retrieve current session
  getSession: function() {
    const raw = sessionStorage.getItem('dco_session');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
  },

  // Clear session and redirect to login
  logout: function() {
    sessionStorage.removeItem('dco_session');
    window.location.href = 'index.html';
  },

  // Protect a page: redirect to login if no session
  requireAuth: function() {
    const session = this.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    return session;
  },

  // Check if current user is superuser
  isSuperuser: function() {
    const session = this.getSession();
    return session && session.role === 'superuser';
  },

  // Validate login credentials
  // Returns { success, role, error }
  validate: function(username, password, githubToken) {
    const userConfig = CONFIG.USERS[username];
    if (!userConfig) {
      return { success: false, error: 'Invalid username or password.' };
    }
    if (userConfig.passwordHash !== btoa(password)) {
      return { success: false, error: 'Invalid username or password.' };
    }
    // Superuser requires GitHub token
    if (userConfig.role === 'superuser' && !githubToken) {
      return { success: false, error: 'GitHub Personal Access Token is required for this account.' };
    }
    return { success: true, role: userConfig.role };
  }
};
