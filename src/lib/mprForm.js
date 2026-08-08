import { normalizeDateKey } from '@/lib/formatters';
import { isBillRowAchieved, isRequisitionRowAchieved } from '@/lib/wprForm';

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

/** Map a WPR "6. Bills to certify" row → MPR Contractor Bills columns. */
export const mapWprBillToContractorBill = (row = {}) => ({
  id: row.id || genId(),
  date: row.billDate || '',
  work: row.name || row.subItemName || '',
  raBillNo: row.raBillNo || '',
  agencyName: row.agencyName || '',
  amount: row.billAmount ?? '',
});

const isBlankStr = (v) => v === '' || v == null || String(v).trim() === '';

export const isContractorBillRowEmpty = (row) => {
  if (!row) return true;
  return (
    isBlankStr(row.date) &&
    isBlankStr(row.work) &&
    isBlankStr(row.raBillNo) &&
    isBlankStr(row.agencyName) &&
    isBlankStr(row.amount)
  );
};

const parseFormData = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Collect achieved WPR bill rows for a given month (YYYY-MM) from WPR reports. */
export const collectWprBillsForMonth = (wprReports, monthId) => {
  if (!monthId || !Array.isArray(wprReports) || wprReports.length === 0) return [];

  const collected = [];
  const seenIds = new Set();

  wprReports.forEach((report) => {
    const weekMonth = String(report.week_start || '').slice(0, 7);
    if (weekMonth !== monthId) return;

    const form = parseFormData(report.form_data);
    const rows = form?.billsToCertify || [];
    rows.forEach((row) => {
      // Only achieved bills (Bill Date / Agency / Amount / RA Bill No / Remark filled)
      if (!isBillRowAchieved(row)) return;
      const mapped = mapWprBillToContractorBill(row);
      if (seenIds.has(mapped.id)) {
        const idx = collected.findIndex((r) => r.id === mapped.id);
        if (idx >= 0) collected[idx] = mapped;
        return;
      }
      seenIds.add(mapped.id);
      collected.push(mapped);
    });
  });

  return collected;
};

/**
 * Merge WPR-sourced contractor bills into the MPR table.
 * WPR rows upsert by id; other manually entered MPR rows are kept.
 */
export const mergeContractorBillsFromWpr = (existingRows, wprMappedRows) => {
  if (!Array.isArray(wprMappedRows) || wprMappedRows.length === 0) {
    return Array.isArray(existingRows) && existingRows.length > 0
      ? existingRows
      : [createEmptyContractorBillRow()];
  }

  const wprIds = new Set(wprMappedRows.map((r) => r.id));
  const byId = new Map();

  (existingRows || []).forEach((row) => {
    if (isContractorBillRowEmpty(row)) return;
    // Drop stale WPR-sourced empties; keep manual rows and current WPR ids for merge
    if (!wprIds.has(row.id)) byId.set(row.id, row);
  });

  wprMappedRows.forEach((row) => {
    byId.set(row.id, { ...(byId.get(row.id) || {}), ...row });
  });

  const merged = Array.from(byId.values());
  return merged.length > 0 ? merged : [createEmptyContractorBillRow()];
};

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

/** Map a WPR "5. No of Requisition Of Material" row → MPR Material Requisition columns. */
export const mapWprRequisitionToMpr = (row = {}) => ({
  id: row.id || genId(),
  date: row.date || '',
  requisitionNo: row.requisitionNo || '',
  particulars: row.name || row.subItemName || row.particulars || '',
  unit: row.unit || '',
  qty: row.qty ?? '',
  receivedDate: row.receivedDate || '',
  remarks: row.remark || row.remarks || '',
});

export const isMaterialRequisitionRowEmpty = (row) => {
  if (!row) return true;
  return (
    isBlankStr(row.date) &&
    isBlankStr(row.requisitionNo) &&
    isBlankStr(row.particulars) &&
    isBlankStr(row.unit) &&
    isBlankStr(row.qty) &&
    isBlankStr(row.receivedDate) &&
    isBlankStr(row.remarks)
  );
};

