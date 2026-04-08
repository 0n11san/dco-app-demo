// js/export.js — Excel export/import for DCO CMS (CSV removed; Excel only)

const EXPORT = {

  // Columns available to superusers
  SUPER_COLS: [
    { key: 'rowNum',              label: '#' },
    { key: 'deliveryOrderName',   label: 'Delivery Order Name' },
    { key: 'deliveryOrderNumber', label: 'DO #' },
    { key: 'vendorPOCs',          label: 'Vendor POC(s)' },
    { key: 'vendorEmail',         label: 'Vendor Email' },
    { key: 'vendorPhone',         label: 'Vendor Phone' },
    { key: 'ba8Portion',          label: 'BA8 Portion ($)' },
    { key: 'arcyberPortion',      label: 'ARCYBER Portion ($)' },
    { key: 'itemsFee',            label: 'ITEMS Fee 1% ($)' },
    { key: 'gsaFee',              label: 'GSA Fee 2% ($)' },
    { key: 'totalCurrentCost',    label: 'Total Current Cost ($)' },
    { key: 'projectedNextFY',     label: 'Projected Next FY ($)' },
    { key: 'por',                    label: 'POR(s)' },
    { key: 'popBeginDate',           label: 'PoP Begin' },
    { key: 'popEndDate',             label: 'PoP End' },
    { key: 'capabilityDescription',  label: 'Capability Description' },
    { key: 'notes',                  label: 'Notes' }
  ],

  // Columns available to regular users
  REGULAR_COLS: [
    { key: 'rowNum',                 label: '#' },
    { key: 'deliveryOrderName',      label: 'Delivery Order Name' },
    { key: 'deliveryOrderNumber',    label: 'DO #' },
    { key: 'por',                    label: 'POR(s)' },
    { key: 'popBeginDate',           label: 'PoP Begin' },
    { key: 'popEndDate',             label: 'PoP End' },
    { key: 'capabilityDescription',  label: 'Capability Description' }
  ],

  // Extract a flat row object from a contract
  _buildRow: function(contract, idx) {
    return {
      rowNum:              idx + 1,
      deliveryOrderName:   contract.deliveryOrderName,
      deliveryOrderNumber: contract.deliveryOrderNumber,
      vendorPOCs:          (contract.vendorPOCs || []).map(p => p.name).join('; '),
      vendorEmail:         (contract.vendorPOCs || []).map(p => p.email).join('; '),
      vendorPhone:         (contract.vendorPOCs || []).map(p => p.phone).join('; '),
      ba8Portion:          contract.costs.ba8Portion,
      arcyberPortion:      contract.costs.arcyberPortion,
      itemsFee:            contract.costs.itemsFee,
      gsaFee:              contract.costs.gsaFee,
      totalCurrentCost:    contract.costs.totalCurrentCost,
      projectedNextFY:     contract.costs.projectedNextFY,
      por:                    (contract.porSupported || contract.por || []).join('; '),
      popBeginDate:           contract.popBeginDate,
      popEndDate:             contract.popEndDate,
      capabilityDescription:  contract.capabilityDescription || '',
      notes:                  contract.notes || ''
    };
  },

  // Export as Excel (.xlsx) using SheetJS
  toExcel: function(contracts, isSuperuser) {
    if (typeof XLSX === 'undefined') {
      alert('Excel export library not loaded. Please check your internet connection.');
      return;
    }

    const cols = isSuperuser ? this.SUPER_COLS : this.REGULAR_COLS;
    const rows = contracts.map((c, i) => this._buildRow(c, i));

    const wsData = [
      cols.map(c => c.label),
      ...rows.map(row => cols.map(c => {
        const val = row[c.key];
        return val === null || val === undefined ? '' : val;
      }))
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = cols.map(c => ({ wch: Math.max(c.label.length + 4, 16) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DCO Contracts');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, 'dco-contracts-' + today + '.xlsx');
  },

  // Parse uploaded Excel file → array of contract-shaped objects
  parseUpload: function(file, callback) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      if (typeof XLSX === 'undefined') {
        callback(new Error('Excel library not loaded.'), null);
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          const result = EXPORT._mapRows(rows);
          callback(null, result);
        } catch(err) {
          callback(err, null);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      callback(new Error('Unsupported file type. Please upload a .xlsx file.'), null);
    }
  },

  // Map spreadsheet row objects (with human-readable column names) to partial contract objects.
  _mapRows: function(rows) {
    const fieldMap = {
      'delivery order name':    'deliveryOrderName',
      'do #':                   'deliveryOrderNumber',
      'do#':                    'deliveryOrderNumber',
      'delivery order number':  'deliveryOrderNumber',
      'por(s)':                 'por',
      'por':                    'por',
      'pop begin':              'popBeginDate',
      'pop begin date':         'popBeginDate',
      'pop end':                'popEndDate',
      'pop end date':           'popEndDate',
      'notes':                  'notes',
      'projected next fy ($)':  'projectedNextFY',
      'projected next fy':      'projectedNextFY',
      'ba8 portion ($)':        'ba8Portion',
      'ba8 portion':            'ba8Portion',
      'arcyber portion ($)':    'arcyberPortion',
      'arcyber portion':        'arcyberPortion',
    };

    return rows.map(function(row) {
      const out = {};
      Object.keys(row).forEach(function(col) {
        const normalised = col.toLowerCase().trim();
        const field = fieldMap[normalised];
        if (field) out[field] = row[col];
      });
      return out;
    }).filter(r => r.deliveryOrderName || r.deliveryOrderNumber);
  }
};
