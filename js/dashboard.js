// js/dashboard.js — Dashboard logic for DCO CMS (Cloudflare Worker backend)

const DASHBOARD = {
  contracts: [],
  session: null,

  init: async function() {
    this.session = AUTH.requireAuth();
    if (!this.session) return;
    const isSU = this.session.role === 'superuser';

    document.getElementById('navUsername').textContent = this.session.username;
    document.getElementById('navRoleBadge').textContent = isSU ? 'Superuser' : 'User';
    document.getElementById('logoutBtn').addEventListener('click', function() { AUTH.logout(); });

    document.querySelectorAll('.su-only').forEach(function(el) {
      el.classList.toggle('hidden', !isSU);
    });

    document.getElementById('btnExportCSV').addEventListener('click', function() {
      EXPORT.toCSV(DASHBOARD.contracts, isSU);
    });
    document.getElementById('btnExportExcel').addEventListener('click', function() {
      EXPORT.toExcel(DASHBOARD.contracts, isSU);
    });

    if (isSU) {
      document.getElementById('uploadInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        EXPORT.parseUpload(file, function(err, parsed) {
          if (err) { DASHBOARD.showAlert('error', 'Upload failed: ' + err.message); return; }
          DASHBOARD.mergeUploaded(parsed);
        });
        e.target.value = '';
      });
      document.getElementById('btnAddContract').addEventListener('click', function() { EDIT.openAdd(); });
    }

    document.getElementById('detailOverlay').addEventListener('click', function(e) {
      if (e.target === this) DETAIL.close();
    });
    document.getElementById('editOverlay').addEventListener('click', function(e) {
      if (e.target === this) EDIT.close();
    });

    await this.load();
  },

  load: async function() {
    this.showLoading(true);
    try {
      this.contracts = await API.getContracts();
      this.render();
    } catch(err) {
      this.showAlert('error', 'Failed to load contracts: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  render: function() {
    const isSU = this.session.role === 'superuser';
    document.getElementById('contractCount').textContent =
      this.contracts.length + ' contract' + (this.contracts.length !== 1 ? 's' : '');

    document.getElementById('contractTbody').innerHTML = this.contracts.map(function(c, idx) {
      // Primary metric: find designated primary line item, or most expensive
      let primaryMetric = '—';
      if (c.lineItems && c.lineItems.length > 0) {
        let primaryLI = c.lineItems.find(function(li) { return li.id === c.primaryLineItemId; });
        if (!primaryLI) primaryLI = c.lineItems.reduce(function(a, b) { return b.total > a.total ? b : a; });
        if (primaryLI && primaryLI.metricType) {
          primaryMetric = (primaryLI.metricQuantity || primaryLI.quantity || '') + ' ' + primaryLI.metricType;
        }
      }

      const porSupportedHtml = (c.porSupported || []).map(function(p) {
        return '<span class="por-tag">' + p + '</span>';
      }).join('');

      const renewalBadge = c.renewalStatus
        ? '<span class="user-badge" style="background:' + (c.renewalStatus === 'RENEW' ? 'var(--green-text)' : 'var(--red-text)') + ';margin-left:4px">' + c.renewalStatus + '</span>'
        : '';

      let row = '<tr data-id="' + c.id + '" onclick="DETAIL.open(\'' + c.id + '\')">' +
        '<td class="row-num">' + (idx + 1) + '</td>' +
        '<td><strong>' + c.deliveryOrderName + '</strong>' + renewalBadge + '</td>' +
        '<td class="muted">' + c.deliveryOrderNumber + '</td>';

      if (isSU) {
        const poc = (c.vendorPOCs && c.vendorPOCs[0]) || {};
        const extra = c.vendorPOCs && c.vendorPOCs.length > 1 ? ' <span class="text-muted">(+' + (c.vendorPOCs.length - 1) + ')</span>' : '';
        row +=
          '<td>' + (poc.name || '—') + extra + '</td>' +
          '<td class="muted">' + (poc.email || '—') + '</td>' +
          '<td class="muted">' + (poc.phone || '—') + '</td>' +
          '<td class="text-right">' + UTILS.formatCurrency(c.costs.ba8Portion) + '</td>' +
          '<td class="text-right">' + UTILS.formatCurrency(c.costs.arcyberPortion) + '</td>' +
          '<td class="text-right muted">' + UTILS.formatCurrency(c.costs.itemsFee) + '</td>' +
          '<td class="text-right muted">' + UTILS.formatCurrency(c.costs.gsaFee) + '</td>' +
          '<td class="text-right text-gold fw-bold">' + UTILS.formatCurrency(c.costs.totalCurrentCost) + '</td>' +
          '<td class="text-right">' + UTILS.formatCurrency(c.costs.projectedNextFY) + '</td>';
      }

      row +=
        '<td>' + porSupportedHtml + '</td>' +
        '<td class="muted">' + ((c.porFundedBy || []).join(', ') || '—') + '</td>' +
        '<td class="muted">' + (c.vehicle || '—') + '</td>' +
        '<td class="muted">' + (c.facilitatedBy || '—') + '</td>' +
        '<td class="muted">' + (c.sunsetting || 'N/A') + '</td>' +
        '<td class="muted">' + primaryMetric + '</td>' +
        '<td class="muted">' + UTILS.formatDate(c.popBeginDate) + '</td>' +
        '<td class="muted">' + UTILS.formatDate(c.popEndDate) + '</td>';

      if (isSU) {
        row += '<td onclick="event.stopPropagation()">' +
          '<button class="action-btn" onclick="EDIT.open(\'' + c.id + '\')" title="Edit">&#9998;</button>' +
          '</td>';
      }

      row += '</tr>';
      return row;
    }).join('');
  },

  mergeUploaded: async function(parsed) {
    this.showLoading(true);
    let added = 0, updated = 0;
    try {
      for (const row of parsed) {
        const existing = this.contracts.find(function(c) {
          return c.deliveryOrderNumber && row.deliveryOrderNumber &&
            c.deliveryOrderNumber.trim() === row.deliveryOrderNumber.trim();
        });
        if (existing) {
          if (row.deliveryOrderName)  existing.deliveryOrderName = row.deliveryOrderName;
          if (row.popBeginDate)       existing.popBeginDate = row.popBeginDate;
          if (row.popEndDate)         existing.popEndDate = row.popEndDate;
          if (row.notes !== undefined) existing.notes = row.notes;
          await API.updateContract(existing.id, existing);
          updated++;
        } else if (row.deliveryOrderName) {
          await API.createContract({
            deliveryOrderName: row.deliveryOrderName,
            deliveryOrderNumber: row.deliveryOrderNumber || '',
            porSupported: row.por ? row.por.split(';').map(function(s){ return s.trim(); }) : [],
            porFundedBy: [],
            vehicle: '',
            facilitatedBy: 'ITEMSS GSA',
            sunsetting: 'N/A',
            popBeginDate: row.popBeginDate || '',
            popEndDate: row.popEndDate || '',
            costs: { ba8Portion: 0, arcyberPortion: 0, projectedNextFY: 0 },
            lineItems: [], vendorPOCs: [], validators: [], documents: {},
            notes: row.notes || ''
          });
          added++;
        }
      }
      this.contracts = await API.getContracts();
      this.render();
      this.showAlert('success', updated + ' updated, ' + added + ' added.');
    } catch(err) {
      this.showAlert('error', 'Upload failed: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  showLoading: function(on) {
    document.getElementById('loadingOverlay').classList.toggle('active', on);
  },

  showAlert: function(type, msg) {
    const el = document.getElementById('pageAlert');
    el.textContent = msg;
    el.className = 'alert alert-' + type + ' visible';
    if (type === 'success') setTimeout(function() { el.classList.remove('visible'); }, 4000);
  }
};

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────

const DETAIL = {
  open: function(idOrContract) {
    const allContracts = (DASHBOARD.contracts && DASHBOARD.contracts.length)
      ? DASHBOARD.contracts
      : (typeof RENEWAL !== 'undefined' ? RENEWAL.contracts : []);
    const contract = typeof idOrContract === 'string'
      ? allContracts.find(function(c) { return c.id === idOrContract; })
      : idOrContract;
    if (!contract) return;

    const session = AUTH.getSession();
    const isSU = session && session.role === 'superuser';

    document.getElementById('detailTitle').textContent = contract.deliveryOrderName;
    document.getElementById('detailSubtitle').textContent = contract.deliveryOrderNumber;

    // Vendor (superuser only)
    const vendorSection = document.getElementById('detailVendorSection');
    vendorSection.classList.toggle('hidden', !isSU);
    if (isSU) {
      document.getElementById('detailVendorBody').innerHTML =
        (contract.vendorPOCs || []).map(function(p) {
          return '<div class="detail-grid" style="margin-bottom:8px">' +
            '<span class="detail-label">Name</span><span class="detail-value">' + p.name + '</span>' +
            '<span class="detail-label">Email</span><span class="detail-value"><a href="mailto:' + p.email + '">' + p.email + '</a></span>' +
            '<span class="detail-label">Phone</span><span class="detail-value">' + p.phone + '</span>' +
          '</div>';
        }).join('<hr style="border-color:var(--border);margin:6px 0">') || '<span class="text-muted">No POC on record.</span>';
    }

    // Contract info
    document.getElementById('detailInfoBody').innerHTML =
      '<div class="detail-grid">' +
        '<span class="detail-label">POR(s) Supported</span><span class="detail-value">' + (contract.porSupported || []).map(function(p){ return '<span class="por-tag">' + p + '</span>'; }).join('') + '</span>' +
        '<span class="detail-label">POR Funded By</span><span class="detail-value">' + ((contract.porFundedBy || []).join(', ') || '—') + '</span>' +
        '<span class="detail-label">Vehicle</span><span class="detail-value">' + (contract.vehicle || '—') + '</span>' +
        '<span class="detail-label">Facilitated By</span><span class="detail-value">' + (contract.facilitatedBy || '—') + '</span>' +
        '<span class="detail-label">Sunsetting?</span><span class="detail-value">' + (contract.sunsetting || 'N/A') + '</span>' +
        '<span class="detail-label">PoP Begin</span><span class="detail-value">' + UTILS.formatDate(contract.popBeginDate) + '</span>' +
        '<span class="detail-label">PoP End</span><span class="detail-value">' + UTILS.formatDate(contract.popEndDate) + '</span>' +
        (contract.renewalStatus ? '<span class="detail-label">Renewal Status</span><span class="detail-value text-' + (contract.renewalStatus === 'RENEW' ? 'green' : 'red') + ' fw-bold">' + contract.renewalStatus + ' — submitted by ' + contract.renewalSubmittedBy + '</span>' : '') +
        (contract.notes ? '<span class="detail-label">Notes</span><span class="detail-value">' + contract.notes + '</span>' : '') +
      '</div>';

    // Capability description
    const capSection = document.getElementById('detailCapSection');
    if (contract.capabilityDescription) {
      capSection.classList.remove('hidden');
      document.getElementById('detailCapBody').textContent = contract.capabilityDescription;
    } else {
      capSection.classList.add('hidden');
    }

    // Cost (superuser only)
    const costSection = document.getElementById('detailCostSection');
    costSection.classList.toggle('hidden', !isSU);
    if (isSU) {
      const li = contract.lineItems || [];
      let liHtml = '';
      if (li.length > 0) {
        liHtml = '<table class="cost-summary-table" style="margin-bottom:12px"><thead><tr>' +
          '<th style="text-align:left;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Description</th>' +
          '<th style="text-align:right;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Qty</th>' +
          '<th style="text-align:right;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Unit Cost</th>' +
          '<th style="text-align:right;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Total</th>' +
          '<th style="padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Metric</th>' +
          (isSU ? '<th style="padding:5px 8px;background:var(--table-header);font-size:10px"></th>' : '') +
          '</tr></thead><tbody>' +
          li.map(function(item) {
            const isPrimary = item.id === contract.primaryLineItemId;
            return '<tr>' +
              '<td>' + item.description + (isPrimary ? ' <span class="user-badge" style="background:var(--gold);color:#000;font-size:9px">PRIMARY</span>' : '') + '</td>' +
              '<td class="text-right muted">' + item.quantity + '</td>' +
              '<td class="text-right muted">' + UTILS.formatCurrency(item.unitCost) + '</td>' +
              '<td class="text-right">' + UTILS.formatCurrency(item.total) + '</td>' +
              '<td class="muted">' + (item.metricQuantity || item.quantity) + ' ' + (item.metricType || '') + '</td>' +
              (isSU ? '<td><button class="action-btn btn-sm" onclick="DETAIL.setPrimary(\'' + contract.id + '\',\'' + item.id + '\')" title="Set as primary metric">&#9733;</button></td>' : '') +
            '</tr>';
          }).join('') + '</tbody></table>';
      }
      const c = contract.costs;
      liHtml += '<table class="cost-summary-table"><tbody>' +
        '<tr><td class="text-muted">BA8 Portion</td><td>' + UTILS.formatCurrency(c.ba8Portion) + '</td></tr>' +
        '<tr><td class="text-muted">ARCYBER Portion</td><td>' + UTILS.formatCurrency(c.arcyberPortion) + '</td></tr>' +
        '<tr><td class="text-muted">ITEMS Fee (1%)</td><td>' + UTILS.formatCurrency(c.itemsFee) + '</td></tr>' +
        '<tr><td class="text-muted">GSA Fee (2%)</td><td>' + UTILS.formatCurrency(c.gsaFee) + '</td></tr>' +
        '<tr class="cost-summary-total"><td>Total Current Cost</td><td>' + UTILS.formatCurrency(c.totalCurrentCost) + '</td></tr>' +
        '<tr><td class="text-muted">Projected Next FY</td><td>' + UTILS.formatCurrency(c.projectedNextFY) + '</td></tr>' +
      '</tbody></table>';
      document.getElementById('detailCostBody').innerHTML = liHtml;
    }

    // Documents (superuser only)
    const docsSection = document.getElementById('detailDocsSection');
    docsSection.classList.toggle('hidden', !isSU);
    if (isSU) {
      const docs = contract.documents || {};
      const otherLinks = (docs.other || []).map(function(d) {
        return '<div><a href="' + (d.url || d) + '" target="_blank">' + (d.label || 'Document') + '</a></div>';
      }).join('');
      document.getElementById('detailDocsBody').innerHTML =
        '<div class="detail-grid">' +
          '<span class="detail-label">DD-250</span><span class="detail-value">' + (docs.dd250 ? '<a href="' + docs.dd250 + '" target="_blank">View</a>' : '<span class="text-muted">Not uploaded</span>') + '</span>' +
          '<span class="detail-label">RIP</span><span class="detail-value">' + (docs.rip ? '<a href="' + docs.rip + '" target="_blank">View</a>' : '<span class="text-muted">Not uploaded</span>') + '</span>' +
          (otherLinks ? '<span class="detail-label">Other</span><span class="detail-value">' + otherLinks + '</span>' : '') +
        '</div>';
    }

    document.getElementById('detailOverlay').classList.add('active');
  },

  setPrimary: async function(contractId, lineItemId) {
    const contract = DASHBOARD.contracts.find(function(c) { return c.id === contractId; });
    if (!contract) return;
    contract.primaryLineItemId = lineItemId;
    try {
      await API.updateContract(contractId, contract);
      DASHBOARD.contracts = await API.getContracts();
      DASHBOARD.render();
      DETAIL.open(contractId);
    } catch(e) {
      DASHBOARD.showAlert('error', 'Failed to set primary: ' + e.message);
    }
  },

  close: function() {
    document.getElementById('detailOverlay').classList.remove('active');
  }
};

// ─── EDIT MODAL ────────────────────────────────────────────────────────────────

const EDIT = {
  currentId: null,
  isAdding: false,

  open: function(id) {
    this.isAdding = false;
    this.currentId = id;
    const contract = DASHBOARD.contracts.find(function(c) { return c.id === id; });
    if (!contract) return;
    this._populate(contract);
    document.getElementById('editModalTitle').textContent = 'Edit Contract';
    document.getElementById('editOverlay').classList.add('active');
  },

  openAdd: function() {
    this.isAdding = true;
    this.currentId = null;
    this._populate(null);
    document.getElementById('editModalTitle').textContent = 'Add Contract';
    document.getElementById('editOverlay').classList.add('active');
  },

  close: function() {
    document.getElementById('editOverlay').classList.remove('active');
    document.getElementById('editAlert').className = 'alert';
  },

  _populate: function(c) {
    document.getElementById('editForm').reset();
    document.getElementById('editAlert').className = 'alert';
    if (!c) {
      this._renderPOCs([]);
      this._renderLineItems([]);
      this._renderValidators([]);
      document.getElementById('editDocOther').value = '';
      return;
    }
    const f = document.getElementById('editForm');
    f.editName.value         = c.deliveryOrderName || '';
    f.editDONum.value        = c.deliveryOrderNumber || '';
    f.editBA8.value          = c.costs.ba8Portion || 0;
    f.editARCYBER.value      = c.costs.arcyberPortion || 0;
    f.editProjected.value    = c.costs.projectedNextFY || 0;
    f.editPopBegin.value     = c.popBeginDate || '';
    f.editPopEnd.value       = c.popEndDate || '';
    f.editVehicle.value      = c.vehicle || '';
    f.editFacilitatedBy.value = c.facilitatedBy || 'ITEMSS GSA';
    f.editSunsetting.value   = c.sunsetting || 'N/A';
    f.editCapDesc.value      = c.capabilityDescription || '';
    f.editNotes.value        = c.notes || '';
    f.editDD250.value        = (c.documents && c.documents.dd250) || '';
    f.editRIP.value          = (c.documents && c.documents.rip) || '';
    document.getElementById('editDocOther').value = ((c.documents && c.documents.other) || []).map(function(d){ return (d.url || d); }).join('\n');

    // POR supported
    document.querySelectorAll('.por-sup-checkbox').forEach(function(cb) {
      cb.checked = (c.porSupported || []).includes(cb.value);
    });
    // POR funded by
    document.querySelectorAll('.por-fund-checkbox').forEach(function(cb) {
      cb.checked = (c.porFundedBy || []).includes(cb.value);
    });

    this._updateFeeDisplay(c.costs.ba8Portion, c.costs.arcyberPortion);
    this._renderPOCs(c.vendorPOCs || []);
    this._renderLineItems(c.lineItems || []);
    this._renderValidators(c.validators || []);
  },

  _updateFeeDisplay: function(ba8, arcyber) {
    const fees = UTILS.recalcCosts(ba8, arcyber);
    document.getElementById('calcItemsFee').textContent = UTILS.formatCurrency(fees.itemsFee);
    document.getElementById('calcGsaFee').textContent   = UTILS.formatCurrency(fees.gsaFee);
    document.getElementById('calcTotal').textContent    = UTILS.formatCurrency(fees.total);
  },

  _renderPOCs: function(pocs) {
    const c = document.getElementById('pocContainer');
    c.innerHTML = '';
    if (pocs.length === 0) { this._addPOCRow({}); return; }
    pocs.forEach(function(p) { EDIT._addPOCRow(p); });
  },

  _addPOCRow: function(poc) {
    const el = document.createElement('div');
    el.className = 'poc-entry';
    el.innerHTML = '<div class="poc-header">POC <button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'.poc-entry\').remove()">Remove</button></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Name</label><input class="form-control poc-name" type="text" value="' + (poc.name||'') + '" placeholder="Full Name"></div>' +
        '<div class="form-group"><label class="form-label">Email</label><input class="form-control poc-email" type="text" value="' + (poc.email||'') + '" placeholder="email@vendor.com"></div>' +
        '<div class="form-group"><label class="form-label">Phone</label><input class="form-control poc-phone" type="text" value="' + (poc.phone||'') + '" placeholder="571-555-0000"></div>' +
      '</div>';
    document.getElementById('pocContainer').appendChild(el);
  },

  _renderLineItems: function(items) {
    const metricOptions = CONFIG.METRIC_TYPES.map(function(m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
    document.getElementById('lineItemsTbody').innerHTML = items.map(function(li) {
      return '<tr>' +
        '<td><input class="form-control li-desc" type="text" value="' + (li.description||'') + '" placeholder="Description"></td>' +
        '<td><input class="form-control li-qty" type="number" value="' + (li.quantity||1) + '" min="0" style="width:70px" onchange="EDIT._updateLITotal(this)"></td>' +
        '<td><input class="form-control li-unit" type="number" value="' + (li.unitCost||0) + '" min="0" onchange="EDIT._updateLITotal(this)"></td>' +
        '<td><input class="form-control li-total" type="number" value="' + (li.total||0) + '" readonly style="background:#0a0e0a"></td>' +
        '<td><select class="form-control li-metric-type" style="min-width:100px"><option value="">— metric —</option>' + metricOptions + '</select></td>' +
        '<td><input class="form-control li-metric-qty" type="number" value="' + (li.metricQuantity||li.quantity||0) + '" placeholder="qty" style="width:70px"></td>' +
        '<td><button type="button" class="action-btn" onclick="this.closest(\'tr\').remove()">&#10005;</button></td>' +
      '</tr>';
    }).join('');
    // Set metric type select values
    const rows = document.querySelectorAll('#lineItemsTbody tr');
    items.forEach(function(li, i) {
      if (rows[i]) {
        const sel = rows[i].querySelector('.li-metric-type');
        if (sel && li.metricType) sel.value = li.metricType;
      }
    });
  },

  _updateLITotal: function(input) {
    const row = input.closest('tr');
    const qty  = parseFloat(row.querySelector('.li-qty').value) || 0;
    const unit = parseFloat(row.querySelector('.li-unit').value) || 0;
    row.querySelector('.li-total').value = qty * unit;
  },

  addLineItem: function() {
    const metricOptions = CONFIG.METRIC_TYPES.map(function(m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input class="form-control li-desc" type="text" placeholder="Description"></td>' +
      '<td><input class="form-control li-qty" type="number" value="1" min="0" style="width:70px" onchange="EDIT._updateLITotal(this)"></td>' +
      '<td><input class="form-control li-unit" type="number" value="0" min="0" onchange="EDIT._updateLITotal(this)"></td>' +
      '<td><input class="form-control li-total" type="number" value="0" readonly style="background:#0a0e0a"></td>' +
      '<td><select class="form-control li-metric-type" style="min-width:100px"><option value="">— metric —</option>' + metricOptions + '</select></td>' +
      '<td><input class="form-control li-metric-qty" type="number" value="0" placeholder="qty" style="width:70px"></td>' +
      '<td><button type="button" class="action-btn" onclick="this.closest(\'tr\').remove()">&#10005;</button></td>';
    document.getElementById('lineItemsTbody').appendChild(tr);
  },

  addPOC: function() { this._addPOCRow({}); },

  _renderValidators: function(emails) {
    const c = document.getElementById('validatorContainer');
    c.innerHTML = '';
    emails.forEach(function(email) { EDIT._addValidatorRow(email); });
  },

  _addValidatorRow: function(email) {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;gap:8px;margin-bottom:6px';
    el.innerHTML = '<input class="form-control validator-email" type="email" value="' + (email||'') + '" placeholder="validator@army.mil" style="flex:1">' +
      '<button type="button" class="action-btn" onclick="this.parentElement.remove()">&#10005;</button>';
    document.getElementById('validatorContainer').appendChild(el);
  },

  addValidator: function() { this._addValidatorRow(''); },

  _collectForm: function() {
    const f = document.getElementById('editForm');
    const ba8     = parseFloat(f.editBA8.value) || 0;
    const arcyber = parseFloat(f.editARCYBER.value) || 0;
    const fees    = UTILS.recalcCosts(ba8, arcyber);

    const pocs = Array.from(document.querySelectorAll('.poc-entry')).map(function(el) {
      return { name: el.querySelector('.poc-name').value.trim(), email: el.querySelector('.poc-email').value.trim(), phone: el.querySelector('.poc-phone').value.trim() };
    }).filter(function(p) { return p.name || p.email; });

    const lineItems = Array.from(document.querySelectorAll('#lineItemsTbody tr')).map(function(tr) {
      const qty  = parseFloat(tr.querySelector('.li-qty').value) || 0;
      const unit = parseFloat(tr.querySelector('.li-unit').value) || 0;
      return {
        description: tr.querySelector('.li-desc').value.trim(),
        quantity: qty, unitCost: unit, total: qty * unit,
        metricType: tr.querySelector('.li-metric-type').value,
        metricQuantity: parseFloat(tr.querySelector('.li-metric-qty').value) || qty,
      };
    }).filter(function(li) { return li.description; });

    const porSupported = Array.from(document.querySelectorAll('.por-sup-checkbox:checked')).map(function(cb) { return cb.value; });
    const porFundedBy  = Array.from(document.querySelectorAll('.por-fund-checkbox:checked')).map(function(cb) { return cb.value; });
    const validators   = Array.from(document.querySelectorAll('.validator-email')).map(function(el) { return el.value.trim(); }).filter(Boolean);

    const otherRaw = document.getElementById('editDocOther').value.trim();
    const other = otherRaw ? otherRaw.split('\n').map(function(s){ return s.trim(); }).filter(Boolean).map(function(u){ return { url: u, label: 'Document' }; }) : [];

    return {
      deliveryOrderName:    f.editName.value.trim(),
      deliveryOrderNumber:  f.editDONum.value.trim(),
      vehicle:              f.editVehicle.value,
      facilitatedBy:        f.editFacilitatedBy.value.trim(),
      sunsetting:           f.editSunsetting.value.trim(),
      capabilityDescription: f.editCapDesc.value.trim(),
      porSupported, porFundedBy,
      costs: { ba8Portion: ba8, arcyberPortion: arcyber, itemsFee: fees.itemsFee, gsaFee: fees.gsaFee, totalCurrentCost: fees.total, projectedNextFY: parseFloat(f.editProjected.value) || 0 },
      popBeginDate: f.editPopBegin.value,
      popEndDate:   f.editPopEnd.value,
      lineItems, vendorPOCs: pocs, validators,
      documents: { dd250: f.editDD250.value.trim(), rip: f.editRIP.value.trim(), other },
      notes: f.editNotes.value.trim(),
    };
  },

  save: async function() {
    const data = this._collectForm();
    if (!data.deliveryOrderName) { this.showAlert('error', 'Delivery Order Name is required.'); return; }

    DASHBOARD.showLoading(true);
    try {
      if (this.isAdding) {
        await API.createContract(data);
      } else {
        await API.updateContract(this.currentId, data);
      }
      this.close();
      DASHBOARD.contracts = await API.getContracts();
      DASHBOARD.render();
      DASHBOARD.showAlert('success', 'Contract saved.');
    } catch(e) {
      this.showAlert('error', 'Save failed: ' + e.message);
    } finally {
      DASHBOARD.showLoading(false);
    }
  },

  showAlert: function(type, msg) {
    const el = document.getElementById('editAlert');
    el.textContent = msg;
    el.className = 'alert alert-' + type + ' visible';
  }
};
