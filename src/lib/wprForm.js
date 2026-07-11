import { normalizeDateKey } from '@/lib/formatters';

const LABOUR_FIELDS = [
  'carpenter',
  'barbender',
  'mason',
  'carpenter_helper',
  'barbender_helper',
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

export const createEmptyFeedbackRow = () => createEmptyNamedRow({ remark: undefined });

export const createDefaultWprForm = (project = {}) => ({
  avgLabour: { plan: '', achieved: 0 },
  milestones: { plan: '', achieved: '' },
  qualityRating: { plan: 10, achieved: '' },
  healthSafetyRating: { plan: 10, achieved: '' },
  materialRequisitions: [createEmptyNamedRow()],
  billsToCertify: [createEmptyNamedRow()],
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

/** Average daily labour headcount for dates in [weekStart, weekEnd]. */
export const calcAvgWeeklyLabour = (labourEntries, weekStart, weekEnd) => {
  const start = normalizeDateKey(weekStart);
  const end = normalizeDateKey(weekEnd);
  if (!start || !end) return 0;

  const byDate = {};
  (labourEntries || []).forEach((entry) => {
    const date = normalizeDateKey(entry.date);
    if (!date || date < start || date > end) return;
    byDate[date] = (byDate[date] || 0) + labourRowTotal(entry);
  });

  const days = Object.keys(byDate);
  if (days.length === 0) return 0;
  const total = days.reduce((sum, d) => sum + byDate[d], 0);
  return Math.round((total / days.length) * 100) / 100;
};

/** Sum of value_of_work_done for progress entries in the week. */
export const calcWeeklyVowd = (progressEntries, weekStart, weekEnd) => {
  const start = normalizeDateKey(weekStart);
  const end = normalizeDateKey(weekEnd);
  if (!start || !end) return 0;

  const total = (progressEntries || []).reduce((sum, entry) => {
    const date = normalizeDateKey(entry.date);
    if (!date || date < start || date > end) return sum;
    return sum + (parseFloat(entry.value_of_work_done) || 0);
  }, 0);

  return Math.round(total * 100) / 100;
};
