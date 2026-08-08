import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Lock, Save, FileCheck, Printer } from 'lucide-react';
import { formatCurrencyINR, formatNumberIndian, normalizeDateKey } from '@/lib/formatters';
import {
  createDefaultMprForm,
  createEmptyScheduleSummaryRow,
  parseMprFormData,
  parseBuildingConfigurations,
  syncProjectConfigurationFromMaster,
  calcMonthlyVowd,
  calcMonthlyMandays,
  calcMonthlyAvgManpower,
  calcMonthlySteelVowd,
  sumForecastAmount,
  sumForecastField,
  sumForecastAmountForSteel,
  forecastRowQty,
  planForNextMonthRowTotal,
  collectWprBillsForMonth,
  mergeContractorBillsFromWpr,
  collectWprRequisitionsForMonth,
  mergeMaterialRequisitionsFromWpr,
  ensureMaterialReconciliationTemplate,
  ensureKeyActivitiesTemplate,
  ensureWorkCompletionStatus,
} from '@/lib/mprForm';
import { getPreviousMonthId, getDaysInMonthId, getNextMonthId, getMonthLabelFromId } from '@/lib/mprMonths';
import MprReviewDialog from '@/components/progress/MprReviewDialog';
import MprPrintReport from '@/components/progress/mpr/MprPrintReport';
import ExecutiveSummarySection from '@/components/progress/mpr/ExecutiveSummarySection';
import ProjectScheduleSummarySection from '@/components/progress/mpr/ProjectScheduleSummarySection';
import DelaySummarySection from '@/components/progress/mpr/DelaySummarySection';
import MaterialConsumptionSection from '@/components/progress/mpr/MaterialConsumptionSection';
import PlanVsAchievementSection from '@/components/progress/mpr/PlanVsAchievementSection';
import WorkCompletionStatusSection from '@/components/progress/mpr/WorkCompletionStatusSection';
import ContractorBillsSection from '@/components/progress/mpr/ContractorBillsSection';
import MaterialRequisitionSection from '@/components/progress/mpr/MaterialRequisitionSection';
import MaterialReconciliationSection from '@/components/progress/mpr/MaterialReconciliationSection';
import WorkOrdersSection from '@/components/progress/mpr/WorkOrdersSection';
import DrawingsReceivedSection from '@/components/progress/mpr/DrawingsReceivedSection';
import ChallengesEncounteredSection from '@/components/progress/mpr/ChallengesEncounteredSection';
import KeyActivitiesSection from '@/components/progress/mpr/KeyActivitiesSection';
import ForecastSection from '@/components/progress/mpr/ForecastSection';
import PlanForNextMonthSection from '@/components/progress/mpr/PlanForNextMonthSection';
import DrawingsRequiredSection from '@/components/progress/mpr/DrawingsRequiredSection';
import ChallengesAnticipatedSection from '@/components/progress/mpr/ChallengesAnticipatedSection';
import UnitHandoverSection from '@/components/progress/mpr/UnitHandoverSection';
import ProjectConfigurationSection from '@/components/progress/mpr/ProjectConfigurationSection';

const SECTIONS = [
  { id: 'executive-summary', label: 'Executive Summary' },
  { id: 'schedule-summary', label: 'Project Schedule Summary' },
  { id: 'delay-summary', label: 'Delay Summary' },
  { id: 'material-consumption', label: 'Material, VOWD & Labor' },
  { id: 'plan-vs-achievement', label: 'Plan V/s Achievement' },
  { id: 'work-completion-status', label: 'Work Completion Status' },
  { id: 'contractor-bills', label: 'Contractor Bills' },
  { id: 'material-requisition', label: 'Material Requisition' },
  { id: 'material-reconciliation', label: 'Material Reconciliation' },
  { id: 'work-orders', label: 'Work Orders Issued' },
  { id: 'drawings-received', label: 'Drawings Received' },
  { id: 'challenges-encountered', label: 'Challenges Encountered' },
  { id: 'key-activities', label: 'Key Activities' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'plan-for-next-month', label: 'Weekly Plan for Next Month' },
  { id: 'drawings-required', label: 'Drawings Required' },
  { id: 'challenges-anticipated', label: 'Challenges Anticipated' },
  { id: 'unit-handover', label: 'Unit Handover' },
  { id: 'project-configuration', label: 'Project Configuration' },
];

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

function isActivityL1Approved(activity, wbsItems) {
  if (!activity || !Array.isArray(wbsItems) || wbsItems.length === 0) return false;

  const wbsById = new Map(wbsItems.map((w) => [w.id, w]));

  // 1. Trace parent_id up the hierarchy tree to find the Level 1 item
  let current = activity;
  let depth = 0;
  let l1Item = null;

  while (current && depth < 5) {
    const level = Number(current.level) || 0;
    const levelText = String(current.level || '').toLowerCase();
    if (level === 1 || levelText === 'l1') {
      l1Item = current;
      break;
    }
    if (!current.parent_id) break;
    current = wbsById.get(current.parent_id);
    depth++;
  }

  // 2. Fallback: if parent_id chain didn't reach L1, find L1 by code prefix (e.g. "4" from "4.2.1")
  if (!l1Item) {
    const codePrefix = String(activity.code || activity.activity_code || '').split('.')[0];
    if (codePrefix) {
      l1Item = wbsItems.find((w) => {
        const lvl = Number(w.level) || 0;
        const lvlTxt = String(w.level || '').toLowerCase();
        const isL1 = lvl === 1 || lvlTxt === 'l1';
        if (!isL1) return false;
        const wCode = String(w.code || '');
        return (
          wCode === codePrefix ||
          wCode === `${codePrefix}.0` ||
          wCode.split('.')[0] === codePrefix
        );
      });
    }
  }

  if (!l1Item) return false;

  // 3. Check L1 item status: MUST be strictly 'approved'
  const status = String(l1Item.status || '').trim().toLowerCase();
  return status === 'approved';
}