/** Collect achieved WPR requisition rows for a given month (YYYY-MM) from WPR reports. */
export const collectWprRequisitionsForMonth = (wprReports, monthId) => {
  if (!monthId || !Array.isArray(wprReports) || wprReports.length === 0) return [];

  const collected = [];
  const seenIds = new Set();

  wprReports.forEach((report) => {
    const weekMonth = String(report.week_start || '').slice(0, 7);
    if (weekMonth !== monthId) return;

    const form = parseFormData(report.form_data);
    const rows = form?.materialRequisitions || [];
    rows.forEach((row) => {
      if (!isRequisitionRowAchieved(row)) return;
      const mapped = mapWprRequisitionToMpr(row);
      if (seenIds.has(mapped.id)) {
        const idx = collected.findIndex((r) => r.id === mapped.id);
        if (idx >= 0) collected[idx] = mapped;
        return;
      }
      seenIds.add(mapped.id);
      collected.push(mapped);
    });
  });

  return collected;
};

/**
 * Merge WPR-sourced material requisitions into the MPR table.
 * WPR rows upsert by id; other manually entered MPR rows are kept.
 */
export const mergeMaterialRequisitionsFromWpr = (existingRows, wprMappedRows) => {
  if (!Array.isArray(wprMappedRows) || wprMappedRows.length === 0) {
    return Array.isArray(existingRows) && existingRows.length > 0
      ? existingRows
      : [createEmptyMaterialRequisitionRow()];
  }

  const wprIds = new Set(wprMappedRows.map((r) => r.id));
  const byId = new Map();

  (existingRows || []).forEach((row) => {
    if (isMaterialRequisitionRowEmpty(row)) return;
    if (!wprIds.has(row.id)) byId.set(row.id, row);
  });

  wprMappedRows.forEach((row) => {
    byId.set(row.id, { ...(byId.get(row.id) || {}), ...row });
  });

  const merged = Array.from(byId.values());
  return merged.length > 0 ? merged : [createEmptyMaterialRequisitionRow()];
};

export const createEmptyMaterialReconciliationRow = (extra = {}) => ({
  id: genId(),
  rowType: 'item', // 'section' | 'item' | 'total'
  totalGroup: '',
  srNo: '',
  materialDescription: '',
  unit: '',
  theoreticalConsumption: '',
  actualConsumption: '',
  physicalStockRegister: '',
  physicalStockVerification: '',
  cummReceived: '',
  certifiedCummConsumption: '',
  remark: '',
  ...extra,
});

/** Default layout matching Planedge "7. Cumulative Material Reconciliation Report". */
export const MATERIAL_RECONCILIATION_TEMPLATE = [
  { rowType: 'section', materialDescription: 'Steel Reconciliation Report' },
  { rowType: 'item', srNo: 1, materialDescription: '8 mm', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'item', srNo: 2, materialDescription: '10 mm', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'item', srNo: 3, materialDescription: '12 mm', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'item', srNo: 4, materialDescription: '16 mm', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'item', srNo: 5, materialDescription: '20 mm', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'item', srNo: 6, materialDescription: '25 mm', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'item', srNo: 7, materialDescription: '32 mm', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'total', materialDescription: 'Total', unit: 'MT', totalGroup: 'steel' },
  { rowType: 'section', materialDescription: 'Cement Reconciliation Report' },
  { rowType: 'item', srNo: 8, materialDescription: 'M15', unit: 'Cum', totalGroup: 'cement-cum' },
  { rowType: 'item', srNo: 9, materialDescription: 'M25', unit: 'Cum', totalGroup: 'cement-cum' },
  { rowType: 'item', srNo: 10, materialDescription: 'M30', unit: 'Cum', totalGroup: 'cement-cum' },
  { rowType: 'item', srNo: 11, materialDescription: 'M35', unit: 'Cum', totalGroup: 'cement-cum' },
  { rowType: 'total', materialDescription: 'Total', unit: 'Cum', totalGroup: 'cement-cum' },
  { rowType: 'item', srNo: 12, materialDescription: 'Cement', unit: 'Bags', totalGroup: '' },
  { rowType: 'item', srNo: 13, materialDescription: 'C/s', unit: 'Brass', totalGroup: '' },
  { rowType: 'item', srNo: 14, materialDescription: '20 mm metal', unit: 'Brass', totalGroup: '' },
  { rowType: 'item', srNo: 15, materialDescription: 'Artificial Sand', unit: 'Brass', totalGroup: '' },
];

