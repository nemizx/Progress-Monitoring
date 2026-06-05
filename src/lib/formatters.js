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
