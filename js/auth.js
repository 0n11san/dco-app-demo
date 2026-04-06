// js/auth.js
// Session management and authentication logic

const AUTH = {
  // Store session data in sessionStorage; token persists in localStorage
  setSession: function(username, role, githubToken) {
    // Token stored in localStorage so APM doesn't re-enter it each session
    if (githubToken) localStorage.setItem('dco_github_token', githubToken);
    const session = { username, role, githubToken: githubToken || localStorage.getItem('dco_github_token') || '' };
    sessionStorage.setItem('dco_session', JSON.stringify(session));
  },

  // Retrieve current session, merging in persisted token if needed
  getSession: function() {
    const raw = sessionStorage.getItem('dco_session');
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      // Ensure token is always available from localStorage if not in session
      if (!session.githubToken) session.githubToken = localStorage.getItem('dco_github_token') || '';
      return session;
    } catch(e) { return null; }
  },

  // Retrieve saved token from localStorage (for pre-filling login form)
  getSavedToken: function() {
    return localStorage.getItem('dco_github_token') || '';
  },

  // Clear session; token intentionally kept in localStorage for next login
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