export const createDefaultMaterialReconciliationRows = () =>
  MATERIAL_RECONCILIATION_TEMPLATE.map((tpl, idx) =>
    createEmptyMaterialReconciliationRow({
      ...tpl,
      // Include index + totalGroup so Steel/Cement Total rows never share the same id
      id: `mrecon_${idx}_${tpl.rowType}_${tpl.totalGroup || 'none'}_${String(tpl.srNo || tpl.materialDescription || 'x')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')}`,
    })
  );

const RECON_NUMERIC_FIELDS = [
  'theoreticalConsumption',
  'actualConsumption',
  'physicalStockRegister',
  'physicalStockVerification',
  'cummReceived',
  'certifiedCummConsumption',
];
export { RECON_NUMERIC_FIELDS };

export const calcReconciliationDiffs = (row = {}) => {
  const n = (v) => parseFloat(v) || 0;
  const theoretical = n(row.theoreticalConsumption);
  const actual = n(row.actualConsumption);
  const stockReg = n(row.physicalStockRegister);
  const stockPhys = n(row.physicalStockVerification);
  const cummRecv = n(row.cummReceived);
  const certCumm = n(row.certifiedCummConsumption);
  const diffDE = theoretical - actual; // F = D - E
  const diffGH = stockReg - stockPhys; // I = G - H
  const diffJK = cummRecv - certCumm; // L = J - K
  const errorAudited = diffJK - stockReg; // M = L - G
  return { diffDE, diffGH, diffJK, errorAudited };
};

/**
 * Always rebuild in template order so Cement Total stays under M35 (Cum block only).
 * Numeric values are merged from saved rows by srNo / description / totalGroup.
 */
export const ensureMaterialReconciliationTemplate = (rows) => {
  const defaults = createDefaultMaterialReconciliationRows();
  const list = Array.isArray(rows) ? rows : [];

  const itemBySr = new Map();
  const itemByDesc = new Map();
  const totalByGroup = new Map();

  list.forEach((r) => {
    if (r.rowType === 'item' || (!r.rowType && (r.materialDescription || '').trim())) {
      if (r.srNo !== '' && r.srNo != null) itemBySr.set(String(r.srNo), r);
      const desc = String(r.materialDescription || '').trim().toLowerCase();
      if (desc && desc !== 'total') itemByDesc.set(desc, r);
    }
    if (r.rowType === 'total') {
      const group =
        r.totalGroup ||
        (r.unit === 'MT' ? 'steel' : r.unit === 'Cum' ? 'cement-cum' : '');
      // Prefer cement-cum over legacy mid-block totals when multiple Cum totals exist
      if (group === 'cement-m15-m25' || group === 'cement-m30-m35' || group === 'cement') {
        if (!totalByGroup.has('cement-cum')) totalByGroup.set('cement-cum', r);
      } else if (group) {
        totalByGroup.set(group, r);
      }
    }
  });

  return defaults.map((d) => {
    if (d.rowType === 'section') return d;

    if (d.rowType === 'total') {
      const existing = totalByGroup.get(d.totalGroup);
      if (!existing) return d;
      return {
        ...d,
        id: d.id, // keep stable template id/order
        ...Object.fromEntries(RECON_NUMERIC_FIELDS.map((f) => [f, existing[f] ?? ''])),
        remark: existing.remark ?? '',
      };
    }

    // item
    const existing =
      itemBySr.get(String(d.srNo)) ||
      itemByDesc.get(String(d.materialDescription).trim().toLowerCase());
    if (!existing) return d;
    return {
      ...d,
      id: d.id,
      ...Object.fromEntries(RECON_NUMERIC_FIELDS.map((f) => [f, existing[f] ?? ''])),
      remark: existing.remark ?? '',
    };
  });
};

export const sumReconciliationGroup = (rows, totalGroup, field) =>
  (rows || [])
    .filter((r) => r.rowType === 'item' && r.totalGroup === totalGroup)
    .reduce((sum, r) => sum + (parseFloat(r[field]) || 0), 0);

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

