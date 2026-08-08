import { normalizeDateKey } from '@/lib/formatters';

const LABOUR_FIELDS = [
  'carpenter',
  'barbender',
  'mason',
  'skilled_other',
  'carpenter_helper',
  'barbender_helper',
  'semi_skilled_other',
  'mc',
  'fc',
];

export const createEmptyNamedRow = (extra = {}) => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  plan: '',
  achieved: '',
  remark: '',
  ...extra,
});

export const createEmptyMaterialRequisitionRow = (extra = {}) => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  date: '',
  requisitionNo: '',
  name: '',
  unit: '',
  qty: '',
  receivedDate: '',
  remark: '',
  ...extra,
});

export const createEmptyBillToCertifyRow = (extra = {}) => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  billDate: '',
  name: '',
  agencyName: '',
  billAmount: '',
  raBillNo: '',
  remark: '',
  ...extra,
});

export const isRequisitionRowAchieved = (row) => {
  if (!row) return false;
  return Boolean(
    (row.date && String(row.date).trim() !== '') ||
    (row.requisitionNo && String(row.requisitionNo).trim() !== '') ||
    (row.unit && String(row.unit).trim() !== '') ||
    (row.qty !== '' && row.qty != null && String(row.qty).trim() !== '') ||
    (row.receivedDate && String(row.receivedDate).trim() !== '') ||
    (row.remark && String(row.remark).trim() !== '')
  );
};

export const isBillRowAchieved = (row) => {
  if (!row) return false;
  return Boolean(
    (row.billDate && String(row.billDate).trim() !== '') ||
    (row.agencyName && String(row.agencyName).trim() !== '') ||
    (row.billAmount !== '' && row.billAmount != null && String(row.billAmount).trim() !== '') ||
    (row.raBillNo && String(row.raBillNo).trim() !== '') ||
    (row.remark && String(row.remark).trim() !== '')
  );
};

export const calcWprRequisitionSummary = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const plan = list.length;
  const achieved = list.filter(isRequisitionRowAchieved).length;
  return { plan, achieved, autoPlan: plan, autoAchieved: achieved };
};

export const calcWprBillSummary = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const plan = list.length;
  const achieved = list.filter(isBillRowAchieved).length;
  return { plan, achieved, autoPlan: plan, autoAchieved: achieved };
};

export const generateAllRequisitionRowsFromBaseline = (baselineItems, savedRows = []) => {
  if (!Array.isArray(baselineItems) || baselineItems.length === 0) {
    return Array.isArray(savedRows) && savedRows.length > 0
      ? savedRows
      : [createEmptyMaterialRequisitionRow()];
  }

  const resultRows = [];
  baselineItems.forEach((item) => {
    const subItemName = (item.name || '').trim();
    if (!subItemName) return;
    const planCount = Math.max(1, parseInt(item.plan, 10) || 1);

    const savedForSubItem = (savedRows || []).filter(
      (r) => (r.subItemName || r.name || '').trim().toLowerCase() === subItemName.toLowerCase()
    );

    const subItemRows = [...savedForSubItem];
    while (subItemRows.length < planCount) {
      subItemRows.push(
        createEmptyMaterialRequisitionRow({
          subItemName,
          name: subItemName,
          mprPlannedCount: planCount,
        })
      );
    }
    subItemRows.forEach((r) => {
      r.subItemName = subItemName;
      r.name = subItemName;
      r.mprPlannedCount = planCount;
    });

    resultRows.push(...subItemRows.slice(0, Math.max(planCount, subItemRows.length)));
  });

  return resultRows.length > 0 ? resultRows : [createEmptyMaterialRequisitionRow()];
};

export const generateAllBillRowsFromBaseline = (baselineItems, savedRows = []) => {
  if (!Array.isArray(baselineItems) || baselineItems.length === 0) {
    return Array.isArray(savedRows) && savedRows.length > 0
      ? savedRows
      : [createEmptyBillToCertifyRow()];
  }

  const resultRows = [];
  baselineItems.forEach((item) => {
    const subItemName = (item.name || '').trim();
    if (!subItemName) return;
    const planCount = Math.max(1, parseInt(item.plan, 10) || 1);

    const savedForSubItem = (savedRows || []).filter(
      (r) => (r.subItemName || r.name || '').trim().toLowerCase() === subItemName.toLowerCase()
    );

    const subItemRows = [...savedForSubItem];
    while (subItemRows.length < planCount) {
      subItemRows.push(
        createEmptyBillToCertifyRow({
          subItemName,
          name: subItemName,
          mprPlannedCount: planCount,
        })
      );
    }
    subItemRows.forEach((r) => {
      r.subItemName = subItemName;
      r.name = subItemName;
      r.mprPlannedCount = planCount;
    });

    resultRows.push(...subItemRows.slice(0, Math.max(planCount, subItemRows.length)));
  });

  return resultRows.length > 0 ? resultRows : [createEmptyBillToCertifyRow()];
};

