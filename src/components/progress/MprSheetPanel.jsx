import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Lock, Save, FileCheck } from 'lucide-react';
import { formatCurrencyINR, formatNumberIndian, normalizeDateKey } from '@/lib/formatters';
import {
  createDefaultMprForm,
  createEmptyScheduleSummaryRow,
  parseMprFormData,
  calcMonthlyVowd,
  calcMonthlyMandays,
  calcMonthlyAvgManpower,
  calcMonthlySteelVowd,
  sumForecastAmount,
  sumForecastField,
  sumForecastAmountForSteel,
  forecastRowQty,
} from '@/lib/mprForm';
import { getPreviousMonthId, getDaysInMonthId } from '@/lib/mprMonths';
import MprReviewDialog from '@/components/progress/MprReviewDialog';
import ExecutiveSummarySection from '@/components/progress/mpr/ExecutiveSummarySection';
import ProjectScheduleSummarySection from '@/components/progress/mpr/ProjectScheduleSummarySection';
import DelaySummarySection from '@/components/progress/mpr/DelaySummarySection';
import MaterialConsumptionSection from '@/components/progress/mpr/MaterialConsumptionSection';
import PlanVsAchievementSection from '@/components/progress/mpr/PlanVsAchievementSection';
import ContractorBillsSection from '@/components/progress/mpr/ContractorBillsSection';
import MaterialRequisitionSection from '@/components/progress/mpr/MaterialRequisitionSection';
import MaterialReconciliationSection from '@/components/progress/mpr/MaterialReconciliationSection';
import WorkOrdersSection from '@/components/progress/mpr/WorkOrdersSection';
import DrawingsReceivedSection from '@/components/progress/mpr/DrawingsReceivedSection';
import ChallengesEncounteredSection from '@/components/progress/mpr/ChallengesEncounteredSection';
import KeyActivitiesSection from '@/components/progress/mpr/KeyActivitiesSection';
import ForecastSection from '@/components/progress/mpr/ForecastSection';
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
  { id: 'contractor-bills', label: 'Contractor Bills' },
  { id: 'material-requisition', label: 'Material Requisition' },
  { id: 'material-reconciliation', label: 'Material Reconciliation' },
  { id: 'work-orders', label: 'Work Orders Issued' },
  { id: 'drawings-received', label: 'Drawings Received' },
  { id: 'challenges-encountered', label: 'Challenges Encountered' },
  { id: 'key-activities', label: 'Key Activities' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'drawings-required', label: 'Drawings Required' },
  { id: 'challenges-anticipated', label: 'Challenges Anticipated' },
  { id: 'unit-handover', label: 'Unit Handover' },
  { id: 'project-configuration', label: 'Project Configuration' },
];

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

