/**
 * WPR week helpers.
 *
 * Rules:
 * - Core week runs Friday → Thursday (inclusive).
 * - Weeks are numbered Week 1..N inside each calendar month.
 * - Month start Mon–Thu (within 4 days before Friday): Week 1 starts on the 1st
 *   and ends on the Thursday of that Friday–Thursday week.
 * - Month start Friday: Week 1 is a normal Fri–Thu week.
 * - Month start Sat/Sun: those days belong to the previous month; Week 1 starts
 *   on this month's first Friday.
 * - Month end leftover days:
 *   - If 1–3 days remain → merge into the previous week
 *   - If more than 3 days remain → create a new week under the same month
 *   Weeks stay inside the month (no spill into the next month).
 */

function toDateOnly(value) {
  const d = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = toDateOnly(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatYmd(date) {
  const d = toDateOnly(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(date) {
  const d = toDateOnly(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(date) {
  const d = toDateOnly(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function inclusiveDayCount(start, end) {
  const a = toDateOnly(start).getTime();
  const b = toDateOnly(end).getTime();
  if (b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

function makeWeek({ weekNum, monthStart, monthLabel, start, end }) {
  const startDate = formatYmd(start);
  const endDate = formatYmd(end);
  return {
    id: `wpr_${startDate}_${endDate}`,
    weekNum,
    monthKey: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
    monthLabel,
    label: `${monthLabel} — Week ${weekNum} (${startDate} to ${endDate})`,
    startDate,
    endDate,
  };
}

function extendLastWeek(weeks, monthEnd, monthStart, monthLabel) {
  if (!weeks.length) return;
  const prev = weeks[weeks.length - 1];
  weeks[weeks.length - 1] = makeWeek({
    weekNum: prev.weekNum,
    monthStart,
    monthLabel,
    start: prev.startDate,
    end: monthEnd,
  });
}

/** Next Friday on or after `date` (Friday = 5). */
export function fridayOnOrAfter(date) {
  const d = toDateOnly(date);
  const day = d.getDay();
  const diff = (5 - day + 7) % 7;
  return addDays(d, diff);
}

/** Thursday closing a Fri→Thu week that starts on `friday`. */
export function thursdayOfWeek(friday) {
  return addDays(toDateOnly(friday), 6);
}

/**
 * Week 1 start date for a calendar month.
 * Mon–Fri → 1st; Sat/Sun → first Friday of the month.
 */
export function getMonthWeek1Start(monthDate) {
  const monthStart = startOfMonth(monthDate);
  const dow = monthStart.getDay();
  if (dow === 0 || dow === 6) return fridayOnOrAfter(monthStart);
  return monthStart;
}

/** Build Week 1..N for one calendar month. */
export function buildWeeksForMonth(monthDate) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthLabel = monthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const week1Start = getMonthWeek1Start(monthStart);
  const week1Friday = fridayOnOrAfter(week1Start);

  const weeks = [];
  let weekNum = 1;
  let cursorStart = week1Start;
  let cursorEnd = thursdayOfWeek(week1Friday);

  while (weekNum <= 6) {
    if (cursorStart > monthEnd) break;

    const daysLeftFromStart = inclusiveDayCount(cursorStart, monthEnd);

    // ≤3 days left at month end → add to previous week
    if (weekNum > 1 && daysLeftFromStart > 0 && daysLeftFromStart <= 3) {
      extendLastWeek(weeks, monthEnd, monthStart, monthLabel);
      break;
    }

    // >3 days left (or Week 1) → this is a week in the same month
    const finalEnd = cursorEnd > monthEnd ? monthEnd : cursorEnd;

    weeks.push(makeWeek({
      weekNum,
      monthStart,
      monthLabel,
      start: cursorStart,
      end: finalEnd,
    }));

    const remStart = addDays(finalEnd, 1);
    if (remStart > monthEnd) break;

    const remDays = inclusiveDayCount(remStart, monthEnd);

    // Leftover after this week closes
    if (remDays <= 3) {
      extendLastWeek(weeks, monthEnd, monthStart, monthLabel);
      break;
    }

    // More than 3 days remain → continue with next week (Fri–Thu or final partial)
    cursorStart = fridayOnOrAfter(remStart);
    if (cursorStart > monthEnd) {
      // Remaining block does not start on Friday but is >3 days — still a new week
      weekNum += 1;
      weeks.push(makeWeek({
        weekNum,
        monthStart,
        monthLabel,
        start: remStart,
        end: monthEnd,
      }));
      break;
    }

    cursorEnd = thursdayOfWeek(cursorStart);
    weekNum += 1;
  }

  return weeks;
}

/**
 * Weeks from the project start month through the current month (newest first).
 */
export function buildWprWeeksList({ projectStartDate, asOfDate = new Date() } = {}) {
  const asOf = toDateOnly(asOfDate);
  const start = projectStartDate
    ? startOfMonth(projectStartDate)
    : startOfMonth(addDays(asOf, -180));

  if (start > startOfMonth(asOf)) {
    return buildWeeksForMonth(asOf).reverse();
  }

  const weeks = [];
  let cursor = new Date(start);
  const lastMonth = startOfMonth(asOf);

  while (cursor.getTime() <= lastMonth.getTime()) {
    weeks.push(...buildWeeksForMonth(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return weeks.reverse();
}

/** Default to the week containing today within the current month. */
export function getDefaultWprWeekId(weeks, asOfDate = new Date()) {
  if (!weeks?.length) return '';
  const asOf = formatYmd(asOfDate);
  const d = toDateOnly(asOfDate);
  const currentMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthWeeks = weeks.filter((w) => w.monthKey === currentMonthKey);
  const pool = monthWeeks.length ? monthWeeks : weeks;
  const containing = pool.find((w) => w.startDate <= asOf && asOf <= w.endDate);
  return containing?.id || pool[0]?.id || weeks[0].id;
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatWprWeekLabel({ weekNum, startDate, endDate }) {
  const startFmt = formatDisplayDate(startDate);
  const endFmt = formatDisplayDate(endDate);
  return `Week ${weekNum} (${startFmt} to ${endFmt})`;
}

export function validateWprWeekConfig({ monthKey, weekNum, startDate, endDate, existingWeeks = [], editingWeekId = null }) {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Start Date and End Date are mandatory.' };
  }

  if (startDate > endDate) {
    return { valid: false, error: 'Start Date cannot be greater than End Date.' };
  }

  const startMonth = String(startDate).slice(0, 7);
  const endMonth = String(endDate).slice(0, 7);

  if (monthKey && (startMonth !== monthKey || endMonth !== monthKey)) {
    const monthLabel = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { valid: false, error: `Both Start Date and End Date must belong to ${monthLabel}.` };
  }

  const otherWeeks = (existingWeeks || []).filter((w) => w.id !== editingWeekId);

  // Check duplicate week number
  const duplicateWeek = otherWeeks.find((w) => Number(w.weekNum) === Number(weekNum));
  if (duplicateWeek) {
    return { valid: false, error: `Week ${weekNum} has already been configured for this month.` };
  }

  // Check date range overlap
  const overlappingWeek = otherWeeks.find((w) => {
    const s1 = startDate;
    const e1 = endDate;
    const s2 = w.startDate;
    const e2 = w.endDate;
    return s1 <= e2 && s2 <= e1;
  });

  if (overlappingWeek) {
    const overlapLabel = formatWprWeekLabel({
      weekNum: overlappingWeek.weekNum,
      startDate: overlappingWeek.startDate,
      endDate: overlappingWeek.endDate,
    });
    return { valid: false, error: `Date range (${startDate} to ${endDate}) overlaps with ${overlapLabel}.` };
  }

  return { valid: true, error: null };
}
