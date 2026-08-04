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

const genId = () => `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const isSteelWbsCode = (code) => {
  const c = String(code || '').trim();
  return c === '2.3' || c.startsWith('2.3.');
};

export const parseMprFormData = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// --- Row factories -----------------------------------------------------

export const createEmptyScheduleSummaryRow = (extra = {}) => ({
  id: genId(),
  monthConsidered: '',
  revisedCompletionDate: '',
  trackedCompletionDate: '',
  locked: false,
  ...extra,
});

export const createEmptyDelayRow = () => ({
  id: genId(),
  activity: '',
  percentComplete: '',
  baselineDate: '',
  trackedDate: '',
  accountabilityRemarks: '',
  correctiveActions: '',
});

export const createEmptyPlanVsAchievementRow = (extra = {}) => ({
  id: genId(),
  activityKey: '',
  activity: '',
  unit: '',
  rate: '',
  plannedQty: '',
  achievedQty: 0,
  ...extra,
});

export const createEmptyContractorBillRow = () => ({
  id: genId(),
  date: '',
  work: '',
  raBillNo: '',
  agencyName: '',
  amount: '',
});

export const createEmptyMaterialRequisitionRow = () => ({
  id: genId(),
  date: '',
  requisitionNo: '',
  particulars: '',
  unit: '',
  qty: '',
  receivedDate: '',
  remarks: '',
});

export const createEmptyMaterialReconciliationRow = () => ({
  id: genId(),
  materialDescription: '',
  unit: '',
  theoreticalConsumption: '',
  actualConsumption: '',
  physicalStockRegister: '',
  physicalStockVerification: '',
  cummReceived: '',
  certifiedCummConsumption: '',
  errorToBeAudited: '',
  remark: '',
});

export const createEmptyWorkOrderRow = () => ({
  id: genId(),
  item: '',
  issuedTo: '',
  scopeOfWork: '',
  rate: '',
  contractAmount: '',
  issueDate: '',
  startDate: '',
  completionDate: '',
  woStatus: '',
});

export const createEmptyDrawingReceivedRow = () => ({
  id: genId(),
  drawingType: '',
  drawingName: '',
  drawingNo: '',
  buildingName: '',
  revNo: '',
  noOfCopies: '',
  receivedDate: '',
});

export const createEmptyChallengeRow = () => ({
  id: genId(),
  challenge: '',
  correctiveAction: '',
});

export const createEmptyKeyActivityRow = () => ({
  id: genId(),
  details: '',
  currentMonthPlan: '',
  currentMonthStatus: '',
  upcomingMonthForecast: '',
});

export const createEmptyForecastRow = (extra = {}) => ({
  id: genId(),
  activityKey: '',
  budgetItemId: '',
  wbsItemId: '',
  description: '',
  unit: '',
  rate: '',
  week1: '',
  week2: '',
  week3: '',
  week4: '',
  drawingStatus: '',
  totalLabourRequired: '',
  cementBags: '',
  ...extra,
});

export const createEmptyDrawingRequiredRow = () => ({
  id: genId(),
  drawingType: '',
  buildingName: '',
  drawingName: '',
  requiredDate: '',
  requiredFrom: '',
});

export const createEmptyChallengeAnticipatedRow = () => ({
  id: genId(),
  challenge: '',
  actionToBeTaken: '',
});

export const createEmptyProjectConfigRow = () => ({
  id: genId(),
  building: '',
  buildingDetails: '',
  noOfFloor: '',
  noOfUnitsResidential: '',
  noOfUnitsCommercial: '',
  areaPerUnitResidential: '',
  areaPerUnitCommercial: '',
});

export const WPR_PLANNING_PARAMETERS = [
  { key: 'avgLabour', name: '1. Avg. No Of Labour Allocated', unit: 'Headcount', isMultiRow: false },
  { key: 'milestones', name: '2. No. of Construction Milestones to Achieve (Building wise)', unit: 'Nos', isMultiRow: false },
  { key: 'qualityRating', name: '3. Quality Rating (1–10)', unit: 'Rating', isMultiRow: false, isReadOnly: true },
  { key: 'healthSafetyRating', name: '4. Health and Safety Rating (1–10)', unit: 'Rating', isMultiRow: false, isReadOnly: true },
  { key: 'materialRequisitions', name: '5. No of Requisition Of Material', unit: 'Items', isMultiRow: true },
  { key: 'billsToCertify', name: '6. Bills to certify', unit: 'Items / ₹', isMultiRow: true },
  { key: 'leadershipInputs', name: '7. Leadership / Client / Consultant Inputs', unit: 'Items', isMultiRow: true },
  { key: 'mockUpActivities', name: '8. Mock up Activity', unit: 'Items', isMultiRow: true },
  { key: 'contractorsMobilized', name: '9. Contractors to be Mobilized', unit: 'Items', isMultiRow: true },
  { key: 'contractorReviewMeeting', name: '10. Contractor review meeting conducted', unit: 'Count', isMultiRow: true },
  { key: 'keyPlanActivities', name: '11. Key Plan Activity', unit: 'Items', isMultiRow: true },
  { key: 'valueOfWorkDone', name: '12. Value of Work Done', unit: '₹ Amount', isMultiRow: false, isReadOnly: true },
  { key: 'workMethodology', name: '13. Work Methodology Details', unit: 'Items', isMultiRow: true },
  { key: 'supportRequired', name: '14. Support Required / Decision On Details', unit: 'Items', isMultiRow: true },
  { key: 'timelineMonthly', name: '15. Timeline Monthly Target', unit: 'Items', isMultiRow: true },
];

export const calcForecastWeeklyVowd = (forecastRows, weekKey) => {
  return (forecastRows || []).reduce((sum, row) => {
    const qty = parseFloat(row?.[weekKey]) || 0;
    const rate = parseFloat(row?.rate) || 0;
    return sum + (qty * rate);
  }, 0);
};

export const createEmptyPlanForNextMonthRow = (paramKey = '', paramName = '', unit = '', isMultiRow = false, extra = {}) => {
  const isRating = paramKey === 'qualityRating' || paramKey === 'healthSafetyRating';
  const defaultVal = isRating ? '10' : '';

  return {
    id: genId(),
    parameterKey: paramKey,
    parameterName: paramName,
    subItemName: '',
    unit: unit,
    isMultiRow: isMultiRow,
    week1: defaultVal,
    week2: defaultVal,
    week3: defaultVal,
    week4: defaultVal,
    ...extra,
  };
};

export const createDefaultPlanForNextMonthRows = () => {
  return WPR_PLANNING_PARAMETERS.map((param) =>
    createEmptyPlanForNextMonthRow(param.key, param.name, param.unit, param.isMultiRow)
  );
};

export const planForNextMonthRowTotal = (row) => {
  if (!row) return 0;
  if (row.parameterKey === 'qualityRating' || row.parameterKey === 'healthSafetyRating') {
    return 10;
  }
  const w1 = parseFloat(row.week1) || 0;
  const w2 = parseFloat(row.week2) || 0;
  const w3 = parseFloat(row.week3) || 0;
  const w4 = parseFloat(row.week4) || 0;
  return w1 + w2 + w3 + w4;
};

// --- Default form --------------------------------------------------------

export const createDefaultMprForm = () => ({
  executiveSummary: '',
  signOff: {
    preparedByName: '',
    preparedByTitle: 'Site Engineer',
    checkedByName: '',
    checkedByTitle: '',
    endorsedByName: '',
    endorsedByTitle: '',
  },
  scheduleSummaryRows: [createEmptyScheduleSummaryRow()],
  projectDuration: {
    estimatedDuration: '',
    baselineStartDate: '',
    baselineCompletionDate: '',
    plannedDuration: '',
  },
  delayRows: [createEmptyDelayRow()],
  materialConsumption: {
    vowd: { target: '', achieved: 0, nextMonthTarget: 0 },
    cement: { target: '', achieved: '', nextMonthTarget: 0 },
    steel: { target: 0, achieved: 0, nextMonthTarget: 0 },
    mandays: { target: '', achieved: 0, nextMonthTarget: 0 },
    avgManpower: { target: '', achieved: 0, nextMonthTarget: 0 },
  },
  planVsAchievement: [],
  contractorBills: [createEmptyContractorBillRow()],
  materialRequisitions: [createEmptyMaterialRequisitionRow()],
  materialReconciliation: [createEmptyMaterialReconciliationRow()],
  workOrders: [createEmptyWorkOrderRow()],
  drawingsReceived: [createEmptyDrawingReceivedRow()],
  challengesEncountered: [createEmptyChallengeRow()],
  keyActivities: [createEmptyKeyActivityRow()],
  forecast: [createEmptyForecastRow()],
  planForNextMonth: createDefaultPlanForNextMonthRows(),
  drawingsRequired: [createEmptyDrawingRequiredRow()],
  challengesAnticipated: [createEmptyChallengeAnticipatedRow()],
  unitHandover: { rPlan: '', rAchieved: '', cPlan: '', cAchieved: '' },
  projectConfiguration: [createEmptyProjectConfigRow()],
});

// --- Calculation helpers --------------------------------------------------

export const labourRowTotal = (row) =>
  LABOUR_FIELDS.reduce((sum, field) => sum + (parseFloat(row?.[field]) || 0), 0);

/** Sum of value_of_work_done for progress entries in [monthStart, monthEnd]. */
export const calcMonthlyVowd = (progressEntries, monthStart, monthEnd) => {
  const start = normalizeDateKey(monthStart);
  const end = normalizeDateKey(monthEnd);
  if (!start || !end) return 0;

  const total = (progressEntries || []).reduce((sum, entry) => {
    const date = normalizeDateKey(entry.date);
    if (!date || date < start || date > end) return sum;
    return sum + (parseFloat(entry.value_of_work_done) || 0);
  }, 0);

  return Math.round(total * 100) / 100;
};

/** Total person-days (sum, not averaged) across labour entries in range. */
export const calcMonthlyMandays = (labourEntries, monthStart, monthEnd) => {
  const start = normalizeDateKey(monthStart);
  const end = normalizeDateKey(monthEnd);
  if (!start || !end) return 0;

  return (labourEntries || []).reduce((sum, entry) => {
    const date = normalizeDateKey(entry.date);
    if (!date || date < start || date > end) return sum;
    return sum + labourRowTotal(entry);
  }, 0);
};

export const calcMonthlyAvgManpower = (labourEntries, monthStart, monthEnd, daysInMonth) => {
  if (!daysInMonth) return 0;
  const mandays = calcMonthlyMandays(labourEntries, monthStart, monthEnd);
  return Math.round((mandays / daysInMonth) * 100) / 100;
};

/** Sum of value_of_work_done for progress entries linked to Steel (WBS "2.3.*") items. */
export const calcMonthlySteelVowd = (progressEntries, wbsItemsById, budgetItemsById, monthStart, monthEnd) => {
  const start = normalizeDateKey(monthStart);
  const end = normalizeDateKey(monthEnd);
  if (!start || !end) return 0;

  const resolveWbsCode = (entry) => {
    if (entry.wbs_item_id) return wbsItemsById.get(entry.wbs_item_id)?.code;
    if (entry.budget_item_id) {
      const wbsId = budgetItemsById.get(entry.budget_item_id)?.wbs_item_id;
      return wbsId ? wbsItemsById.get(wbsId)?.code : null;
    }
    return null;
  };

  const total = (progressEntries || []).reduce((sum, entry) => {
    const date = normalizeDateKey(entry.date);
    if (!date || date < start || date > end) return sum;
    if (!isSteelWbsCode(resolveWbsCode(entry))) return sum;
    return sum + (parseFloat(entry.value_of_work_done) || 0);
  }, 0);

  return Math.round(total * 100) / 100;
};

/** Sum of (rate * total weekly qty) across forecast rows. */
export const sumForecastAmount = (forecastRows) =>
  (forecastRows || []).reduce((sum, row) => {
    const qty = (parseFloat(row.week1) || 0) + (parseFloat(row.week2) || 0)
      + (parseFloat(row.week3) || 0) + (parseFloat(row.week4) || 0);
    return sum + qty * (parseFloat(row.rate) || 0);
  }, 0);

/** Sum of a plain numeric field across forecast rows. */
export const sumForecastField = (forecastRows, fieldKey) =>
  (forecastRows || []).reduce((sum, row) => sum + (parseFloat(row[fieldKey]) || 0), 0);

/** Sum of (rate * total weekly qty) across forecast rows linked to Steel (WBS "2.3.*") items. */
export const sumForecastAmountForSteel = (forecastRows, wbsItemsById) =>
  (forecastRows || []).reduce((sum, row) => {
    const code = row.wbsItemId ? wbsItemsById.get(row.wbsItemId)?.code : null;
    if (!isSteelWbsCode(code)) return sum;
    const qty = (parseFloat(row.week1) || 0) + (parseFloat(row.week2) || 0)
      + (parseFloat(row.week3) || 0) + (parseFloat(row.week4) || 0);
    return sum + qty * (parseFloat(row.rate) || 0);
  }, 0);

/** Sum of total planned quantity (week1..4) across forecast rows. */
export const forecastRowQty = (row) =>
  (parseFloat(row.week1) || 0) + (parseFloat(row.week2) || 0)
  + (parseFloat(row.week3) || 0) + (parseFloat(row.week4) || 0);

/** Whole-day difference: dateA - dateB, in days. Returns null if either date is missing/invalid. */
export const diffDays = (dateA, dateB) => {
  const a = normalizeDateKey(dateA);
  const b = normalizeDateKey(dateB);
  if (!a || !b) return null;
  const msPerDay = 86400000;
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round((da.getTime() - db.getTime()) / msPerDay);
};

export const todayDateKey = () => normalizeDateKey(new Date());
