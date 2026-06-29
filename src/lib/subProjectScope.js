/** Helpers for scoping data to a selected sub-project via WBS links. */

export function getSubProjectWbsIds(wbsItems, subProjectId) {
  if (!subProjectId) return new Set();
  return new Set(
    wbsItems
      .filter((w) => w.sub_project_id === subProjectId)
      .map((w) => w.id)
  );
}

export function filterWbsBySubProject(wbsItems, subProjectId) {
  if (!subProjectId) return [];
  return wbsItems.filter((w) => w.sub_project_id === subProjectId);
}

export function filterByWbsScope(items, wbsIds, wbsField = 'wbs_item_id') {
  if (!wbsIds.size) return [];
  return items.filter((item) => item[wbsField] && wbsIds.has(item[wbsField]));
}

/** Keep budget rows linked to sub-project WBS plus their L1/L2 parents. */
export function filterBudgetBySubProject(budgetItems, wbsItems, subProjectId) {
  const wbsIds = getSubProjectWbsIds(wbsItems, subProjectId);
  if (!wbsIds.size) return [];

  const matched = new Set();
  budgetItems.forEach((b) => {
    if (b.wbs_item_id && wbsIds.has(b.wbs_item_id)) matched.add(b.id);
  });

  let added = true;
  while (added) {
    added = false;
    budgetItems.forEach((b) => {
      if (matched.has(b.id) && b.parent_id && !matched.has(b.parent_id)) {
        matched.add(b.parent_id);
        added = true;
      }
    });
  }

  return budgetItems.filter((b) => matched.has(b.id));
}

export function filterActivitiesBySubProject(activities, wbsItems, subProjectId) {
  const wbsIds = getSubProjectWbsIds(wbsItems, subProjectId);
  return filterByWbsScope(activities, wbsIds, 'wbs_item_id');
}

export function filterProgressBySubProject(progressEntries, budgetItems, wbsItems, subProjectId) {
  const scopedBudget = filterBudgetBySubProject(budgetItems, wbsItems, subProjectId);
  const budgetIds = new Set(scopedBudget.map((b) => b.id));
  const wbsIds = getSubProjectWbsIds(wbsItems, subProjectId);

  return progressEntries.filter((p) => {
    if (p.budget_item_id && budgetIds.has(p.budget_item_id)) return true;
    if (p.wbs_item_id && wbsIds.has(p.wbs_item_id)) return true;
    return false;
  });
}

const PHASE_WBS_HINTS = {
  foundation: ['mobil', 'excav', 'substruct', 'foundation', 'piling', 'shoring'],
  structure: ['frame', 'struct', 'slab', 'column', 'shear', 'concrete'],
  mep: ['mep', 'electrical', 'hvac', 'plumb', 'fire', 'drain'],
  finishing: ['finish', 'facade', 'drywall', 'paint', 'tile', 'glaz'],
  handover: ['handover', 'commission', 'testing', 'sign-off', 'snag'],
  other: [],
};

/** Suggest WBS links for generated schedule activities within a sub-project. */
export function linkActivitiesToSubProjectWbs(activities, wbsItems, subProjectId) {
  const scopedWbs = filterWbsBySubProject(wbsItems, subProjectId);
  if (!scopedWbs.length) return activities;

  const l2Items = scopedWbs.filter((w) => w.level === 2);
  const fallback = l2Items[0] || scopedWbs.find((w) => w.level === 1);

  return activities.map((act) => {
    if (act.wbs_item_id) return act;
    const hints = PHASE_WBS_HINTS[act.phase] || PHASE_WBS_HINTS.other;
    const haystack = (w) => `${w.code || ''} ${w.title || ''}`.toLowerCase();
    const match =
      l2Items.find((w) => hints.some((h) => haystack(w).includes(h))) ||
      fallback;
    return match ? { ...act, wbs_item_id: match.id } : act;
  });
}