export const createEmptyFeedbackRow = () => createEmptyNamedRow({ remark: undefined });

export const createDefaultWprForm = (project = {}) => ({
  avgLabour: { plan: '', achieved: 0 },
  milestones: { plan: '', achieved: '' },
  qualityRating: { plan: 10, achieved: '' },
  healthSafetyRating: { plan: 10, achieved: '' },
  materialRequisitions: [createEmptyMaterialRequisitionRow()],
  materialRequisitionsSummary: { plan: '', achieved: '' },
  billsToCertify: [createEmptyBillToCertifyRow()],
  billsToCertifySummary: { plan: '', achieved: '' },
  leadershipInputs: [createEmptyFeedbackRow()],
  mockUpActivities: [createEmptyNamedRow()],
  contractorsMobilized: [createEmptyNamedRow()],
  contractorReviewMeeting: { plan: '', achieved: '' },
  keyPlanActivities: [createEmptyNamedRow()],
  valueOfWorkDone: { plan: '', achieved: 0 },
  workMethodology: [createEmptyNamedRow()],
  supportRequired: [createEmptyNamedRow()],
  timelineMonthly: {
    startDate: normalizeDateKey(project?.start_date) || '',
    endDate: normalizeDateKey(project?.end_date) || '',
  },
});

export const getPreviousMonthId = (dateOrMonthId) => {
  if (!dateOrMonthId) return null;
  let year, month;
  if (typeof dateOrMonthId === 'string') {
    const parts = dateOrMonthId.split('-');
    if (parts.length >= 2) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
  } else if (dateOrMonthId instanceof Date) {
    year = dateOrMonthId.getFullYear();
    month = dateOrMonthId.getMonth() + 1;
  }
  if (!year || !month || isNaN(year) || isNaN(month)) return null;

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
};

