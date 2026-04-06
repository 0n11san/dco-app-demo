// js/renewal.js — Renewal Tracker logic

const RENEWAL = {

  contracts: [],
  sha: null,

  init: async function() {
    const session = AUTH.requireAuth();
    if (!session) return;

    // Set username display
    document.getElementById('navUsername').textContent = session.username;
    document.getElementById('navRoleBadge').textContent = session.role === 'superuser' ? 'Superuser' : 'User';

    document.getElementById('logoutBtn').addEventListener('click', function() {
      AUTH.logout();
    });

    await this.load();
  },

  load: async function() {
    this.showLoading(true);
    try {
      const result = await GITHUB_API.getContracts();
      this.contracts = result.contracts;
      this.sha = result.sha;
      this.render();
    } catch(err) {
      this.showError('Failed to load contracts: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  // Filter contracts expiring within RENEWAL_WINDOW days
  getUpcoming: function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowMs = CONFIG.RENEWAL_WINDOW * 24 * 60 * 60 * 1000;

    return this.contracts
      .map(function(c) {
        const end = new Date(c.popEndDate);
        const daysUntilEnd = Math.ceil((end - today) / (24 * 60 * 60 * 1000));
        const suspenseDate = new Date(end);
        suspenseDate.setDate(suspenseDate.getDate() - CONFIG.RENEWAL_LEAD_TIME);
        const daysUntilSuspense = Math.ceil((suspenseDate - today) / (24 * 60 * 60 * 1000));
        return { contract: c, daysUntilEnd, suspenseDate, daysUntilSuspense };
      })
      .filter(function(item) {
        return item.daysUntilEnd <= CONFIG.RENEWAL_WINDOW;
      })
      .sort(function(a, b) {
        return a.daysUntilSuspense - b.daysUntilSuspense;
      });
  },

  // Determine row status class based on days until suspense
  statusClass: function(daysUntilSuspense) {
    if (daysUntilSuspense <= 0)  return 'status-red';
    if (daysUntilSuspense <= 14) return 'status-orange';
    if (daysUntilSuspense <= 30) return 'status-yellow';
    return 'status-green';
  },

  statusLabel: function(daysUntilSuspense) {
    if (daysUntilSuspense <= 0)  return 'OVERDUE';
    if (daysUntilSuspense <= 14) return 'CRITICAL';
    if (daysUntilSuspense <= 30) return 'WARNING';
    return 'MONITOR';
  },

  render: function() {
    const upcoming = this.getUpcoming();
    const tbody = document.getElementById('renewalTbody');
    const emptyMsg = document.getElementById('renewalEmpty');
    const table = document.getElementById('renewalTable');
    const countEl = document.getElementById('renewalCount');

    countEl.textContent = upcoming.length + ' item' + (upcoming.length !== 1 ? 's' : '') + ' within ' + CONFIG.RENEWAL_WINDOW + ' days';

    if (upcoming.length === 0) {
      table.classList.add('hidden');
      emptyMsg.classList.remove('hidden');
      return;
    }

    table.classList.remove('hidden');
    emptyMsg.classList.add('hidden');

    tbody.innerHTML = upcoming.map(function(item, idx) {
      const c = item.contract;
      const statusCls = RENEWAL.statusClass(item.daysUntilSuspense);
      const statusLbl = RENEWAL.statusLabel(item.daysUntilSuspense);
      const suspStr = UTILS.formatDate(item.suspenseDate.toISOString().slice(0,10));
      const endStr  = UTILS.formatDate(c.popEndDate);
      const porHtml = (c.por || []).map(function(p) {
        return '<span class="por-tag">' + p + '</span>';
      }).join('');

      const daysEndDisplay = item.daysUntilEnd <= 0
        ? '<strong>EXPIRED</strong>'
        : item.daysUntilEnd + ' days';

      const daysSuspDisplay = item.daysUntilSuspense <= 0
        ? '<strong>OVERDUE (' + Math.abs(item.daysUntilSuspense) + 'd)</strong>'
        : item.daysUntilSuspense + ' days';

      return '<tr class="' + statusCls + '" data-id="' + c.id + '">' +
        '<td class="row-num">' + (idx + 1) + '</td>' +
        '<td><strong>' + c.deliveryOrderName + '</strong></td>' +
        '<td class="muted">' + c.deliveryOrderNumber + '</td>' +
        '<td>' + endStr + '</td>' +
        '<td>' + daysEndDisplay + '</td>' +
        '<td>' + suspStr + '</td>' +
        '<td>' + daysSuspDisplay + '</td>' +
        '<td>' + porHtml + '</td>' +
        '<td><span class="status-badge ' + statusCls.replace('status-','badge-') + '">' + statusLbl + '</span></td>' +
        '<td><button class="action-btn" onclick="RENEWAL.openDetail(\'' + c.id + '\')">VIEW</button></td>' +
        '</tr>';
    }).join('');
  },

  openDetail: function(id) {
    const contract = this.contracts.find(function(c) { return c.id === id; });
    if (!contract) return;
    // Reuse dashboard detail modal logic via shared DETAIL object
    DETAIL.open(contract);
  },

  showLoading: function(on) {
    document.getElementById('loadingOverlay').classList.toggle('active', on);
  },

  showError: function(msg) {
    const el = document.getElementById('pageAlert');
    el.textContent = msg;
    el.className = 'alert alert-error visible';
  }
};
