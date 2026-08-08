import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Lock, Plus, Minus, Save, FileCheck, HelpCircle, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { formatCurrencyINR, normalizeDateKey } from '@/lib/formatters';
import { filterProgressBySubProject } from '@/lib/subProjectScope';
import {
  calcAvgWeeklyLabour,
  calcWeeklyVowd,
  calcWprBillSummary,
  calcWprRequisitionSummary,
  createDefaultWprForm,
  createEmptyBillToCertifyRow,
  createEmptyFeedbackRow,
  createEmptyMaterialRequisitionRow,
  createEmptyNamedRow,
  formatPct,
  generateAllBillRowsFromBaseline,
  generateAllRequisitionRowsFromBaseline,
  getMprBaselineForWpr,
  isBillRowAchieved,
  isRequisitionRowAchieved,
  parseWprFormData,
  sumPlanAchieved,
} from '@/lib/wprForm';
import WprReviewDialog from '@/components/progress/WprReviewDialog';

function TitleWithTooltip({ text, tooltip }) {
  if (!tooltip) return <Label className="text-sm font-semibold text-foreground">{text}</Label>;
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm font-semibold text-foreground">{text}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-center font-normal">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

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
  tooltip,
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
}) {
  const achievedValue = achievedLocked
    ? (achievedDisplay ?? achieved)
    : achieved;

  const cleanLabel = label ? label.replace(/^\d+\.\s*/, '') : '';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitleWithTooltip text={label} tooltip={tooltip} />
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
            Achieved
          </Label>
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
        </div>
      </div>
    </div>
  );
}