export const KEY_ACTIVITY_CATEGORIES = [
  { key: 'start', label: 'Key activities to Start' },
  { key: 'finish', label: 'Key Activities to Finish' },
];

export const createEmptyKeyActivityRow = (category = 'start', extra = {}) => ({
  id: genId(),
  category, // 'start' | 'finish'
  currentMonthPlan: '',
  currentMonthStatus: '',
  upcomingMonthForecast: '',
  ...extra,
});

/** Default: 3 blank rows under Start + 3 under Finish (editable / addable). */
export const createDefaultKeyActivityRows = () => [
  createEmptyKeyActivityRow('start'),
  createEmptyKeyActivityRow('start'),
  createEmptyKeyActivityRow('start'),
  createEmptyKeyActivityRow('finish'),
  createEmptyKeyActivityRow('finish'),
  createEmptyKeyActivityRow('finish'),
];

/** Normalize legacy flat key-activity rows into Start/Finish groups. */
export const ensureKeyActivitiesTemplate = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const hasCategory = list.some((r) => r.category === 'start' || r.category === 'finish');

  if (hasCategory) {
    const start = list.filter((r) => r.category === 'start');
    const finish = list.filter((r) => r.category === 'finish');
    const normalized = [
      ...(start.length > 0 ? start : [createEmptyKeyActivityRow('start')]),
      ...(finish.length > 0 ? finish : [createEmptyKeyActivityRow('finish')]),
    ].map((r) => ({
      ...createEmptyKeyActivityRow(r.category),
      ...r,
      category: r.category === 'finish' ? 'finish' : 'start',
      // Drop legacy free-text details field from display model
      details: undefined,
    }));
    return normalized;
  }

  // Legacy rows used `details` as free text — put them under Start, keep Finish defaults
  const legacyFilled = list.filter(
    (r) =>
      (r.details || '').trim() ||
      (r.currentMonthPlan || '').trim() ||
      (r.currentMonthStatus || '').trim() ||
      (r.upcomingMonthForecast || '').trim()
  );

  if (legacyFilled.length === 0) return createDefaultKeyActivityRows();

  return [
    ...legacyFilled.map((r) =>
      createEmptyKeyActivityRow('start', {
        id: r.id,
        currentMonthPlan: r.currentMonthPlan || r.details || '',
        currentMonthStatus: r.currentMonthStatus || '',
        upcomingMonthForecast: r.upcomingMonthForecast || '',
      })
    ),
    createEmptyKeyActivityRow('finish'),
    createEmptyKeyActivityRow('finish'),
    createEmptyKeyActivityRow('finish'),
  ];
};

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
  source: 'manual',
});

const normalizeBuildingKey = (value) => String(value || '').trim().toLowerCase();

/** Parse Project Master Sub Project table (`projects.building_configurations`). */
export const parseBuildingConfigurations = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Map one Project Master Sub Project row → MPR Project Configuration row. */
export const mapSubProjectConfigToMprRow = (config, index = 0) => {
  const building = String(config?.building || config?.name || '').trim();
  const stableKey = normalizeBuildingKey(building) || String(index);
  return {
    id: config?.id && String(config.id).startsWith('temp_') === false
      ? String(config.id)
      : `pm_${stableKey}`,
    building,
    buildingDetails: config?.buildingDetails ?? config?.building_details ?? '',
    noOfFloor: config?.noOfFloor ?? config?.no_of_floor ?? '',
    noOfUnitsResidential: config?.noOfUnitsResidential ?? config?.no_of_units_residential ?? '',
    noOfUnitsCommercial: config?.noOfUnitsCommercial ?? config?.no_of_units_commercial ?? '',
    areaPerUnitResidential: config?.areaPerUnitResidential ?? config?.approx_area_resi ?? '',
    areaPerUnitCommercial: config?.areaPerUnitCommercial ?? config?.approx_area_comm ?? '',
    source: 'project_master',
  };
};

