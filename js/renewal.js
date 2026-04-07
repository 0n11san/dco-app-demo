// js/renewal.js — Renewal Tracker logic

const RENEWAL = {
  contracts: [],

  init: async function() {
    const session = AUTH.requireAuth();
    if (!session) return;
    document.getElementById('navUsername').textContent = session.username;
    document.getElementById('navRoleBadge').textContent = session.role === 'superuser' ? 'Superuser' : 'User';
    document.getElementById('logoutBtn').addEventListener('click', function() { AUTH.logout(); });

    document.querySelectorAll('.su-only').forEach(function(el) {
      el.classList.toggle('hidden', session.role !== 'superuser');
    });

    document.getElementById('detailOverlay').addEventListener('click', function(e) {
      if (e.target === this) DETAIL.close();
    });
    document.getElementById('renewalOverlay').addEventListener('click', function(e) {
      if (e.target === this) RENEWAL_MODAL.close();
    });

    await this.load();
  },

  load: async function() {
    this.showLoading(true);
    try {
      this.contracts = await API.getContracts();
      this.render();
    } catch(err) {
      this.showError('Failed to load contracts: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  getUpcoming: function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.contracts
      .map(function(c) {
        const end = new Date(c.popEndDate + 'T12:00:00');
        const daysUntilEnd = Math.ceil((end - today) / 86400000);
        const suspenseDate = new Date(end);
        suspenseDate.setDate(suspenseDate.getDate() - CONFIG.RENEWAL_LEAD_TIME);
        const daysUntilSuspense = Math.ceil((suspenseDate - today) / 86400000);
        return { contract: c, daysUntilEnd, suspenseDate, daysUntilSuspense };
      })
      .filter(function(item) { return item.daysUntilEnd <= CONFIG.RENEWAL_WINDOW; })
      .sort(function(a, b) { return a.daysUntilSuspense - b.daysUntilSuspense; });
  },

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
    const tbody    = document.getElementById('renewalTbody');
    const emptyMsg = document.getElementById('renewalEmpty');
    const table    = document.getElementById('renewalTable');
    document.getElementById('renewalCount').textContent =
      upcoming.length + ' item' + (upcoming.length !== 1 ? 's' : '') + ' within ' + CONFIG.RENEWAL_WINDOW + ' days';

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
      const porHtml   = (c.porSupported || []).map(function(p) { return '<span class="por-tag">' + p + '</span>'; }).join('');
      const endStr    = UTILS.formatDate(c.popEndDate);
      const suspStr   = UTILS.formatDate(item.suspenseDate.toISOString().slice(0, 10));
      const daysEndDisplay = item.daysUntilEnd <= 0 ? '<strong>EXPIRED</strong>' : item.daysUntilEnd + ' days';
      const daysSuspDisplay = item.daysUntilSuspense <= 0
        ? '<strong>OVERDUE (' + Math.abs(item.daysUntilSuspense) + 'd)</strong>'
        : item.daysUntilSuspense + ' days';

      // Show renewal status badge if decision already made
      let renewalCell;
      if (c.renewalStatus) {
        renewalCell = '<span class="user-badge" style="background:' + (c.renewalStatus === 'RENEW' ? 'var(--green-text)' : 'var(--red-text)') + '">' + c.renewalStatus + '</span>' +
          '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">by ' + c.renewalSubmittedBy + '</div>';
      } else {
        renewalCell = '<button class="action-btn" onclick="RENEWAL_MODAL.open(\'' + c.id + '\')">REVIEW &amp; DECIDE</button>';
      }

      return '<tr class="' + statusCls + '">' +
        '<td class="row-num">' + (idx + 1) + '</td>' +
        '<td><strong>' + c.deliveryOrderName + '</strong></td>' +
        '<td class="muted">' + c.deliveryOrderNumber + '</td>' +
        '<td>' + endStr + '</td>' +
        '<td>' + daysEndDisplay + '</td>' +
        '<td>' + suspStr + '</td>' +
        '<td>' + daysSuspDisplay + '</td>' +
        '<td>' + porHtml + '</td>' +
        '<td><span class="status-badge badge-' + statusCls.replace('status-', '') + '">' + statusLbl + '</span></td>' +
        '<td>' + renewalCell + '</td>' +
        '<td><button class="action-btn" onclick="DETAIL.open(\'' + c.id + '\')">VIEW</button></td>' +
        '</tr>';
    }).join('');
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

// ─── RENEWAL DECISION MODAL ───────────────────────────────────────────────────

const RENEWAL_MODAL = {
  contractId: null,

  open: function(contractId) {
    this.contractId = contractId;
    const contract = RENEWAL.contracts.find(function(c) { return c.id === contractId; });
    if (!contract) return;

    document.getElementById('renewalModalTitle').textContent = contract.deliveryOrderName;
    document.getElementById('renewalModalDO').textContent = contract.deliveryOrderNumber;
    document.getElementById('renewalModalEnd').textContent = UTILS.formatDate(contract.popEndDate);

    // Populate current line items so validators can judge against present quantities
    const lineItems = contract.lineItems || [];
    let liHtml;
    if (lineItems.length === 0) {
      liHtml = '<span class="text-muted" style="font-size:12px">No line items on record.</span>';
    } else {
      liHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em">Description</th>' +
          '<th style="text-align:right;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em">Qty</th>' +
          '<th style="padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em">Metric</th>' +
        '</tr></thead><tbody>' +
        lineItems.map(function(li) {
          const isPrimary = li.id === contract.primaryLineItemId;
          const metricStr = li.metricQuantity || li.quantity
            ? (li.metricQuantity || li.quantity) + (li.metricType ? ' ' + li.metricType : '')
            : '—';
          return '<tr style="border-bottom:1px solid #1a2a1a">' +
            '<td style="padding:6px 8px;color:var(--text)">' + li.description +
              (isPrimary ? ' <span class="user-badge" style="background:var(--gold);color:#000;font-size:9px">PRIMARY</span>' : '') +
            '</td>' +
            '<td style="padding:6px 8px;text-align:right;color:var(--text-muted)">' + (li.quantity || '—') + '</td>' +
            '<td style="padding:6px 8px;color:var(--gold);font-weight:600">' + metricStr + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>';
    }
    document.getElementById('renewalLineItems').innerHTML = liHtml;

    // Reset form
    document.getElementById('renewalForm').reset();
    document.getElementById('renewalAlert').className = 'alert';

    document.getElementById('renewalOverlay').classList.add('active');
  },

  close: function() {
    document.getElementById('renewalOverlay').classList.remove('active');
    document.getElementById('renewalAlert').className = 'alert';
  },

  submit: async function() {
    const actionEl = document.querySelector('input[name="renewalAction"]:checked');
    const action   = actionEl ? actionEl.value : '';
    const qty      = document.getElementById('renewalQuantity').value.trim();
    const justif   = document.getElementById('renewalJustification').value.trim();
    const feedback = document.getElementById('renewalFeedback').value.trim();

    if (!action)   { this.showAlert('error', 'Please select Renew or Sunset.'); return; }
    if (!qty)      { this.showAlert('error', 'Renewal quantity / description is required.'); return; }
    if (!justif)   { this.showAlert('error', 'Justification is required.'); return; }
    if (!feedback) { this.showAlert('error', 'Capability feedback is required.'); return; }

    RENEWAL.showLoading(true);
    try {
      await API.submitRenewal(this.contractId, {
        action,
        renewalQuantity: qty,
        justification: justif,
        capabilityFeedback: feedback,
      });
      this.close();
      RENEWAL.contracts = await API.getContracts();
      RENEWAL.render();
    } catch(e) {
      this.showAlert('error', 'Submission failed: ' + e.message);
    } finally {
      RENEWAL.showLoading(false);
    }
  },

  showAlert: function(type, msg) {
    const el = document.getElementById('renewalAlert');
    el.textContent = msg;
    el.className = 'alert alert-' + type + ' visible';
  }
};