export const formatMonthYearLabel = (monthId) => {
  if (!monthId || typeof monthId !== 'string') return '';
  const [yearStr, monthStr] = monthId.split('-');
  const monthNum = parseInt(monthStr, 10);
  const yearNum = parseInt(yearStr, 10);
  if (isNaN(monthNum) || isNaN(yearNum)) return monthId;
  const date = new Date(yearNum, monthNum - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

export const getMprBaselineForWpr = (mprReports, weekNum, wprMonthId, weekStart, weekEnd) => {
  const targetPrevMonthId = wprMonthId ? getPreviousMonthId(wprMonthId) : null;
  const missingResult = {
    missing: true,
    prevMonthId: targetPrevMonthId,
    wprMonthId,
    prevMonthLabel: formatMonthYearLabel(targetPrevMonthId),
    wprMonthLabel: formatMonthYearLabel(wprMonthId),
  };

  if (!weekNum || !Array.isArray(mprReports) || mprReports.length === 0 || !wprMonthId || !targetPrevMonthId) {
    return null;
  }

  // Find specifically the MPR report matching targetPrevMonthId
  // Prefer approved status, fallback to any matching targetPrevMonthId
  const prevMpr =
    mprReports.find((r) => r?.month_id === targetPrevMonthId && r?.status === 'approved') ||
    mprReports.find((r) => r?.month_id === targetPrevMonthId && r?.status === 'submitted') ||
    mprReports.find((r) => r?.month_id === targetPrevMonthId);

  if (!prevMpr) {
    return missingResult;
  }

  let formData = prevMpr?.form_data;
  if (typeof formData === 'string') {
    try { formData = JSON.parse(formData); } catch { formData = null; }
  }
  const rows = formData?.planForNextMonth;
  const wkKey = `week${weekNum || 1}`;
  const baselines = {
    missing: false,
    prevMonthId: targetPrevMonthId,
    wprMonthId,
    prevMonthLabel: formatMonthYearLabel(targetPrevMonthId),
    wprMonthLabel: formatMonthYearLabel(wprMonthId),
  };

  // "Weekly Total Labour Count" from the MPR plan is a total headcount for the whole
  // week; the WPR's "Avg. No Of Labour Allocated" plan needs a per-day average instead,
  // rounded to a whole number (labour count is never shown in decimal).
  const daysInThisWeek = inclusiveDaysBetween(weekStart, weekEnd) || 7;

  if (Array.isArray(rows) && rows.length > 0) {
    rows.forEach((row) => {
      const val = row[wkKey];
      const numericPlan = parseFloat(val);
      if (row.isMultiRow) {
        if (
          row.subItemName &&
          String(row.subItemName).trim() !== '' &&
          !isNaN(numericPlan) &&
          numericPlan > 0
        ) {
          if (!baselines[row.parameterKey]) baselines[row.parameterKey] = [];
          baselines[row.parameterKey].push({
            id: row.id || `mpr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: row.subItemName,
            plan: val,
            achieved: '',
            remark: '',
          });
        }
      } else if (row.parameterKey === 'avgLabour') {
        if (!isNaN(numericPlan) && numericPlan > 0) {
          baselines.avgLabour = Math.round(numericPlan / daysInThisWeek);
        }
      } else if (val !== '' && val != null) {
        baselines[row.parameterKey] = val;
      }
    });
  }

  if (Array.isArray(formData?.forecast)) {
    const forecastVowd = formData.forecast.reduce((sum, f) => {
      const qty = parseFloat(f[wkKey]) || 0;
      const rate = parseFloat(f.rate) || 0;
      return sum + (qty * rate);
    }, 0);
    if (forecastVowd > 0) {
      baselines.valueOfWorkDone = forecastVowd;
    }
  }

  return baselines;
};

export const parseWprFormData = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const calcPct = (plan, achieved) => {
  const p = parseFloat(plan);
  const a = parseFloat(achieved);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(a)) return null;
  return Math.round((a / p) * 1000) / 10;
};

export const formatPct = (plan, achieved) => {
  const pct = calcPct(plan, achieved);
  if (pct === null) return '—';
  return `${pct}%`;
};

export const sumPlanAchieved = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return list.reduce(
    (acc, row) => ({
      plan: acc.plan + (parseFloat(row.plan) || 0),
      achieved: acc.achieved + (parseFloat(row.achieved) || 0),
    }),
    { plan: 0, achieved: 0 }
  );
};

export const labourRowTotal = (row) =>
  LABOUR_FIELDS.reduce((sum, field) => sum + (parseFloat(row?.[field]) || 0), 0);

/** Inclusive calendar days between YYYY-MM-DD dates. */
const inclusiveDaysBetween = (start, end) => {
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 86400000) + 1;
};

/** Total person-days (sum) across labour entries in [weekStart, weekEnd]. */
export const calcWeeklyMandays = (labourEntries, weekStart, weekEnd) => {
  const start = normalizeDateKey(weekStart);
  const end = normalizeDateKey(weekEnd);
  if (!start || !end) return 0;

  return (labourEntries || []).reduce((sum, entry) => {
    const date = normalizeDateKey(entry.date);
    if (!date || date < start || date > end) return sum;
    return sum + labourRowTotal(entry);
  }, 0);
};

/**
 * Average daily labour headcount for the selected date period.
 * Uses total mandays ÷ inclusive calendar days, rounded to a whole number (no decimals).
 */
export const calcAvgWeeklyLabour = (labourEntries, weekStart, weekEnd) => {
  const start = normalizeDateKey(weekStart);
  const end = normalizeDateKey(weekEnd);
  if (!start || !end) return 0;

  const daysInPeriod = inclusiveDaysBetween(start, end);
  if (!daysInPeriod) return 0;

  const mandays = calcWeeklyMandays(labourEntries, start, end);
  if (!mandays) return 0;
  // Round to nearest whole labour count (no decimal places)
  return Math.round(mandays / daysInPeriod);
};

/** Only count real daily entries — server also returns auto-generated weekly/monthly
 * aggregate rows (report_type 'weekly'/'monthly' or _is_aggregated) which must be
 * excluded here, otherwise VOWD gets double-counted. */
const onlyDailyProgressEntries = (entries) =>
  (entries || []).filter((e) => !e._is_aggregated && (e.report_type === 'daily' || !e.report_type));

/** Sum of value_of_work_done for progress entries in the week. */
export const calcWeeklyVowd = (progressEntries, weekStart, weekEnd) => {
  const start = normalizeDateKey(weekStart);
  const end = normalizeDateKey(weekEnd);
  if (!start || !end) return 0;

  const total = onlyDailyProgressEntries(progressEntries).reduce((sum, entry) => {
    const date = normalizeDateKey(entry.date);
    if (!date || date < start || date > end) return sum;
    return sum + (parseFloat(entry.value_of_work_done) || 0);
  }, 0);

  return Math.round(total * 100) / 100;
};