const projectConfigRowHasContent = (row) =>
  [
    'building',
    'buildingDetails',
    'noOfFloor',
    'noOfUnitsResidential',
    'noOfUnitsCommercial',
    'areaPerUnitResidential',
    'areaPerUnitCommercial',
  ].some((key) => String(row?.[key] ?? '').trim() !== '');

/**
 * Sync MPR Project Configuration from Project Master Sub Projects.
 * - One row per Sub Project (latest master values win — no duplicates by building name)
 * - Preserves additional manual rows that do not match a master Sub Project
 */
export const syncProjectConfigurationFromMaster = (masterConfigs, existingRows = []) => {
  const masterRows = (masterConfigs || [])
    .map((config, index) => mapSubProjectConfigToMprRow(config, index))
    .filter((row) => row.building);

  // De-dupe master by building name (keep first)
  const seenMaster = new Set();
  const uniqueMasterRows = [];
  masterRows.forEach((row) => {
    const key = normalizeBuildingKey(row.building);
    if (!key || seenMaster.has(key)) return;
    seenMaster.add(key);
    uniqueMasterRows.push(row);
  });

  const manualRows = (existingRows || [])
    .filter((row) => {
      if (row?.source === 'project_master') return false;
      const key = normalizeBuildingKey(row?.building);
      if (key && seenMaster.has(key)) return false;
      if (!key && uniqueMasterRows.length > 0 && !projectConfigRowHasContent(row)) return false;
      if (row?.source === 'manual') return true;
      return projectConfigRowHasContent(row);
    })
    .map((row) => ({ ...row, source: 'manual' }));

  return [...uniqueMasterRows, ...manualRows];
};

