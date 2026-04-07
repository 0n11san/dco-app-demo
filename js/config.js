// js/config.js — DCO CMS Configuration
// WARNING: Credentials are base64-encoded for demo obfuscation only.
// This is NOT real security. Do not use with classified or sensitive data.

const CONFIG = {
  WORKER_URL: 'https://dco-worker.jon-ev-smi.workers.dev',

  // DEMO CREDENTIALS — NOT FOR USE WITH REAL DATA
  USERS: {
    'APM':        { passwordHash: btoa('Dco2025!'), role: 'superuser' },
    'ChiefNeely': { passwordHash: btoa('Dco2025!'), role: 'regular' }
  },

  POR_OPTIONS:     ['GDP', 'DDS', 'F&MA', 'Tools', 'Miscellaneous'],
  VEHICLE_OPTIONS: ['CHESS ITES-4H', 'CHESS ITES SW'],
  METRIC_TYPES:    ['seats', 'endpoints', 'cores', 'users', 'processors', 'nodes', 'servers', 'workstations', 'gb/day', 'credits', 'unlimited', 'units'],

  RENEWAL_LEAD_TIME: 45,
  RENEWAL_WINDOW:    120,
};
