// js/export.js — CSV and Excel export for DCO CMS

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
    { key: 'por',                 label: 'POR(s)' },
    { key: 'popBeginDate',        label: 'PoP Begin' },
    { key: 'popEndDate',          label: 'PoP End' },
    { key: 'notes',               label: 'Notes' }
  ],

  // Columns available to regular users
  REGULAR_COLS: [
    { key: 'rowNum',              label: '#' },
    { key: 'deliveryOrderName',   label: 'Delivery Order Name' },
    { key: 'deliveryOrderNumber', label: 'DO #' },
    { key: 'por',                 label: 'POR(s)' },
    { key: 'popBeginDate',        label: 'PoP Begin' },
    { key: 'popEndDate',          label: 'PoP End' }
  ],

  // Extract a flat row object from a contract for a given column list
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
      por:                 (contract.por || []).join('; '),
      popBeginDate:        contract.popBeginDate,
      popEndDate:          contract.popEndDate,
      notes:               contract.notes || ''
    };
  },

  // Export as CSV file download
  toCSV: function(contracts, isSuperuser) {
    const cols = isSuperuser ? this.SUPER_COLS : this.REGULAR_COLS;
    const rows = contracts.map((c, i) => this._buildRow(c, i));

    const header = cols.map(c => '"' + c.label + '"').join(',');
    const body = rows.map(row =>
      cols.map(c => {
        const val = row[c.key] === null || row[c.key] === undefined ? '' : row[c.key];
        return '"' + String(val).replace(/"/g, '""') + '"';
      }).join(',')
    ).join('\n');

    const csv = header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const today = new Date().toISOString().slice(0, 10);
    this._download(blob, 'dco-contracts-' + today + '.csv');
  },

  // Export as Excel (.xlsx) using SheetJS
  toExcel: function(contracts, isSuperuser) {
    if (typeof XLSX === 'undefined') {
      alert('Excel export library not loaded. Please check your internet connection.');
      return;
    }

    const cols = isSuperuser ? this.SUPER_COLS : this.REGULAR_COLS;
    const rows = contracts.map((c, i) => this._buildRow(c, i));

    // Build array of arrays: header row + data rows
    const wsData = [
      cols.map(c => c.label),
      ...rows.map(row => cols.map(c => {
        const val = row[c.key];
        return val === null || val === undefined ? '' : val;
      }))
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Bold header row
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: col })];
      if (cell) {
        cell.s = { font: { bold: true } };
      }
    }

    // Auto column widths (approximate)
    ws['!cols'] = cols.map(c => ({ wch: Math.max(c.label.length + 4, 16) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DCO Contracts');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, 'dco-contracts-' + today + '.xlsx');
  },

  // Trigger browser file download
  _download: function(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Parse uploaded CSV or Excel file → array of contract-shaped objects
  // Maps columns by header name (case-insensitive, trimmed)
  parseUpload: function(file, callback) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const text = e.target.result;
          const result = EXPORT._parseCSVText(text);
          callback(null, result);
        } catch(err) {
          callback(err, null);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
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
      callback(new Error('Unsupported file type. Please upload a .csv or .xlsx file.'), null);
    }
  },

  _parseCSVText: function(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('File appears empty.');
    const headers = EXPORT._parseCSVRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = EXPORT._parseCSVRow(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
      rows.push(obj);
    }
    return EXPORT._mapRows(rows);
  },

  _parseCSVRow: function(line) {
    const result = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  },

  // Map spreadsheet row objects (with human-readable column names) to partial contract objects.
  // Merge strategy: match by DO # if present; otherwise append as new.
  _mapRows: function(rows) {
    // Column name → field mapping (case-insensitive)
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
