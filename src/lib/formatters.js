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

/**
 * Formats a raw numeric string for display inside a live-typing currency input
 * (Indian grouping, ₹ symbol, preserves an in-progress decimal as the user types).
 * Pair with `parseCurrencyInputValue` to strip formatting back to a raw numeric string on change.
 */
export function formatInputCurrency(val) {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  const match = str.match(/\.(\d*)$/);
  const numericVal = parseFloat(str);
  if (Number.isNaN(numericVal)) return '';

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  if (match) {
    const decimalPart = match[1];
    const integerPart = str.split('.')[0];
    const parsedInt = parseFloat(integerPart) || 0;
    const formattedInt = formatter.format(parsedInt);
    return `${formattedInt}.${decimalPart}`;
  }

  const hasDecimal = str.includes('.');
  const decimals = hasDecimal ? str.split('.')[1].length : 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Math.min(decimals, 2),
  }).format(numericVal);
}

/** Strips a live-typing currency input's raw text value down to a plain numeric string. */
export function parseCurrencyInputValue(rawText) {
  const stripped = String(rawText ?? '').replace(/[^0-9.]/g, '');
  const parts = stripped.split('.');
  return parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
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
