import React, { useMemo, useState, useEffect, forwardRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Minus, Trash2, Wrench, Clock, Coins, Calculator, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import StatCard from '@/components/shared/StatCard';
import { formatCurrencyINR, normalizeDateKey } from '@/lib/formatters';
import { useDprPanelRef } from '@/components/progress/useDprPanelRef';

const createEmptyRow = () => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  machinery_name: '',
  nos: '',
  todays_hours: '',
  rate: '',
});

export default forwardRef(function MachineriesDetailsPanel({
  projectId,
  subProjectId,
  selectedDate,
  isDateLocked = false,
}, ref) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([createEmptyRow()]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [loadedDate, setLoadedDate] = useState(null);

  // Fetch all historical machinery details for calculations
  const { data: allMachineryEntries = [], isLoading: allLoading } = useQuery({
    queryKey: ['machinery-details-all', projectId, subProjectId],
    queryFn: () => base44.entities.MachineryDetail.filter({
      project_id: projectId,
      sub_project_id: subProjectId,
    }),
    enabled: !!projectId && !!subProjectId,
  });

  // Fetch machinery details for the selected date
  const { data: selectedDateEntries = [], isLoading: dateLoading } = useQuery({
    queryKey: ['machinery-details-date', projectId, subProjectId, selectedDate],
    queryFn: () => base44.entities.MachineryDetail.filter({
      project_id: projectId,
      sub_project_id: subProjectId,
      date: selectedDate,
    }),
    enabled: !!projectId && !!subProjectId && !!selectedDate,
  });

  // Reset local state immediately when the reporting date changes
  useEffect(() => {
    setRows([createEmptyRow()]);
    setDeletedIds([]);
    setLoadedDate(null);
  }, [selectedDate]);

  // Sync db entries to local state
  useEffect(() => {
    if (dateLoading || selectedDate === loadedDate) return;

    if (selectedDateEntries && selectedDateEntries.length > 0) {
      setRows(selectedDateEntries.map(e => ({
        id: e.id,
        machinery_name: e.machinery_name || '',
        nos: e.nos !== null ? String(e.nos) : '',
        todays_hours: e.todays_hours !== null ? String(e.todays_hours) : '',
        rate: e.rate !== null ? String(e.rate) : '',
      })));
    } else {
      setRows([createEmptyRow()]);
    }
    setLoadedDate(selectedDate);
    setDeletedIds([]);
  }, [selectedDateEntries, selectedDate, loadedDate, dateLoading]);

  // Dynamic calculations for each row
  const calculatedRows = useMemo(() => {
    return rows.map((row, index) => {
      const machineryName = row.machinery_name?.trim() || '';
      const nosVal = parseFloat(row.nos) || 0;
      const todaysHoursVal = parseFloat(row.todays_hours) || 0;
      const rateVal = parseFloat(row.rate) || 0;

      let tillDateHours = 0;
      let tillDateAmount = 0;

      if (machineryName) {
        // Filter history for previous dates, excluding currently edited row in db
        const previousEntries = allMachineryEntries.filter(e => 
          e.machinery_name.toLowerCase() === machineryName.toLowerCase() &&
          normalizeDateKey(e.date) < selectedDate &&
          e.id !== row.id
        );

        tillDateHours = previousEntries.reduce((sum, e) => sum + (parseFloat(e.todays_hours) || 0), 0);
        tillDateAmount = previousEntries.reduce((sum, e) => sum + (parseFloat(e.todays_amount) || 0), 0);
      }

      const todaysAmount = nosVal * todaysHoursVal * rateVal;
      const cumulativeHours = tillDateHours + todaysHoursVal;
      const cumulativeAmount = tillDateAmount + todaysAmount;

      return {
        ...row,
        till_date_hours: tillDateHours,
        todays_hours_val: todaysHoursVal,
        cumulative_hours: cumulativeHours,
        till_date_amount: tillDateAmount,
        todays_amount: todaysAmount,
        cumulative_amount: cumulativeAmount,
      };
    });
  }, [rows, allMachineryEntries, selectedDate]);

  const machineryNameSuggestions = useMemo(() => {
    const byKey = new Map();

    allMachineryEntries.forEach((entry) => {
      const machineryName = (entry.machinery_name || '').trim();
      if (!machineryName) return;

      const key = machineryName.toLowerCase();
      const existing = byKey.get(key);

      if (!existing || normalizeDateKey(entry.date) > normalizeDateKey(existing.lastDate)) {
        byKey.set(key, {
          machinery_name: machineryName,
          nos: entry.nos !== null && entry.nos !== undefined ? String(entry.nos) : '',
          rate: entry.rate !== null && entry.rate !== undefined ? String(entry.rate) : '',
          lastDate: entry.date,
        });
      }
    });

    return Array.from(byKey.values()).sort((a, b) => a.machinery_name.localeCompare(b.machinery_name));
  }, [allMachineryEntries]);

  const suggestionListId = 'machinery-name-suggestions';

  // Aggregate stats for cards
  const stats = useMemo(() => {
    let totalMachines = 0;
    let totalHoursToday = 0;
    let totalCostToday = 0;
    let totalCumulativeCost = 0;

    calculatedRows.forEach(r => {
      totalMachines += parseFloat(r.nos) || 0;
      totalHoursToday += r.todays_hours_val;
      totalCostToday += r.todays_amount;
      totalCumulativeCost += r.cumulative_amount;
    });

    return {
      totalMachines,
      totalHoursToday,
      totalCostToday,
      totalCumulativeCost,
    };
  }, [calculatedRows]);

  const performSave = useCallback(async () => {
    if (deletedIds.length > 0) {
      await Promise.all(deletedIds.map(id => base44.entities.MachineryDetail.delete(id)));
    }
    const validRows = calculatedRows.filter(r => r.machinery_name.trim());
    await Promise.all(validRows.map(row => {
      const payload = {
        project_id: projectId,
        sub_project_id: subProjectId,
        date: selectedDate,
        machinery_name: row.machinery_name.trim(),
        nos: parseFloat(row.nos) || 0,
        till_date_hours: row.till_date_hours,
        todays_hours: parseFloat(row.todays_hours) || 0,
        cumulative_hours: row.cumulative_hours,
        rate: parseFloat(row.rate) || 0,
        till_date_amount: row.till_date_amount,
        todays_amount: row.todays_amount,
        cumulative_amount: row.cumulative_amount,
      };
      if (row.id && !row.id.startsWith('temp_')) {
        return base44.entities.MachineryDetail.update(row.id, payload);
      }
      return base44.entities.MachineryDetail.create(payload);
    }));
  }, [calculatedRows, deletedIds, projectId, subProjectId, selectedDate]);

  const validate = useCallback(() => {
    const hasInvalidRow = rows.some(r => r.machinery_name.trim() && (
      isNaN(parseFloat(r.nos)) || isNaN(parseFloat(r.todays_hours)) || isNaN(parseFloat(r.rate))
    ));
    if (hasInvalidRow) {
      return 'Machinery Details: ensure Nos, Hours, and Rate are valid numbers.';
    }
    return null;
  }, [rows]);

  const getReviewData = useCallback(() => ({
    title: 'E. Machineries Details',
    columns: [
      { key: 'sr', label: 'Sr.' },
      { key: 'machinery_name', label: 'Machinery' },
      { key: 'nos', label: 'Nos' },
      { key: 'todays_hours', label: "Today's Total Hours" },
      { key: 'todays_amount', label: 'Today Amount', render: (r) => formatCurrencyINR(r.todays_amount) },
    ],
    rows: calculatedRows
      .filter((r) => r.machinery_name.trim())
      .map((r, i) => ({
        sr: i + 1,
        machinery_name: r.machinery_name,
        nos: r.nos || 0,
        todays_hours: r.todays_hours_val,
        todays_amount: r.todays_amount,
      })),
  }), [calculatedRows]);

  useDprPanelRef(ref, {
    validate,
    getReviewData,
    save: async () => {
      const error = validate();
      if (error) throw new Error(error);
      await performSave();
      queryClient.invalidateQueries({ queryKey: ['machinery-details-all', projectId] });
      queryClient.invalidateQueries({ queryKey: ['machinery-details-date', projectId] });
      setLoadedDate(null);
      setDeletedIds([]);
    },
  });

  const handleAddRow = (index) => {
    if (isDateLocked) return;
    setRows(prev => {
      const copy = [...prev];
      copy.splice(index + 1, 0, createEmptyRow());
      return copy;
    });
  };

  const handleRemoveRow = (index, rowId) => {
    if (isDateLocked) return;
    if (rowId && !rowId.startsWith('temp_')) {
      setDeletedIds(prev => [...prev, rowId]);
    }
    setRows(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length === 0 ? [createEmptyRow()] : filtered;
    });
  };

  const handleUpdateField = (index, field, value) => {
    if (isDateLocked) return;
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleMachineryNameChange = (index, value) => {
    handleUpdateField(index, 'machinery_name', value);

    const match = machineryNameSuggestions.find(
      (item) => item.machinery_name.toLowerCase() === value.trim().toLowerCase()
    );
    if (!match) return;

    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      return {
        ...row,
        machinery_name: match.machinery_name,
        nos: row.nos?.trim() ? row.nos : match.nos,
        rate: row.rate?.trim() ? row.rate : match.rate,
      };
    }));
  };

  const isLoading = allLoading || dateLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground font-sans">Loading machinery details...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {isDateLocked && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            DPR is locked for this date. Machinery details cannot be changed.
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Machines" value={stats.totalMachines} icon={Wrench} />
          <StatCard title="Total Hours Today" value={`${stats.totalHoursToday.toFixed(1)} hrs`} icon={Clock} />
          <StatCard title="Cost Today" value={formatCurrencyINR(stats.totalCostToday)} icon={Coins} />
          <StatCard title="Cumulative Cost" value={formatCurrencyINR(stats.totalCumulativeCost)} icon={Calculator} />
        </div>

        {/* Table Form Layout */}
        <Card className="overflow-hidden border shadow-sm">
          <datalist id={suggestionListId}>
            {machineryNameSuggestions.map((item) => (
              <option key={item.machinery_name} value={item.machinery_name}>
                {item.nos ? `Nos: ${item.nos}` : 'Previously used machinery'}
                {item.rate ? ` | Rate: ${item.rate}` : ''}
              </option>
            ))}
          </datalist>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans border-collapse min-w-[1200px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase w-[220px]">
                    <div className="flex items-center gap-1 select-none">
                      <span>Name of Machineries *</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Specify the machinery type. Matches history using this name (case-insensitive).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[90px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Nos *</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Number of machinery units deployed today.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[130px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Till Date Total Hours</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Total run hours accumulated on previous days for this machinery.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[140px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Todays Total Hours *</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Operating hours today (hours run per machine).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[150px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Cumulative Total Hours</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Total run hours up to date (Till Date Hours + Today's Hours).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Rate *</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Hourly operating or rental rate per machine unit.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[150px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Till Date Total Amount</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Total cost accumulated on previous days for this machinery.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[130px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Todays Amount</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Cost incurred today (Nos × Today's Hours × Rate).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[160px]">
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Cumulative Total Amount</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Total cost up to date (Till Date Amount + Today's Amount).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase w-[90px]">Add/Remove</th>
              </tr>
            </thead>
            <tbody>
              {calculatedRows.map((row, index) => (
                <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                  {/* Name of Machineries */}
                  <td className="p-2.5">
                    <Input
                      type="text"
                      list={machineryNameSuggestions.length > 0 ? suggestionListId : undefined}
                      value={row.machinery_name}
                      onChange={(e) => handleMachineryNameChange(index, e.target.value)}
                      placeholder="e.g. JCB, Hydra Crane, Transit Mixer"
                      disabled={isDateLocked}
                      className="h-8.5 text-xs bg-background"
                      required
                      autoComplete="off"
                    />
                  </td>

                  {/* Nos */}
                  <td className="p-2.5">
                    <Input
                      type="number"
                      value={row.nos}
                      onChange={e => handleUpdateField(index, 'nos', e.target.value)}
                      placeholder="0"
                      disabled={isDateLocked}
                      className="h-8.5 text-xs text-right bg-background w-full"
                      min="0"
                    />
                  </td>

                  {/* Till Date Total Hours (calculated) */}
                  <td className="p-2.5">
                    <Input
                      type="text"
                      value={row.till_date_hours.toFixed(1)}
                      disabled
                      readOnly
                      className="h-8.5 text-xs text-right bg-muted/40 font-mono select-none"
                    />
                  </td>

                  {/* Todays Total Hours */}
                  <td className="p-2.5">
                    <Input
                      type="number"
                      value={row.todays_hours}
                      onChange={e => handleUpdateField(index, 'todays_hours', e.target.value)}
                      placeholder="0.0"
                      disabled={isDateLocked}
                      className="h-8.5 text-xs text-right bg-background w-full"
                      min="0"
                      step="0.1"
                    />
                  </td>

                  {/* Cumulative Total Hours (calculated) */}
                  <td className="p-2.5">
                    <Input
                      type="text"
                      value={row.cumulative_hours.toFixed(1)}
                      disabled
                      readOnly
                      className="h-8.5 text-xs text-right bg-muted/40 font-mono select-none font-semibold text-slate-700"
                    />
                  </td>

                  {/* Rate */}
                  <td className="p-2.5">
                    <Input
                      type="number"
                      value={row.rate}
                      onChange={e => handleUpdateField(index, 'rate', e.target.value)}
                      placeholder="0.00"
                      disabled={isDateLocked}
                      className="h-8.5 text-xs text-right bg-background w-full"
                      min="0"
                      step="0.01"
                    />
                  </td>

                  {/* Till Date Total Amount (calculated) */}
                  <td className="p-2.5">
                    <Input
                      type="text"
                      value={formatCurrencyINR(row.till_date_amount)}
                      disabled
                      readOnly
                      className="h-8.5 text-xs text-right bg-muted/40 font-mono select-none"
                    />
                  </td>

                  {/* Todays Amount (calculated) */}
                  <td className="p-2.5">
                    <Input
                      type="text"
                      value={formatCurrencyINR(row.todays_amount)}
                      disabled
                      readOnly
                      className="h-8.5 text-xs text-right bg-muted/40 font-mono select-none font-semibold text-slate-800"
                    />
                  </td>

                  {/* Cumulative Total Amount (calculated) */}
                  <td className="p-2.5">
                    <Input
                      type="text"
                      value={formatCurrencyINR(row.cumulative_amount)}
                      disabled
                      readOnly
                      className="h-8.5 text-xs text-right bg-muted/50 font-mono select-none font-bold text-emerald-600 border-emerald-100"
                    />
                  </td>

                  {/* Actions +/- */}
                  <td className="p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => handleAddRow(index)}
                        disabled={isDateLocked}
                        title="Add machinery row"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-destructive border-red-100 hover:bg-red-50 hover:text-destructive"
                        onClick={() => handleRemoveRow(index, row.id)}
                        disabled={isDateLocked}
                        title="Remove machinery row"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card Footer Actions */}
        <div className="flex justify-start items-center bg-muted/10 p-4 border-t">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 text-xs font-semibold"
            onClick={() => handleAddRow(rows.length - 1)}
            disabled={isDateLocked}
          >
            <Plus className="w-4 h-4" /> Add Row
          </Button>
        </div>
      </Card>
    </div>
    </TooltipProvider>
  );
});
