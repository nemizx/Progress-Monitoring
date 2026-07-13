import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Lock, Plus, Minus, Save, FileCheck } from 'lucide-react';
import { formatCurrencyINR, normalizeDateKey } from '@/lib/formatters';
import { filterProgressBySubProject } from '@/lib/subProjectScope';
import {
  calcAvgWeeklyLabour,
  calcWeeklyVowd,
  createDefaultWprForm,
  createEmptyFeedbackRow,
  createEmptyNamedRow,
  formatPct,
  parseWprFormData,
  sumPlanAchieved,
} from '@/lib/wprForm';
import WprReviewDialog from '@/components/progress/WprReviewDialog';

function PctBadge({ plan, achieved }) {
  const label = formatPct(plan, achieved);
  if (label === '—') {
    return <span className="text-xs text-muted-foreground whitespace-nowrap">% Achieved: —</span>;
  }
  return (
    <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
      % Achieved: {label}
    </span>
  );
}

function PlanAchievedRow({
  label,
  plan,
  achieved,
  onPlanChange,
  onAchievedChange,
  achievedLocked = false,
  planLocked = false,
  achievedDisplay,
  locked = false,
  formatAchieved,
  formatPlan,
  isRating = false,
}) {
  const achievedValue = achievedLocked
    ? (achievedDisplay ?? achieved)
    : achieved;

  const cleanLabel = label ? label.replace(/^\d+\.\s*/, '') : '';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <PctBadge plan={plan} achieved={achievedValue} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Plan</Label>
          <Input
            type={formatPlan ? 'text' : 'number'}
            step="any"
            value={
              formatPlan
                ? formatPlan(plan)
                : (plan ?? '')
            }
            onChange={(e) => {
              if (formatPlan) {
                const rawVal = e.target.value.replace(/[^0-9.]/g, '');
                const parts = rawVal.split('.');
                const cleanVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                onPlanChange?.(cleanVal);
              } else {
                onPlanChange?.(e.target.value);
              }
            }}
            disabled={locked || planLocked}
            readOnly={planLocked}
            className={planLocked ? 'bg-muted/50 font-medium' : ''}
            placeholder={`Enter plan for ${cleanLabel}`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Achieved{achievedLocked ? ' (auto)' : ''}
          </Label>
          {isRating ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
                const isSelected = Number(achievedValue) === num;
                const isDisabled = locked || achievedLocked;
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onAchievedChange?.(num)}
                    className={cn(
                      "w-8 h-8 rounded-full border text-xs font-semibold flex items-center justify-center transition-all duration-150 shrink-0",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                        : "bg-background text-muted-foreground border-muted-foreground/20 hover:border-muted-foreground hover:bg-muted/10",
                      isDisabled && "opacity-80 cursor-not-allowed"
                    )}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          ) : (
            <Input
              type={formatAchieved ? 'text' : 'number'}
              step="any"
              value={
                formatAchieved
                  ? formatAchieved(achievedValue)
                  : (achievedValue ?? '')
              }
              onChange={(e) => onAchievedChange?.(e.target.value)}
              disabled={locked || achievedLocked}
              readOnly={achievedLocked}
              className={achievedLocked ? 'bg-muted/50' : ''}
              placeholder={`Enter achieved for ${cleanLabel}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MultiRowSection({
  title,
  nameLabel,
  rows,
  onChange,
  locked = false,
  showRemark = true,
}) {
  const totals = sumPlanAchieved(rows);

  const updateRow = (id, field, value) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    onChange([...rows, showRemark ? createEmptyNamedRow() : createEmptyFeedbackRow()]);
  };

  const removeRow = (id) => {
    if (rows.length <= 1) {
      onChange([showRemark ? createEmptyNamedRow() : createEmptyFeedbackRow()]);
      return;
    }
    onChange(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-foreground">{title}</Label>
        <PctBadge plan={totals.plan} achieved={totals.achieved} />
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-10">#</th>
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground">{nameLabel}</th>
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-28">Plan</th>
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-28">Achieved</th>
              {showRemark ? (
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Remark</th>
              ) : null}
              {!locked ? (
                <th className="text-center p-2 text-xs font-semibold text-muted-foreground w-24">Add/Remove</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="p-2 text-xs text-muted-foreground">{idx + 1}</td>
                <td className="p-2">
                  <Input
                    value={row.name || ''}
                    onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                    disabled={locked}
                    placeholder={nameLabel}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    step="any"
                    value={row.plan ?? ''}
                    onChange={(e) => updateRow(row.id, 'plan', e.target.value)}
                    disabled={locked}
                    placeholder="Plan"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    step="any"
                    value={row.achieved ?? ''}
                    onChange={(e) => updateRow(row.id, 'achieved', e.target.value)}
                    disabled={locked}
                    placeholder="Achieved"
                  />
                </td>
                {showRemark ? (
                  <td className="p-2">
                    <Input
                      value={row.remark || ''}
                      onChange={(e) => updateRow(row.id, 'remark', e.target.value)}
                      disabled={locked}
                      placeholder="Remark"
                    />
                  </td>
                ) : null}
                {!locked ? (
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={addRow}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeRow(row.id)}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WprSheetPanel({
  projectId,
  subProjectId,
  selectedProject,
  selectedSubProject,
  week,
  submittedBy = 'Supervisor',
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => createDefaultWprForm(selectedProject));
  const [reportId, setReportId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [loadedKey, setLoadedKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const weekId = week?.id || '';
  const weekStart = week?.startDate || '';
  const weekEnd = week?.endDate || '';
  const scopeKey = `${projectId}:${subProjectId || 'project'}:${weekId}`;
  const isLocked = status === 'submitted';

  const { data: existingReports = [], isLoading: reportLoading } = useQuery({
    queryKey: ['wpr-report', projectId, subProjectId || 'project', weekId],
    queryFn: () =>
      base44.entities.WprReport.filter({
        project_id: projectId,
        sub_project_id: subProjectId || null,
        week_id: weekId,
      }),
    enabled: !!projectId && !!weekId,
  });

  const { data: labourEntries = [], isLoading: labourLoading } = useQuery({
    queryKey: ['wpr-labours', projectId, subProjectId || 'project', weekStart, weekEnd],
    queryFn: () =>
      base44.entities.ContractorLabour.filter({
        project_id: projectId,
        ...(subProjectId ? { sub_project_id: subProjectId } : {}),
      }, '-date', 2000),
    enabled: !!projectId && !!weekStart && !!weekEnd,
  });

  const { data: allProgress = [], isLoading: progressLoading } = useQuery({
    queryKey: ['wpr-progress', projectId],
    queryFn: () => base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 2000),
    enabled: !!projectId,
  });

  const { data: allBudgetItems = [] } = useQuery({
    queryKey: ['budgetItems', projectId],
    queryFn: () => base44.entities.BudgetItem.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: allWbsItems = [] } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => base44.entities.WBSItem.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const scopedProgress = useMemo(
    () => subProjectId 
      ? filterProgressBySubProject(allProgress, allBudgetItems, allWbsItems, subProjectId)
      : allProgress,
    [allProgress, allBudgetItems, allWbsItems, subProjectId]
  );

  const avgLabour = useMemo(
    () => calcAvgWeeklyLabour(labourEntries, weekStart, weekEnd),
    [labourEntries, weekStart, weekEnd]
  );

  const weeklyVowd = useMemo(
    () => calcWeeklyVowd(scopedProgress, weekStart, weekEnd),
    [scopedProgress, weekStart, weekEnd]
  );

  // Reset when week/scope changes
  useEffect(() => {
    setLoadedKey('');
    setReportId(null);
    setStatus('draft');
    setForm(createDefaultWprForm(selectedProject));
    // Only re-init when week/project/sub-project scope changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Hydrate from saved report + locked computed fields
  useEffect(() => {
    if (reportLoading || !weekId || loadedKey === scopeKey) return;

    const existing = existingReports[0];
    const parsed = parseWprFormData(existing?.form_data);
    const base = createDefaultWprForm(selectedProject);

    if (parsed) {
      setForm({
        ...base,
        ...parsed,
        avgLabour: {
          plan: parsed.avgLabour?.plan ?? '',
          achieved: avgLabour,
        },
        valueOfWorkDone: {
          plan: parsed.valueOfWorkDone?.plan ?? '',
          achieved: weeklyVowd,
        },
        qualityRating: {
          plan: 10,
          achieved: parsed.qualityRating?.achieved ?? '',
        },
        healthSafetyRating: {
          plan: 10,
          achieved: parsed.healthSafetyRating?.achieved ?? '',
        },
        timelineMonthly: {
          startDate:
            parsed.timelineMonthly?.startDate ||
            normalizeDateKey(selectedProject?.start_date) ||
            '',
          endDate:
            parsed.timelineMonthly?.endDate ||
            normalizeDateKey(selectedProject?.end_date) ||
            '',
        },
        materialRequisitions: parsed.materialRequisitions?.length
          ? parsed.materialRequisitions
          : base.materialRequisitions,
        billsToCertify: parsed.billsToCertify?.length ? parsed.billsToCertify : base.billsToCertify,
        leadershipInputs: parsed.leadershipInputs?.length
          ? parsed.leadershipInputs
          : base.leadershipInputs,
        mockUpActivities: parsed.mockUpActivities?.length
          ? parsed.mockUpActivities
          : base.mockUpActivities,
        contractorsMobilized: parsed.contractorsMobilized?.length
          ? parsed.contractorsMobilized
          : base.contractorsMobilized,
        keyPlanActivities: parsed.keyPlanActivities?.length
          ? parsed.keyPlanActivities
          : base.keyPlanActivities,
        workMethodology: parsed.workMethodology?.length
          ? parsed.workMethodology
          : base.workMethodology,
        supportRequired: parsed.supportRequired?.length
          ? parsed.supportRequired
          : base.supportRequired,
      });
      setReportId(existing.id);
      setStatus(existing.status || 'draft');
    } else {
      setForm({
        ...base,
        avgLabour: { plan: '', achieved: avgLabour },
        valueOfWorkDone: { plan: '', achieved: weeklyVowd },
      });
      setReportId(null);
      setStatus('draft');
    }
    setLoadedKey(scopeKey);
  }, [
    existingReports,
    reportLoading,
    scopeKey,
    weekId,
    loadedKey,
    selectedProject,
    avgLabour,
    weeklyVowd,
  ]);

  // Keep locked achieved fields in sync while editing
  useEffect(() => {
    if (isLocked || loadedKey !== scopeKey) return;
    setForm((prev) => ({
      ...prev,
      avgLabour: { ...prev.avgLabour, achieved: avgLabour },
      valueOfWorkDone: { ...prev.valueOfWorkDone, achieved: weeklyVowd },
    }));
  }, [avgLabour, weeklyVowd, isLocked, loadedKey, scopeKey]);

  const updateSimple = (key, field, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const formatInputCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const str = String(val);
    const match = str.match(/\.(\d*)$/);
    const numericVal = parseFloat(str);
    if (isNaN(numericVal)) return '';

    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    });
    
    if (match) {
      const decimalPart = match[1];
      const integerPart = str.split('.')[0];
      const parsedInt = parseFloat(integerPart) || 0;
      const formattedInt = formatter.format(parsedInt);
      return `${formattedInt}.${decimalPart}`;
    }
    
    const hasDecimal = str.includes('.');
    const decimals = hasDecimal ? str.split('.')[1].length : 0;
    
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: Math.min(decimals, 2)
    }).format(numericVal);
  };

  const buildPayload = useCallback(
    (nextStatus) => {
      const formData = {
        ...form,
        avgLabour: { ...form.avgLabour, achieved: avgLabour },
        valueOfWorkDone: { ...form.valueOfWorkDone, achieved: weeklyVowd },
      };
      return {
        project_id: projectId,
        sub_project_id: subProjectId || null,
        week_id: weekId,
        week_start: weekStart,
        week_end: weekEnd,
        status: nextStatus,
        form_data: JSON.stringify(formData),
        submitted_by: submittedBy || 'Supervisor',
        submitted_at: nextStatus === 'submitted' ? new Date().toISOString() : null,
      };
    },
    [
      form,
      avgLabour,
      weeklyVowd,
      projectId,
      subProjectId,
      weekId,
      weekStart,
      weekEnd,
      submittedBy,
    ]
  );

  const persist = async (nextStatus) => {
    const payload = buildPayload(nextStatus);
    if (reportId) {
      const updated = await base44.entities.WprReport.update(reportId, payload);
      setReportId(updated?.id || reportId);
    } else {
      const created = await base44.entities.WprReport.create(payload);
      setReportId(created?.id || null);
    }
    setStatus(nextStatus);
    queryClient.invalidateQueries({ queryKey: ['wpr-report', projectId, subProjectId || 'project', weekId] });
  };

  const handleSaveDraft = async () => {
    if (isLocked) return;
    setSaving(true);
    try {
      await persist('draft');
      toast({
        title: 'Draft Saved',
        description: 'Weekly progress report saved as draft.',
      });
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: err?.message || 'Could not save draft.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReview = () => {
    if (isLocked) {
      toast({
        title: 'Week Locked',
        description: 'This WPR is already submitted and cannot be changed.',
        variant: 'destructive',
      });
      return;
    }
    setShowReview(true);
  };

  const handleConfirmSubmit = async () => {
    setSaving(true);
    try {
      await persist('submitted');
      setShowReview(false);
      toast({
        title: 'WPR Submitted',
        description: 'Weekly report submitted and locked for this week.',
      });
    } catch (err) {
      toast({
        title: 'Submit Failed',
        description: err?.message || 'Could not submit WPR.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const reviewSections = useMemo(() => {
    const simpleRow = (label, plan, achieved, extra = {}) => ({
      title: label,
      pctLabel: `Achieved: ${formatPct(plan, achieved)}`,
      columns: [
        { key: 'plan', label: 'Plan', align: 'right' },
        { key: 'achieved', label: 'Achieved', align: 'right' },
        { key: 'pct', label: '% Achieved', align: 'right' },
      ],
      rows: [
        {
          plan: plan === '' || plan == null ? '—' : plan,
          achieved: extra.formatAchieved ? extra.formatAchieved(achieved) : (achieved ?? '—'),
          pct: formatPct(plan, achieved),
        },
      ],
    });

    const multiSection = (title, nameLabel, rows, withRemark = true) => {
      const filled = (rows || []).filter((r) => (r.name || '').trim() || r.plan !== '' || r.achieved !== '');
      const totals = sumPlanAchieved(filled);
      const columns = [
        { key: 'sr', label: '#' },
        { key: 'name', label: nameLabel },
        { key: 'plan', label: 'Plan', align: 'right' },
        { key: 'achieved', label: 'Achieved', align: 'right' },
      ];
      if (withRemark) columns.push({ key: 'remark', label: 'Remark' });
      columns.push({ key: 'pct', label: '% Achieved', align: 'right' });

      return {
        title,
        pctLabel: `Total % Achieved: ${formatPct(totals.plan, totals.achieved)}`,
        columns,
        rows: filled.map((r, i) => ({
          id: r.id,
          sr: i + 1,
          name: r.name || '—',
          plan: r.plan === '' ? '—' : r.plan,
          achieved: r.achieved === '' ? '—' : r.achieved,
          remark: r.remark || '—',
          pct: formatPct(r.plan, r.achieved),
        })),
      };
    };

    return [
      simpleRow('1. Avg. No Of Labour Allocated', form.avgLabour.plan, avgLabour),
      simpleRow('2. No. of Construction Milestones to Achieve (Building wise)', form.milestones.plan, form.milestones.achieved),
      simpleRow('3. Quality Rating', form.qualityRating.plan, form.qualityRating.achieved),
      simpleRow('4. Health and Safety Rating', form.healthSafetyRating.plan, form.healthSafetyRating.achieved),
      multiSection('5. No of Requisition Of Material', 'Requisition', form.materialRequisitions),
      multiSection('6. Bills to certify', 'Bills to Certify', form.billsToCertify),
      multiSection('7. Leadership / Client / Consultant Inputs', 'Feedback', form.leadershipInputs, false),
      multiSection('8. Mock up Activity', 'Mock up Activity', form.mockUpActivities),
      multiSection('9. Contractors to be Mobilized', 'Contractor', form.contractorsMobilized),
      simpleRow('10. Contractor review meeting conducted', form.contractorReviewMeeting.plan, form.contractorReviewMeeting.achieved),
      multiSection('11. Key Plan Activity', 'Activity Name', form.keyPlanActivities),
      simpleRow('12. Value of Work Done', form.valueOfWorkDone.plan, weeklyVowd, {
        formatAchieved: (v) => formatCurrencyINR(v || 0),
      }),
      multiSection('13. Work Methodology Details', 'Work Methodology', form.workMethodology),
      multiSection('14. Support Required / Decision On Details', 'Support Required / Decision On', form.supportRequired),
      {
        title: '15. Timeline Monthly',
        columns: [
          { key: 'startDate', label: 'Start Date' },
          { key: 'endDate', label: 'End Date' },
        ],
        rows: [
          {
            startDate: form.timelineMonthly?.startDate || '—',
            endDate: form.timelineMonthly?.endDate || '—',
          },
        ],
      },
    ];
  }, [form, avgLabour, weeklyVowd]);

  const loading = reportLoading || labourLoading || progressLoading;

  if (!week) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Select a week to fill the Weekly Progress Report.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {loading && loadedKey !== scopeKey ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading WPR…
        </div>
      ) : (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Fill plan vs achieved for {week?.label || 'the selected week'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isLocked ? (
                <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                  <Lock className="w-3 h-3" />
                  Submitted — Locked
                </Badge>
              ) : status === 'draft' && reportId ? (
                <Badge variant="secondary">Draft</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <PlanAchievedRow
              label="1. Avg. No Of Labour Allocated"
              plan={form.avgLabour.plan}
              achieved={avgLabour}
              onPlanChange={(v) => updateSimple('avgLabour', 'plan', v)}
              achievedLocked
              locked={isLocked}
            />

            <PlanAchievedRow
              label="2. No. of Construction Milestones to Achieve: Building wise"
              plan={form.milestones.plan}
              achieved={form.milestones.achieved}
              onPlanChange={(v) => updateSimple('milestones', 'plan', v)}
              onAchievedChange={(v) => updateSimple('milestones', 'achieved', v)}
              locked={isLocked}
            />

            <PlanAchievedRow
              label="3. Quality Rating"
              plan={form.qualityRating.plan}
              achieved={form.qualityRating.achieved}
              onPlanChange={(v) => updateSimple('qualityRating', 'plan', v)}
              onAchievedChange={(v) => updateSimple('qualityRating', 'achieved', v)}
              locked={isLocked}
              planLocked
              isRating
            />

            <PlanAchievedRow
              label="4. Health and Safety Rating"
              plan={form.healthSafetyRating.plan}
              achieved={form.healthSafetyRating.achieved}
              onPlanChange={(v) => updateSimple('healthSafetyRating', 'plan', v)}
              onAchievedChange={(v) => updateSimple('healthSafetyRating', 'achieved', v)}
              locked={isLocked}
              planLocked
              isRating
            />

            <MultiRowSection
              title="5. No of Requisition Of Material"
              nameLabel="Requisition"
              rows={form.materialRequisitions}
              onChange={(rows) => setForm((p) => ({ ...p, materialRequisitions: rows }))}
              locked={isLocked}
            />

            <MultiRowSection
              title="6. Bills to certify"
              nameLabel="Bills to Certify"
              rows={form.billsToCertify}
              onChange={(rows) => setForm((p) => ({ ...p, billsToCertify: rows }))}
              locked={isLocked}
            />

            <MultiRowSection
              title="7. No. of leadership input / client inputs / consultant inputs to be adopted"
              nameLabel="Feedback"
              rows={form.leadershipInputs}
              onChange={(rows) => setForm((p) => ({ ...p, leadershipInputs: rows }))}
              locked={isLocked}
              showRemark={false}
            />

            <MultiRowSection
              title="8. Mock up Activity"
              nameLabel="Mock up Activity"
              rows={form.mockUpActivities}
              onChange={(rows) => setForm((p) => ({ ...p, mockUpActivities: rows }))}
              locked={isLocked}
            />

            <MultiRowSection
              title="9. Contractors to be Mobilized"
              nameLabel="Contractor"
              rows={form.contractorsMobilized}
              onChange={(rows) => setForm((p) => ({ ...p, contractorsMobilized: rows }))}
              locked={isLocked}
            />

            <PlanAchievedRow
              label="10. Contractor review meeting conducted"
              plan={form.contractorReviewMeeting.plan}
              achieved={form.contractorReviewMeeting.achieved}
              onPlanChange={(v) => updateSimple('contractorReviewMeeting', 'plan', v)}
              onAchievedChange={(v) => updateSimple('contractorReviewMeeting', 'achieved', v)}
              locked={isLocked}
            />

            <MultiRowSection
              title="11. Key Plan Activity"
              nameLabel="Activity Name"
              rows={form.keyPlanActivities}
              onChange={(rows) => setForm((p) => ({ ...p, keyPlanActivities: rows }))}
              locked={isLocked}
            />

            <PlanAchievedRow
              label="12. Value of Work Done"
              plan={form.valueOfWorkDone.plan}
              achieved={weeklyVowd}
              onPlanChange={(v) => updateSimple('valueOfWorkDone', 'plan', v)}
              achievedLocked
              locked={isLocked}
              formatAchieved={(v) => formatCurrencyINR(v || 0)}
              formatPlan={formatInputCurrency}
            />

            <MultiRowSection
              title="13. Work Methodology Details"
              nameLabel="Work Methodology"
              rows={form.workMethodology}
              onChange={(rows) => setForm((p) => ({ ...p, workMethodology: rows }))}
              locked={isLocked}
            />

            <MultiRowSection
              title="14. Support Required / Decision On Details"
              nameLabel="Support Required / Decision On"
              rows={form.supportRequired}
              onChange={(rows) => setForm((p) => ({ ...p, supportRequired: rows }))}
              locked={isLocked}
            />

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">15. Timeline Monthly</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start Date</Label>
                  <Input
                    type="date"
                    value={form.timelineMonthly?.startDate || ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        timelineMonthly: { ...p.timelineMonthly, startDate: e.target.value },
                      }))
                    }
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End Date</Label>
                  <Input
                    type="date"
                    value={form.timelineMonthly?.endDate || ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        timelineMonthly: { ...p.timelineMonthly, endDate: e.target.value },
                      }))
                    }
                    disabled={isLocked}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLocked && !loading && (
        <div className="flex justify-end gap-3 bg-card border rounded-xl p-4 shadow-sm">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || loading}
            className="gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as Draft
          </Button>
          <Button
            type="button"
            onClick={handleOpenReview}
            disabled={saving || loading}
            className="gap-2"
          >
            <FileCheck className="w-4 h-4" />
            Save &amp; Review
          </Button>
        </div>
      )}

      <WprReviewDialog
        open={showReview}
        onOpenChange={setShowReview}
        meta={{
          weekLabel: week.label,
          projectName: selectedProject?.name,
          subProjectName: selectedSubProject?.name,
          submittedBy,
        }}
        sections={reviewSections}
        onConfirm={handleConfirmSubmit}
        isSubmitting={saving}
      />
    </div>
  );
}