/** Leaf-level (executable) activities only — restricted to Approved WBS heads. */
function buildActivityOptions(wbsItems, budgetItems) {
  const budgetByWbsId = new Map();
  (budgetItems || []).forEach((item) => {
    if (item.wbs_item_id && !budgetByWbsId.has(item.wbs_item_id)) {
      budgetByWbsId.set(item.wbs_item_id, item);
    }
  });

  const activityItems = (wbsItems || []).filter((item) => {
    const levelNumber = Number(item.level);
    const levelText = String(item.level || '').trim().toLowerCase();
    const hasActivityId = String(item.activity_id || '').trim() !== '';
    const isActivity = levelNumber === 3 || levelText === 'l3' || hasActivityId;
    if (!isActivity) return false;

    // EXCLUSIVELY include activities under Approved L1 WBS Heads!
    return isActivityL1Approved(item, wbsItems);
  });

  return activityItems.map((activity) => {
    const linkedBudget = budgetByWbsId.get(activity.id);
    const code = linkedBudget?.code || activity.activity_code || activity.activity_id || activity.code || '';
    const title = linkedBudget?.title || activity.title || activity.name || 'Activity';
    return {
      value: activity.id,
      label: code ? `${code} — ${title}` : title,
      code,
      title,
      unit: linkedBudget?.unit || activity.unit || '',
      rate: linkedBudget?.cost_per_unit ?? activity.lumsum_rate ?? '',
      wbsItemId: activity.id,
      budgetItemId: linkedBudget?.id || '',
      activityKey: normalizeKey(title),
    };
  });
}

