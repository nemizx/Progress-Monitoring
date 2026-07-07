export function formatCurrencyINR(value, options = {}) {
  const num = Number(value) || 0;
  // Use Intl.NumberFormat for Indian grouping and INR symbol
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: options.decimals ?? 0 }).format(num);
}

export function formatCompactCurrencyINR(value) {
  const val = Number(value) || 0;
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  
  let formatted = '';
  if (absVal >= 1e7) {
    formatted = `₹${(absVal / 1e7).toFixed(2)} Cr`;
  } else if (absVal >= 1e5) {
    formatted = `₹${(absVal / 1e5).toFixed(2)} L`;
  } else {
    formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(absVal);
  }
  
  return isNegative ? `-${formatted}` : formatted;
}

export function formatNumberIndian(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatDateIndian(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Normalize API/DB date values to YYYY-MM-DD for reliable comparisons. */
export function normalizeDateKey(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const isoPrefix = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoPrefix) {
      if (value.length === 10) return isoPrefix[1];
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - offset * 60 * 1000);
        return localDate.toISOString().split('T')[0];
      }
      return isoPrefix[1];
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}
