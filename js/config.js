// js/config.js
// DCO Contract Management System - Configuration
// WARNING: Credentials are base64-encoded for demo obfuscation only.
// This is NOT real security. Do not use with classified or sensitive data.

const CONFIG = {
  GITHUB_OWNER: '0n11san',
  GITHUB_REPO: 'dco-app-demo',
  DATA_FILE: 'data/contracts.json',

  // DEMO CREDENTIALS — NOT FOR USE WITH REAL DATA
  // Passwords are btoa-encoded (base64), not hashed — demo only
  USERS: {
    'APM': { passwordHash: btoa('Dco2025!'), role: 'superuser' },
    'ChiefNeely': { passwordHash: btoa('Dco2025!'), role: 'regular' }
  },

  // POR options
  POR_OPTIONS: ['GDP', 'DDS', 'F&MA', 'Miscellaneous'],

  // Renewal thresholds (days)
  RENEWAL_LEAD_TIME: 45,
  RENEWAL_WINDOW: 120
};
