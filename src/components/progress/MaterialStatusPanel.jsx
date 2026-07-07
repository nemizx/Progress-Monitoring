import React, { useMemo, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Minus, Trash2, Package, RefreshCcw, TrendingUp, Coins, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import StatCard from '@/components/shared/StatCard';
import { formatCurrencyINR, normalizeDateKey } from '@/lib/formatters';

const createEmptyRow = () => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  unit: '',
  today_rec: '',
  today_consumed: '',
  rate: '',
  remarks: '',
});

export default forwardRef(function MaterialStatusPanel({
  projectId,
  subProjectId,
  selectedDate,
  isDateLocked = false,
}, ref) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([createEmptyRow()]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [loadedDate, setLoadedDate] = useState(null);

  // Fetch all historical material status details for calculations
  const { data: allMaterialEntries = [], isLoading: allLoading } = useQuery({
    queryKey: ['material-status-all', projectId, subProjectId],
    queryFn: () => base44.entities.MaterialStatus.filter({
      project_id: projectId,
      sub_project_id: subProjectId,
    }),
    enabled: !!projectId && !!subProjectId,
  });

  // Fetch material status for the selected date
  const { data: selectedDateEntries = [], isLoading: dateLoading } = useQuery({
    queryKey: ['material-status-date', projectId, subProjectId, selectedDate],
    queryFn: () => base44.entities.MaterialStatus.filter({
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
        description: e.description || '',
        unit: e.unit || '',
        today_rec: e.today_rec !== null ? String(e.today_rec) : '',
        today_consumed: e.today_consumed !== null ? String(e.today_consumed) : '',
        rate: e.rate !== null ? String(e.rate) : '',
        remarks: e.remarks || '',
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
      const desc = row.description?.trim() || '';
      const todayRecVal = parseFloat(row.today_rec) || 0;
      const todayConsumedVal = parseFloat(row.today_consumed) || 0;
      const rateVal = parseFloat(row.rate) || 0;

      let tillDateRec = 0;
      let tillDateConsumed = 0;

      if (desc) {
        // Filter history for previous dates, excluding currently edited row in db
        const previousEntries = allMaterialEntries.filter(e => 
          e.description.toLowerCase() === desc.toLowerCase() &&
          normalizeDateKey(e.date) < selectedDate &&
          e.id !== row.id
        );

        tillDateRec = previousEntries.reduce((sum, e) => sum + (parseFloat(e.today_rec) || 0), 0);
        tillDateConsumed = previousEntries.reduce((sum, e) => sum + (parseFloat(e.today_consumed) || 0), 0);
      }

      const totalReceived = tillDateRec + todayRecVal;
      const totalConsumed = tillDateConsumed + todayConsumedVal;
      const balance = totalReceived - totalConsumed;

      const tillDateAmount = tillDateConsumed * rateVal;
      const todayAmount = todayConsumedVal * rateVal;
      const cumulativeAmount = totalConsumed * rateVal;

      return {
        ...row,
        till_date_rec: tillDateRec,
        today_rec_val: todayRecVal,
        total_received: totalReceived,
        till_date_consumed: tillDateConsumed,
        today_consumed_val: todayConsumedVal,
        total_consumed: totalConsumed,
        balance,
        rate_val: rateVal,
        till_date_amount: tillDateAmount,
        today_amount: todayAmount,
        cumulative_amount: cumulativeAmount,
      };
    });
  }, [rows, allMaterialEntries, selectedDate]);

  // Aggregate stats for cards
  const stats = useMemo(() => {
    let totalReceivedValueToday = 0;
    let totalConsumedValueToday = 0;
    let totalCumulativeValue = 0;

    calculatedRows.forEach(r => {
      totalReceivedValueToday += r.today_rec_val * r.rate_val;
      totalConsumedValueToday += r.today_amount;
      totalCumulativeValue += r.cumulative_amount;
    });

    return {
      totalReceivedValueToday,
      totalConsumedValueToday,
      totalCumulativeValue,
    };
  }, [calculatedRows]);

  const performSave = useCallback(async () => {
    if (deletedIds.length > 0) {
      await Promise.all(deletedIds.map(id => base44.entities.MaterialStatus.delete(id)));
    }

    const validRows = calculatedRows.filter(r => r.description.trim());

    await Promise.all(validRows.map(row => {
      const payload = {
        project_id: projectId,
        sub_project_id: subProjectId,
        date: selectedDate,
        description: row.description.trim(),
        unit: row.unit.trim(),
        till_date_rec: row.till_date_rec,
        today_rec: parseFloat(row.today_rec) || 0,
        total_received: row.total_received,
        till_date_consumed: row.till_date_consumed,
        today_consumed: parseFloat(row.today_consumed) || 0,
        total_consumed: row.total_consumed,
        balance: row.balance,
        rate: parseFloat(row.rate) || 0,
        till_date_amount: row.till_date_amount,
        today_amount: row.today_amount,
        cumulative_amount: row.cumulative_amount,
        remarks: row.remarks || '',
      };

      if (row.id && !row.id.startsWith('temp_')) {
        return base44.entities.MaterialStatus.update(row.id, payload);
      }
      return base44.entities.MaterialStatus.create(payload);
    }));
  }, [calculatedRows, deletedIds, projectId, subProjectId, selectedDate]);

  const validate = useCallback(() => {
    const hasInvalidRow = rows.some(r => r.description.trim() && (
      (r.today_rec.trim() && isNaN(parseFloat(r.today_rec))) ||
      (r.today_consumed.trim() && isNaN(parseFloat(r.today_consumed))) ||
      (r.rate.trim() && isNaN(parseFloat(r.rate)))
    ));
    if (hasInvalidRow) {
      return 'Material Status: ensure all entered fields have valid numbers.';
    }
    return null;
  }, [rows]);

  const getReviewData = useCallback(() => ({
    title: 'D. Material Status',
    columns: [
      { key: 'sr', label: 'Sr.' },
      { key: 'description', label: 'Description' },
      { key: 'unit', label: 'Unit' },
      { key: 'today_rec', label: 'Today Rec.' },
      { key: 'today_consumed', label: 'Today Consumed' },
      { key: 'remarks', label: 'Remarks' },
    ],
    rows: calculatedRows
      .filter((r) => r.description.trim())
      .map((r, i) => ({
        sr: i + 1,
        description: r.description,
        unit: r.unit || '—',
        today_rec: r.today_rec_val,
        today_consumed: r.today_consumed_val,
        remarks: r.remarks || '—',
      })),
  }), [calculatedRows]);

  useImperativeHandle(ref, () => ({
    validate,
    getReviewData,
    save: async () => {
      const error = validate();
      if (error) throw new Error(error);
      await performSave();
      queryClient.invalidateQueries({ queryKey: ['material-status-all', projectId] });
      queryClient.invalidateQueries({ queryKey: ['material-status-date', projectId] });
      setLoadedDate(null);
      setDeletedIds([]);
    },
  }), [validate, getReviewData, performSave, queryClient, projectId]);

  const isLoading = allLoading || dateLoading;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground font-sans">Loading material status...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {isDateLocked && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            DPR is locked for this date. Material status cannot be changed.
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Received Cost Today" value={formatCurrencyINR(stats.totalReceivedValueToday)} icon={Package} />
          <StatCard title="Consumed Cost Today" value={formatCurrencyINR(stats.totalConsumedValueToday)} icon={Coins} />
          <StatCard title="Cumulative Consumed Cost" value={formatCurrencyINR(stats.totalCumulativeValue)} icon={TrendingUp} />
        </div>

        {/* Table Form Layout */}
        <Card className="overflow-hidden border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans border-collapse min-w-[1500px]">
              <thead>
                {/* Multi-level Headers */}
                <tr className="bg-muted/40 border-b">
                  <th colSpan={3} className="border-r"></th>
                  <th colSpan={3} className="text-center p-2 font-semibold text-xs border-r text-muted-foreground uppercase tracking-wider">Received Qty</th>
                  <th colSpan={4} className="text-center p-2 font-semibold text-xs border-r text-muted-foreground uppercase tracking-wider">Consumed Qty</th>
                  <th colSpan={4} className="text-center p-2 font-semibold text-xs border-r text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th></th>
                </tr>
                <tr className="border-b bg-muted/60">
                  {/* Basic Fields */}
                  <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase w-[60px] border-r">Sr. No</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase w-[220px] border-r">Description *</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase w-[90px] border-r">Unit</th>

                  {/* Received Qty fields */}
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px]">Till Date Rec Qty</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px]">Today Rec Qty</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px] border-r">Total Received Qty</th>

                  {/* Consumed Qty fields */}
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px]">Till Date Consumtion</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px]">Today Consumption</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px]">Total Consumption</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px] border-r bg-emerald-50/30">Balance</th>

                  {/* Amount fields */}
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[110px]">Rate</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[130px]">Till Date</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[140px]">Today Material Amount</th>
                  <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase w-[160px] border-r">Cummulative Material Amount</th>

                  {/* Remarks & Actions */}
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase w-[180px]">Remarks</th>
                  <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calculatedRows.map((row, index) => (
                  <tr key={row.id} className="border-b hover:bg-muted/10 transition-colors">
                    {/* Sr. No */}
                    <td className="p-2 text-center text-xs font-semibold text-muted-foreground border-r">{index + 1}</td>

                    {/* Description */}
                    <td className="p-2 border-r">
                      <Input
                        type="text"
                        value={row.description}
                        onChange={e => handleUpdateField(index, 'description', e.target.value)}
                        placeholder="e.g. Cement, TMT Steel, Sand"
                        disabled={isDateLocked}
                        className="h-8 text-xs bg-background"
                        required
                      />
                    </td>

                    {/* Unit */}
                    <td className="p-2 border-r">
                      <Input
                        type="text"
                        value={row.unit}
                        onChange={e => handleUpdateField(index, 'unit', e.target.value)}
                        placeholder="e.g. Bags, MT"
                        disabled={isDateLocked}
                        className="h-8 text-xs bg-background"
                      />
                    </td>

                    {/* Till Date Rec Qty */}
                    <td className="p-2">
                      <Input
                        type="text"
                        value={row.till_date_rec.toFixed(2)}
                        disabled
                        readOnly
                        className="h-8 text-xs text-right bg-muted/40 font-mono select-none"
                      />
                    </td>

                    {/* Today Rec Qty */}
                    <td className="p-2">
                      <Input
                        type="number"
                        value={row.today_rec}
                        onChange={e => handleUpdateField(index, 'today_rec', e.target.value)}
                        placeholder="0"
                        disabled={isDateLocked}
                        className="h-8 text-xs text-right bg-background w-full"
                        min="0"
                      />
                    </td>

                    {/* Total Received Qty */}
                    <td className="p-2 border-r">
                      <Input
                        type="text"
                        value={row.total_received.toFixed(2)}
                        disabled
                        readOnly
                        className="h-8 text-xs text-right bg-muted/40 font-mono select-none font-semibold text-slate-700"
                      />
                    </td>

                    {/* Till Date Consumtion */}
                    <td className="p-2">
                      <Input
                        type="text"
                        value={row.till_date_consumed.toFixed(2)}
                        disabled
                        readOnly
                        className="h-8 text-xs text-right bg-muted/40 font-mono select-none"
                      />
                    </td>

                    {/* Today Consumption */}
                    <td className="p-2">
                      <Input
                        type="number"
                        value={row.today_consumed}
                        onChange={e => handleUpdateField(index, 'today_consumed', e.target.value)}
                        placeholder="0"
                        disabled={isDateLocked}
                        className="h-8 text-xs text-right bg-background w-full"
                        min="0"
                      />
                    </td>

                    {/* Total Consumption */}
                    <td className="p-2">
                      <Input
                        type="text"
                        value={row.total_consumed.toFixed(2)}
                        disabled
                        readOnly
                        className="h-8 text-xs text-right bg-muted/40 font-mono select-none font-semibold text-slate-700"
                      />
                    </td>

                    {/* Balance */}
                    <td className="p-2 border-r bg-emerald-50/20">
                      <Input
                        type="text"
                        value={row.balance.toFixed(2)}
                        disabled
                        readOnly
                        className={`h-8 text-xs text-right font-mono select-none font-bold border-emerald-100 ${
                          row.balance < 0 ? 'text-red-600 bg-red-50/40' : 'text-emerald-700 bg-emerald-50/40'
                        }`}
                      />
                    </td>

                    {/* Rate */}
                    <td className="p-2">
                      <Input
                        type="number"
                        value={row.rate}
                        onChange={e => handleUpdateField(index, 'rate', e.target.value)}
                        placeholder="0.00"
                        disabled={isDateLocked}
                        className="h-8 text-xs text-right bg-background w-full"
                        min="0"
                        step="0.01"
                      />
                    </td>

                    {/* Till Date Amount */}
                    <td className="p-2">
                      <Input
                        type="text"
                        value={formatCurrencyINR(row.till_date_amount)}
                        disabled
                        readOnly
                        className="h-8 text-xs text-right bg-muted/40 font-mono select-none"
                      />
                    </td>

                    {/* Today Material Amount */}
                    <td className="p-2">
                      <Input
                        type="text"
                        value={formatCurrencyINR(row.today_amount)}
                        disabled
                        readOnly
                        className="h-8 text-xs text-right bg-muted/40 font-mono select-none font-semibold text-slate-800"
                      />
                    </td>

                    {/* Cummulative Material Amount */}
                    <td className="p-2 border-r">
                      <Input
                        type="text"
                        value={formatCurrencyINR(row.cumulative_amount)}
                        disabled
                        readOnly
                        className="h-8 text-xs text-right bg-muted/50 font-mono select-none font-bold text-emerald-600 border-emerald-100"
                      />
                    </td>

                    {/* Remarks */}
                    <td className="p-2">
                      <Input
                        type="text"
                        value={row.remarks}
                        onChange={e => handleUpdateField(index, 'remarks', e.target.value)}
                        placeholder="e.g. Received invoice #22"
                        disabled={isDateLocked}
                        className="h-8 text-xs bg-background w-full"
                      />
                    </td>

                    {/* Actions +/- */}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => handleAddRow(index)}
                          disabled={isDateLocked}
                          title="Add material row"
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
                          title="Remove material row"
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