export default function MprSheetPanel({
  projectId,
  selectedProject,
  month,
  submittedBy = 'Supervisor',
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => createDefaultMprForm());
  const [reportId, setReportId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [loadedKey, setLoadedKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showPrintReport, setShowPrintReport] = useState(false);
  const [mprSubTab, setMprSubTab] = useState('executive-summary');

  const monthId = month?.id || '';
  const monthStart = month?.startDate || '';
  const monthEnd = month?.endDate || '';
  const scopeKey = `${projectId}:${monthId}`;
  const isLocked = status === 'approved';
  const prevMonthId = getPreviousMonthId(monthId);
  const prev2MonthId = getPreviousMonthId(prevMonthId);
  const daysInMonth = getDaysInMonthId(monthId);
  const nextMonthLabel = getMonthLabelFromId(getNextMonthId(monthId));

  const { data: fetchedProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.get(projectId),
    enabled: !!projectId,
    refetchOnMount: 'always',
  });
  const projectData = fetchedProject || selectedProject;

  const { data: existingReports = [], isLoading: reportLoading } = useQuery({
    queryKey: ['mpr-report', projectId, monthId],
    queryFn: () => base44.entities.MprReport.filter({ project_id: projectId, month_id: monthId }),
    enabled: !!projectId && !!monthId,
  });

  const { data: prevReports = [] } = useQuery({
    queryKey: ['mpr-report', projectId, prevMonthId],
    queryFn: () => base44.entities.MprReport.filter({ project_id: projectId, month_id: prevMonthId }),
    enabled: !!projectId && !!prevMonthId,
  });

  const { data: prev2Reports = [] } = useQuery({
    queryKey: ['mpr-report', projectId, prev2MonthId],
    queryFn: () => base44.entities.MprReport.filter({ project_id: projectId, month_id: prev2MonthId }),
    enabled: !!projectId && !!prev2MonthId,
  });

  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budgetItems', projectId],
    queryFn: () => base44.entities.BudgetItem.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: wbsItems = [] } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => base44.entities.WBSItem.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: wbsHeaders = [] } = useQuery({
    queryKey: ['wbsHeaders', projectId],
    queryFn: () => base44.entities.WbsHeader.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: rawProgressEntries = [], isLoading: progressLoading } = useQuery({
    queryKey: ['mpr-progress', projectId],
    queryFn: () => base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 5000),
    enabled: !!projectId,
  });

  // Server also returns auto-generated weekly/monthly aggregate rows alongside daily
  // entries — exclude them here so VOWD / quantities are never double-counted.
  const progressEntries = useMemo(
    () => rawProgressEntries.filter((e) => !e._is_aggregated && (e.report_type === 'daily' || !e.report_type)),
    [rawProgressEntries]
  );

  const { data: labourEntries = [], isLoading: labourLoading } = useQuery({
    queryKey: ['mpr-labours', projectId],
    queryFn: () => base44.entities.ContractorLabour.filter({ project_id: projectId }, '-date', 5000),
    enabled: !!projectId,
  });

  const { data: wprReports = [] } = useQuery({
    queryKey: ['wpr-reports-for-mpr', projectId, monthId],
    queryFn: () => base44.entities.WprReport.filter({ project_id: projectId }),
    enabled: !!projectId && !!monthId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const wprContractorBills = useMemo(
    () => collectWprBillsForMonth(wprReports, monthId),
    [wprReports, monthId]
  );

  const wprMaterialRequisitions = useMemo(
    () => collectWprRequisitionsForMonth(wprReports, monthId),
    [wprReports, monthId]
  );

  const budgetItemsById = useMemo(() => new Map(budgetItems.map((b) => [b.id, b])), [budgetItems]);
  const wbsItemsById = useMemo(() => new Map(wbsItems.map((w) => [w.id, w])), [wbsItems]);
  const activityOptions = useMemo(
    () => buildActivityOptions(wbsItems, budgetItems),
    [wbsItems, budgetItems]
  );

  const prevForm = useMemo(() => parseMprFormData(prevReports[0]?.form_data), [prevReports]);
  const prev2Form = useMemo(() => parseMprFormData(prev2Reports[0]?.form_data), [prev2Reports]);
  const previousScheduleRows = useMemo(() => [
    ...(prev2Form?.scheduleSummaryRows || []),
    ...(prevForm?.scheduleSummaryRows || []),
  ], [prev2Form, prevForm]);

  // --- Live computed values -------------------------------------------------
  const monthlyVowd = useMemo(
    () => calcMonthlyVowd(progressEntries, monthStart, monthEnd),
    [progressEntries, monthStart, monthEnd]
  );
  const monthlySteelVowd = useMemo(
    () => calcMonthlySteelVowd(progressEntries, wbsItemsById, budgetItemsById, monthStart, monthEnd),
    [progressEntries, wbsItemsById, budgetItemsById, monthStart, monthEnd]
  );
  const monthlyMandays = useMemo(
    () => calcMonthlyMandays(labourEntries, monthStart, monthEnd),
    [labourEntries, monthStart, monthEnd]
  );
  const monthlyAvgManpower = useMemo(
    () => calcMonthlyAvgManpower(labourEntries, monthStart, monthEnd, daysInMonth),
    [labourEntries, monthStart, monthEnd, daysInMonth]
  );

  const thisMonthForecastTotal = useMemo(() => sumForecastAmount(form.forecast), [form.forecast]);
  const thisMonthForecastCement = useMemo(() => sumForecastField(form.forecast, 'cementBags'), [form.forecast]);
  const thisMonthForecastSteel = useMemo(() => sumForecastAmountForSteel(form.forecast, wbsItemsById), [form.forecast, wbsItemsById]);

  // "Next Month Target" for labour is sourced from the "Weekly Plan for Next Month"
  // section's Total Month Plan for the "Weekly Total Labour Count" row, not the
  // separate Forecast tab, so both sections stay consistent.
  const nextMonthLabourPlanTotal = useMemo(
    () =>
      (form.planForNextMonth || [])
        .filter((row) => row.parameterKey === 'avgLabour')
        .reduce((sum, row) => sum + planForNextMonthRowTotal(row), 0),
    [form.planForNextMonth]
  );
  const daysInNextMonth = useMemo(() => getDaysInMonthId(getNextMonthId(monthId)), [monthId]);
  const nextMonthLabourPlanAvg = daysInNextMonth ? nextMonthLabourPlanTotal / daysInNextMonth : 0;

  const prevForecastRows = prevForm?.forecast || [];
  const prevForecastTotal = useMemo(() => sumForecastAmount(prevForecastRows), [prevForecastRows]);
  const prevForecastCement = useMemo(() => sumForecastField(prevForecastRows, 'cementBags'), [prevForecastRows]);
  const prevForecastSteel = useMemo(() => sumForecastAmountForSteel(prevForecastRows, wbsItemsById), [prevForecastRows, wbsItemsById]);
  const prevForecastLabour = useMemo(() => sumForecastField(prevForecastRows, 'totalLabourRequired'), [prevForecastRows]);
  const prevForecastLabourAvg = daysInMonth ? prevForecastLabour / daysInMonth : 0;

  // Target (this month) for Mandays / Average Man Power should carry forward exactly
  // what the previous month's MPR showed as its "Next Month Target" — i.e. the Total
  // Month Plan of "Weekly Total Labour Count" from that month's Weekly Plan for Next
  // Month tab — so it auto-fetches into the new month's Target column.
  const prevMonthLabourPlanTotal = useMemo(
    () =>
      (prevForm?.planForNextMonth || [])
        .filter((row) => row.parameterKey === 'avgLabour')
        .reduce((sum, row) => sum + planForNextMonthRowTotal(row), 0),
    [prevForm]
  );
  const prevMonthLabourPlanAvg = daysInMonth ? prevMonthLabourPlanTotal / daysInMonth : 0;

  // Plan V/s Achievement — auto-seeded from prev month forecast + this month's executed activities
  const planVsAchievementRows = useMemo(() => {
    const byKey = new Map();

    prevForecastRows.forEach((row) => {
      const key = row.activityKey || normalizeKey(row.description);
      if (!key) return;
      const qty = forecastRowQty(row);
      const existing = byKey.get(key) || {
        activityKey: key,
        activity: row.description,
        unit: row.unit,
        rate: parseFloat(row.rate) || 0,
        plannedQty: 0,
        achievedQty: 0,
      };
      existing.plannedQty += qty;
      byKey.set(key, existing);
    });

    const start = normalizeDateKey(monthStart);
    const end = normalizeDateKey(monthEnd);
    (progressEntries || []).forEach((entry) => {
      const date = normalizeDateKey(entry.date);
      if (!date || date < start || date > end) return;
      const budgetItem = entry.budget_item_id ? budgetItemsById.get(entry.budget_item_id) : null;
      const wbsItem = entry.wbs_item_id ? wbsItemsById.get(entry.wbs_item_id) : (budgetItem?.wbs_item_id ? wbsItemsById.get(budgetItem.wbs_item_id) : null);
      const title = budgetItem?.title || wbsItem?.title || entry.work_done_description;
      const key = normalizeKey(title);
      if (!key) return;
      // Same rate fallback the DPR worksheet uses: Budget Item cost_per_unit first,
      // then the WBS activity's own lumsum_rate for activities with no linked budget item.
      const resolvedRate = parseFloat(budgetItem?.cost_per_unit ?? wbsItem?.lumsum_rate ?? 0) || 0;
      const existing = byKey.get(key) || {
        activityKey: key,
        activity: title,
        unit: budgetItem?.unit || wbsItem?.unit || entry.unit || '',
        rate: resolvedRate,
        plannedQty: 0,
        achievedQty: 0,
        achievedVowd: 0,
      };
      existing.achievedQty += parseFloat(entry.quantity_done) || 0;
      // Sum the VOWD already recorded on the DPR entry directly, rather than
      // re-deriving it from the rate — this stays correct even if the rate lookup
      // above still can't resolve to anything for a given activity.
      existing.achievedVowd = (existing.achievedVowd || 0) + (parseFloat(entry.value_of_work_done) || 0);
      if (!existing.unit) existing.unit = budgetItem?.unit || wbsItem?.unit || entry.unit || '';
      if (!existing.rate) existing.rate = resolvedRate;
      byKey.set(key, existing);
    });

    return Array.from(byKey.values()).map((row) => {
      // Last-resort fallback: if no rate could be resolved anywhere but we do have
      // both an achieved quantity and a recorded VOWD, back into the effective rate
      // so the Rate column is never blank when an amount is clearly showing.
      const rate = row.rate || (row.achievedQty ? (row.achievedVowd || 0) / row.achievedQty : 0);
      return {
        ...row,
        rate,
        plannedAmount: row.plannedQty * rate,
        achievedAmount: row.achievedVowd || (row.achievedQty * rate),
      };
    });
  }, [prevForecastRows, progressEntries, budgetItemsById, wbsItemsById, monthStart, monthEnd]);

  // Reset when month/project changes
  useEffect(() => {
    setLoadedKey('');
    setReportId(null);
    setStatus('draft');
    setForm(createDefaultMprForm());
  }, [scopeKey]);

  // Hydrate from saved report
  useEffect(() => {
    if (reportLoading || !monthId || loadedKey === scopeKey) return;

    const existing = existingReports[0];
    const parsed = parseMprFormData(existing?.form_data);
    const base = createDefaultMprForm();
    const masterConfigs = parseBuildingConfigurations(projectData?.building_configurations);

    if (parsed) {
      const merged = { ...base, ...parsed };
      merged.projectConfiguration = syncProjectConfigurationFromMaster(
        masterConfigs,
        merged.projectConfiguration
      );
      merged.materialReconciliation = ensureMaterialReconciliationTemplate(merged.materialReconciliation);
      merged.keyActivities = ensureKeyActivitiesTemplate(merged.keyActivities);
      merged.workCompletionStatus = ensureWorkCompletionStatus(merged.workCompletionStatus);
      // Coerce Average Man Power to whole numbers (legacy drafts may still store decimals).
      const amp = merged.materialConsumption?.avgManpower;
      if (amp) {
        const roundOrBlank = (v) => (v === '' || v == null ? v : Math.round(Number(v) || 0));
        merged.materialConsumption = {
          ...merged.materialConsumption,
          avgManpower: {
            ...amp,
            target: roundOrBlank(amp.target),
            achieved: roundOrBlank(amp.achieved) ?? 0,
            nextMonthTarget: roundOrBlank(amp.nextMonthTarget) ?? 0,
          },
        };
      }
      setForm(merged);
      setReportId(existing.id);
      setStatus(existing.status || 'draft');
    } else {
      setForm({
        ...base,
        scheduleSummaryRows: [
          createEmptyScheduleSummaryRow({ monthConsidered: month?.label ? month.label.replace(' ', '-') : '' }),
        ],
        materialConsumption: {
          vowd: { target: prevForecastTotal || '', achieved: 0, nextMonthTarget: 0 },
          cement: { target: prevForecastCement || '', achieved: '', nextMonthTarget: 0 },
          steel: { target: prevForecastSteel, achieved: 0, nextMonthTarget: 0 },
          mandays: { target: prevMonthLabourPlanTotal || prevForecastLabour || '', achieved: 0, nextMonthTarget: 0 },
          avgManpower: {
            target: Math.round(prevMonthLabourPlanAvg) || Math.round(prevForecastLabourAvg) || '',
            achieved: 0,
            nextMonthTarget: 0,
          },
        },
        projectConfiguration: syncProjectConfigurationFromMaster(masterConfigs, []),
      });
      setReportId(null);
      setStatus('draft');
    }
    setLoadedKey(scopeKey);
  }, [existingReports, reportLoading, scopeKey, monthId, month, loadedKey, prevForecastTotal, prevForecastCement, prevForecastSteel, prevForecastLabour, prevForecastLabourAvg, prevMonthLabourPlanTotal, prevMonthLabourPlanAvg, projectData?.building_configurations]);

  // Keep Project Configuration in sync with Project Master Sub Projects on open/refresh
  useEffect(() => {
    if (isLocked || loadedKey !== scopeKey || !projectData) return;
    const masterConfigs = parseBuildingConfigurations(projectData.building_configurations);
    setForm((prev) => {
      const nextRows = syncProjectConfigurationFromMaster(masterConfigs, prev.projectConfiguration);
      const prevJson = JSON.stringify(prev.projectConfiguration || []);
      const nextJson = JSON.stringify(nextRows);
      if (prevJson === nextJson) return prev;
      return { ...prev, projectConfiguration: nextRows };
    });
  }, [isLocked, loadedKey, scopeKey, projectData?.building_configurations, projectData?.updated_date]);

  // Pull WPR "6. Bills to certify" into MPR Contractor Bills (Date / Work / RA Bill No / Agency / Amount)
  useEffect(() => {
    if (isLocked || loadedKey !== scopeKey) return;
    if (!wprContractorBills.length) return;

    setForm((prev) => {
      const merged = mergeContractorBillsFromWpr(prev.contractorBills, wprContractorBills);
      if (JSON.stringify(prev.contractorBills) === JSON.stringify(merged)) return prev;
      return { ...prev, contractorBills: merged };
    });
  }, [isLocked, loadedKey, scopeKey, wprContractorBills]);

  // Pull WPR "5. No of Requisition Of Material" into MPR Material Requisition (achieved only)
  useEffect(() => {
    if (isLocked || loadedKey !== scopeKey) return;
    if (!wprMaterialRequisitions.length) return;

    setForm((prev) => {
      const merged = mergeMaterialRequisitionsFromWpr(prev.materialRequisitions, wprMaterialRequisitions);
      if (JSON.stringify(prev.materialRequisitions) === JSON.stringify(merged)) return prev;
      return { ...prev, materialRequisitions: merged };
    });
  }, [isLocked, loadedKey, scopeKey, wprMaterialRequisitions]);

  // Keep locked computed fields in sync while editing. Also backfill Target from the
  // previous month's "Next Month Target" whenever Target is still blank — this covers
  // reports that were already created before their Target could be auto-fetched, without
  // ever overwriting a value the user has actually entered.
  useEffect(() => {
    if (isLocked || loadedKey !== scopeKey) return;
    const isBlank = (v) => v === '' || v === null || v === undefined;
    const avgManpowerFallback = Math.round(prevMonthLabourPlanAvg) || Math.round(prevForecastLabourAvg) || '';

    setForm((prev) => {
      const mc = prev.materialConsumption;
      return {
        ...prev,
        materialConsumption: {
          vowd: {
            ...mc.vowd,
            target: isBlank(mc.vowd.target) && prevForecastTotal ? prevForecastTotal : mc.vowd.target,
            achieved: monthlyVowd,
            nextMonthTarget: thisMonthForecastTotal,
          },
          cement: {
            ...mc.cement,
            target: isBlank(mc.cement.target) && prevForecastCement ? prevForecastCement : mc.cement.target,
            nextMonthTarget: thisMonthForecastCement,
          },
          steel: { ...mc.steel, target: prevForecastSteel, achieved: monthlySteelVowd, nextMonthTarget: thisMonthForecastSteel },
          mandays: {
            ...mc.mandays,
            target: isBlank(mc.mandays.target) && (prevMonthLabourPlanTotal || prevForecastLabour)
              ? (prevMonthLabourPlanTotal || prevForecastLabour)
              : mc.mandays.target,
            achieved: monthlyMandays,
            nextMonthTarget: nextMonthLabourPlanTotal,
          },
          avgManpower: {
            ...mc.avgManpower,
            // Always coerce to whole numbers — legacy saved targets may still have decimals.
            target: (() => {
              const t = isBlank(mc.avgManpower.target) && avgManpowerFallback
                ? avgManpowerFallback
                : mc.avgManpower.target;
              return isBlank(t) ? t : Math.round(Number(t) || 0);
            })(),
            achieved: monthlyAvgManpower,
            nextMonthTarget: Math.round(nextMonthLabourPlanAvg),
          },
        },
      };
    });
  }, [
    isLocked, loadedKey, scopeKey, monthlyVowd, monthlySteelVowd, monthlyMandays, monthlyAvgManpower,
    thisMonthForecastTotal, thisMonthForecastCement, thisMonthForecastSteel, nextMonthLabourPlanTotal, nextMonthLabourPlanAvg,
    prevForecastSteel, prevForecastTotal, prevForecastCement, prevForecastLabour, prevForecastLabourAvg,
    prevMonthLabourPlanTotal, prevMonthLabourPlanAvg,
  ]);

  const updateSection = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const buildPayload = useCallback((nextStatus) => ({
    project_id: projectId,
    month_id: monthId,
    month_start: monthStart,
    month_end: monthEnd,
    status: nextStatus,
    form_data: JSON.stringify(form),
    submitted_by: submittedBy || 'Supervisor',
    submitted_at: nextStatus === 'submitted' ? new Date().toISOString() : null,
  }), [form, projectId, monthId, monthStart, monthEnd, submittedBy]);

  const persist = async (nextStatus) => {
    const payload = buildPayload(nextStatus);
    if (reportId) {
      const updated = await base44.entities.MprReport.update(reportId, payload);
      setReportId(updated?.id || reportId);
    } else {
      const created = await base44.entities.MprReport.create(payload);
      setReportId(created?.id || null);
    }
    setStatus(nextStatus);
    queryClient.invalidateQueries({ queryKey: ['mpr-report', projectId, monthId] });
  };

  const handleSaveDraft = async () => {
    if (isLocked) return;
    setSaving(true);
    try {
      await persist('draft');
      toast({ title: 'Draft Saved', description: 'Monthly progress report saved as draft.' });
    } catch (err) {
      toast({ title: 'Save Failed', description: err?.message || 'Could not save draft.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReview = () => {
    if (isLocked) {
      toast({ title: 'Month Locked', description: 'This MPR is already submitted and cannot be changed.', variant: 'destructive' });
      return;
    }
    setShowReview(true);
  };

  const handleConfirmSubmit = async () => {
    setSaving(true);
    try {
      await persist('submitted');
      setShowReview(false);
      toast({ title: 'MPR Submitted', description: 'Monthly report submitted for review.' });
    } catch (err) {
      toast({ title: 'Submit Failed', description: err?.message || 'Could not submit MPR.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReport = async () => {
    setSaving(true);
    try {
      await persist('approved');
      setShowReview(false);
      toast({ title: 'MPR Approved & Locked', description: 'Monthly report approved and locked for this month.' });
    } catch (err) {
      toast({ title: 'Approve Failed', description: err?.message || 'Could not approve MPR.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockReport = async () => {
    setSaving(true);
    try {
      await persist('draft');
      toast({ title: 'Report Unlocked', description: 'MPR report unlocked and restored to draft mode.' });
    } catch (err) {
      toast({ title: 'Unlock Failed', description: err?.message || 'Could not unlock report.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reviewSections = useMemo(() => {
    const textRows = (rows, columns) => (rows || [])
      .filter((r) => columns.some((c) => (r[c.key] ?? '').toString().trim()))
      .map((r, i) => ({ id: r.id, sr: i + 1, ...r }));

    const mc = form.materialConsumption;
    const formatMcRow = (row, isMonetary, wholeNumber = false) => {
      const fmt = (v) => {
        const n = wholeNumber ? Math.round(Number(v) || 0) : v;
        return isMonetary ? formatCurrencyINR(n) : formatNumberIndian(n, wholeNumber ? 0 : undefined);
      };
      return {
        target: row.target === '' || row.target == null ? '—' : fmt(row.target),
        achieved: row.achieved === '' || row.achieved == null ? '—' : fmt(row.achieved),
        nextMonthTarget: row.nextMonthTarget === '' || row.nextMonthTarget == null ? '—' : fmt(row.nextMonthTarget),
      };
    };
    return [
      { title: 'Executive Summary', layout: 'html', html: form.executiveSummary },
      {
        title: 'Project Schedule Summary',
        columns: [
          { key: 'monthConsidered', label: 'Month' },
          { key: 'revisedCompletionDate', label: 'Revised Completion' },
          { key: 'trackedCompletionDate', label: 'Tracked Completion' },
        ],
        rows: textRows(form.scheduleSummaryRows, [{ key: 'monthConsidered' }]),
      },
      {
        title: 'Delay Summary',
        columns: [
          { key: 'sr', label: 'Sr' },
          { key: 'activity', label: 'Activity' },
          { key: 'percentComplete', label: '% Complete', align: 'right' },
          { key: 'accountabilityRemarks', label: 'Remarks' },
        ],
        rows: textRows(form.delayRows, [{ key: 'activity' }]),
      },
      {
        title: 'Material, VOWD & Labor',
        columns: [
          { key: 'label', label: 'Description' },
          { key: 'target', label: 'Target', align: 'right' },
          { key: 'achieved', label: 'Achieved', align: 'right' },
          { key: 'nextMonthTarget', label: 'Next Month Target', align: 'right' },
        ],
        rows: [
          { label: 'VOWD', ...formatMcRow(mc.vowd, true) },
          { label: 'Cement (Bags)', ...formatMcRow(mc.cement, false) },
          { label: 'Steel (MT)', ...formatMcRow(mc.steel, true) },
          { label: 'Mandays', ...formatMcRow(mc.mandays, false) },
          { label: 'Average Man Power', ...formatMcRow(mc.avgManpower, false, true) },
        ],
      },
      {
        title: 'Plan V/s Achievement',
        columns: [
          { key: 'activity', label: 'Activity' },
          { key: 'plannedQty', label: 'Planned Qty', align: 'right' },
          { key: 'achievedQty', label: 'Achieved Qty', align: 'right' },
          { key: 'achievedAmount', label: 'Achieved Amt', align: 'right', render: (r) => formatCurrencyINR(r.achievedAmount || 0) },
        ],
        rows: planVsAchievementRows,
      },
      {
        title: 'Work Completion Status',
        columns: [
          { key: 'note', label: 'Summary' },
        ],
        rows: [{
          id: 'wcs',
          note: 'Sub-project wise Total Flats / Completed Flats for sections A, B and C (fixed activities).',
        }],
      },
      {
        title: 'Contractor Bills',
        columns: [
          { key: 'date', label: 'Date' }, { key: 'work', label: 'Work' },
          { key: 'agencyName', label: 'Agency' },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrencyINR(r.amount || 0) },
        ],
        rows: textRows(form.contractorBills, [{ key: 'work' }]),
      },
      {
        title: 'Material Requisition Details',
        columns: [
          { key: 'date', label: 'Date' }, { key: 'requisitionNo', label: 'Requisition No' },
          { key: 'particulars', label: 'Particulars' }, { key: 'qty', label: 'Qty', align: 'right' },
        ],
        rows: textRows(form.materialRequisitions, [{ key: 'particulars' }]),
      },
      {
        title: 'Cumulative Material Reconciliation',
        columns: [
          { key: 'srNo', label: 'Sr' },
          { key: 'materialDescription', label: 'Material' },
          { key: 'unit', label: 'Unit' },
          { key: 'theoreticalConsumption', label: 'Theoretical', align: 'right' },
          { key: 'actualConsumption', label: 'Actual', align: 'right' },
        ],
        rows: (form.materialReconciliation || [])
          .filter((r) => r.rowType === 'item' || (!r.rowType && (r.materialDescription || '').trim()))
          .map((r, i) => ({ id: r.id, sr: i + 1, srNo: r.srNo || i + 1, ...r })),
      },
      {
        title: 'Work Orders Issued',
        columns: [
          { key: 'item', label: 'Item' }, { key: 'issuedTo', label: 'Issued To' },
          { key: 'contractAmount', label: 'Contract Amount', align: 'right', render: (r) => formatCurrencyINR(r.contractAmount || 0) },
          { key: 'woStatus', label: 'Status' },
        ],
        rows: textRows(form.workOrders, [{ key: 'item' }]),
      },
      {
        title: 'List of Drawings Received',
        columns: [
          { key: 'drawingName', label: 'Drawing Name' }, { key: 'drawingNo', label: 'Drawing No' },
          { key: 'buildingName', label: 'Building' }, { key: 'receivedDate', label: 'Received Date' },
        ],
        rows: textRows(form.drawingsReceived, [{ key: 'drawingName' }]),
      },
      {
        title: 'Challenges Encountered',
        columns: [{ key: 'challenge', label: 'Challenge' }, { key: 'correctiveAction', label: 'Corrective Action' }],
        rows: textRows(form.challengesEncountered, [{ key: 'challenge' }]),
      },
      {
        title: 'Key Activities',
        columns: [
          { key: 'categoryLabel', label: 'Details' },
          { key: 'currentMonthPlan', label: 'Plan' },
          { key: 'currentMonthStatus', label: 'Status' },
          { key: 'upcomingMonthForecast', label: 'Forecast' },
        ],
        rows: (form.keyActivities || [])
          .filter(
            (r) =>
              (r.currentMonthPlan || '').trim() ||
              (r.currentMonthStatus || '').trim() ||
              (r.upcomingMonthForecast || '').trim()
          )
          .map((r, i) => ({
            id: r.id,
            sr: i + 1,
            categoryLabel: r.category === 'finish' ? 'Key Activities to Finish' : 'Key activities to Start',
            currentMonthPlan: r.currentMonthPlan || '—',
            currentMonthStatus: r.currentMonthStatus || '—',
            upcomingMonthForecast: r.upcomingMonthForecast || '—',
          })),
      },
      {
        title: 'Forecast',
        columns: [
          { key: 'description', label: 'Activity' }, { key: 'unit', label: 'Unit' },
          { key: 'totalAmount', label: 'Total Amount', align: 'right', render: (r) => formatCurrencyINR((forecastRowQty(r)) * (parseFloat(r.rate) || 0)) },
        ],
        rows: textRows(form.forecast, [{ key: 'description' }]),
      },
      {
        title: 'List of Drawings Required',
        columns: [
          { key: 'drawingName', label: 'Drawing Name' }, { key: 'buildingName', label: 'Building' },
          { key: 'requiredDate', label: 'Required Date' },
        ],
        rows: textRows(form.drawingsRequired, [{ key: 'drawingName' }]),
      },
      {
        title: 'Challenges Anticipated',
        columns: [{ key: 'challenge', label: 'Challenge' }, { key: 'actionToBeTaken', label: 'Action' }],
        rows: textRows(form.challengesAnticipated, [{ key: 'challenge' }]),
      },
      {
        title: 'Unit Handover',
        columns: [
          { key: 'rPlan', label: '(R) Plan', align: 'right' }, { key: 'rAchieved', label: '(R) Achieved', align: 'right' },
          { key: 'cPlan', label: '(C) Plan', align: 'right' }, { key: 'cAchieved', label: '(C) Achieved', align: 'right' },
        ],
        rows: [form.unitHandover],
      },
      {
        title: 'Project Configuration',
        columns: [
          { key: 'building', label: 'Building' }, { key: 'noOfFloor', label: 'Floors', align: 'right' },
          { key: 'noOfUnitsResidential', label: 'Res. Units', align: 'right' }, { key: 'noOfUnitsCommercial', label: 'Comm. Units', align: 'right' },
        ],
        rows: textRows(form.projectConfiguration, [{ key: 'building' }]),
      },
    ];
  }, [form, planVsAchievementRows]);

  const loading = reportLoading || progressLoading || labourLoading;

  if (!month) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Select a month to fill the Monthly Progress Report.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {loading && loadedKey !== scopeKey ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading MPR…
        </div>
      ) : (
        <>
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Monthly Progress Report — {month?.label || 'selected month'}
              </CardTitle>
              <div className="flex items-center gap-2">
                {status === 'approved' ? (
                  <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                    <Lock className="w-3 h-3" /> Approved — Locked
                  </Badge>
                ) : status === 'submitted' ? (
                  <Badge className="bg-blue-100 text-blue-800 gap-1">
                    <FileCheck className="w-3 h-3" /> Submitted — Editable
                  </Badge>
                ) : reportId ? (
                  <Badge variant="secondary">Draft — Editable</Badge>
                ) : null}
              </div>
            </CardHeader>
          </Card>

          <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_-12px_rgba(15,23,42,0.18)] dark:from-slate-900/80 dark:via-slate-900/40 dark:to-slate-950/80 dark:border-primary/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2 flex-1">
                {SECTIONS.map((tab) => {
                  const isActive = mprSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMprSubTab(tab.id)}
                      className={`group relative inline-flex items-center rounded-xl px-3.5 py-2 text-left text-[12px] font-medium tracking-wide transition-all duration-200 ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_rgba(15,40,70,0.65)] ring-1 ring-primary/30'
                          : 'bg-slate-200/90 text-slate-700 ring-1 ring-slate-300/80 hover:-translate-y-0.5 hover:bg-slate-300/70 hover:text-slate-900 hover:shadow-md hover:ring-primary/25 dark:bg-slate-700/90 dark:text-slate-100 dark:ring-slate-500/70 dark:hover:bg-slate-600 dark:hover:text-white'
                      }`}
                    >
                      <span className="leading-tight">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col items-stretch gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setShowPrintReport(true)} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                  <Printer className="w-4 h-4 text-blue-600" />
                  Print Report (PDF)
                </Button>
                {!isLocked ? (
                  <>
                    <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save as Draft
                    </Button>
                    <Button type="button" onClick={handleOpenReview} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <FileCheck className="w-4 h-4" />
                      Save & Review
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={handleUnlockReport} disabled={saving} className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50">
                    <Lock className="w-4 h-4 text-amber-600" />
                    Unlock Report to Edit
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className={mprSubTab === 'executive-summary' ? '' : 'hidden'}>
            <ExecutiveSummarySection
              value={form.executiveSummary}
              onChange={(v) => updateSection('executiveSummary', v)}
              locked={isLocked}
              signOff={form.signOff}
              onSignOffChange={(signOff) => updateSection('signOff', signOff)}
              submittedBy={submittedBy}
            />
          </div>

          <div className={mprSubTab === 'schedule-summary' ? '' : 'hidden'}>
            <ProjectScheduleSummarySection
              rows={form.scheduleSummaryRows}
              onChange={(rows) => updateSection('scheduleSummaryRows', rows)}
              previousRows={previousScheduleRows}
              duration={form.projectDuration}
              onDurationChange={(v) => updateSection('projectDuration', v)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'delay-summary' ? '' : 'hidden'}>
            <DelaySummarySection
              rows={form.delayRows}
              onChange={(rows) => updateSection('delayRows', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'material-consumption' ? '' : 'hidden'}>
            <MaterialConsumptionSection
              value={form.materialConsumption}
              onChange={(v) => updateSection('materialConsumption', v)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'plan-vs-achievement' ? '' : 'hidden'}>
            <PlanVsAchievementSection rows={planVsAchievementRows} />
          </div>

          <div className={mprSubTab === 'work-completion-status' ? '' : 'hidden'}>
            <WorkCompletionStatusSection
              value={form.workCompletionStatus}
              onChange={(v) => updateSection('workCompletionStatus', v)}
              locked={isLocked}
              projectConfiguration={form.projectConfiguration}
              buildingConfigurationsRaw={projectData?.building_configurations}
            />
          </div>

          <div className={mprSubTab === 'contractor-bills' ? '' : 'hidden'}>
            <ContractorBillsSection
              rows={form.contractorBills}
              onChange={(rows) => updateSection('contractorBills', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'material-requisition' ? '' : 'hidden'}>
            <MaterialRequisitionSection
              rows={form.materialRequisitions}
              onChange={(rows) => updateSection('materialRequisitions', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'material-reconciliation' ? '' : 'hidden'}>
            <MaterialReconciliationSection
              rows={form.materialReconciliation}
              onChange={(rows) => updateSection('materialReconciliation', rows)}
              locked={isLocked}
              monthLabel={month?.label}
            />
          </div>

          <div className={mprSubTab === 'work-orders' ? '' : 'hidden'}>
            <WorkOrdersSection
              rows={form.workOrders}
              onChange={(rows) => updateSection('workOrders', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'drawings-received' ? '' : 'hidden'}>
            <DrawingsReceivedSection
              rows={form.drawingsReceived}
              onChange={(rows) => updateSection('drawingsReceived', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'challenges-encountered' ? '' : 'hidden'}>
            <ChallengesEncounteredSection
              rows={form.challengesEncountered}
              onChange={(rows) => updateSection('challengesEncountered', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'key-activities' ? '' : 'hidden'}>
            <KeyActivitiesSection
              rows={form.keyActivities}
              onChange={(rows) => updateSection('keyActivities', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'forecast' ? '' : 'hidden'}>
            <ForecastSection
              rows={form.forecast}
              onChange={(rows) => updateSection('forecast', rows)}
              locked={isLocked}
              activityOptions={activityOptions}
            />
          </div>

          <div className={mprSubTab === 'plan-for-next-month' ? '' : 'hidden'}>
            <PlanForNextMonthSection
              rows={form.planForNextMonth}
              onChange={(rows) => updateSection('planForNextMonth', rows)}
              locked={isLocked}
              forecastRows={form.forecast}
            />
          </div>

          <div className={mprSubTab === 'drawings-required' ? '' : 'hidden'}>
            <DrawingsRequiredSection
              rows={form.drawingsRequired}
              onChange={(rows) => updateSection('drawingsRequired', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'challenges-anticipated' ? '' : 'hidden'}>
            <ChallengesAnticipatedSection
              rows={form.challengesAnticipated}
              onChange={(rows) => updateSection('challengesAnticipated', rows)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'unit-handover' ? '' : 'hidden'}>
            <UnitHandoverSection
              value={form.unitHandover}
              onChange={(v) => updateSection('unitHandover', v)}
              locked={isLocked}
            />
          </div>

          <div className={mprSubTab === 'project-configuration' ? '' : 'hidden'}>
            <ProjectConfigurationSection
              rows={form.projectConfiguration}
              onChange={(rows) => updateSection('projectConfiguration', rows)}
              locked={isLocked}
            />
          </div>

          <MprReviewDialog
            open={showReview}
            onOpenChange={setShowReview}
            meta={{
              monthLabel: month.label,
              projectName: selectedProject?.name || projectData?.name,
              elevationPhotoUrl: selectedProject?.elevation_photo_url || projectData?.elevation_photo_url,
              submittedBy,
            }}
            sections={reviewSections}
            onConfirm={handleConfirmSubmit}
            onApprove={handleApproveReport}
            onPrint={() => {
              setShowReview(false);
              setShowPrintReport(true);
            }}
            isSubmitting={saving}
          />

          <MprPrintReport
            open={showPrintReport}
            onClose={() => setShowPrintReport(false)}
            form={form}
            meta={{
              monthLabel: month.label,
              nextMonthLabel,
              monthId: month.id,
              projectName: selectedProject?.name || projectData?.name,
              projectCode: selectedProject?.project_code || projectData?.project_code,
              location: selectedProject?.location || projectData?.location,
              elevationPhotoUrl: selectedProject?.elevation_photo_url || projectData?.elevation_photo_url,
            }}
            projectData={selectedProject || projectData}
            planVsAchievementRows={planVsAchievementRows}
          />
        </>
      )}
    </div>
  );
}
