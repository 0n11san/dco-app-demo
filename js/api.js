// js/api.js — Cloudflare Worker API client (replaces github-api.js)
// All data operations go through the Worker. No GitHub token needed.

const API = {
  BASE: 'https://dco-worker.jon-ev-smi.workers.dev',

  // Build headers with user identity for audit logging
  _headers: function() {
    const session = AUTH.getSession();
    const h = { 'Content-Type': 'application/json' };
    if (session) {
      h['X-DCO-Username'] = session.username;
      h['X-DCO-Role']     = session.role;
    }
    return h;
  },

  // GET /api/contracts
  getContracts: async function() {
    const resp = await fetch(this.BASE + '/api/contracts', { headers: this._headers() });
    if (!resp.ok) throw new Error('Failed to load contracts: ' + resp.status);
    return await resp.json();
  },

  // POST /api/contracts
  createContract: async function(data) {
    const resp = await fetch(this.BASE + '/api/contracts', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(data)
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || 'Failed to create contract');
    }
    return await resp.json();
  },

  // PUT /api/contracts/:id
  updateContract: async function(id, data) {
    const resp = await fetch(this.BASE + '/api/contracts/' + id, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(data)
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || 'Failed to update contract');
    }
    return await resp.json();
  },

  // DELETE /api/contracts/:id
  deleteContract: async function(id) {
    const resp = await fetch(this.BASE + '/api/contracts/' + id, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || 'Failed to delete contract');
    }
    return await resp.json();
  },

  // POST /api/contracts/:id/renewal
  submitRenewal: async function(contractId, data) {
    const resp = await fetch(this.BASE + '/api/contracts/' + contractId + '/renewal', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(data)
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || 'Failed to submit renewal');
    }
    return await resp.json();
  },

  // GET /api/priorities
  getPriorities: async function() {
    const resp = await fetch(this.BASE + '/api/priorities', { headers: this._headers() });
    if (!resp.ok) throw new Error('Failed to load priorities: ' + resp.status);
    return await resp.json();
  },

  // PUT /api/priorities
  savePriorities: async function(orderedIds) {
    const resp = await fetch(this.BASE + '/api/priorities', {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify({ orderedIds })
    });
    if (!resp.ok) throw new Error('Failed to save priorities');
    return await resp.json();
  },

  // GET /api/audit-log
  getAuditLog: async function() {
    const resp = await fetch(this.BASE + '/api/audit-log', { headers: this._headers() });
    if (!resp.ok) throw new Error('Failed to load audit log: ' + resp.status);
    return await resp.json();
  },

  // GET /api/email-preview/:id
  getEmailPreview: async function(contractId) {
    const resp = await fetch(this.BASE + '/api/email-preview/' + contractId, { headers: this._headers() });
    if (!resp.ok) throw new Error('Failed to load email preview');
    return await resp.json();
  }
};