/** Leaf-level (executable) activities only — mirrors the DPR worksheet's activity picker. */
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
    return levelNumber === 3 || levelText === 'l3' || hasActivityId;
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
  const [mprSubTab, setMprSubTab] = useState('executive-summary');

  const monthId = month?.id || '';
  const monthStart = month?.startDate || '';
  const monthEnd = month?.endDate || '';
  const scopeKey = `${projectId}:${monthId}`;
  const isLocked = status === 'submitted';
  const prevMonthId = getPreviousMonthId(monthId);
  const prev2MonthId = getPreviousMonthId(prevMonthId);
  const daysInMonth = getDaysInMonthId(monthId);

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

  const { data: progressEntries = [], isLoading: progressLoading } = useQuery({
    queryKey: ['mpr-progress', projectId],
    queryFn: () => base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 5000),
    enabled: !!projectId,
  });

  const { data: labourEntries = [], isLoading: labourLoading } = useQuery({
    queryKey: ['mpr-labours', projectId],
    queryFn: () => base44.entities.ContractorLabour.filter({ project_id: projectId }, '-date', 5000),
    enabled: !!projectId,
  });

  const budgetItemsById = useMemo(() => new Map(budgetItems.map((b) => [b.id, b])), [budgetItems]);
  const wbsItemsById = useMemo(() => new Map(wbsItems.map((w) => [w.id, w])), [wbsItems]);
  const activityOptions = useMemo(() => buildActivityOptions(wbsItems, budgetItems), [wbsItems, budgetItems]);

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
  const thisMonthForecastLabour = useMemo(() => sumForecastField(form.forecast, 'totalLabourRequired'), [form.forecast]);
  const thisMonthForecastLabourAvg = daysInMonth ? thisMonthForecastLabour / daysInMonth : 0;

  const prevForecastRows = prevForm?.forecast || [];
  const prevForecastTotal = useMemo(() => sumForecastAmount(prevForecastRows), [prevForecastRows]);
  const prevForecastCement = useMemo(() => sumForecastField(prevForecastRows, 'cementBags'), [prevForecastRows]);
  const prevForecastSteel = useMemo(() => sumForecastAmountForSteel(prevForecastRows, wbsItemsById), [prevForecastRows, wbsItemsById]);
  const prevForecastLabour = useMemo(() => sumForecastField(prevForecastRows, 'totalLabourRequired'), [prevForecastRows]);
  const prevForecastLabourAvg = daysInMonth ? prevForecastLabour / daysInMonth : 0;

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
      const existing = byKey.get(key) || {
        activityKey: key,
        activity: title,
        unit: budgetItem?.unit || wbsItem?.unit || entry.unit || '',
        rate: parseFloat(budgetItem?.cost_per_unit) || 0,
        plannedQty: 0,
        achievedQty: 0,
      };
      existing.achievedQty += parseFloat(entry.quantity_done) || 0;
      if (!existing.unit) existing.unit = budgetItem?.unit || wbsItem?.unit || entry.unit || '';
      if (!existing.rate) existing.rate = parseFloat(budgetItem?.cost_per_unit) || 0;
      byKey.set(key, existing);
    });

    return Array.from(byKey.values()).map((row) => ({
      ...row,
      plannedAmount: row.plannedQty * row.rate,
      achievedAmount: row.achievedQty * row.rate,
    }));
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

    if (parsed) {
      setForm({ ...base, ...parsed });
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
          mandays: { target: prevForecastLabour || '', achieved: 0, nextMonthTarget: 0 },
          avgManpower: { target: Math.round(prevForecastLabourAvg * 100) / 100 || '', achieved: 0, nextMonthTarget: 0 },
        },
      });
      setReportId(null);
      setStatus('draft');
    }
    setLoadedKey(scopeKey);
  }, [existingReports, reportLoading, scopeKey, monthId, month, loadedKey, prevForecastTotal, prevForecastCement, prevForecastSteel, prevForecastLabour, prevForecastLabourAvg]);

  // Keep locked computed fields in sync while editing
  useEffect(() => {
    if (isLocked || loadedKey !== scopeKey) return;
    setForm((prev) => ({
      ...prev,
      materialConsumption: {
        vowd: { ...prev.materialConsumption.vowd, achieved: monthlyVowd, nextMonthTarget: thisMonthForecastTotal },
        cement: { ...prev.materialConsumption.cement, nextMonthTarget: thisMonthForecastCement },
        steel: { ...prev.materialConsumption.steel, target: prevForecastSteel, achieved: monthlySteelVowd, nextMonthTarget: thisMonthForecastSteel },
        mandays: { ...prev.materialConsumption.mandays, achieved: monthlyMandays, nextMonthTarget: thisMonthForecastLabour },
        avgManpower: { ...prev.materialConsumption.avgManpower, achieved: monthlyAvgManpower, nextMonthTarget: Math.round(thisMonthForecastLabourAvg * 100) / 100 },
      },
    }));
  }, [
    isLocked, loadedKey, scopeKey, monthlyVowd, monthlySteelVowd, monthlyMandays, monthlyAvgManpower,
    thisMonthForecastTotal, thisMonthForecastCement, thisMonthForecastSteel, thisMonthForecastLabour, thisMonthForecastLabourAvg,
    prevForecastSteel,
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
      toast({ title: 'MPR Submitted', description: 'Monthly report submitted and locked for this month.' });
    } catch (err) {
      toast({ title: 'Submit Failed', description: err?.message || 'Could not submit MPR.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reviewSections = useMemo(() => {
    const textRows = (rows, columns) => (rows || [])
      .filter((r) => columns.some((c) => (r[c.key] ?? '').toString().trim()))
      .map((r, i) => ({ id: r.id, sr: i + 1, ...r }));

    const mc = form.materialConsumption;
    const formatMcRow = (row, isMonetary) => {
      const fmt = isMonetary ? formatCurrencyINR : formatNumberIndian;
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
          { label: 'Average Man Power', ...formatMcRow(mc.avgManpower, false) },
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
          { key: 'materialDescription', label: 'Material' }, { key: 'theoreticalConsumption', label: 'Theoretical', align: 'right' },
          { key: 'actualConsumption', label: 'Actual', align: 'right' },
        ],
        rows: textRows(form.materialReconciliation, [{ key: 'materialDescription' }]),
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
          { key: 'details', label: 'Details' }, { key: 'currentMonthPlan', label: 'Plan' },
          { key: 'currentMonthStatus', label: 'Status' },
        ],
        rows: textRows(form.keyActivities, [{ key: 'details' }]),
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
                {isLocked ? (
                  <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                    <Lock className="w-3 h-3" /> Submitted — Locked
                  </Badge>
                ) : status === 'draft' && reportId ? (
                  <Badge variant="secondary">Draft</Badge>
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

              {!isLocked && (
                <div className="flex flex-col items-stretch gap-2 shrink-0">
                  <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save as Draft
                  </Button>
                  <Button type="button" onClick={handleOpenReview} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <FileCheck className="w-4 h-4" />
                    Save & Review
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className={mprSubTab === 'executive-summary' ? '' : 'hidden'}>
            <ExecutiveSummarySection
              value={form.executiveSummary}
              onChange={(v) => updateSection('executiveSummary', v)}
              locked={isLocked}
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
              projectName: selectedProject?.name,
              submittedBy,
            }}
            sections={reviewSections}
            onConfirm={handleConfirmSubmit}
            isSubmitting={saving}
          />
        </>
      )}
    </div>
  );
}
