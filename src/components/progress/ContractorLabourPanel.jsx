import React, { useMemo, useState, useEffect, forwardRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Users, ChevronsUpDown, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { useDprPanelRef } from '@/components/progress/useDprPanelRef';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

function HeaderTooltip({ text }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="w-3 h-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help inline-block ml-1 align-middle" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-center font-sans font-normal normal-case">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

const splitTypeOfWork = (value) => String(value || '')
  .split(/[,;]/)
  .map((v) => v.trim())
  .filter(Boolean);

export default forwardRef(function ContractorLabourPanel({
  projectId,
  subProjectId,
  selectedDate,
  isDateLocked = false,
}, ref) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [deletedIds, setDeletedIds] = useState([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAddContractorId, setSelectedAddContractorId] = useState('');
  const [selectedTypesOfWork, setSelectedTypesOfWork] = useState([]);

  // 1. Fetch Contractors from Contractor module
  const { data: contractors = [], isLoading: contractorsLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 1000),
  });

  // 2. Fetch Subprojects to get active subproject name
  const { data: subProjects = [] } = useQuery({
    queryKey: ['sub-projects', projectId],
    queryFn: () => projectId
      ? base44.entities.SubProject.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId,
  });

  const selectedSubProject = useMemo(() => {
    return subProjects.find(sp => sp.id === subProjectId);
  }, [subProjects, subProjectId]);

  // 3. Fetch Contractor Labours for current date and subproject
  const { data: dateEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['contractor-labours', projectId, subProjectId, selectedDate],
    queryFn: () => base44.entities.ContractorLabour.filter({
      project_id: projectId,
      sub_project_id: subProjectId,
      date: selectedDate,
    }),
    enabled: !!projectId && !!subProjectId && !!selectedDate,
  });

  // 4. Fetch Contractor Labours for current project and date (all subprojects) to calculate Project Total
  const { data: projectEntries = [], isLoading: projectLoading } = useQuery({
    queryKey: ['contractor-labours-project-date', projectId, selectedDate],
    queryFn: () => base44.entities.ContractorLabour.filter({
      project_id: projectId,
      date: selectedDate,
    }),
    enabled: !!projectId && !!selectedDate,
  });

  // 5. Sync DB entries to local state — reset immediately when date/scope changes
  const syncKey = `${projectId}:${subProjectId}:${selectedDate}`;
  useEffect(() => {
    setRows([]);
    setDeletedIds([]);
    setLoadedKey('');
  }, [syncKey]);

  useEffect(() => {
    if (entriesLoading || loadedKey === syncKey) return;

    if (dateEntries.length > 0) {
      setRows(dateEntries.map(e => ({
        id: e.id,
        contractor_id: e.contractor_id,
        type_of_work: e.type_of_work || '',
        unit: 'Nos',
        carpenter: e.carpenter !== null ? String(e.carpenter) : '',
        barbender: e.barbender !== null ? String(e.barbender) : '',
        mason: e.mason !== null ? String(e.mason) : '',
        skilled_other: e.skilled_other !== null ? String(e.skilled_other) : '',
        carpenter_helper: e.carpenter_helper !== null ? String(e.carpenter_helper) : '',
        barbender_helper: e.barbender_helper !== null ? String(e.barbender_helper) : '',
        semi_skilled_other: e.semi_skilled_other !== null ? String(e.semi_skilled_other) : '',
        mc: e.mc !== null ? String(e.mc) : '',
        fc: e.fc !== null ? String(e.fc) : '',
      })));
    } else {
      setRows([]);
    }
    setLoadedKey(syncKey);
    setDeletedIds([]);
  }, [dateEntries, syncKey, loadedKey, entriesLoading]);

  // Map contractor_id to Company Name
  const contractorNameMap = useMemo(() => {
    const map = new Map();
    contractors.forEach(c => map.set(c.id, c.name));
    return map;
  }, [contractors]);

  // List of contractors from Contractor Master
  const availableContractors = contractors;

  // Row update handler
  const handleUpdateRow = (rowId, field, value) => {
    if (isDateLocked) return;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  // Create labour rows after validating duplicates
  const handleCreateLabourRows = () => {
    if (!selectedAddContractorId) return;

    let addedCount = 0;
    const duplicateWarnings = [];
    const updatedRows = [...rows];

    selectedTypesOfWork.forEach((type) => {
      const exists = updatedRows.some(
        (r) => r.contractor_id === selectedAddContractorId && r.type_of_work === type
      );

      if (exists) {
        duplicateWarnings.push(type);
      } else {
        const newRow = {
          id: `temp_${Date.now()}_${Math.round(Math.random() * 1e5)}`,
          contractor_id: selectedAddContractorId,
          type_of_work: type,
          unit: 'Nos',
          carpenter: '',
          barbender: '',
          mason: '',
          skilled_other: '',
          carpenter_helper: '',
          barbender_helper: '',
          semi_skilled_other: '',
          mc: '',
          fc: '',
        };
        updatedRows.push(newRow);
        addedCount++;
      }
    });

    if (duplicateWarnings.length > 0) {
      toast({
        title: 'Duplicate Entry',
        description: `Labour entry already exists for this Contractor and Type of Work: ${duplicateWarnings.join(', ')}`,
        variant: 'destructive',
      });
    }

    if (addedCount > 0) {
      setRows(updatedRows);
    }

    setIsAddModalOpen(false);
    setSelectedAddContractorId('');
    setSelectedTypesOfWork([]);
  };

  // Remove contractor row
  const handleRemoveRow = (rowId) => {
    if (isDateLocked) return;
    const row = rows.find(r => r.id === rowId);
    if (row && !row.id.startsWith('temp_')) {
      setDeletedIds(prev => [...prev, row.id]);
    }
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  // Modified row detector
  const isRowModified = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return false;

    if (row.id.startsWith('temp_')) {
      return (
        row.unit !== '' ||
        row.carpenter !== '' ||
        row.barbender !== '' ||
        row.mason !== '' ||
        row.skilled_other !== '' ||
        row.carpenter_helper !== '' ||
        row.barbender_helper !== '' ||
        row.semi_skilled_other !== '' ||
        row.mc !== '' ||
        row.fc !== ''
      );
    }

    const dbRow = dateEntries.find(e => e.id === rowId);
    if (!dbRow) return false;

    const currentUnit = row.unit || '';
    const dbUnit = dbRow.unit || '';

    const currentTypeOfWork = row.type_of_work || '';
    const dbTypeOfWork = dbRow.type_of_work || '';

    const currentCarpenter = row.carpenter === '' ? 0 : parseFloat(row.carpenter) || 0;
    const dbCarpenter = dbRow.carpenter === null ? 0 : parseFloat(dbRow.carpenter) || 0;

    const currentBarbender = row.barbender === '' ? 0 : parseFloat(row.barbender) || 0;
    const dbBarbender = dbRow.barbender === null ? 0 : parseFloat(dbRow.barbender) || 0;

    const currentMason = row.mason === '' ? 0 : parseFloat(row.mason) || 0;
    const dbMason = dbRow.mason === null ? 0 : parseFloat(dbRow.mason) || 0;

    const currentSkilledOther = row.skilled_other === '' ? 0 : parseFloat(row.skilled_other) || 0;
    const dbSkilledOther = dbRow.skilled_other === null ? 0 : parseFloat(dbRow.skilled_other) || 0;

    const currentCarpenterHelper = row.carpenter_helper === '' ? 0 : parseFloat(row.carpenter_helper) || 0;
    const dbCarpenterHelper = dbRow.carpenter_helper === null ? 0 : parseFloat(dbRow.carpenter_helper) || 0;

    const currentBarbenderHelper = row.barbender_helper === '' ? 0 : parseFloat(row.barbender_helper) || 0;
    const dbBarbenderHelper = dbRow.barbender_helper === null ? 0 : parseFloat(dbRow.barbender_helper) || 0;

    const currentSemiSkilledOther = row.semi_skilled_other === '' ? 0 : parseFloat(row.semi_skilled_other) || 0;
    const dbSemiSkilledOther = dbRow.semi_skilled_other === null ? 0 : parseFloat(dbRow.semi_skilled_other) || 0;

    const currentMc = row.mc === '' ? 0 : parseFloat(row.mc) || 0;
    const dbMc = dbRow.mc === null ? 0 : parseFloat(dbRow.mc) || 0;

    const currentFc = row.fc === '' ? 0 : parseFloat(row.fc) || 0;
    const dbFc = dbRow.fc === null ? 0 : parseFloat(dbRow.fc) || 0;

    return (
      currentUnit !== dbUnit ||
      currentTypeOfWork !== dbTypeOfWork ||
      currentCarpenter !== dbCarpenter ||
      currentBarbender !== dbBarbender ||
      currentMason !== dbMason ||
      currentSkilledOther !== dbSkilledOther ||
      currentCarpenterHelper !== dbCarpenterHelper ||
      currentBarbenderHelper !== dbBarbenderHelper ||
      currentSemiSkilledOther !== dbSemiSkilledOther ||
      currentMc !== dbMc ||
      currentFc !== dbFc
    );
  };

  const modifiedCount = rows.filter(r => isRowModified(r.id)).length + deletedIds.length;

  const performSave = useCallback(async () => {
    if (deletedIds.length > 0) {
      await Promise.all(deletedIds.map(id => base44.entities.ContractorLabour.delete(id)));
    }
    await Promise.all(rows.map(r => {
      const payload = {
        project_id: projectId,
        sub_project_id: subProjectId,
        contractor_id: r.contractor_id,
        type_of_work: r.type_of_work || null,
        date: selectedDate,
        unit: r.unit || null,
        carpenter: r.carpenter === '' ? 0 : parseFloat(r.carpenter) || 0,
        barbender: r.barbender === '' ? 0 : parseFloat(r.barbender) || 0,
        mason: r.mason === '' ? 0 : parseFloat(r.mason) || 0,
        skilled_other: r.skilled_other === '' ? 0 : parseFloat(r.skilled_other) || 0,
        carpenter_helper: r.carpenter_helper === '' ? 0 : parseFloat(r.carpenter_helper) || 0,
        barbender_helper: r.barbender_helper === '' ? 0 : parseFloat(r.barbender_helper) || 0,
        semi_skilled_other: r.semi_skilled_other === '' ? 0 : parseFloat(r.semi_skilled_other) || 0,
        mc: r.mc === '' ? 0 : parseFloat(r.mc) || 0,
        fc: r.fc === '' ? 0 : parseFloat(r.fc) || 0,
      };
      if (r.id.startsWith('temp_')) {
        return base44.entities.ContractorLabour.create(payload);
      }
      return base44.entities.ContractorLabour.update(r.id, payload);
    }));
  }, [deletedIds, rows, projectId, subProjectId, selectedDate]);

  const getReviewData = useCallback(() => ({
    title: 'C. Contractor Labour',
    layout: 'contractor-labour',
    columns: [],
    rows: rows
      .filter((r) => r.contractor_id)
      .map((r, i) => {
        const carpenter = parseFloat(r.carpenter) || 0;
        const barbender = parseFloat(r.barbender) || 0;
        const mason = parseFloat(r.mason) || 0;
        const skilledOther = parseFloat(r.skilled_other) || 0;
        const carpenterHelper = parseFloat(r.carpenter_helper) || 0;
        const barbenderHelper = parseFloat(r.barbender_helper) || 0;
        const semiSkilledOther = parseFloat(r.semi_skilled_other) || 0;
        const mc = parseFloat(r.mc) || 0;
        const fc = parseFloat(r.fc) || 0;
        return {
          sr: i + 1,
          contractor_name: contractorNameMap.get(r.contractor_id) || '—',
          type_of_work: r.type_of_work || '—',
          unit: r.unit || 'Nos',
          carpenter,
          barbender,
          mason,
          skilled_other: skilledOther,
          carpenter_helper: carpenterHelper,
          barbender_helper: barbenderHelper,
          semi_skilled_other: semiSkilledOther,
          mc,
          fc,
          total: carpenter + barbender + mason + skilledOther + carpenterHelper + barbenderHelper + semiSkilledOther + mc + fc,
        };
      }),
  }), [rows, contractorNameMap]);

  useDprPanelRef(ref, {
    validate: () => null,
    getReviewData,
    save: async () => {
      await performSave();
      queryClient.invalidateQueries({ queryKey: ['contractor-labours', projectId, subProjectId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['contractor-labours-project-date', projectId, selectedDate] });
      setDeletedIds([]);
      setLoadedKey('');
    },
  });

  // Calculate Subproject Total
  const subProjectTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      return sum + (parseFloat(r.carpenter) || 0) +
                   (parseFloat(r.barbender) || 0) +
                   (parseFloat(r.mason) || 0) +
                   (parseFloat(r.skilled_other) || 0) +
                   (parseFloat(r.carpenter_helper) || 0) +
                   (parseFloat(r.barbender_helper) || 0) +
                   (parseFloat(r.semi_skilled_other) || 0) +
                   (parseFloat(r.mc) || 0) +
                   (parseFloat(r.fc) || 0);
    }, 0);
  }, [rows]);

  // Calculate Project Total (dynamic sum from other subprojects on the same date)
  const projectTotal = useMemo(() => {
    const otherSubProjectsTotal = projectEntries
      .filter(e => e.sub_project_id !== subProjectId)
      .reduce((sum, e) => {
        return sum + (parseFloat(e.carpenter) || 0) +
                     (parseFloat(e.barbender) || 0) +
                     (parseFloat(e.mason) || 0) +
                     (parseFloat(e.skilled_other) || 0) +
                     (parseFloat(e.carpenter_helper) || 0) +
                     (parseFloat(e.barbender_helper) || 0) +
                     (parseFloat(e.semi_skilled_other) || 0) +
                     (parseFloat(e.mc) || 0) +
                     (parseFloat(e.fc) || 0);
      }, 0);
    return subProjectTotal + otherSubProjectsTotal;
  }, [subProjectTotal, projectEntries, subProjectId]);

  const isLoading = contractorsLoading || entriesLoading || projectLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground font-sans">Loading contractor labours...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Top Header Row with Search & Save Actions */}
      <div className="flex flex-wrap gap-2 items-center justify-end">
        {rows.length > 0 && !isDateLocked && modifiedCount > 0 && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] px-2 py-0.5 font-bold mr-auto">
            ⚠️ {modifiedCount} unsaved
          </Badge>
        )}
        {rows.length > 0 && !isDateLocked && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedAddContractorId('');
              setSelectedTypesOfWork([]);
              setIsAddModalOpen(true);
            }}
            className="gap-1.5 h-9 font-semibold text-xs border border-dashed border-slate-400 bg-slate-200 text-slate-800 hover:bg-slate-300 hover:text-slate-900 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Contractor
          </Button>
        )}
      </div>

      {isDateLocked && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          DPR is locked for this date. Contractor labour records cannot be modified.
        </div>
      )}

      {/* Empty State / Initial Contractor Search Selector */}
      {rows.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 max-w-xl mx-auto my-6 text-center space-y-4 bg-card shadow-sm">
          <div className="bg-primary/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold font-heading uppercase tracking-wide text-muted-foreground">Select Contractor</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Choose a contractor company and select the types of work to begin filling in the daily labor counts.
            </p>
          </div>
          <div className="max-w-xs mx-auto">
            <Button
              className="w-full"
              disabled={isDateLocked}
              onClick={() => {
                setSelectedAddContractorId('');
                setSelectedTypesOfWork([]);
                setIsAddModalOpen(true);
              }}
            >
              Add Contractor & Type of Work
            </Button>
          </div>
        </div>
      ) : (
        /* Detailed Contractor Labours Table */
        <Card className="overflow-hidden border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans border-collapse border-slate-200">
              <thead>
                <tr className="border-b bg-muted/60 text-muted-foreground text-center">
                  <th rowSpan={2} className="p-3 text-left font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 w-16">Sr. No</th>
                  <th rowSpan={2} className="p-3 text-left font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 min-w-[240px]">Contractor Name</th>
                  <th rowSpan={2} className="p-3 text-left font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 min-w-[180px]">Type of Work</th>
                  <th rowSpan={2} className="p-3 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 w-24">Unit</th>
                  <th colSpan={4} className="p-2 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 bg-muted/20">
                    Skilled Labour
                    <HeaderTooltip text="Skilled tradespeople deployed by this contractor today." />
                  </th>
                  <th colSpan={3} className="p-2 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 bg-muted/30">
                    Semi Skilled Labour
                    <HeaderTooltip text="Semi-skilled helper labour deployed by this contractor today." />
                  </th>
                  <th colSpan={2} className="p-2 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 bg-muted/20">
                    Unskilled Labour
                    <HeaderTooltip text="Unskilled male/female coolie labour deployed by this contractor today." />
                  </th>
                  <th rowSpan={2} className="p-3 text-right font-bold text-[11px] uppercase tracking-wider w-28">
                    Total
                    <HeaderTooltip text="Sum of all labour categories for this contractor today." />
                  </th>
                  {!isDateLocked && <th rowSpan={2} className="p-3 border-l border-slate-200 w-12"></th>}
                </tr>
                <tr className="border-b bg-muted/40 text-[10px] text-muted-foreground text-center">
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px] max-w-[72px]">Carpentar</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px] max-w-[72px]">Barbender</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px] max-w-[72px]">Mason</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px] max-w-[72px]">Other</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/20 w-[90px] max-w-[90px]">Carpenter Helper</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/20 w-[90px] max-w-[90px]">Barbender Helper</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/20 w-[90px] max-w-[90px]">Other</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[60px] max-w-[60px]">M/C</th>
                  <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[60px] max-w-[60px]">F/C</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const companyName = contractorNameMap.get(row.contractor_id) || 'Unknown Contractor';
                  const rowModified = isRowModified(row.id);
                  const carpenterVal = parseFloat(row.carpenter) || 0;
                  const barbenderVal = parseFloat(row.barbender) || 0;
                  const masonVal = parseFloat(row.mason) || 0;
                  const skilledOtherVal = parseFloat(row.skilled_other) || 0;
                  const carpenterHelperVal = parseFloat(row.carpenter_helper) || 0;
                  const barbenderHelperVal = parseFloat(row.barbender_helper) || 0;
                  const semiSkilledOtherVal = parseFloat(row.semi_skilled_other) || 0;
                  const mcVal = parseFloat(row.mc) || 0;
                  const fcVal = parseFloat(row.fc) || 0;
                  const totalLabours = carpenterVal + barbenderVal + masonVal + skilledOtherVal + carpenterHelperVal + barbenderHelperVal + semiSkilledOtherVal + mcVal + fcVal;

                  return (
                    <tr
                      key={row.id}
                      className={`border-b hover:bg-muted/15 transition-colors ${
                        rowModified ? 'bg-amber-500/5 hover:bg-amber-500/10' : ''
                      }`}
                    >
                      {/* Sr No */}
                      <td className="p-3 text-xs font-semibold text-muted-foreground border-r border-slate-200 text-left">
                        {index + 1}
                      </td>

                      {/* Contractor Name */}
                      <td className="p-3 text-xs font-bold text-foreground border-r border-slate-200">
                        {companyName}
                      </td>

                      {/* Type of Work */}
                      <td className="p-3 text-xs text-foreground border-r border-slate-200">
                        {row.type_of_work || '—'}
                      </td>

                      {/* Unit */}
                      <td className="p-3 text-center border-r border-slate-200">
                        <span className="text-xs font-semibold text-slate-600">Nos</span>
                      </td>

                      {/* Carpenter */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.carpenter}
                          onChange={e => handleUpdateRow(row.id, 'carpenter', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* Barbender */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.barbender}
                          onChange={e => handleUpdateRow(row.id, 'barbender', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* Mason */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.mason}
                          onChange={e => handleUpdateRow(row.id, 'mason', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* Skilled Other */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.skilled_other}
                          onChange={e => handleUpdateRow(row.id, 'skilled_other', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* Carpenter Helper */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.carpenter_helper}
                          onChange={e => handleUpdateRow(row.id, 'carpenter_helper', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* Barbender Helper */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.barbender_helper}
                          onChange={e => handleUpdateRow(row.id, 'barbender_helper', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* Semi Skilled Other */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.semi_skilled_other}
                          onChange={e => handleUpdateRow(row.id, 'semi_skilled_other', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* M/C */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.mc}
                          onChange={e => handleUpdateRow(row.id, 'mc', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* F/C */}
                      <td className="p-1 text-center border-r border-slate-200">
                        <Input
                          type="number"
                          className="h-8 w-full min-w-0 text-xs text-center font-mono border-slate-200 px-1"
                          placeholder="0"
                          value={row.fc}
                          onChange={e => handleUpdateRow(row.id, 'fc', e.target.value)}
                          disabled={isDateLocked}
                        />
                      </td>

                      {/* Total */}
                      <td className="p-3 text-right font-mono text-xs font-bold text-slate-800">
                        {totalLabours.toFixed(2)}
                      </td>

                      {/* Remove Row Button */}
                      {!isDateLocked && (
                        <td className="p-3 border-l border-slate-200 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveRow(row.id)}
                            title="Remove contractor row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* Sub-Project Summary Row */}
                <tr className="border-t border-b bg-slate-50/50 font-bold border-slate-200">
                  <td colSpan={13} className="p-3 text-right text-xs uppercase tracking-wider text-slate-700">
                    {selectedSubProject?.name || 'Sub-Project Total'}
                  </td>
                  <td className="p-3 text-right font-mono text-xs font-bold text-slate-800">
                    {subProjectTotal.toFixed(2)}
                  </td>
                  {!isDateLocked && <td className="p-3 border-l border-slate-200"></td>}
                </tr>

                {/* Project Summary Row */}
                <tr className="bg-slate-100/50 font-extrabold border-b border-slate-200">
                  <td colSpan={13} className="p-3 text-right text-xs uppercase tracking-wider text-slate-800">
                    Project Total
                  </td>
                  <td className="p-3 text-right font-mono text-xs font-extrabold text-primary">
                    {projectTotal.toFixed(2)}
                  </td>
                  {!isDateLocked && <td className="p-3 border-l border-slate-200"></td>}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Enhanced Add Contractor & Type of Work Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle>Add Contractor & Type of Work</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Step 1: Select Contractor */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contractor</Label>
              <select
                value={selectedAddContractorId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setSelectedAddContractorId(cid);
                  
                  if (!cid) {
                    setSelectedTypesOfWork([]);
                    return;
                  }
                  
                  const contractor = contractors.find(c => c.id === cid);
                  const types = contractor ? splitTypeOfWork(contractor.type_of_work) : [];
                  
                  if (types.length === 1) {
                    const singleType = types[0];
                    const exists = rows.some(
                      (r) => r.contractor_id === cid && r.type_of_work === singleType
                    );
                    
                    if (exists) {
                      toast({
                        title: 'Duplicate Entry',
                        description: `Labour entry already exists for this Contractor and Type of Work: ${singleType}`,
                        variant: 'destructive',
                      });
                    } else {
                      const newRow = {
                        id: `temp_${Date.now()}_${Math.round(Math.random() * 1e5)}`,
                        contractor_id: cid,
                        type_of_work: singleType,
                        unit: 'Nos',
                        carpenter: '',
                        barbender: '',
                        mason: '',
                        skilled_other: '',
                        carpenter_helper: '',
                        barbender_helper: '',
                        semi_skilled_other: '',
                        mc: '',
                        fc: '',
                      };
                      setRows(prev => [...prev, newRow]);
                      toast({
                        title: 'Success',
                        description: 'Labour row added successfully.',
                      });
                    }
                    
                    setIsAddModalOpen(false);
                    setSelectedAddContractorId('');
                    setSelectedTypesOfWork([]);
                  } else {
                    setSelectedTypesOfWork([]);
                  }
                }}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select contractor...</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2 & 3: Select Types of Work */}
            {selectedAddContractorId && (() => {
              const contractor = contractors.find(c => c.id === selectedAddContractorId);
              const types = contractor ? splitTypeOfWork(contractor.type_of_work) : [];
              if (types.length === 1) return null; // Auto-created already, hide checkboxes
              if (types.length === 0) {
                return (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available Types of Work</Label>
                    <p className="text-xs text-muted-foreground italic">No types of work defined for this contractor in the master.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available Types of Work</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-3 bg-muted/10">
                    {types.map((type) => (
                      <label key={type} className="flex items-center space-x-2 text-xs font-medium cursor-pointer text-slate-700 hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={selectedTypesOfWork.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTypesOfWork(prev => [...prev, type]);
                            } else {
                              setSelectedTypesOfWork(prev => prev.filter(t => t !== type));
                            }
                          }}
                          className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            {(() => {
              const contractor = contractors.find(c => c.id === selectedAddContractorId);
              const types = contractor ? splitTypeOfWork(contractor.type_of_work) : [];
              if (types.length <= 1) return null; // Hide Create button for single or no work type
              return (
                <Button
                  size="sm"
                  onClick={handleCreateLabourRows}
                  disabled={selectedTypesOfWork.length === 0}
                >
                  Create Labour Rows
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
});
