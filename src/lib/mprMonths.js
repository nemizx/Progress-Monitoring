function toDateOnly(value) {
  const d = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatYmd(date) {
  const d = toDateOnly(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthId(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function makeMonth(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const label = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return {
    id: monthId(year, monthIndex),
    label,
    startDate: formatYmd(start),
    endDate: formatYmd(end),
  };
}

/**
 * Calendar months around today (newest first).
 * Default window: 12 months back through 1 month forward.
 */
export function getMprMonthsList({ monthsBack = 12, monthsForward = 1, asOfDate = new Date() } = {}) {
  const asOf = toDateOnly(asOfDate);
  const months = [];
  for (let offset = monthsForward; offset >= -monthsBack; offset -= 1) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() + offset, 1);
    months.push(makeMonth(d.getFullYear(), d.getMonth()));
  }
  return months;
}

/** Default to the month containing today. */
export function getDefaultMprMonthId(months, asOfDate = new Date()) {
  if (!months?.length) return '';
  const currentId = monthId(toDateOnly(asOfDate).getFullYear(), toDateOnly(asOfDate).getMonth());
  return months.find((m) => m.id === currentId)?.id || months[0].id;
}

/** 'YYYY-MM' -> previous 'YYYY-MM'. */
export function getPreviousMonthId(monthIdValue) {
  if (!monthIdValue) return '';
  const [year, month] = monthIdValue.split('-').map(Number);
  if (!year || !month) return '';
  const d = new Date(year, month - 1 - 1, 1);
  return monthId(d.getFullYear(), d.getMonth());
}

/** Number of calendar days in a 'YYYY-MM' month. */
export function getDaysInMonthId(monthIdValue) {
  if (!monthIdValue) return 0;
  const [year, month] = monthIdValue.split('-').map(Number);
  if (!year || !month) return 0;
  return new Date(year, month, 0).getDate();
}
