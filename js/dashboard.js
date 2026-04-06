// js/dashboard.js — Dashboard and modal logic for DCO CMS

const DASHBOARD = {
  contracts: [],
  sha: null,
  session: null,

  init: async function() {
    this.session = AUTH.requireAuth();
    if (!this.session) return;

    const isSU = this.session.role === 'superuser';

    document.getElementById('navUsername').textContent = this.session.username;
    document.getElementById('navRoleBadge').textContent = isSU ? 'Superuser' : 'User';
    document.getElementById('logoutBtn').addEventListener('click', function() { AUTH.logout(); });

    // Show/hide superuser controls
    document.querySelectorAll('.su-only').forEach(function(el) {
      el.classList.toggle('hidden', !isSU);
    });

    // Wire export buttons
    document.getElementById('btnExportCSV').addEventListener('click', function() {
      EXPORT.toCSV(DASHBOARD.contracts, isSU);
    });
    document.getElementById('btnExportExcel').addEventListener('click', function() {
      EXPORT.toExcel(DASHBOARD.contracts, isSU);
    });

    // Wire upload
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

      document.getElementById('btnAddContract').addEventListener('click', function() {
        EDIT.openAdd();
      });
    }

    // Close modals on overlay click
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
      const result = await GITHUB_API.getContracts();
      this.contracts = result.contracts;
      this.sha = result.sha;
      this.render();
    } catch(err) {
      this.showAlert('error', 'Failed to load contracts: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  render: function() {
    const isSU = this.session.role === 'superuser';
    const tbody = document.getElementById('contractTbody');
    const countEl = document.getElementById('contractCount');
    countEl.textContent = this.contracts.length + ' contract' + (this.contracts.length !== 1 ? 's' : '');

    tbody.innerHTML = this.contracts.map(function(c, idx) {
      const porHtml = (c.por || []).map(function(p) {
        return '<span class="por-tag">' + p + '</span>';
      }).join('');

      let row = '<tr data-id="' + c.id + '" onclick="DETAIL.open(DASHBOARD.contracts.find(function(x){return x.id===\'' + c.id + '\';}))">' +
        '<td class="row-num">' + (idx + 1) + '</td>' +
        '<td><strong>' + c.deliveryOrderName + '</strong></td>' +
        '<td class="muted">' + c.deliveryOrderNumber + '</td>';

      if (isSU) {
        const poc = (c.vendorPOCs && c.vendorPOCs[0]) || {};
        const extraPOCs = c.vendorPOCs && c.vendorPOCs.length > 1 ? ' <span class="text-muted">(+' + (c.vendorPOCs.length - 1) + ')</span>' : '';
        row += '<td>' + (poc.name || '—') + extraPOCs + '</td>' +
          '<td class="muted">' + (poc.email || '—') + '</td>' +
          '<td class="muted">' + (poc.phone || '—') + '</td>' +
          '<td class="text-right">' + UTILS.formatCurrency(c.costs.ba8Portion) + '</td>' +
          '<td class="text-right">' + UTILS.formatCurrency(c.costs.arcyberPortion) + '</td>' +
          '<td class="text-right muted">' + UTILS.formatCurrency(c.costs.itemsFee) + '</td>' +
          '<td class="text-right muted">' + UTILS.formatCurrency(c.costs.gsaFee) + '</td>' +
          '<td class="text-right text-gold fw-bold">' + UTILS.formatCurrency(c.costs.totalCurrentCost) + '</td>' +
          '<td class="text-right">' + UTILS.formatCurrency(c.costs.projectedNextFY) + '</td>';
      }

      row += '<td>' + porHtml + '</td>' +
        '<td class="muted">' + UTILS.formatDate(c.popBeginDate) + '</td>' +
        '<td class="muted">' + UTILS.formatDate(c.popEndDate) + '</td>';

      if (isSU) {
        row += '<td onclick="event.stopPropagation()">' +
          '<button class="action-btn" onclick="EDIT.open(\'' + c.id + '\')" title="Edit contract">&#9998;</button>' +
          '</td>';
      }

      row += '</tr>';
      return row;
    }).join('');
  },

  // Merge uploaded rows into contracts array (match by DO # if found, else append)
  mergeUploaded: async function(parsed) {
    let added = 0, updated = 0;
    parsed.forEach(function(row) {
      const existing = DASHBOARD.contracts.find(function(c) {
        return c.deliveryOrderNumber && row.deliveryOrderNumber &&
          c.deliveryOrderNumber.trim() === row.deliveryOrderNumber.trim();
      });
      if (existing) {
        // Update only provided fields
        if (row.deliveryOrderName)  existing.deliveryOrderName = row.deliveryOrderName;
        if (row.popBeginDate)       existing.popBeginDate = row.popBeginDate;
        if (row.popEndDate)         existing.popEndDate = row.popEndDate;
        if (row.por)                existing.por = row.por.split(';').map(function(s){ return s.trim(); }).filter(Boolean);
        if (row.notes !== undefined) existing.notes = row.notes;
        if (row.ba8Portion)         existing.costs.ba8Portion = parseFloat(row.ba8Portion) || existing.costs.ba8Portion;
        if (row.arcyberPortion)     existing.costs.arcyberPortion = parseFloat(row.arcyberPortion) || existing.costs.arcyberPortion;
        if (row.projectedNextFY)    existing.costs.projectedNextFY = parseFloat(row.projectedNextFY) || existing.costs.projectedNextFY;
        // Recalc fees
        const fees = UTILS.recalcCosts(existing.costs.ba8Portion, existing.costs.arcyberPortion);
        existing.costs.itemsFee = fees.itemsFee;
        existing.costs.gsaFee = fees.gsaFee;
        existing.costs.totalCurrentCost = fees.total;
        updated++;
      } else if (row.deliveryOrderName) {
        // Append new contract with defaults
        const ba8 = parseFloat(row.ba8Portion) || 0;
        const arc = parseFloat(row.arcyberPortion) || 0;
        const fees = UTILS.recalcCosts(ba8, arc);
        DASHBOARD.contracts.push({
          id: UTILS.generateId(),
          deliveryOrderName: row.deliveryOrderName,
          deliveryOrderNumber: row.deliveryOrderNumber || '',
          vendorPOCs: [],
          costs: {
            ba8Portion: ba8,
            arcyberPortion: arc,
            itemsFee: fees.itemsFee,
            gsaFee: fees.gsaFee,
            totalCurrentCost: fees.total,
            projectedNextFY: parseFloat(row.projectedNextFY) || 0
          },
          por: row.por ? row.por.split(';').map(function(s){ return s.trim(); }).filter(Boolean) : [],
          popBeginDate: row.popBeginDate || '',
          popEndDate: row.popEndDate || '',
          lineItems: [],
          documents: { dd250: '', rip: '', other: [] },
          notes: row.notes || ''
        });
        added++;
      }
    });

    this.showAlert('info', 'Parsed: ' + updated + ' updated, ' + added + ' added. Saving...');
    await this.save();
  },

  save: async function() {
    this.showLoading(true);
    try {
      const token = this.session.githubToken;
      this.sha = await GITHUB_API.saveContracts(this.contracts, this.sha, token);
      this.render();
      this.showAlert('success', 'Contracts saved successfully.');
    } catch(err) {
      this.showAlert('error', 'Save failed: ' + err.message);
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
    if (type === 'success') {
      setTimeout(function() { el.classList.remove('visible'); }, 4000);
    }
  }
};

// ─── DETAIL MODAL ───────────────────────────────────────────────────────────

const DETAIL = {
  open: function(contract) {
    if (!contract) return;
    const session = AUTH.getSession();
    const isSU = session && session.role === 'superuser';

    document.getElementById('detailTitle').textContent = contract.deliveryOrderName;
    document.getElementById('detailSubtitle').textContent = contract.deliveryOrderNumber;

    // Vendor section
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

    // Contract details
    document.getElementById('detailInfoBody').innerHTML =
      '<div class="detail-grid">' +
        '<span class="detail-label">POR(s)</span><span class="detail-value">' +
          (contract.por || []).map(function(p){ return '<span class="por-tag">' + p + '</span>'; }).join('') +
        '</span>' +
        '<span class="detail-label">PoP Begin</span><span class="detail-value">' + UTILS.formatDate(contract.popBeginDate) + '</span>' +
        '<span class="detail-label">PoP End</span><span class="detail-value">' + UTILS.formatDate(contract.popEndDate) + '</span>' +
        (contract.notes ? '<span class="detail-label">Notes</span><span class="detail-value">' + contract.notes + '</span>' : '') +
      '</div>';

    // Line items + cost — hidden for regular users
    const costSection = document.getElementById('detailCostSection');
    costSection.classList.toggle('hidden', !isSU);
    if (isSU) {
      const li = contract.lineItems || [];
      let liHtml = '';
      if (li.length > 0) {
        liHtml = '<table class="cost-summary-table" style="margin-bottom:12px">' +
          '<thead><tr>' +
            '<th style="text-align:left;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Description</th>' +
            '<th style="text-align:right;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Qty</th>' +
            '<th style="text-align:right;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Unit Cost</th>' +
            '<th style="text-align:right;padding:5px 8px;background:var(--table-header);color:var(--text-muted);font-size:10px;text-transform:uppercase">Total</th>' +
          '</tr></thead><tbody>' +
          li.map(function(item) {
            return '<tr>' +
              '<td>' + item.description + '</td>' +
              '<td class="text-right muted">' + item.quantity + '</td>' +
              '<td class="text-right muted">' + UTILS.formatCurrency(item.unitCost) + '</td>' +
              '<td class="text-right">' + UTILS.formatCurrency(item.total) + '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table>';
      }

      const c = contract.costs;
      liHtml += '<table class="cost-summary-table">' +
        '<tbody>' +
          '<tr><td class="text-muted">BA8 Portion</td><td>' + UTILS.formatCurrency(c.ba8Portion) + '</td></tr>' +
          '<tr><td class="text-muted">ARCYBER Portion</td><td>' + UTILS.formatCurrency(c.arcyberPortion) + '</td></tr>' +
          '<tr><td class="text-muted">ITEMS Fee (1%)</td><td>' + UTILS.formatCurrency(c.itemsFee) + '</td></tr>' +
          '<tr><td class="text-muted">GSA Fee (2%)</td><td>' + UTILS.formatCurrency(c.gsaFee) + '</td></tr>' +
          '<tr class="cost-summary-total"><td>Total Current Cost</td><td>' + UTILS.formatCurrency(c.totalCurrentCost) + '</td></tr>' +
          '<tr><td class="text-muted">Projected Next FY</td><td>' + UTILS.formatCurrency(c.projectedNextFY) + '</td></tr>' +
        '</tbody></table>';

      document.getElementById('detailCostBody').innerHTML = liHtml;
    }

    // Documents — hidden for regular users
    const docsSection = document.getElementById('detailDocsSection');
    docsSection.classList.toggle('hidden', !isSU);
    if (isSU) {
      const docs = contract.documents || {};
      const otherLinks = (docs.other || []).map(function(link, i) {
        return '<div><a href="' + link + '" target="_blank">Document ' + (i + 1) + '</a></div>';
      }).join('');
      document.getElementById('detailDocsBody').innerHTML =
        '<div class="detail-grid">' +
          '<span class="detail-label">DD-250</span><span class="detail-value">' +
            (docs.dd250 ? '<a href="' + docs.dd250 + '" target="_blank">View</a>' : '<span class="text-muted">Not uploaded</span>') +
          '</span>' +
          '<span class="detail-label">RIP</span><span class="detail-value">' +
            (docs.rip ? '<a href="' + docs.rip + '" target="_blank">View</a>' : '<span class="text-muted">Not uploaded</span>') +
          '</span>' +
          (otherLinks ? '<span class="detail-label">Other</span><span class="detail-value">' + otherLinks + '</span>' : '') +
        '</div>';
    }

    document.getElementById('detailOverlay').classList.add('active');
  },

  close: function() {
    document.getElementById('detailOverlay').classList.remove('active');
  }
};

// ─── EDIT MODAL ─────────────────────────────────────────────────────────────

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
    const f = document.getElementById('editForm');
    f.reset();

    document.getElementById('editAlert').className = 'alert';

    if (!c) {
      // Blank form for new contract
      this._renderPOCs([]);
      this._renderLineItems([]);
      document.getElementById('editDocOther').value = '';
      return;
    }

    f.editName.value         = c.deliveryOrderName || '';
    f.editDONum.value        = c.deliveryOrderNumber || '';
    f.editBA8.value          = c.costs.ba8Portion || 0;
    f.editARCYBER.value      = c.costs.arcyberPortion || 0;
    f.editProjected.value    = c.costs.projectedNextFY || 0;
    f.editPopBegin.value     = c.popBeginDate || '';
    f.editPopEnd.value       = c.popEndDate || '';
    f.editNotes.value        = c.notes || '';
    f.editDD250.value        = (c.documents && c.documents.dd250) || '';
    f.editRIP.value          = (c.documents && c.documents.rip)   || '';
    document.getElementById('editDocOther').value = ((c.documents && c.documents.other) || []).join('\n');

    // POR checkboxes
    document.querySelectorAll('.por-checkbox').forEach(function(cb) {
      cb.checked = (c.por || []).includes(cb.value);
    });

    this._updateFeeDisplay(c.costs.ba8Portion, c.costs.arcyberPortion);
    this._renderPOCs(c.vendorPOCs || []);
    this._renderLineItems(c.lineItems || []);
  },

  _updateFeeDisplay: function(ba8, arcyber) {
    const fees = UTILS.recalcCosts(ba8, arcyber);
    document.getElementById('calcItemsFee').textContent  = UTILS.formatCurrency(fees.itemsFee);
    document.getElementById('calcGsaFee').textContent    = UTILS.formatCurrency(fees.gsaFee);
    document.getElementById('calcTotal').textContent     = UTILS.formatCurrency(fees.total);
  },

  _renderPOCs: function(pocs) {
    const container = document.getElementById('pocContainer');
    container.innerHTML = '';
    pocs.forEach(function(poc, idx) { EDIT._addPOCRow(poc, idx); });
    if (pocs.length === 0) EDIT._addPOCRow({}, 0);
  },

  _addPOCRow: function(poc, idx) {
    const container = document.getElementById('pocContainer');
    const count = container.children.length;
    const div = document.createElement('div');
    div.className = 'poc-entry';
    div.innerHTML = '<div class="poc-header">POC ' + (count + 1) +
      '<button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'.poc-entry\').remove()">Remove</button></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Name</label>' +
          '<input class="form-control poc-name" type="text" value="' + (poc.name || '') + '" placeholder="Full Name"></div>' +
        '<div class="form-group"><label class="form-label">Email</label>' +
          '<input class="form-control poc-email" type="text" value="' + (poc.email || '') + '" placeholder="email@vendor.com"></div>' +
        '<div class="form-group"><label class="form-label">Phone</label>' +
          '<input class="form-control poc-phone" type="text" value="' + (poc.phone || '') + '" placeholder="571-555-0000"></div>' +
      '</div>';
    container.appendChild(div);
  },

  _renderLineItems: function(items) {
    const tbody = document.getElementById('lineItemsTbody');
    tbody.innerHTML = items.map(function(item, idx) {
      return '<tr>' +
        '<td><input class="form-control li-desc" type="text" value="' + (item.description||'') + '" placeholder="Description"></td>' +
        '<td><input class="form-control li-qty" type="number" value="' + (item.quantity||1) + '" min="0" style="width:70px" onchange="EDIT._updateLITotal(this)"></td>' +
        '<td><input class="form-control li-unit" type="number" value="' + (item.unitCost||0) + '" min="0" onchange="EDIT._updateLITotal(this)"></td>' +
        '<td><input class="form-control li-total" type="number" value="' + (item.total||0) + '" readonly style="background:#0a0e0a"></td>' +
        '<td><button type="button" class="action-btn" onclick="this.closest(\'tr\').remove()">&#10005;</button></td>' +
      '</tr>';
    }).join('');
  },

  _updateLITotal: function(input) {
    const row = input.closest('tr');
    const qty  = parseFloat(row.querySelector('.li-qty').value)  || 0;
    const unit = parseFloat(row.querySelector('.li-unit').value) || 0;
    row.querySelector('.li-total').value = qty * unit;
  },

  addLineItem: function() {
    const tbody = document.getElementById('lineItemsTbody');
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input class="form-control li-desc" type="text" placeholder="Description"></td>' +
      '<td><input class="form-control li-qty" type="number" value="1" min="0" style="width:70px" onchange="EDIT._updateLITotal(this)"></td>' +
      '<td><input class="form-control li-unit" type="number" value="0" min="0" onchange="EDIT._updateLITotal(this)"></td>' +
      '<td><input class="form-control li-total" type="number" value="0" readonly style="background:#0a0e0a"></td>' +
      '<td><button type="button" class="action-btn" onclick="this.closest(\'tr\').remove()">&#10005;</button></td>';
    tbody.appendChild(tr);
  },

  addPOC: function() {
    const count = document.getElementById('pocContainer').children.length;
    EDIT._addPOCRow({}, count);
  },

  _collectForm: function() {
    const f = document.getElementById('editForm');
    const ba8    = parseFloat(f.editBA8.value)    || 0;
    const arcyber= parseFloat(f.editARCYBER.value) || 0;
    const fees   = UTILS.recalcCosts(ba8, arcyber);

    const pocs = Array.from(document.querySelectorAll('.poc-entry')).map(function(el) {
      return {
        name:  el.querySelector('.poc-name').value.trim(),
        email: el.querySelector('.poc-email').value.trim(),
        phone: el.querySelector('.poc-phone').value.trim()
      };
    }).filter(function(p) { return p.name || p.email; });

    const lineItems = Array.from(document.querySelectorAll('#lineItemsTbody tr')).map(function(tr) {
      const qty  = parseFloat(tr.querySelector('.li-qty').value)   || 0;
      const unit = parseFloat(tr.querySelector('.li-unit').value)  || 0;
      return {
        description: tr.querySelector('.li-desc').value.trim(),
        quantity: qty,
        unitCost: unit,
        total: qty * unit
      };
    }).filter(function(li) { return li.description; });

    const por = Array.from(document.querySelectorAll('.por-checkbox:checked')).map(function(cb) {
      return cb.value;
    });

    const otherRaw = document.getElementById('editDocOther').value.trim();
    const other = otherRaw ? otherRaw.split('\n').map(function(s){return s.trim();}).filter(Boolean) : [];

    return {
      deliveryOrderName:   f.editName.value.trim(),
      deliveryOrderNumber: f.editDONum.value.trim(),
      vendorPOCs: pocs,
      costs: {
        ba8Portion: ba8,
        arcyberPortion: arcyber,
        itemsFee: fees.itemsFee,
        gsaFee: fees.gsaFee,
        totalCurrentCost: fees.total,
        projectedNextFY: parseFloat(f.editProjected.value) || 0
      },
      por: por,
      popBeginDate: f.editPopBegin.value,
      popEndDate:   f.editPopEnd.value,
      lineItems: lineItems,
      documents: {
        dd250: f.editDD250.value.trim(),
        rip:   f.editRIP.value.trim(),
        other: other
      },
      notes: f.editNotes.value.trim()
    };
  },

  save: async function() {
    const data = this._collectForm();
    if (!data.deliveryOrderName) {
      this.showAlert('error', 'Delivery Order Name is required.');
      return;
    }

    if (this.isAdding) {
      data.id = UTILS.generateId();
      DASHBOARD.contracts.push(data);
    } else {
      const idx = DASHBOARD.contracts.findIndex(function(c) { return c.id === EDIT.currentId; });
      if (idx === -1) { this.showAlert('error', 'Contract not found.'); return; }
      data.id = EDIT.currentId;
      DASHBOARD.contracts[idx] = data;
    }

    this.close();
    await DASHBOARD.save();
  },

  showAlert: function(type, msg) {
    const el = document.getElementById('editAlert');
    el.textContent = msg;
    el.className = 'alert alert-' + type + ' visible';
  }
};
