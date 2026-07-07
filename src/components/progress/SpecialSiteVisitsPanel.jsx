import React, { useState, useEffect, forwardRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Minus, ClipboardList, HelpCircle } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useDprPanelRef } from '@/components/progress/useDprPanelRef';

const createEmptyRow = () => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  firm_name: '',
  visitor_name: '',
  purpose: '',
});

export default forwardRef(function SpecialSiteVisitsPanel({
  projectId,
  subProjectId,
  selectedDate,
  isDateLocked = false,
}, ref) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([createEmptyRow()]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [loadedDate, setLoadedDate] = useState(null);

  // Fetch special site visits for the selected date
  const { data: selectedDateEntries = [], isLoading: dateLoading } = useQuery({
    queryKey: ['site-visits-date', projectId, subProjectId, selectedDate],
    queryFn: () => base44.entities.SpecialSiteVisit.filter({
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
        firm_name: e.firm_name || '',
        visitor_name: e.visitor_name || '',
        purpose: e.purpose || '',
      })));
    } else {
      setRows([createEmptyRow()]);
    }
    setLoadedDate(selectedDate);
    setDeletedIds([]);
  }, [selectedDateEntries, selectedDate, loadedDate, dateLoading]);

  const performSave = useCallback(async () => {
    if (deletedIds.length > 0) {
      await Promise.all(deletedIds.map(id => base44.entities.SpecialSiteVisit.delete(id)));
    }
    const validRows = rows.filter(r => r.firm_name.trim() || r.visitor_name.trim() || r.purpose.trim());
    await Promise.all(validRows.map(row => {
      const payload = {
        project_id: projectId,
        sub_project_id: subProjectId,
        date: selectedDate,
        firm_name: row.firm_name.trim(),
        visitor_name: row.visitor_name.trim(),
        purpose: row.purpose.trim(),
      };
      if (row.id && !row.id.startsWith('temp_')) {
        return base44.entities.SpecialSiteVisit.update(row.id, payload);
      }
      return base44.entities.SpecialSiteVisit.create(payload);
    }));
  }, [deletedIds, rows, projectId, subProjectId, selectedDate]);

  const validate = useCallback(() => {
    const hasIncompleteRow = rows.some(r => {
      const parts = [r.firm_name.trim(), r.visitor_name.trim(), r.purpose.trim()];
      const filledCount = parts.filter(Boolean).length;
      return filledCount > 0 && filledCount < 3;
    });
    if (hasIncompleteRow) {
      return 'Special Site Visits: fill Firm, Visitor, and Purpose for all active rows.';
    }
    return null;
  }, [rows]);

  const getReviewData = useCallback(() => ({
    title: 'H. Special Site Visits',
    columns: [
      { key: 'sr', label: 'Sr.' },
      { key: 'firm_name', label: 'Firm' },
      { key: 'visitor_name', label: 'Visitor' },
      { key: 'purpose', label: 'Purpose' },
    ],
    rows: rows
      .filter((r) => r.firm_name.trim() || r.visitor_name.trim() || r.purpose.trim())
      .map((r, i) => ({
        sr: i + 1,
        firm_name: r.firm_name,
        visitor_name: r.visitor_name,
        purpose: r.purpose,
      })),
  }), [rows]);

  useDprPanelRef(ref, {
    validate,
    getReviewData,
    save: async () => {
      const error = validate();
      if (error) throw new Error(error);
      await performSave();
      queryClient.invalidateQueries({ queryKey: ['site-visits-date', projectId] });
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

  if (dateLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground font-sans">Loading special site visits...</span>
      </div>
    );
  }

  const validEntriesCount = rows.filter(r => r.firm_name.trim() && r.visitor_name.trim() && r.purpose.trim()).length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {isDateLocked && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            DPR is locked for this date. Special site visits cannot be changed.
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard title="Visit Records" value={validEntriesCount} icon={ClipboardList} />
          <StatCard title="Locked State" value={isDateLocked ? "Locked" : "Editable"} icon={ClipboardList} />
        </div>

        {/* Table Form Layout */}
        <Card className="overflow-hidden border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase w-[250px]">
                    <div className="flex items-center gap-1 select-none">
                      <span>Name of the Firm *</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          The organization, company, or firm representing the visitor.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase w-[250px]">
                    <div className="flex items-center gap-1 select-none">
                      <span>Name of Visitor *</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          Full name of the visiting individual or official.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase flex-1">
                    <div className="flex items-center gap-1 select-none">
                      <span>Purpose *</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                          The exact reason or objective of the site visit.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                    {/* Name of the Firm */}
                    <td className="p-3 align-top">
                      <Input
                        type="text"
                        value={row.firm_name}
                        onChange={e => handleUpdateField(index, 'firm_name', e.target.value)}
                        placeholder="e.g. L&T Construction, Tata Projects, RITES"
                        disabled={isDateLocked}
                        className="h-8.5 text-xs bg-background w-full"
                        required
                      />
                    </td>

                    {/* Name of Visitor */}
                    <td className="p-3 align-top">
                      <Input
                        type="text"
                        value={row.visitor_name}
                        onChange={e => handleUpdateField(index, 'visitor_name', e.target.value)}
                        placeholder="e.g. Rajesh Kumar (Chief Engineer)"
                        disabled={isDateLocked}
                        className="h-8.5 text-xs bg-background w-full"
                        required
                      />
                    </td>

                    {/* Purpose */}
                    <td className="p-3">
                      <Textarea
                        value={row.purpose}
                        onChange={e => handleUpdateField(index, 'purpose', e.target.value)}
                        placeholder="e.g. Geotechnical review of column foundations for Block B."
                        disabled={isDateLocked}
                        className="h-12.5 text-xs bg-background resize-none w-full"
                        required
                      />
                    </td>

                    {/* Actions +/- */}
                    <td className="p-3 text-center align-top pt-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => handleAddRow(index)}
                          disabled={isDateLocked}
                          title="Add visit row"
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
                          title="Remove visit row"
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
            <Button type="button" variant="outline" className="gap-1.5 text-xs font-semibold" onClick={() => handleAddRow(rows.length - 1)} disabled={isDateLocked}>
              <Plus className="w-4 h-4" /> Add Row
            </Button>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
});
