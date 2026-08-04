import { getPreviousMonthId } from './wprForm';

const normalizeKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const getMprActivitiesForDprDate = (
  allMprReports,
  reportDate,
  allWbsItems = [],
  allBudgetItems = [],
  subProjectId = ''
) => {
  if (!Array.isArray(allMprReports) || allMprReports.length === 0 || !reportDate) {
    return [];
  }

  const dprMonthId = String(reportDate).slice(0, 7);
  const targetPrevMonthId = getPreviousMonthId(dprMonthId);

  if (!targetPrevMonthId) return [];

  // Find matching MPR report for previous month
  const prevMpr =
    allMprReports.find((r) => r?.month_id === targetPrevMonthId && r?.status === 'approved') ||
    allMprReports.find((r) => r?.month_id === targetPrevMonthId && r?.status === 'submitted') ||
    allMprReports.find((r) => r?.month_id === targetPrevMonthId);

  if (!prevMpr) return [];

  let formData = prevMpr?.form_data;
  if (typeof formData === 'string') {
    try {
      formData = JSON.parse(formData);
    } catch {
      formData = null;
    }
  }

  // EXCLUSIVELY fetch construction activities from the MPR Forecast tab as Activity Master!
  const forecastRows = formData?.forecast;
  if (!Array.isArray(forecastRows) || forecastRows.length === 0) return [];

  const mprActivities = [];

  // Build fast lookup maps over ALL project WBS and Budget items
  const wbsByIdMap = new Map();
  const wbsMapNormalized = new Map();
  allWbsItems.forEach((w) => {
    if (w.id) wbsByIdMap.set(w.id, w);
    const norm = normalizeKey(w.title || w.name || w.activity_id || w.code);
    if (norm && !wbsMapNormalized.has(norm)) wbsMapNormalized.set(norm, w);
  });

  const budgetByIdMap = new Map();
  const budgetMapNormalized = new Map();
  allBudgetItems.forEach((b) => {
    if (b.id) budgetByIdMap.set(b.id, b);
    const norm = normalizeKey(b.title || b.name || b.code);
    if (norm && !budgetMapNormalized.has(norm)) budgetMapNormalized.set(norm, b);
  });

  forecastRows.forEach((row, idx) => {
    const title = String(row.description || row.activityName || row.name || row.title || '').trim();
    if (!title) return;

    const normKey = normalizeKey(title);

    // 1. Resolve master WBS Item and Budget Item
    const matchedWbs = row.wbsItemId
      ? wbsByIdMap.get(row.wbsItemId)
      : wbsMapNormalized.get(normKey);

    const matchedBudget = row.budgetItemId
      ? budgetByIdMap.get(row.budgetItemId)
      : matchedWbs
      ? allBudgetItems.find((b) => b.wbs_item_id === matchedWbs.id)
      : budgetMapNormalized.get(normKey);

    // 2. Resolve true Sub-Project ID directly from master WBS/Budget Item
    const itemSubProjectId =
      row.subProjectId ||
      row.sub_project_id ||
      matchedWbs?.sub_project_id ||
      matchedBudget?.sub_project_id ||
      '';

    // 3. Strict Sub-Project Scoping: Skip if activity belongs to a different sub-project
    if (subProjectId && itemSubProjectId && String(itemSubProjectId) !== String(subProjectId)) {
      return;
    }

    // 4. Total Qty MUST come directly from Budget Quantity (or WBS Planned Quantity)
    const totalBudgetQty = parseFloat(
      matchedBudget?.quantity ??
      matchedWbs?.planned_quantity ??
      row.totalQuantity ??
      row.quantity ??
      0
    ) || 0;

    mprActivities.push({
      id: row.id || `mpr_fc_${idx}_${normKey.slice(0, 10)}`,
      mprRowId: row.id,
      title,
      code: row.activityCode || matchedBudget?.code || matchedWbs?.code || '',
      unit: row.unit || matchedBudget?.unit || matchedWbs?.unit || 'no',
      rate: parseFloat(row.rate) || parseFloat(matchedBudget?.cost_per_unit) || 0,
      totalBudgetQty,
      wbs_item_id: row.wbsItemId || matchedWbs?.id || matchedBudget?.wbs_item_id || null,
      budget_item_id: row.budgetItemId || matchedBudget?.id || null,
      sub_project_id: itemSubProjectId || subProjectId || null,
      isMprFetched: true,
    });
  });

  return mprActivities;
};