function MultiRowSection({
  title,
  tooltip,
  nameLabel,
  rows,
  onChange,
  locked = false,
  showRemark = true,
  showAgencyName = false,
}) {
  const totals = sumPlanAchieved(rows);

  const updateRow = (id, field, value) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    if (showAgencyName) {
      onChange([...rows, createEmptyBillToCertifyRow()]);
    } else {
      onChange([...rows, showRemark ? createEmptyNamedRow() : createEmptyFeedbackRow()]);
    }
  };

  const removeRow = (id) => {
    if (rows.length <= 1) {
      onChange([
        showAgencyName
          ? createEmptyBillToCertifyRow()
          : showRemark
          ? createEmptyNamedRow()
          : createEmptyFeedbackRow(),
      ]);
      return;
    }
    onChange(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitleWithTooltip text={title} tooltip={tooltip} />
        <PctBadge plan={totals.plan} achieved={totals.achieved} />
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-10">#</th>
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground">{nameLabel}</th>
              {showAgencyName ? (
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Name of Agency</th>
              ) : null}
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
                {showAgencyName ? (
                  <td className="p-2">
                    <Input
                      value={row.agencyName || ''}
                      onChange={(e) => updateRow(row.id, 'agencyName', e.target.value)}
                      disabled={locked}
                      placeholder="Name of Agency"
                    />
                  </td>
                ) : null}
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

function Point5RequisitionSection({
  title,
  tooltip,
  rows = [],
  onChange,
  locked = false,
}) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const grouped = useMemo(() => {
    const groups = {};
    (rows || []).forEach((row) => {
      const gKey = (row.subItemName || row.name || 'General Requisition').trim();
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push(row);
    });
    return groups;
  }, [rows]);

  const updateRow = (id, field, value) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addSubItemRow = (gKey) => {
    onChange([...rows, createEmptyMaterialRequisitionRow({ subItemName: gKey, name: gKey })]);
  };

  const removeRow = (id) => {
    if (rows.length <= 1) {
      onChange([createEmptyMaterialRequisitionRow()]);
      return;
    }
    onChange(rows.filter((r) => r.id !== id));
  };

  const overallPlan = rows.length;
  const overallAchieved = rows.filter(isRequisitionRowAchieved).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitleWithTooltip text={title} tooltip={tooltip} />
        <PctBadge plan={overallPlan} achieved={overallAchieved} />
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([gKey, groupRows]) => {
          const isExpanded = Boolean(expandedGroups[gKey]);
          const groupPlan = groupRows.length;
          const groupAchieved = groupRows.filter(isRequisitionRowAchieved).length;

          return (
            <div key={gKey} className="border rounded-lg overflow-hidden bg-card">
              <div
                onClick={() => toggleGroup(gKey)}
                className="p-3 bg-muted/40 hover:bg-muted/60 transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-muted-foreground pointer-events-none">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                  <span className="font-semibold text-sm text-foreground">{gKey}</span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">
                    Plan: <strong className="text-foreground">{groupPlan}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Achieved: <strong className="text-foreground">{groupAchieved}</strong>
                  </span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {formatPct(groupPlan, groupAchieved)}
                  </span>
                  <span className="text-xs text-primary font-medium flex items-center gap-1 ml-1">
                    {isExpanded ? 'Collapse' : `Expand (${groupPlan} rows)`}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 border-t overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[850px]">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-10">#</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-32">Date</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-36">Requisition No.</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Requisition</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-24">Unit</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-24">Qty</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-36">Received Date</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Remark</th>
                        {!locked ? (
                          <th className="text-center p-2 text-xs font-semibold text-muted-foreground w-20">Action</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((row, idx) => {
                        const achieved = isRequisitionRowAchieved(row);
                        return (
                          <tr key={row.id} className={`border-b last:border-0 ${achieved ? 'bg-emerald-50/40' : ''}`}>
                            <td className="p-2 text-xs text-muted-foreground">{idx + 1}</td>
                            <td className="p-2">
                              <Input
                                type="date"
                                value={row.date || ''}
                                onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                                disabled={locked}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.requisitionNo || ''}
                                onChange={(e) => updateRow(row.id, 'requisitionNo', e.target.value)}
                                disabled={locked}
                                placeholder="e.g. REQ-045"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.name || gKey}
                                disabled
                                className="bg-muted/50 font-medium"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.unit || ''}
                                onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                                disabled={locked}
                                placeholder="Unit"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="any"
                                value={row.qty ?? ''}
                                onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                                disabled={locked}
                                placeholder="Qty"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="date"
                                value={row.receivedDate || ''}
                                onChange={(e) => updateRow(row.id, 'receivedDate', e.target.value)}
                                disabled={locked}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.remark || ''}
                                onChange={(e) => updateRow(row.id, 'remark', e.target.value)}
                                disabled={locked}
                                placeholder="Remark"
                              />
                            </td>
                            {!locked ? (
                              <td className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRow(row.id)}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!locked && (
                    <div className="mt-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => addSubItemRow(gKey)}
                      >
                        <Plus className="w-3 h-3" /> Add Row to {gKey}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-muted/40 border rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
        <div className="flex items-center gap-6">
          <span>Total Planned: <strong className="font-mono text-sm">{overallPlan}</strong></span>
          <span>Total Achieved: <strong className="font-mono text-sm text-emerald-700">{overallAchieved}</strong></span>
        </div>
        <div className="font-semibold text-emerald-700">
          Overall Achievement: {formatPct(overallPlan, overallAchieved)}
        </div>
      </div>
    </div>
  );
}

function Point6BillsSection({
  title,
  tooltip,
  rows = [],
  onChange,
  locked = false,
}) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const grouped = useMemo(() => {
    const groups = {};
    (rows || []).forEach((row) => {
      const gKey = (row.subItemName || row.name || 'General Bills').trim();
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push(row);
    });
    return groups;
  }, [rows]);

  const updateRow = (id, field, value) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addSubItemRow = (gKey) => {
    onChange([...rows, createEmptyBillToCertifyRow({ subItemName: gKey, name: gKey })]);
  };

  const removeRow = (id) => {
    if (rows.length <= 1) {
      onChange([createEmptyBillToCertifyRow()]);
      return;
    }
    onChange(rows.filter((r) => r.id !== id));
  };

  const overallPlan = rows.length;
  const overallAchieved = rows.filter(isBillRowAchieved).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitleWithTooltip text={title} tooltip={tooltip} />
        <PctBadge plan={overallPlan} achieved={overallAchieved} />
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([gKey, groupRows]) => {
          const isExpanded = Boolean(expandedGroups[gKey]);
          const groupPlan = groupRows.length;
          const groupAchieved = groupRows.filter(isBillRowAchieved).length;

          return (
            <div key={gKey} className="border rounded-lg overflow-hidden bg-card">
              <div
                onClick={() => toggleGroup(gKey)}
                className="p-3 bg-muted/40 hover:bg-muted/60 transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-muted-foreground pointer-events-none">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                  <span className="font-semibold text-sm text-foreground">{gKey}</span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">
                    Plan: <strong className="text-foreground">{groupPlan}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Achieved: <strong className="text-foreground">{groupAchieved}</strong>
                  </span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {formatPct(groupPlan, groupAchieved)}
                  </span>
                  <span className="text-xs text-primary font-medium flex items-center gap-1 ml-1">
                    {isExpanded ? 'Collapse' : `Expand (${groupPlan} rows)`}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 border-t overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[900px]">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-10">#</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-32">Bill Date</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Work</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Name of Agency</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-32">Bill Amount</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-36">RA Bill No</th>
                        <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Remark</th>
                        {!locked ? (
                          <th className="text-center p-2 text-xs font-semibold text-muted-foreground w-20">Action</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((row, idx) => {
                        const achieved = isBillRowAchieved(row);
                        return (
                          <tr key={row.id} className={`border-b last:border-0 ${achieved ? 'bg-emerald-50/40' : ''}`}>
                            <td className="p-2 text-xs text-muted-foreground">{idx + 1}</td>
                            <td className="p-2">
                              <Input
                                type="date"
                                value={row.billDate || ''}
                                onChange={(e) => updateRow(row.id, 'billDate', e.target.value)}
                                disabled={locked}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.name || gKey}
                                disabled
                                className="bg-muted/50 font-medium"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.agencyName || ''}
                                onChange={(e) => updateRow(row.id, 'agencyName', e.target.value)}
                                disabled={locked}
                                placeholder="Name of Agency"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="any"
                                value={row.billAmount ?? ''}
                                onChange={(e) => updateRow(row.id, 'billAmount', e.target.value)}
                                disabled={locked}
                                placeholder="Amount ₹"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.raBillNo || ''}
                                onChange={(e) => updateRow(row.id, 'raBillNo', e.target.value)}
                                disabled={locked}
                                placeholder="RA Bill No"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.remark || ''}
                                onChange={(e) => updateRow(row.id, 'remark', e.target.value)}
                                disabled={locked}
                                placeholder="Remark"
                              />
                            </td>
                            {!locked ? (
                              <td className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRow(row.id)}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!locked && (
                    <div className="mt-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => addSubItemRow(gKey)}
                      >
                        <Plus className="w-3 h-3" /> Add Row to {gKey}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-muted/40 border rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
        <div className="flex items-center gap-6">
          <span>Total Planned: <strong className="font-mono text-sm">{overallPlan}</strong></span>
          <span>Total Achieved: <strong className="font-mono text-sm text-emerald-700">{overallAchieved}</strong></span>
        </div>
        <div className="font-semibold text-emerald-700">
          Overall Achievement: {formatPct(overallPlan, overallAchieved)}
        </div>
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
  const isLocked = status === 'approved';

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
    queryKey: ['wpr-labours', projectId, weekStart, weekEnd],
    queryFn: () =>
      base44.entities.ContractorLabour.filter({
        project_id: projectId,
      }, '-date', 5000),
    enabled: !!projectId && !!weekStart && !!weekEnd,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const labourInPeriod = useMemo(() => {
    const start = normalizeDateKey(weekStart);
    const end = normalizeDateKey(weekEnd);
    if (!start || !end) return [];
    return (labourEntries || []).filter((entry) => {
      const date = normalizeDateKey(entry.date);
      return date && date >= start && date <= end;
    });
  }, [labourEntries, weekStart, weekEnd]);

  const { data: rawAllProgress = [], isLoading: progressLoading } = useQuery({
    queryKey: ['wpr-progress', projectId],
    queryFn: () => base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 2000),
    enabled: !!projectId,
  });

  // Server also returns auto-generated weekly/monthly aggregate rows alongside daily
  // entries — exclude them here so VOWD is never double-counted.
  const allProgress = useMemo(
    () => rawAllProgress.filter((e) => !e._is_aggregated && (e.report_type === 'daily' || !e.report_type)),
    [rawAllProgress]
  );

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

  const { data: allMprReports = [] } = useQuery({
    queryKey: ['mpr-reports-for-wpr', projectId],
    queryFn: () => base44.entities.MprReport.filter({ project_id: projectId }, '-month_id', 12),
    enabled: !!projectId,
  });

  const scopedProgress = useMemo(
    () => subProjectId 
      ? filterProgressBySubProject(allProgress, allBudgetItems, allWbsItems, subProjectId)
      : allProgress,
    [allProgress, allBudgetItems, allWbsItems, subProjectId]
  );

  const avgLabour = useMemo(
    () => calcAvgWeeklyLabour(labourInPeriod, weekStart, weekEnd),
    [labourInPeriod, weekStart, weekEnd]
  );

  const weeklyVowd = useMemo(
    () => calcWeeklyVowd(scopedProgress, weekStart, weekEnd),
    [scopedProgress, weekStart, weekEnd]
  );

  const wprMonthId = week?.monthId || (week?.startDate ? String(week.startDate).slice(0, 7) : '');
  const mprBaselineInfo = useMemo(() => {
    return getMprBaselineForWpr(allMprReports, week?.weekNum, wprMonthId, weekStart, weekEnd);
  }, [allMprReports, week?.weekNum, wprMonthId, weekStart, weekEnd]);

  // Reset when week/scope changes
  useEffect(() => {
    setLoadedKey('');
    setReportId(null);
    setStatus('draft');
    setForm(createDefaultWprForm(selectedProject));
    // Only re-init when week/project/sub-project scope changes
     
  }, [scopeKey]);

  // Hydrate from saved report + locked computed fields
  useEffect(() => {
    if (reportLoading || labourLoading || !weekId || loadedKey === scopeKey) return;

    const existing = existingReports[0];
    const parsed = parseWprFormData(existing?.form_data);
    const base = createDefaultWprForm(selectedProject);
    const mprBaselines = mprBaselineInfo?.missing ? null : mprBaselineInfo;

    const hasRealItem = (list) => Array.isArray(list) && list.some((r) => (r?.name || r?.subItemName || '').trim() !== '');
    const resolveMultiRow = (savedRows, baselineRows, defaultRows) => {
      if (hasRealItem(savedRows)) return savedRows;
      if (hasRealItem(baselineRows)) return baselineRows;
      return savedRows?.length ? savedRows : defaultRows;
    };

    if (parsed) {
      setForm({
        ...base,
        ...parsed,
        avgLabour: {
          plan: parsed.avgLabour?.plan !== '' && parsed.avgLabour?.plan != null ? parsed.avgLabour.plan : (mprBaselines?.avgLabour ?? ''),
          achieved: avgLabour,
        },
        milestones: {
          plan: parsed.milestones?.plan !== '' && parsed.milestones?.plan != null ? parsed.milestones.plan : (mprBaselines?.milestones ?? ''),
          achieved: parsed.milestones?.achieved ?? '',
        },
        contractorReviewMeeting: {
          plan: parsed.contractorReviewMeeting?.plan !== '' && parsed.contractorReviewMeeting?.plan != null ? parsed.contractorReviewMeeting.plan : (mprBaselines?.contractorReviewMeeting ?? ''),
          achieved: parsed.contractorReviewMeeting?.achieved ?? '',
        },
        valueOfWorkDone: {
          plan: parsed.valueOfWorkDone?.plan !== '' && parsed.valueOfWorkDone?.plan != null ? parsed.valueOfWorkDone.plan : (mprBaselines?.valueOfWorkDone ?? ''),
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
        materialRequisitions: generateAllRequisitionRowsFromBaseline(
          mprBaselines?.materialRequisitions,
          parsed.materialRequisitions
        ),
        materialRequisitionsSummary: parsed.materialRequisitionsSummary || { plan: '', achieved: '' },
        billsToCertify: generateAllBillRowsFromBaseline(
          mprBaselines?.billsToCertify,
          parsed.billsToCertify
        ),
        billsToCertifySummary: parsed.billsToCertifySummary || { plan: '', achieved: '' },
        leadershipInputs: resolveMultiRow(parsed.leadershipInputs, mprBaselines?.leadershipInputs, base.leadershipInputs),
        mockUpActivities: resolveMultiRow(parsed.mockUpActivities, mprBaselines?.mockUpActivities, base.mockUpActivities),
        contractorsMobilized: resolveMultiRow(parsed.contractorsMobilized, mprBaselines?.contractorsMobilized, base.contractorsMobilized),
        keyPlanActivities: resolveMultiRow(parsed.keyPlanActivities, mprBaselines?.keyPlanActivities, base.keyPlanActivities),
        workMethodology: resolveMultiRow(parsed.workMethodology, mprBaselines?.workMethodology, base.workMethodology),
        supportRequired: resolveMultiRow(parsed.supportRequired, mprBaselines?.supportRequired, base.supportRequired),
      });
      setReportId(existing.id);
      setStatus(existing.status || 'draft');
    } else {
      setForm({
        ...base,
        avgLabour: { plan: mprBaselines?.avgLabour ?? '', achieved: avgLabour },
        milestones: { plan: mprBaselines?.milestones ?? '', achieved: '' },
        qualityRating: { plan: 10, achieved: '' },
        healthSafetyRating: { plan: 10, achieved: '' },
        contractorReviewMeeting: { plan: mprBaselines?.contractorReviewMeeting ?? '', achieved: '' },
        valueOfWorkDone: { plan: mprBaselines?.valueOfWorkDone ?? '', achieved: weeklyVowd },
        materialRequisitions: generateAllRequisitionRowsFromBaseline(
          mprBaselines?.materialRequisitions,
          []
        ),
        billsToCertify: generateAllBillRowsFromBaseline(
          mprBaselines?.billsToCertify,
          []
        ),
        leadershipInputs: mprBaselines?.leadershipInputs?.length
          ? mprBaselines.leadershipInputs
          : base.leadershipInputs,
        mockUpActivities: mprBaselines?.mockUpActivities?.length
          ? mprBaselines.mockUpActivities
          : base.mockUpActivities,
        contractorsMobilized: mprBaselines?.contractorsMobilized?.length
          ? mprBaselines.contractorsMobilized
          : base.contractorsMobilized,
        keyPlanActivities: mprBaselines?.keyPlanActivities?.length
          ? mprBaselines.keyPlanActivities
          : base.keyPlanActivities,
        workMethodology: mprBaselines?.workMethodology?.length
          ? mprBaselines.workMethodology
          : base.workMethodology,
        supportRequired: mprBaselines?.supportRequired?.length
          ? mprBaselines.supportRequired
          : base.supportRequired,
      });
      setReportId(null);
      setStatus('draft');
    }
    setLoadedKey(scopeKey);
  }, [
    existingReports,
    reportLoading,
    labourLoading,
    scopeKey,
    weekId,
    loadedKey,
    selectedProject,
    avgLabour,
    weeklyVowd,
    mprBaselineInfo,
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

  const syncAchievedToMpr = async () => {
    const achievedReqs = (form.materialRequisitions || []).filter(isRequisitionRowAchieved);
    const filledBills = (form.billsToCertify || []).filter(isBillRowAchieved);

    if (achievedReqs.length === 0 && filledBills.length === 0) return;

    const targetMonthId = wprMonthId || (weekStart ? String(weekStart).slice(0, 7) : '');
    if (!targetMonthId) return;

    try {
      const mprList = await base44.entities.MprReport.filter({
        project_id: projectId,
        month_id: targetMonthId,
      });
      if (!mprList || mprList.length === 0) return;

      const currentMpr = mprList[0];
      let mprFormData = currentMpr.form_data;
      if (typeof mprFormData === 'string') {
        try { mprFormData = JSON.parse(mprFormData); } catch { mprFormData = {}; }
      }
      if (!mprFormData) mprFormData = {};

      let updatedReqs = Array.isArray(mprFormData.materialRequisitions) ? [...mprFormData.materialRequisitions] : [];
      let updatedBills = Array.isArray(mprFormData.contractorBills) ? [...mprFormData.contractorBills] : [];

      achievedReqs.forEach((r) => {
        const existsIdx = updatedReqs.findIndex((m) => m.id === r.id || (m.requisitionNo && m.requisitionNo === r.requisitionNo));
        const itemObj = {
          id: r.id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: r.date || '',
          requisitionNo: r.requisitionNo || '',
          particulars: r.name || r.subItemName || '',
          unit: r.unit || '',
          qty: r.qty || '',
          receivedDate: r.receivedDate || '',
          remarks: r.remark || '',
        };
        if (existsIdx >= 0) {
          updatedReqs[existsIdx] = { ...updatedReqs[existsIdx], ...itemObj };
        } else {
          updatedReqs.push(itemObj);
        }
      });

      filledBills.forEach((b) => {
        const itemObj = {
          id: b.id || `bill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: b.billDate || '',
          work: b.name || b.subItemName || '',
          raBillNo: b.raBillNo || '',
          agencyName: b.agencyName || '',
          amount: b.billAmount ?? '',
        };
        const existsIdx = updatedBills.findIndex((m) => m.id === itemObj.id);
        if (existsIdx >= 0) {
          updatedBills[existsIdx] = { ...updatedBills[existsIdx], ...itemObj };
        } else {
          // Drop a single trailing empty placeholder row when appending the first real bill
          if (
            updatedBills.length === 1 &&
            !updatedBills[0].date &&
            !updatedBills[0].work &&
            !updatedBills[0].raBillNo &&
            !updatedBills[0].agencyName &&
            (updatedBills[0].amount === '' || updatedBills[0].amount == null)
          ) {
            updatedBills = [itemObj];
          } else {
            updatedBills.push(itemObj);
          }
        }
      });

      await base44.entities.MprReport.update(currentMpr.id, {
        form_data: JSON.stringify({
          ...mprFormData,
          materialRequisitions: updatedReqs,
          contractorBills: updatedBills,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['mpr-report', projectId, targetMonthId] });
      queryClient.invalidateQueries({ queryKey: ['wpr-reports-for-mpr', projectId, targetMonthId] });
    } catch (err) {
      console.warn('Sync to MPR failed:', err);
    }
  };

  const persist = async (nextStatus) => {
    if (!projectId || !week?.wprYear || !week?.wprMonthNum || !week?.weekNum || !weekStart || !weekEnd) {
      toast({
        title: 'Mandatory Fields Missing',
        description: 'Please select Project, Year, Month, Week, Start Date, and End Date before saving.',
        variant: 'destructive',
      });
      throw new Error('Mandatory fields missing');
    }

    if (weekStart > weekEnd) {
      toast({
        title: 'Invalid Date Range',
        description: 'Start Date cannot be greater than End Date.',
        variant: 'destructive',
      });
      throw new Error('Invalid date range');
    }

    const payload = buildPayload(nextStatus);
    if (reportId) {
      const updated = await base44.entities.WprReport.update(reportId, payload);
      setReportId(updated?.id || reportId);
    } else {
      const created = await base44.entities.WprReport.create(payload);
      setReportId(created?.id || null);
    }
    await syncAchievedToMpr();
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
        description: 'Weekly report submitted for review.',
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

  const handleApproveReport = async () => {
    setSaving(true);
    try {
      await persist('approved');
      setShowReview(false);
      toast({
        title: 'WPR Approved & Locked',
        description: 'Weekly report approved and locked for this week.',
      });
    } catch (err) {
      toast({
        title: 'Approve Failed',
        description: err?.message || 'Could not approve WPR.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const reviewSections = useMemo(() => {
    const simpleRow = (label, plan, achieved, extra = {}) => ({
      title: label,
      tooltip: extra.tooltip,
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

    const multiSection = (title, nameLabel, rows, withRemark = true, tooltip) => {
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
        tooltip,
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

      const requisitionSummary = calcWprRequisitionSummary(form.materialRequisitions);
      const billsSummary = calcWprBillSummary(form.billsToCertify);

      const requisitionReviewSection = {
        title: '5. No of Requisition Of Material',
        tooltip: 'Material requisitions raised this week — list each requisition with date and received status.',
        pctLabel: `Total % Achieved: ${formatPct(requisitionSummary.plan, requisitionSummary.achieved)}`,
        columns: [
          { key: 'sr', label: '#' },
          { key: 'name', label: 'Requisition' },
          { key: 'requisitionNo', label: 'Requisition No.' },
          { key: 'date', label: 'Date' },
          { key: 'receivedDate', label: 'Received Date' },
          { key: 'remark', label: 'Remark' },
        ],
        rows: (form.materialRequisitions || [])
          .filter((r) => (r.name || '').trim() || (r.requisitionNo || '').trim() || (r.date || '').trim() || (r.receivedDate || '').trim())
          .map((r, i) => ({
            id: r.id,
            sr: i + 1,
            name: r.name || '—',
            requisitionNo: r.requisitionNo || '—',
            date: r.date || '—',
            receivedDate: r.receivedDate || '—',
            remark: r.remark || '—',
          })),
      };

      const billsReviewSection = {
        title: '6. Bills to certify',
        tooltip: 'Contractor or vendor bills that need certification this week.',
        pctLabel: `Total % Achieved: ${formatPct(billsSummary.plan, billsSummary.achieved)}`,
        columns: [
          { key: 'sr', label: '#' },
          { key: 'name', label: 'Work' },
          { key: 'agencyName', label: 'Name of Agency' },
          { key: 'billDate', label: 'Bill Date' },
          { key: 'raBillNo', label: 'RA Bill No' },
          { key: 'remark', label: 'Remark' },
        ],
        rows: (form.billsToCertify || [])
          .filter((r) => (r.name || '').trim() || (r.agencyName || '').trim() || (r.billDate || '').trim() || (r.raBillNo || '').trim())
          .map((r, i) => ({
            id: r.id,
            sr: i + 1,
            name: r.name || '—',
            agencyName: r.agencyName || '—',
            billDate: r.billDate || '—',
            raBillNo: r.raBillNo || '—',
            remark: r.remark || '—',
          })),
      };

      return [
        simpleRow('1. Avg. No Of Labour Allocated', form.avgLabour.plan, avgLabour, {
          tooltip: 'Average daily labour for the selected Start–End dates (total mandays ÷ days in period), from saved Contractor Labour on DPRs.',
        }),
        simpleRow('2. No. of Construction Milestones to Achieve (Building wise)', form.milestones.plan, form.milestones.achieved, {
          tooltip: 'Number of construction milestones planned versus achieved this week, building-wise.',
        }),
        simpleRow('3. Quality Rating', form.qualityRating.plan, form.qualityRating.achieved, {
          tooltip: 'Rate the quality of work executed this week on a scale of 1–10.',
        }),
        simpleRow('4. Health and Safety Rating', form.healthSafetyRating.plan, form.healthSafetyRating.achieved, {
          tooltip: 'Rate health & safety compliance on site this week on a scale of 1–10.',
        }),
        requisitionReviewSection,
        billsReviewSection,
      multiSection('7. Leadership / Client / Consultant Inputs', 'Feedback', form.leadershipInputs, false,
        'Key directives or feedback received from leadership, client, or consultant to be adopted this week.'),
      multiSection('8. Mock up Activity', 'Mock up Activity', form.mockUpActivities, true,
        'Mock-up activities planned and completed on site this week.'),
      multiSection('9. Contractors to be Mobilized', 'Contractor', form.contractorsMobilized, true,
        'New contractors planned to be mobilized to site this week.'),
      simpleRow('10. Contractor review meeting conducted', form.contractorReviewMeeting.plan, form.contractorReviewMeeting.achieved, {
        tooltip: 'Whether the scheduled contractor review meeting was planned and conducted this week.',
      }),
      multiSection('11. Key Plan Activity', 'Activity Name', form.keyPlanActivities, true,
        'Key activities planned for the week and what was actually achieved.'),
      simpleRow('12. Value of Work Done', form.valueOfWorkDone.plan, weeklyVowd, {
        formatAchieved: (v) => formatCurrencyINR(v || 0),
        tooltip: 'Value of work completed this week, auto-calculated from progress entries.',
      }),
      multiSection('13. Work Methodology Details', 'Work Methodology', form.workMethodology, true,
        'Work methodology or execution approach followed for key activities this week.'),
      multiSection('14. Support Required / Decision On Details', 'Support Required / Decision On', form.supportRequired, true,
        'Support, approvals, or decisions required from management this week.'),
      {
        title: '15. Timeline Monthly',
        tooltip: 'Overall project start and end dates used for monthly timeline tracking.',
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

  const handleUnlockReport = async () => {
    setSaving(true);
    try {
      await persist('draft');
      toast({
        title: 'Report Unlocked',
        description: 'WPR report unlocked and restored to draft mode.',
      });
    } catch (err) {
      toast({
        title: 'Unlock Failed',
        description: err?.message || 'Could not unlock report.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <TooltipProvider>
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
              Fill plan vs achieved
            </CardTitle>
            <div className="flex items-center gap-2">
              {status === 'approved' ? (
                <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                  <Lock className="w-3 h-3" />
                  Approved — Locked
                </Badge>
              ) : status === 'submitted' ? (
                <Badge className="bg-blue-100 text-blue-800 gap-1">
                  <FileCheck className="w-3 h-3" />
                  Submitted — Editable
                </Badge>
              ) : reportId ? (
                <Badge variant="secondary">Draft — Editable</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {mprBaselineInfo?.missing && (
              <div className="p-4 border border-amber-300 bg-amber-50 rounded-lg flex items-start gap-3 text-amber-900 text-sm shadow-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 mb-0.5">MPR Weekly Plan Not Available</h4>
                  <p className="text-amber-800 font-normal">
                    Weekly Plan for <strong>{mprBaselineInfo.wprMonthLabel || 'this month'}</strong> is not available.
                    Please complete and approve the <strong>{mprBaselineInfo.prevMonthLabel || 'previous month'}</strong> MPR first.
                  </p>
                </div>
              </div>
            )}
            <PlanAchievedRow
              label="1. Avg. No Of Labour Allocated"
              tooltip="Average daily labour for the selected Start–End dates (total mandays ÷ days in period), from saved Contractor Labour on DPRs."
              plan={form.avgLabour.plan}
              achieved={avgLabour}
              onPlanChange={(v) => updateSimple('avgLabour', 'plan', v)}
              achievedLocked
              locked={isLocked}
            />

            <PlanAchievedRow
              label="2. No. of Construction Milestones to Achieve: Building wise"
              tooltip="Number of construction milestones planned versus achieved this week, building-wise."
              plan={form.milestones.plan}
              achieved={form.milestones.achieved}
              onPlanChange={(v) => updateSimple('milestones', 'plan', v)}
              onAchievedChange={(v) => updateSimple('milestones', 'achieved', v)}
              locked={isLocked}
            />

            <PlanAchievedRow
              label="3. Quality Rating"
              tooltip="Rate the quality of work executed this week on a scale of 1–10."
              plan={form.qualityRating.plan}
              achieved={form.qualityRating.achieved}
              onPlanChange={(v) => updateSimple('qualityRating', 'plan', v)}
              onAchievedChange={(v) => updateSimple('qualityRating', 'achieved', v)}
              locked={isLocked}
              planLocked
            />

            <PlanAchievedRow
              label="4. Health and Safety Rating"
              tooltip="Rate health & safety compliance on site this week on a scale of 1–10."
              plan={form.healthSafetyRating.plan}
              achieved={form.healthSafetyRating.achieved}
              onPlanChange={(v) => updateSimple('healthSafetyRating', 'plan', v)}
              onAchievedChange={(v) => updateSimple('healthSafetyRating', 'achieved', v)}
              locked={isLocked}
              planLocked
            />

            <Point5RequisitionSection
              title="5. No of Requisition Of Material"
              tooltip="Material requisitions raised this week — list each requisition with date and received status."
              rows={form.materialRequisitions}
              onChange={(rows) => setForm((p) => ({ ...p, materialRequisitions: rows }))}
              customSummary={form.materialRequisitionsSummary}
              onSummaryChange={(field, val) =>
                setForm((p) => ({
                  ...p,
                  materialRequisitionsSummary: { ...p.materialRequisitionsSummary, [field]: val },
                }))
              }
              locked={isLocked}
            />

            <Point6BillsSection
              title="6. Bills to certify"
              tooltip="Contractor or vendor bills that need certification this week."
              rows={form.billsToCertify}
              onChange={(rows) => setForm((p) => ({ ...p, billsToCertify: rows }))}
              customSummary={form.billsToCertifySummary}
              onSummaryChange={(field, val) =>
                setForm((p) => ({
                  ...p,
                  billsToCertifySummary: { ...p.billsToCertifySummary, [field]: val },
                }))
              }
              locked={isLocked}
            />

            <MultiRowSection
              title="7. No. of leadership input / client inputs / consultant inputs to be adopted"
              tooltip="Key directives or feedback received from leadership, client, or consultant to be adopted this week."
              nameLabel="Feedback"
              rows={form.leadershipInputs}
              onChange={(rows) => setForm((p) => ({ ...p, leadershipInputs: rows }))}
              locked={isLocked}
              showRemark={false}
            />

            <MultiRowSection
              title="8. Mock up Activity"
              tooltip="Mock-up activities planned and completed on site this week."
              nameLabel="Mock up Activity"
              rows={form.mockUpActivities}
              onChange={(rows) => setForm((p) => ({ ...p, mockUpActivities: rows }))}
              locked={isLocked}
            />

            <MultiRowSection
              title="9. Contractors to be Mobilized"
              tooltip="New contractors planned to be mobilized to site this week."
              nameLabel="Contractor"
              rows={form.contractorsMobilized}
              onChange={(rows) => setForm((p) => ({ ...p, contractorsMobilized: rows }))}
              locked={isLocked}
            />

            <PlanAchievedRow
              label="10. Contractor review meeting conducted"
              tooltip="Whether the scheduled contractor review meeting was planned and conducted this week."
              plan={form.contractorReviewMeeting.plan}
              achieved={form.contractorReviewMeeting.achieved}
              onPlanChange={(v) => updateSimple('contractorReviewMeeting', 'plan', v)}
              onAchievedChange={(v) => updateSimple('contractorReviewMeeting', 'achieved', v)}
              locked={isLocked}
            />

            <MultiRowSection
              title="11. Key Plan Activity"
              tooltip="Key activities planned for the week and what was actually achieved."
              nameLabel="Activity Name"
              rows={form.keyPlanActivities}
              onChange={(rows) => setForm((p) => ({ ...p, keyPlanActivities: rows }))}
              locked={isLocked}
            />

            <PlanAchievedRow
              label="12. Value of Work Done"
              tooltip="Value of work completed this week, auto-calculated from progress entries."
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
              tooltip="Work methodology or execution approach followed for key activities this week."
              nameLabel="Work Methodology"
              rows={form.workMethodology}
              onChange={(rows) => setForm((p) => ({ ...p, workMethodology: rows }))}
              locked={isLocked}
            />

            <MultiRowSection
              title="14. Support Required / Decision On Details"
              tooltip="Support, approvals, or decisions required from management this week."
              nameLabel="Support Required / Decision On"
              rows={form.supportRequired}
              onChange={(rows) => setForm((p) => ({ ...p, supportRequired: rows }))}
              locked={isLocked}
            />

            <div className="space-y-2">
              <TitleWithTooltip
                text="15. Timeline Monthly"
                tooltip="Overall project start and end dates used for monthly timeline tracking."
              />
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

      {!loading && (
        <div className="flex flex-wrap justify-end gap-3 bg-card border rounded-xl p-4 shadow-sm">
          {!isLocked ? (
            <>
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
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleUnlockReport}
              disabled={saving || loading}
              className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50"
            >
              <Lock className="w-4 h-4 text-amber-600" />
              Unlock Report to Edit
            </Button>
          )}
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
        onApprove={handleApproveReport}
        isSubmitting={saving}
      />
    </div>
    </TooltipProvider>
  );
}
