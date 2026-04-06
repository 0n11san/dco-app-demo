// js/utils.js — Shared formatting utilities

const UTILS = {

  // Format a YYYY-MM-DD string as "01 OCT 2024"
  formatDate: function(dateStr) {
    if (!dateStr) return '—';
    const months = ['JAN','FEB','MAR','APR','MAY','JUN',
                    'JUL','AUG','SEP','OCT','NOV','DEC'];
    const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone shift
    if (isNaN(d)) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    return dd + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  },

  // Format a number as $1,234,567
  formatCurrency: function(n) {
    if (n === null || n === undefined || n === '') return '—';
    return '$' + Number(n).toLocaleString('en-US');
  },

  // Generate a simple unique ID
  generateId: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // Recalculate fees from ba8 + arcyber portions
  recalcCosts: function(ba8, arcyber) {
    const base = (parseFloat(ba8) || 0) + (parseFloat(arcyber) || 0);
    const itemsFee = Math.round(base * 0.01);
    const gsaFee   = Math.round(base * 0.02);
    const total    = base + itemsFee + gsaFee;
    return { itemsFee, gsaFee, total };
  }
};