export const WPR_PLANNING_PARAMETERS = [
  { key: 'avgLabour', name: '1. Weekly Total Labour Count', unit: 'Headcount', isMultiRow: false },
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

// --- Work Completion Status (fixed activities, subproject-wise) ----------

export const WORK_COMPLETION_SUBPROJECT_PAGE_SIZE = 3;

/** Fixed A/B/C activities — all subproject-wise. rowType: section | group | data */
export const WORK_COMPLETION_BUILDING_ROWS = [
  { id: 'sec-a', srNo: '', activity: 'A. Status of Flat related activities', unit: '', rowType: 'section' },
  { id: 'a1', srNo: '1', activity: 'Internal Plaster & Gypsum Work', unit: 'NOS', rowType: 'data' },
  { id: 'a3', srNo: '3', activity: 'Toilet Waterproofing', unit: 'NOS', rowType: 'data' },
  { id: 'a4', srNo: '4', activity: 'Concealed Plumbing', unit: 'NOS', rowType: 'data' },
  { id: 'a5', srNo: '5', activity: 'Toilet dado', unit: 'NOS', rowType: 'data' },
  { id: 'a6', srNo: '6', activity: 'Kitchen otta & Dado', unit: 'NOS', rowType: 'data' },
  { id: 'a7', srNo: '7', activity: 'Flat Flooring including Dry Balcony, Att Terrace, Toilet', unit: 'NOS', rowType: 'data' },
  { id: 'a8', srNo: '8', activity: 'Electrical Wiring', unit: 'NOS', rowType: 'data' },
  { id: 'a9', srNo: '9', activity: 'Flat Doors', unit: 'NOS', rowType: 'data' },
  { id: 'a10', srNo: '10', activity: 'Aluminum Windows', unit: 'NOS', rowType: 'data' },
  { id: 'a11', srNo: '11', activity: 'Aluminum Sliding doors', unit: 'NOS', rowType: 'data' },
  { id: 'a12', srNo: '12', activity: 'Internal Painting 1st coat', unit: 'NOS', rowType: 'data' },
  { id: 'a13', srNo: '13', activity: 'Internal Painting 2nd coat', unit: 'NOS', rowType: 'data' },
  { id: 'a14', srNo: '14', activity: 'Sanitary fitting work', unit: 'NOS', rowType: 'data' },
  { id: 'a15', srNo: '15', activity: 'Electrical Fittings', unit: 'NOS', rowType: 'data' },
  { id: 'a16', srNo: '16', activity: 'CP fitting', unit: 'NOS', rowType: 'data' },

  { id: 'sec-b', srNo: '', activity: 'B. Status of Common area related activities', unit: '', rowType: 'section' },
  { id: 'b17', srNo: '17', activity: 'LIFT', unit: '', rowType: 'group' },
  { id: 'b17.1', srNo: '17.1', activity: 'Lift rail', unit: 'NOS', rowType: 'data' },
  { id: 'b17.2', srNo: '17.2', activity: 'Lift doors', unit: 'NOS', rowType: 'data' },
  { id: 'b17.3', srNo: '17.3', activity: 'Lift cabin', unit: 'NOS', rowType: 'data' },
  { id: 'b17.4', srNo: '17.4', activity: 'No of lobbies', unit: 'NOS', rowType: 'data' },
  { id: 'b17.5', srNo: '17.5', activity: 'Passage painting', unit: 'NOS', rowType: 'data' },
  { id: 'b18', srNo: '18', activity: 'FIRE FIGHTING', unit: '', rowType: 'group' },
  { id: 'b18.1', srNo: '18.1', activity: 'Fire Door', unit: 'NOS', rowType: 'data' },
  { id: 'b18.2', srNo: '18.2', activity: 'Firefighting work (Sprinkler)', unit: 'NOS', rowType: 'data' },
  { id: 'b18.3', srNo: '18.3', activity: 'Firefighting work (risers)', unit: 'NOS', rowType: 'data' },
  { id: 'b19', srNo: '19', activity: 'PLUMBING', unit: '', rowType: 'group' },
  { id: 'b19.1', srNo: '19.1', activity: 'drainage', unit: 'NOS', rowType: 'data' },
  { id: 'b19.2', srNo: '19.2', activity: 'water line', unit: 'NOS', rowType: 'data' },
  { id: 'b19.3', srNo: '19.3', activity: 'looping', unit: 'NOS', rowType: 'data' },
  { id: 'b20', srNo: '20', activity: 'DUCT', unit: '', rowType: 'group' },
  { id: 'b20.1', srNo: '20.1', activity: 'Electrical', unit: 'NOS', rowType: 'data' },
  { id: 'b20.2', srNo: '20.2', activity: 'Plumbing', unit: 'NOS', rowType: 'data' },

  { id: 'sec-c', srNo: '', activity: 'C. Status of Infra Development work related activities', unit: '', rowType: 'section' },
  { id: 'c21', srNo: '21', activity: 'External Plumbing', unit: '', rowType: 'group' },
  { id: 'c21.1', srNo: '21.1', activity: 'Storm', unit: 'RMT', rowType: 'data' },
  { id: 'c21.2', srNo: '21.2', activity: 'Drainage', unit: 'RMT', rowType: 'data' },
  { id: 'c21.3', srNo: '21.3', activity: 'Water Line', unit: 'RMT', rowType: 'data' },
  { id: 'c21.4', srNo: '21.4', activity: 'Chambers', unit: 'Nos', rowType: 'data' },
  { id: 'c22', srNo: '22', activity: 'Compound wall', unit: '', rowType: 'group' },
  { id: 'c22.1', srNo: '22.1', activity: 'RCC', unit: '%', rowType: 'data' },
  { id: 'c22.2', srNo: '22.2', activity: 'Brickwork', unit: 'Sqm', rowType: 'data' },
  { id: 'c22.3', srNo: '22.3', activity: 'Plaster', unit: 'Sqm', rowType: 'data' },
  { id: 'c22.4', srNo: '22.4', activity: 'Paint 1st Coat', unit: 'Sqm', rowType: 'data' },
  { id: 'c22.5', srNo: '22.5', activity: 'Paint 2nd Coat', unit: 'Sqm', rowType: 'data' },
  { id: 'c23', srNo: '23', activity: 'Road Works', unit: '', rowType: 'group' },
  { id: 'c23.1', srNo: '23.1', activity: 'Sub Base', unit: 'RMT', rowType: 'data' },
  { id: 'c23.2', srNo: '23.2', activity: 'Trimix', unit: 'Sqm', rowType: 'data' },
];

export const createDefaultWorkCompletionStatus = () => ({
  bySubProject: {},
});

export const ensureWorkCompletionStatus = (raw) => {
  const base = createDefaultWorkCompletionStatus();
  if (!raw || typeof raw !== 'object') return base;
  return {
    bySubProject: raw.bySubProject && typeof raw.bySubProject === 'object' ? raw.bySubProject : {},
  };
};

/** Subprojects for Work Completion — from Project Configuration / building master. */
export const getWorkCompletionSubProjects = (projectConfiguration = [], buildingConfigurationsRaw) => {
  const fromConfig = (Array.isArray(projectConfiguration) ? projectConfiguration : [])
    .map((row, index) => {
      const name = String(row?.building || row?.name || '').trim();
      if (!name) return null;
      const key = normalizeBuildingKey(name) || `sp_${index}`;
      return {
        key,
        id: row?.id || key,
        name: name.toUpperCase(),
      };
    })
    .filter(Boolean);

  if (fromConfig.length > 0) {
    const seen = new Set();
    return fromConfig.filter((sp) => {
      if (seen.has(sp.key)) return false;
      seen.add(sp.key);
      return true;
    });
  }

  return parseBuildingConfigurations(buildingConfigurationsRaw)
    .map((cfg, index) => {
      const name = String(cfg?.building || cfg?.name || '').trim();
      if (!name) return null;
      const key = normalizeBuildingKey(name) || `sp_${index}`;
      return { key, id: cfg?.id || key, name: name.toUpperCase() };
    })
    .filter(Boolean);
};

export const chunkWorkCompletionSubProjects = (
  subProjects,
  pageSize = WORK_COMPLETION_SUBPROJECT_PAGE_SIZE
) => {
  const list = Array.isArray(subProjects) ? subProjects : [];
  if (list.length === 0) return [[]];
  const chunks = [];
  for (let i = 0; i < list.length; i += pageSize) {
    chunks.push(list.slice(i, i + pageSize));
  }
  return chunks;
};

export const getWorkCompletionCell = (data, activityId, subKey) => {
  const cell = data?.bySubProject?.[activityId]?.[subKey];
  return {
    totalFlats: cell?.totalFlats ?? '',
    completedFlats: cell?.completedFlats ?? '',
  };
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
  materialReconciliation: createDefaultMaterialReconciliationRows(),
  workOrders: [createEmptyWorkOrderRow()],
  drawingsReceived: [createEmptyDrawingReceivedRow()],
  challengesEncountered: [createEmptyChallengeRow()],
  keyActivities: createDefaultKeyActivityRows(),
  forecast: [createEmptyForecastRow()],
  planForNextMonth: createDefaultPlanForNextMonthRows(),
  drawingsRequired: [createEmptyDrawingRequiredRow()],
  challengesAnticipated: [createEmptyChallengeAnticipatedRow()],
  unitHandover: { rPlan: '', rAchieved: '', cPlan: '', cAchieved: '' },
  projectConfiguration: [],
  workCompletionStatus: createDefaultWorkCompletionStatus(),
});

// --- Calculation helpers --------------------------------------------------

/** Only count real daily entries — server also returns auto-generated weekly/monthly
 * aggregate rows (report_type 'weekly'/'monthly' or _is_aggregated) which must be
 * excluded here, otherwise VOWD/mandays get double-counted. */
const onlyDailyEntries = (entries) =>
  (entries || []).filter((e) => !e._is_aggregated && (e.report_type === 'daily' || !e.report_type));

export const labourRowTotal = (row) =>
  LABOUR_FIELDS.reduce((sum, field) => sum + (parseFloat(row?.[field]) || 0), 0);

/** Sum of value_of_work_done for progress entries in [monthStart, monthEnd]. */
export const calcMonthlyVowd = (progressEntries, monthStart, monthEnd) => {
  const start = normalizeDateKey(monthStart);
  const end = normalizeDateKey(monthEnd);
  if (!start || !end) return 0;

  const total = onlyDailyEntries(progressEntries).reduce((sum, entry) => {
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
  // Labour count is always a whole number, never shown with decimals.
  return Math.round(mandays / daysInMonth);
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

  const total = onlyDailyEntries(progressEntries).reduce((sum, entry) => {
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
