import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Layers, BookTemplate, Download, Loader2, Building2, Upload, FileSpreadsheet, Search, SlidersHorizontal, X, ChevronsUpDown, Check } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { formatCompactCurrencyINR } from '@/lib/formatters';
import { compareWbsIds, getNextChildWbsId, getNextL1WbsId } from '@/lib/wbsUtils';
import { useAuth } from '@/lib/AuthContext';

const levelColors = {
  1: 'bg-primary/10 text-primary font-bold',
  2: 'bg-blue-100 text-blue-700 font-semibold',
  3: 'bg-slate-100 text-slate-600',
};

const defaultForm = {
  project_id: '', sub_project_id: '', code: '', title: '', description: '', level: 1,
  parent_id: '', planned_quantity: '', actual_quantity: 0, unit: '',
  progress: 0, budget_amount: '', order_index: 0,
  activity_id: '', budget_item_id: '',
};

const defaultTemplateForm = {
  wbs_id: '', title: '', description: '', level: 1, parent_wbs_id: '', order_index: 0,
};

const WBS_UPLOAD_TYPES = {
  l1: {
    label: 'L1 / L2 WBS',
    allowedLevels: new Set([1, 2]),
    note: 'Use for WBS heads/sub-heads (e.g. 1, 1.1). If WBS ID + WBS Name are blank, previous WBS group from sheet is reused.',
  },
  l3: {
    label: 'L3 WBS',
    allowedLevels: new Set([3]),
    note: 'Use for activity-level rows (e.g. 1.1.1, 2.3.4). Activity ID is used as the WBS code.',
  },
};

const HEADER_ALIASES = {
  code: ['wbsid', 'wbs_id', 'wbs code', 'wbscode', 'wbs', 'id', 'code'],
  wbsName: ['wbsname', 'wbs name', 'wbstitle', 'wbs title'],
  level: ['level', 'wbs level'],
  activityTitle: ['activity', 'activity name', 'activity_name', 'title', 'name'],
  title: ['activity', 'activity name', 'activity_name', 'wbs name', 'wbs title', 'title', 'name'],
  activityId: ['activityid', 'activity_id', 'actid', 'taskid'],
  description: ['description', 'activity description', 'activity_description', 'scope', 'details', 'remarks'],
  plannedQty: ['plannedqty', 'planned quantity', 'quantity', 'qty', 'total qty', 'total_quantity'],
  actualQty: ['actualqty', 'actual quantity', 'actual'],
  unit: ['unit', 'uom', 'measurement'],
  budget: ['budget', 'budget amount', 'amount', 'cost', 'total amount'],
  rate: ['lumsum rate', 'lumpsum rate', 'rate', 'unit rate', 'rate per unit'],
  totalDays: ['totaldays', 'total days', 'days', 'duration', 'duration days'],
};

const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getWbsLevel = (code) => String(code || '').split('.').filter(Boolean).length;

const getParentCode = (code) => {
  const parts = String(code || '').split('.').filter(Boolean);
  if (parts.length <= 1) return '';
  parts.pop();
  return parts.join('.');
};

const parseNumber = (value) => {
  const num = parseFloat(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : 0;
};

const compactSegment = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

const buildActivityCode = ({ projectCode, subProjectName, levelLabel, activityId }) => {
  const parts = [
    compactSegment(projectCode),
    compactSegment(subProjectName),
    compactSegment(levelLabel),
    compactSegment(activityId),
  ].filter(Boolean);

  return parts.join('-');
};

export default function WBSManagement() {
  const [activeTab, setActiveTab] = useState('project');
  const [projectFilter, setProjectFilter] = useState('');
  const [subProjectFilter, setSubProjectFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState(defaultForm);
  const [templateExpanded, setTemplateExpanded] = useState({});
  const [showTemplateEdit, setShowTemplateEdit] = useState(false);
  const [editTemplateItem, setEditTemplateItem] = useState(null);
  const [templateForm, setTemplateForm] = useState(defaultTemplateForm);
  const [applyMode, setApplyMode] = useState('merge');
  const [applyMessage, setApplyMessage] = useState('');
  const [wbsViewTab, setWbsViewTab] = useState('l1');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadType, setUploadType] = useState('l1');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadRows, setUploadRows] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [parsingUpload, setParsingUpload] = useState(false);
  const [confirmingUpload, setConfirmingUpload] = useState(false);

  // Filter options state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgress, setFilterProgress] = useState('all');
  const [filterLevelLabel, setFilterLevelLabel] = useState('all');
  const [filterWbsLevel, setFilterWbsLevel] = useState('all');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const { data: subProjects = [] } = useQuery({
    queryKey: ['subprojects', projectFilter],
    queryFn: () => base44.entities.SubProject.filter({ project_id: projectFilter }, '-created_date', 100),
    enabled: !!projectFilter,
  });

  const { data: formSubProjects = [] } = useQuery({
    queryKey: ['subprojects', form.project_id],
    queryFn: () => base44.entities.SubProject.filter({ project_id: form.project_id }, '-created_date', 100),
    enabled: !!form.project_id && showAdd,
  });

  const wbsReady = !!projectFilter && !!subProjectFilter;

  const { data: wbsItems = [], isLoading } = useQuery({
    queryKey: ['wbs', projectFilter, subProjectFilter],
    queryFn: () => base44.entities.WBSItem.filter(
      { project_id: projectFilter, sub_project_id: subProjectFilter },
      'order_index'
    ),
    enabled: wbsReady,
  });

  const { data: templateItems = [], isLoading: templateLoading } = useQuery({
    queryKey: ['wbs-template'],
    queryFn: () => base44.wbsTemplate.list(),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', projectFilter || form.project_id],
    queryFn: () => (projectFilter || form.project_id)
      ? base44.entities.ScheduleActivity.filter({ project_id: projectFilter || form.project_id })
      : base44.entities.ScheduleActivity.list('order_index', 500),
  });

  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budgetItems', projectFilter || form.project_id],
    queryFn: () => (projectFilter || form.project_id)
      ? base44.entities.BudgetItem.filter({ project_id: projectFilter || form.project_id })
      : base44.entities.BudgetItem.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WBSItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wbs'] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WBSItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wbs'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WBSItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wbs'] }),
  });

  const applyTemplateMutation = useMutation({
    mutationFn: ({ projectId, subProjectId, mode }) => base44.wbsTemplate.applyToProject(projectId, subProjectId, mode),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wbs'] });
      setApplyMessage(`Applied standard WBS: ${result.created} created, ${result.skipped} already existed.`);
      setTimeout(() => setApplyMessage(''), 5000);
    },
  });

  const handleProjectChange = (value) => {
    setProjectFilter(value);
    setSubProjectFilter('');
  };

  const createTemplateMutation = useMutation({
    mutationFn: (data) => base44.wbsTemplate.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs-template'] });
      setShowTemplateEdit(false);
      setEditTemplateItem(null);
      setTemplateForm(defaultTemplateForm);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ wbsId, data }) => base44.wbsTemplate.updateItem(wbsId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs-template'] });
      setShowTemplateEdit(false);
      setEditTemplateItem(null);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (wbsId) => base44.wbsTemplate.deleteItem(wbsId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wbs-template'] }),
  });

  const resetTemplateMutation = useMutation({
    mutationFn: () => base44.wbsTemplate.resetToDefault(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wbs-template'] });
      setApplyMessage(`Standard template loaded: ${result.total} categories (heads only).`);
      setTimeout(() => setApplyMessage(''), 5000);
    },
  });

  const sortedWbsItems = useMemo(
    () => [...wbsItems].sort((a, b) => compareWbsIds(a.code, b.code)),
    [wbsItems]
  );
  const sortedTemplateItems = useMemo(
    () => [...templateItems].sort((a, b) => compareWbsIds(a.wbs_id, b.wbs_id)),
    [templateItems]
  );
  const l1L2Items = useMemo(
    () => sortedWbsItems.filter((item) => Number(item.level) <= 2),
    [sortedWbsItems]
  );
  const l1ActivityItems = useMemo(
    () => sortedWbsItems.filter((item) => Number(item.level) === 3 && item.source_upload_type === 'l1_activity'),
    [sortedWbsItems]
  );
  const l3Items = useMemo(
    () => sortedWbsItems.filter((item) => Number(item.level) === 3 && item.source_upload_type !== 'l1_activity'),
    [sortedWbsItems]
  );
  const hasL1Data = l1L2Items.length > 0;
  const hasL3Data = l3Items.length > 0;

  // Floor levels (level labels) extracted dynamically
  const availableLevelLabels = useMemo(() => {
    const labels = new Set();
    wbsItems.forEach((item) => {
      const lbl = String(item.level_label || '').trim();
      if (lbl) {
        labels.add(lbl);
      }
    });
    return Array.from(labels).sort();
  }, [wbsItems]);

  // Check if filtering is currently active
  const isFiltering = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      filterProgress !== 'all' ||
      filterLevelLabel !== 'all' ||
      filterWbsLevel !== 'all' ||
      minBudget !== '' ||
      maxBudget !== ''
    );
  }, [searchQuery, filterProgress, filterLevelLabel, filterWbsLevel, minBudget, maxBudget]);

  // Filter matching predicate
  const isItemMatch = (item) => {
    // 1. Search Query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      const matchText = [
        item.code,
        item.title,
        item.description,
        item.activity_id,
        item.activity_code,
        item.level_label,
        item.unit
      ].join(' ').toLowerCase();
      if (!matchText.includes(query)) return false;
    }

    // 2. Progress
    if (filterProgress !== 'all') {
      const prog = parseNumber(item.progress);
      if (filterProgress === 'not_started' && prog > 0) return false;
      if (filterProgress === 'in_progress' && (prog === 0 || prog === 100)) return false;
      if (filterProgress === 'completed' && prog < 100) return false;
    }

    // 3. Level Label (floor level)
    if (filterLevelLabel !== 'all') {
      if (String(item.level_label || '').trim().toLowerCase() !== filterLevelLabel.toLowerCase()) return false;
    }

    // 4. WBS Level
    if (filterWbsLevel !== 'all') {
      if (String(item.level) !== filterWbsLevel) return false;
    }

    // 5. Budget Range
    const budget = parseNumber(item.budget_amount);
    if (minBudget !== '') {
      const minVal = parseFloat(minBudget);
      if (!isNaN(minVal) && budget < minVal) return false;
    }
    if (maxBudget !== '') {
      const maxVal = parseFloat(maxBudget);
      if (!isNaN(maxVal) && budget > maxVal) return false;
    }

    return true;
  };

  // Memoized set of WBS Item IDs that should be visible (matches + their parents)
  const visibleWbsItemIds = useMemo(() => {
    if (!isFiltering) {
      return new Set(wbsItems.map(item => item.id));
    }

    const visibleIds = new Set();
    const matches = wbsItems.filter(isItemMatch);

    // For each matching item, add its ID and all its parent/ancestor IDs
    matches.forEach(item => {
      visibleIds.add(item.id);
      
      // Traverse up parent chain
      let current = item;
      while (current.parent_id) {
        visibleIds.add(current.parent_id);
        const parent = wbsItems.find(p => p.id === current.parent_id);
        if (!parent) break;
        current = parent;
      }
    });

    return visibleIds;
  }, [wbsItems, isFiltering, searchQuery, filterProgress, filterLevelLabel, filterWbsLevel, minBudget, maxBudget]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterProgress('all');
    setFilterLevelLabel('all');
    setFilterWbsLevel('all');
    setMinBudget('');
    setMaxBudget('');
  };

  // Filtered lists for the render views
  const filteredL1L2Items = useMemo(() => {
    return l1L2Items.filter(item => visibleWbsItemIds.has(item.id));
  }, [l1L2Items, visibleWbsItemIds]);

  const filteredL1Items = useMemo(() => {
    return filteredL1L2Items.filter((w) => Number(w.level) === 1 || !w.parent_id);
  }, [filteredL1L2Items]);

  const filteredL3Items = useMemo(() => {
    return l3Items.filter(isItemMatch);
  }, [l3Items, searchQuery, filterProgress, filterLevelLabel, filterWbsLevel, minBudget, maxBudget]);

  useEffect(() => {
    if (!hasL3Data && wbsViewTab === 'l3') {
      setWbsViewTab('l1');
    }
  }, [hasL3Data, wbsViewTab]);

  useEffect(() => {
    setUploadFile(null);
    setUploadRows([]);
    setUploadErrors([]);
    setShowUploadDialog(false);
  }, [projectFilter, subProjectFilter]);

  const openEdit = (item) => {
    const linkedAct = activities.find(a => a.wbs_item_id === item.id);
    const linkedBud = budgetItems.find(b => b.wbs_item_id === item.id);

    setEditItem(item);
    setForm({
      ...defaultForm,
      ...item,
      activity_id: linkedAct ? linkedAct.id : '',
      budget_item_id: linkedBud ? linkedBud.id : '',
    });
    setShowAdd(true);
  };

  const openAddTemplate = (parentItem = null) => {
    if (parentItem) {
      const siblings = templateItems.filter(t => t.parent_wbs_id === parentItem.wbs_id).map(t => t.wbs_id);
      setTemplateForm({
        ...defaultTemplateForm,
        wbs_id: getNextChildWbsId(parentItem.wbs_id, siblings),
        level: 2,
        parent_wbs_id: parentItem.wbs_id,
        order_index: siblings.length + 1,
      });
    } else {
      setTemplateForm({
        ...defaultTemplateForm,
        wbs_id: getNextL1WbsId(templateItems),
        level: 1,
        parent_wbs_id: '',
        order_index: templateItems.filter(t => t.level === 1).length,
      });
    }
    setEditTemplateItem(null);
    setShowTemplateEdit(true);
  };

  const openEditTemplate = (item) => {
    setEditTemplateItem(item);
    setTemplateForm({ ...defaultTemplateForm, ...item });
    setShowTemplateEdit(true);
  };

  const isReadOnlyMetaEdit = !!editItem;

  const handleSubmit = () => {
    if (editItem) {
      updateMutation.mutate(
        {
          id: editItem.id,
          data: {
            title: String(form.title || '').trim(),
            description: String(form.description || '').trim(),
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wbs'] });
            setShowAdd(false);
            setEditItem(null);
          },
        }
      );
      return;
    }

    const payload = {
      ...form,
      planned_quantity: parseFloat(form.planned_quantity) || 0,
      actual_quantity: parseFloat(form.actual_quantity) || 0,
      budget_amount: parseFloat(form.budget_amount) || 0,
      progress: parseFloat(form.progress) || 0,
    };

    const { activity_id, budget_item_id, ...wbsData } = payload;

    const handleLinks = async (savedWBS) => {
      const wbsId = savedWBS.id;
      const actsToClear = activities.filter(a => a.wbs_item_id === wbsId && a.id !== activity_id);
      for (const act of actsToClear) {
        await base44.entities.ScheduleActivity.update(act.id, { wbs_item_id: '' });
      }
      if (activity_id && activity_id !== 'none') {
        await base44.entities.ScheduleActivity.update(activity_id, { wbs_item_id: wbsId });
      }

      const budsToClear = budgetItems.filter(b => b.wbs_item_id === wbsId && b.id !== budget_item_id);
      for (const bud of budsToClear) {
        await base44.entities.BudgetItem.update(bud.id, { wbs_item_id: '' });
      }
      if (budget_item_id && budget_item_id !== 'none') {
        await base44.entities.BudgetItem.update(budget_item_id, { wbs_item_id: wbsId });
      }

      queryClient.invalidateQueries({ queryKey: ['wbs'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['budgetItems'] });
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: wbsData }, {
        onSuccess: (savedWBS) => {
          handleLinks(savedWBS);
          setShowAdd(false);
          setEditItem(null);
        }
      });
    } else {
      createMutation.mutate(wbsData, {
        onSuccess: (savedWBS) => {
          handleLinks(savedWBS);
          setShowAdd(false);
          setForm(defaultForm);
        }
      });
    }
  };

  const getRowValue = (row, aliases = []) => {
    const normalized = Object.entries(row).reduce((acc, [key, value]) => {
      acc[normalizeHeader(key)] = value;
      return acc;
    }, {});
    for (const alias of aliases) {
      const value = normalized[normalizeHeader(alias)];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return '';
  };

  const parseUploadWorkbook = async (file, selectedUploadType) => {
    const uploadConfig = WBS_UPLOAD_TYPES[selectedUploadType];
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], errors: ['No sheet found in the selected file.'] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rawGrid.length === 0) {
      return { rows: [], errors: ['The selected sheet is empty.'] };
    }

    // Check if the spreadsheet is in the new format by searching for 'parent wbs id' in any row
    const headerRowIndex = rawGrid.findIndex(row => 
      row && row.some(cell => String(cell).trim().toLowerCase() === 'parent wbs id')
    );

    if (headerRowIndex !== -1) {
      // Parse the new format!
      const headers = rawGrid[headerRowIndex].map(h => String(h || '').trim());
      
      const parentWbsIdIndex = headers.findIndex(h => h.toLowerCase() === 'parent wbs id');
      const parentWbsNameIndex = headers.findIndex(h => h.toLowerCase() === 'parent wbs name');
      const activityDescriptionIndex = headers.findIndex(h => h.toLowerCase() === 'activity description');
      const rateIndex = headers.findIndex(h => h.toLowerCase() === 'rate');
      const unitIndex = headers.findIndex(h => h.toLowerCase() === 'unit');

      if (parentWbsIdIndex === -1 || parentWbsNameIndex === -1 || activityDescriptionIndex === -1 || rateIndex === -1 || unitIndex === -1) {
        return { rows: [], errors: ['Invalid columns in the new WBS Template format. Required: "Parent WBS ID", "Parent WBS name", "Activity Description", "Rate", "Unit".'] };
      }

      // Detect level columns: all non-empty columns after "Unit"
      const levelColumns = [];
      for (let i = unitIndex + 1; i < headers.length; i++) {
        const h = headers[i];
        if (h !== undefined && h !== null && String(h).trim() !== '') {
          levelColumns.push({ index: i, name: String(h).trim() });
        }
      }

      if (levelColumns.length === 0) {
        return { rows: [], errors: ['No levels found after the "Unit" column in the new WBS Template format.'] };
      }

      const rows = [];
      const errors = [];
      
      // Sub-head counter Map for generating Activity IDs by row priority
      const subHeadCounters = new Map();

      // Loop through the data rows
      for (let r = headerRowIndex + 1; r < rawGrid.length; r++) {
        const row = rawGrid[r];
        if (!row) continue;
        const rowNumber = r + 1;

        const subHeadId = String(row[parentWbsIdIndex] ?? '').trim();
        const subHeadName = String(row[parentWbsNameIndex] ?? '').trim();
        const activityDesc = String(row[activityDescriptionIndex] ?? '').trim();
        
        // Skip empty rows
        if (!subHeadId && !subHeadName && !activityDesc) {
          continue;
        }

        if (!subHeadId) {
          errors.push(`Row ${rowNumber}: Missing "Parent WBS ID".`);
          continue;
        }

        // Collect level-wise quantities
        const levelQties = [];
        levelColumns.forEach(lvl => {
          const qtyVal = row[lvl.index];
          if (qtyVal !== undefined && qtyVal !== null && String(qtyVal).trim() !== '') {
            levelQties.push({ levelName: lvl.name, qty: parseNumber(qtyVal) });
          }
        });

        // Skip activity if no level quantities are defined
        if (levelQties.length === 0) {
          continue;
        }

        // Generate Activity ID by row priority under this sub-head
        let counter = subHeadCounters.get(subHeadId) || 1;
        const activityId = `${subHeadId}.${counter}`;
        subHeadCounters.set(subHeadId, counter + 1);

        const rate = parseNumber(row[rateIndex]);
        const unit = String(row[unitIndex] ?? '').trim();

        // Split into separate rows for each level that has a quantity
        levelQties.forEach((lvl, lvlIdx) => {
          const activityName = `${lvl.levelName}-${activityDesc}`;
          const budgetAmount = lvl.qty * rate;

          rows.push({
            temp_id: `upload_${Date.now()}_act_${activityId}_lvl_${lvl.levelName}_${lvlIdx}`,
            code: selectedUploadType === 'l3' ? activityId : subHeadId,
            wbs_name: subHeadName || `WBS ${subHeadId}`,
            level_label: lvl.levelName,
            activity_name: activityName,
            title: activityName,
            activity_id: activityId,
            activity_description: activityDesc,
            description: activityDesc,
            total_qty: lvl.qty,
            planned_quantity: lvl.qty,
            actual_quantity: 0,
            unit: unit,
            lumsum_rate: rate,
            total_days: 1, // Default total_days to 1
            budget_amount: budgetAmount,
            source_upload_type: selectedUploadType === 'l3' ? 'l3' : 'l1_activity'
          });
        });
      }

      rows.sort((a, b) => compareWbsIds(a.code, b.code));
      return { rows, errors };
    } else {
      // Fallback to the previous format!
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (rawRows.length === 0) {
        return { rows: [], errors: ['The selected sheet is empty.'] };
      }

      const templateByCode = new Map(sortedTemplateItems.map((item) => [item.wbs_id, item]));
      const rows = [];
      const errors = [];
      let lastSheetWbsCode = '';
      let lastSheetWbsName = '';

      rawRows.forEach((rawRow, index) => {
        const rowNumber = index + 2;
        const rawWbsCode = String(getRowValue(rawRow, HEADER_ALIASES.code)).trim();
        const rawWbsName = String(getRowValue(rawRow, HEADER_ALIASES.wbsName)).trim();
        const rawLevel = String(getRowValue(rawRow, HEADER_ALIASES.level)).trim();
        const activityTitle = String(getRowValue(rawRow, HEADER_ALIASES.activityTitle)).trim();
        const activityId = String(getRowValue(rawRow, HEADER_ALIASES.activityId)).trim();
        const activityDescription = String(getRowValue(rawRow, HEADER_ALIASES.description)).trim();
        const hasActivityData = !!(activityId || activityTitle);

        let code = rawWbsCode;
        let shouldUsePreviousWbs = false;
        if (selectedUploadType === 'l3') {
          code = activityId || rawWbsCode;
        } else {
          if (!rawWbsCode && !rawWbsName && hasActivityData) {
            if (!lastSheetWbsCode || !lastSheetWbsName) {
              errors.push(`Row ${rowNumber}: WBS ID and WBS Name are blank; no previous WBS group found.`);
              return;
            }
            code = lastSheetWbsCode;
            shouldUsePreviousWbs = true;
          } else {
            code = rawWbsCode || getParentCode(activityId) || activityId;
          }
        }

        if (!code) {
          errors.push(`Row ${rowNumber}: Missing WBS ID and Activity ID.`);
          return;
        }

        const level = getWbsLevel(code);
        if (!uploadConfig.allowedLevels.has(level)) {
          errors.push(`Row ${rowNumber}: WBS ${code} is level ${level}. Upload type ${uploadConfig.label} accepts ${Array.from(uploadConfig.allowedLevels).map((v) => `L${v}`).join(', ')}.`);
          return;
        }

        const templateItem = templateByCode.get(code);
        const resolvedWbsName = String(
          (shouldUsePreviousWbs ? lastSheetWbsName : '') ||
          rawWbsName ||
          templateItem?.title ||
          ''
        ).trim();
        const resolvedActivityName = String(
          activityTitle ||
          getRowValue(rawRow, HEADER_ALIASES.activityTitle) ||
          ''
        ).trim();
        const title = String(
          selectedUploadType === 'l3'
            ? (resolvedActivityName || resolvedWbsName || templateItem?.title || activityId || `WBS ${code}`)
            : (resolvedWbsName || resolvedActivityName || templateItem?.title || activityId || `WBS ${code}`)
        ).trim();
        const plannedQty = parseNumber(getRowValue(rawRow, HEADER_ALIASES.plannedQty));
        const actualQty = parseNumber(getRowValue(rawRow, HEADER_ALIASES.actualQty));
        const explicitBudget = parseNumber(getRowValue(rawRow, HEADER_ALIASES.budget));
        const unitRate = parseNumber(getRowValue(rawRow, HEADER_ALIASES.rate));
        const totalDays = parseNumber(getRowValue(rawRow, HEADER_ALIASES.totalDays));
        const budgetAmount = explicitBudget || (plannedQty > 0 && unitRate > 0 ? plannedQty * unitRate : 0);
        const description = activityDescription || templateItem?.description || '';

        if (!title) {
          errors.push(`Row ${rowNumber}: Missing activity/title for WBS ${code}.`);
          return;
        }

        if (selectedUploadType === 'l1') {
          if (rawWbsCode) lastSheetWbsCode = rawWbsCode;
          if (rawWbsName) {
            lastSheetWbsName = rawWbsName;
          } else if (rawWbsCode && resolvedWbsName) {
            lastSheetWbsName = resolvedWbsName;
          }
        }

        rows.push({
          temp_id: `upload_${Date.now()}_${index}`,
          code,
          wbs_name: resolvedWbsName || title,
          level_label: rawLevel || `L${level}`,
          activity_name: resolvedActivityName || title,
          title,
          activity_id: activityId,
          activity_description: description,
          description,
          total_qty: plannedQty,
          planned_quantity: plannedQty,
          actual_quantity: actualQty,
          unit: String(getRowValue(rawRow, HEADER_ALIASES.unit)).trim(),
          lumsum_rate: unitRate,
          total_days: totalDays,
          budget_amount: budgetAmount,
        });
      });

      rows.sort((a, b) => compareWbsIds(a.code, b.code));
      return { rows, errors };
    }
  };

  const parseSelectedUploadFile = async (nextFile = uploadFile, nextUploadType = uploadType) => {
    if (!nextFile) return;
    setParsingUpload(true);
    try {
      const parsed = await parseUploadWorkbook(nextFile, nextUploadType);
      setUploadRows(parsed.rows);
      setUploadErrors(parsed.errors);
    } catch (error) {
      setUploadRows([]);
      setUploadErrors([`Failed to parse upload file: ${error.message}`]);
    } finally {
      setParsingUpload(false);
    }
  };

  useEffect(() => {
    if (showUploadDialog && uploadFile) {
      parseSelectedUploadFile(uploadFile, uploadType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadType]);

  const openUploadDialog = (type = 'l1') => {
    setUploadType(type);
    setUploadFile(null);
    setUploadRows([]);
    setUploadErrors([]);
    setShowUploadDialog(true);
  };

  const closeUploadDialog = () => {
    setShowUploadDialog(false);
    setUploadFile(null);
    setUploadRows([]);
    setUploadErrors([]);
    setParsingUpload(false);
    setConfirmingUpload(false);
  };

  const updateUploadRow = (tempId, field, value) => {
    setUploadRows((prev) => prev.map((row) => (
      row.temp_id === tempId ? { ...row, [field]: value } : row
    )));
  };

  const addUploadRow = () => {
    setUploadRows((prev) => ([
      ...prev,
      {
        temp_id: `manual_${Date.now()}`,
        code: '',
        wbs_name: '',
        level_label: '',
        activity_name: '',
        title: '',
        activity_id: '',
        activity_description: '',
        description: '',
        total_qty: 0,
        planned_quantity: 0,
        actual_quantity: 0,
        unit: '',
        lumsum_rate: 0,
        total_days: 0,
        budget_amount: 0,
      },
    ]));
  };

  const removeUploadRow = (tempId) => {
    setUploadRows((prev) => prev.filter((row) => row.temp_id !== tempId));
  };

  const uploadRowIssues = useMemo(() => {
    const issuesByRow = {};
    uploadRows.forEach((row) => {
      const rowIssues = [];
      const code = String(row.code || '').trim();
      const activityId = String(row.activity_id || '').trim();

      if (uploadType === 'l1' && code && activityId && !activityId.startsWith(`${code}.`)) {
        rowIssues.push(`Activity ID must start with "${code}."`);
      }

      if (rowIssues.length > 0) {
        issuesByRow[row.temp_id] = rowIssues;
      }
    });
    return issuesByRow;
  }, [uploadRows, uploadType]);

  const hasBlockingUploadIssues = Object.keys(uploadRowIssues).length > 0;

  const handleConfirmUpload = async () => {
    if (!wbsReady) return;
    if (hasBlockingUploadIssues) {
      setUploadErrors([
        'Fix highlighted rows before submit. For L1/L2 upload, each Activity ID must begin with its WBS ID prefix (e.g. 1.1 -> 1.1.1).',
      ]);
      return;
    }
    const uploadConfig = WBS_UPLOAD_TYPES[uploadType];
    const normalizedRows = uploadRows
      .map((row) => ({
        ...row,
        code: String(row.code || '').trim(),
        wbs_name: String(row.wbs_name || '').trim(),
        level_label: String(row.level_label || '').trim(),
        activity_name: String(row.activity_name || '').trim(),
        title: uploadType === 'l3'
          ? String(row.activity_name || row.title || row.wbs_name || '').trim()
          : String(row.wbs_name || row.title || row.activity_name || '').trim(),
        activity_id: String(row.activity_id || '').trim(),
        activity_description: String(row.activity_description || row.description || '').trim(),
        description: String(row.activity_description || row.description || '').trim(),
        unit: String(row.unit || '').trim(),
        total_qty: parseNumber(row.total_qty ?? row.planned_quantity),
        planned_quantity: parseNumber(row.total_qty ?? row.planned_quantity),
        actual_quantity: parseNumber(row.actual_quantity),
        lumsum_rate: parseNumber(row.lumsum_rate),
        total_days: parseNumber(row.total_days),
        budget_amount: parseNumber(row.budget_amount) || (parseNumber(row.total_qty ?? row.planned_quantity) > 0 && parseNumber(row.lumsum_rate) > 0 ? parseNumber(row.total_qty ?? row.planned_quantity) * parseNumber(row.lumsum_rate) : 0),
      }))
      .filter((row) => row.code && row.title)
      .filter((row) => uploadConfig.allowedLevels.has(getWbsLevel(row.code)));

    if (normalizedRows.length === 0) {
      setUploadErrors([`No valid ${uploadConfig.label} rows available to submit.`]);
      return;
    }

    const selectedProjectRecord = projects.find((project) => project.id === projectFilter);
    const selectedSubProjectRecord = subProjects.find((subProject) => subProject.id === subProjectFilter);
    const activityCodeProjectSegment = selectedProjectRecord?.project_code || selectedProjectRecord?.name || projectFilter;
    const activityCodeSubProjectSegment = selectedSubProjectRecord?.name || subProjectFilter;
    const makeActivityCode = (row, fallbackActivityId, fallbackLevelLabel) =>
      buildActivityCode({
        projectCode: activityCodeProjectSegment,
        subProjectName: activityCodeSubProjectSegment,
        levelLabel: row?.level_label || fallbackLevelLabel || '',
        activityId: row?.activity_id || fallbackActivityId || row?.code || '',
      });

    setConfirmingUpload(true);
    try {
      const currentItems = await base44.entities.WBSItem.filter(
        { project_id: projectFilter, sub_project_id: subProjectFilter },
        'order_index'
      );

      const existingByCode = new Map(currentItems.map((item) => [item.code, item]));
      const templateByCode = new Map(sortedTemplateItems.map((item) => [item.wbs_id, item]));
      const codeToId = new Map(currentItems.map((item) => [item.code, item.id]));
      const activityRows = uploadType === 'l1'
        ? normalizedRows.filter((row) => row.activity_id || row.activity_name)
        : [];

      const desiredByCode = new Map();
      if (uploadType === 'l1') {
        normalizedRows.forEach((row) => {
          const key = row.code;
          const existing = desiredByCode.get(key);
          if (existing) {
            existing.planned_quantity += row.total_qty;
            existing.actual_quantity += row.actual_quantity;
            existing.budget_amount += row.budget_amount;
            if (!existing.unit && row.unit) existing.unit = row.unit;
            if (!existing.description && row.description) existing.description = row.description;
            if (!existing.level_label && row.level_label) existing.level_label = row.level_label;
          } else {
            desiredByCode.set(key, {
              ...row,
              title: row.wbs_name || row.title || key,
              description: row.wbs_name || row.description || '',
              planned_quantity: row.total_qty,
              actual_quantity: row.actual_quantity,
              budget_amount: row.budget_amount,
              level_label: row.level_label || '',
              source_upload_type: 'l1',
            });
          }
        });
      } else {
        normalizedRows.forEach((row) => {
          const resolvedActivityId = row.activity_id || row.code;
          const resolvedLevelLabel = row.level_label || `L${row.level || 3}`;
          const computedActivityCode = makeActivityCode(row, resolvedActivityId, resolvedLevelLabel);
          desiredByCode.set(computedActivityCode.toLowerCase(), {
            ...row,
            source_upload_type: 'l3',
          });
        });
      }

      const requiredAncestorCodes = new Set();
      Array.from(desiredByCode.values()).forEach((row) => {
        let parentCode = getParentCode(row.code);
        while (parentCode) {
          const desiredHasParent = Array.from(desiredByCode.values()).some(r => r.code === parentCode);
          if (!existingByCode.has(parentCode) && !desiredHasParent) {
            requiredAncestorCodes.add(parentCode);
          }
          parentCode = getParentCode(parentCode);
        }
      });

      Array.from(requiredAncestorCodes)
        .sort(compareWbsIds)
        .forEach((code) => {
          const template = templateByCode.get(code);
          desiredByCode.set(code, {
            temp_id: `ancestor_${code}`,
            code,
            title: template?.title || `WBS ${code}`,
            activity_id: '',
            description: template?.description || 'Auto-created from hierarchy template.',
            planned_quantity: 0,
            actual_quantity: 0,
            unit: '',
            lumsum_rate: 0,
            total_days: 0,
            budget_amount: 0,
            _autoAncestor: true,
            level_label: '',
            source_upload_type: uploadType === 'l3' ? 'l3' : 'l1',
          });
        });

      const orderedRows = Array.from(desiredByCode.values()).sort((a, b) => compareWbsIds(a.code, b.code));
      const activityByCode = new Map(
        activities
          .filter((act) => act.project_id === projectFilter)
          .map((act) => [String(act.activity_id || '').trim().toLowerCase(), act])
      );

      let created = 0;
      let updated = 0;

      // 1. Separate orderedRows into parent items (levels 1 & 2) and child items (level 3)
      const parentRows = orderedRows.filter((row) => getWbsLevel(row.code) <= 2);
      const level3RowsFromOrdered = orderedRows.filter((row) => getWbsLevel(row.code) === 3);

      // 2. Process parents sequentially
      for (let index = 0; index < parentRows.length; index += 1) {
        const row = parentRows[index];
        const level = getWbsLevel(row.code);
        const parentCode = getParentCode(row.code);
        const parentId = parentCode ? codeToId.get(parentCode) || null : null;
        const existing = existingByCode.get(row.code);

        const payload = {
          project_id: projectFilter,
          sub_project_id: subProjectFilter,
          code: row.code,
          activity_id: '',
          activity_code: null,
          title: row.title,
          description: row.description || '',
          level,
          parent_id: parentId,
          planned_quantity: row.planned_quantity,
          actual_quantity: row.actual_quantity,
          unit: row.unit || '',
          lumsum_rate: row.lumsum_rate || 0,
          total_days: row.total_days || 0,
          level_label: row.level_label || existing?.level_label || '',
          source_upload_type: row.source_upload_type || 'l1',
          progress: existing ? parseNumber(existing.progress) : 0,
          budget_amount: row.budget_amount,
          order_index: index,
        };

        let savedItem;
        if (existing) {
          savedItem = await base44.entities.WBSItem.update(existing.id, payload);
          updated += 1;
        } else {
          savedItem = await base44.entities.WBSItem.create(payload);
          created += 1;
          currentItems.push(savedItem);
        }

        codeToId.set(row.code, savedItem.id);
        existingByCode.set(row.code, savedItem);
      }

      // 3. Collect level 3 tasks (WBS items and/or activities) to process in parallel batches
      let activityCreated = 0;
      let activityUpdated = 0;
      let activityDeleted = 0;
      const consumedActivityCodes = new Set();

      const l3ToSave = [];
      level3RowsFromOrdered.forEach((row, index) => {
        l3ToSave.push({ row, index, isActivityRow: false });
      });
      activityRows.forEach((row, index) => {
        l3ToSave.push({ row, index, isActivityRow: true });
      });

      // Process in parallel batches of size 40
      const batchSize = 40;
      for (let i = 0; i < l3ToSave.length; i += batchSize) {
        const batch = l3ToSave.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async ({ row, index, isActivityRow }) => {
            if (isActivityRow) {
              const parentCode = uploadType === 'l3' ? getParentCode(row.code) : row.code;
              const parentId = parentCode ? codeToId.get(parentCode) : null;
              if (!parentId) return;

              const activityCode = (uploadType === 'l3' ? row.code : row.activity_id) || `${parentCode}.${index + 1}`;
              const resolvedActivityId = row.activity_id || activityCode;
              const resolvedLevelLabel = row.level_label || `L${row.level || 3}`;
              const computedActivityCode = makeActivityCode(row, resolvedActivityId, resolvedLevelLabel);

              const existingActivity = currentItems.find(item => 
                item.activity_code && 
                item.activity_code.toLowerCase() === computedActivityCode.toLowerCase()
              ) || (row.activity_id ? currentItems.find(item => 
                Number(item.level) === 3 && 
                item.activity_id && 
                item.activity_id.toLowerCase() === row.activity_id.toLowerCase() && 
                String(item.level_label || '').toLowerCase() === resolvedLevelLabel.toLowerCase()
              ) : null);

              const activityPayload = {
                project_id: projectFilter,
                sub_project_id: subProjectFilter,
                code: activityCode,
                activity_id: resolvedActivityId,
                activity_code: computedActivityCode,
                title: row.activity_name || row.title || activityCode,
                description: row.activity_description || row.description || '',
                level: 3,
                parent_id: parentId,
                planned_quantity: row.total_qty,
                actual_quantity: row.actual_quantity,
                unit: row.unit || '',
                lumsum_rate: row.lumsum_rate || 0,
                total_days: row.total_days || 0,
                level_label: row.level_label || existingActivity?.level_label || '',
                progress: existingActivity ? parseNumber(existingActivity.progress) : 0,
                budget_amount: row.budget_amount,
                order_index: parentRows.length + index,
                source_upload_type: uploadType === 'l3' ? 'l3' : 'l1_activity',
              };

              let savedActivity;
              if (existingActivity) {
                savedActivity = await base44.entities.WBSItem.update(existingActivity.id, activityPayload);
                activityUpdated += 1;
              } else {
                savedActivity = await base44.entities.WBSItem.create(activityPayload);
                activityCreated += 1;
                currentItems.push(savedActivity);
              }

              consumedActivityCodes.add(savedActivity.code);
              codeToId.set(savedActivity.code, savedActivity.id);
              existingByCode.set(savedActivity.code, savedActivity);

              const match = activityByCode.get(String(savedActivity.activity_id || '').toLowerCase()) || activities.find((act) => act.id === savedActivity.activity_id);
              if (match && match.wbs_item_id !== savedActivity.id) {
                await base44.entities.ScheduleActivity.update(match.id, { wbs_item_id: savedActivity.id });
              }
            } else {
              const parentCode = getParentCode(row.code);
              const parentId = parentCode ? codeToId.get(parentCode) || null : null;
              
              const resolvedActivityId = row.activity_id || row.code;
              const resolvedLevelLabel = row.level_label || `L3`;
              const computedActivityCode = makeActivityCode(row, resolvedActivityId, resolvedLevelLabel);

              let existing = currentItems.find(item => 
                item.activity_code && 
                item.activity_code.toLowerCase() === computedActivityCode.toLowerCase()
              ) || (resolvedActivityId ? currentItems.find(item => 
                Number(item.level) === 3 && 
                item.activity_id && 
                item.activity_id.toLowerCase() === resolvedActivityId.toLowerCase() && 
                String(item.level_label || '').toLowerCase() === resolvedLevelLabel.toLowerCase()
              ) : null);

              const payload = {
                project_id: projectFilter,
                sub_project_id: subProjectFilter,
                code: row.code,
                activity_id: resolvedActivityId,
                activity_code: computedActivityCode,
                title: row.title,
                description: row.description || '',
                level: 3,
                parent_id: parentId,
                planned_quantity: row.planned_quantity,
                actual_quantity: row.actual_quantity,
                unit: row.unit || '',
                lumsum_rate: row.lumsum_rate || 0,
                total_days: row.total_days || 0,
                level_label: row.level_label || existing?.level_label || '',
                source_upload_type: row.source_upload_type || 'l3',
                progress: existing ? parseNumber(existing.progress) : 0,
                budget_amount: row.budget_amount,
                order_index: parentRows.length + index,
              };

              let savedItem;
              if (existing) {
                savedItem = await base44.entities.WBSItem.update(existing.id, payload);
                updated += 1;
              } else {
                savedItem = await base44.entities.WBSItem.create(payload);
                created += 1;
                currentItems.push(savedItem);
              }

              codeToId.set(row.code, savedItem.id);
              existingByCode.set(row.code, savedItem);

              if (row.activity_id) {
                const match = activityByCode.get(String(row.activity_id).toLowerCase()) || activities.find((act) => act.id === row.activity_id);
                if (match && match.wbs_item_id !== savedItem.id) {
                  await base44.entities.ScheduleActivity.update(match.id, { wbs_item_id: savedItem.id });
                }
              }
            }
          })
        );
      }

      // 4. Delete stale L1 activities sequentially
      if (uploadType === 'l1') {
        const staleL1Activities = currentItems.filter(
          (item) => Number(item.level) === 3 && item.source_upload_type === 'l1_activity' && !consumedActivityCodes.has(item.code)
        );
        for (const staleItem of staleL1Activities) {
          await base44.entities.WBSItem.delete(staleItem.id);
          activityDeleted += 1;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['wbs'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setApplyMessage(
        `WBS upload complete (${uploadConfig.label}): ${created} created, ${updated} updated, ${activityCreated} activity rows created, ${activityUpdated} activity rows updated${activityDeleted ? `, ${activityDeleted} activity rows removed` : ''}.`
      );
      setTimeout(() => setApplyMessage(''), 5000);
      closeUploadDialog();
    } catch (error) {
      setUploadErrors((prev) => [...prev, `Submit failed: ${error.message}`]);
    } finally {
      setConfirmingUpload(false);
    }
  };

  const handleTemplateSubmit = () => {
    const payload = {
      ...templateForm,
      parent_wbs_id: templateForm.level === 1 ? null : templateForm.parent_wbs_id,
    };
    if (editTemplateItem) {
      updateTemplateMutation.mutate({
        wbsId: editTemplateItem.wbs_id,
        data: { title: payload.title, description: payload.description, order_index: payload.order_index },
      });
    } else {
      createTemplateMutation.mutate(payload);
    }
  };

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const toggleTemplateExpand = (id) => setTemplateExpanded(e => ({ ...e, [id]: !e[id] }));

  const l1Items = l1L2Items.filter((w) => Number(w.level) === 1 || !w.parent_id);
  const getChildren = (items, parentId) => items.filter((w) => w.parent_id === parentId);
  const l1ActivitiesByParent = useMemo(() => {
    const map = {};
    l1ActivityItems.forEach((item) => {
      if (!item.parent_id) return;
      if (!map[item.parent_id]) map[item.parent_id] = [];
      map[item.parent_id].push(item);
    });
    Object.keys(map).forEach((key) => {
      map[key] = map[key].sort((a, b) => compareWbsIds(a.code, b.code));
    });
    return map;
  }, [l1ActivityItems]);

  const l1Template = sortedTemplateItems.filter(t => t.level === 1);
  const getTemplateChildren = (parentWbsId) =>
    sortedTemplateItems.filter(t => t.parent_wbs_id === parentWbsId);

  const getSubHeadBudget = (subHead) => {
    const activitiesForSubHead = l1ActivitiesByParent[subHead.id] || [];
    if (activitiesForSubHead.length > 0) {
      return activitiesForSubHead.reduce((sum, activity) => sum + (parseNumber(activity.budget_amount) || 0), 0);
    }
    return parseNumber(subHead.budget_amount) || 0;
  };

  const getHeadBudget = (head) => {
    const subHeads = getChildren(l1L2Items, head.id);
    if (subHeads.length === 0) return parseNumber(head.budget_amount) || 0;
    return subHeads.reduce((sum, subHead) => sum + getSubHeadBudget(subHead), 0);
  };

  const totalBudget = l1Items.reduce((sum, head) => sum + getHeadBudget(head), 0);
  const avgProgress = wbsItems.length > 0
    ? Math.round(wbsItems.reduce((sum, item) => sum + parseNumber(item.progress), 0) / wbsItems.length)
    : 0;

  const selectedProject = projects.find(p => p.id === projectFilter);
  const selectedSubProject = subProjects.find(sp => sp.id === subProjectFilter);

  const openAddWbs = () => {
    setEditItem(null);
    setForm({
      ...defaultForm,
      project_id: projectFilter,
      sub_project_id: subProjectFilter,
    });
    setShowAdd(true);
  };

  const fmt = (v) => formatCompactCurrencyINR(v);

  const applyStandardWbs = () => {
    if (!projectFilter || !subProjectFilter) return;
    applyTemplateMutation.mutate({
      projectId: projectFilter,
      subProjectId: subProjectFilter,
      mode: applyMode,
    });
  };

  const renderRow = (item, items, depth = 0, expandActivitiesFromHead = false) => {
    const children = getChildren(items, item.id);
    const indent = depth * 20;
    const isHead = Number(item.level) === 1 || !item.parent_id;
    const isSubHead = Number(item.level) === 2;
    const isForcedExpandedSubHead = isSubHead && expandActivitiesFromHead;
    const isExp = Boolean(expanded[item.id] || isForcedExpandedSubHead || isFiltering);
    const rawActivityRows = isSubHead ? (l1ActivitiesByParent[item.id] || []) : [];
    const activityRows = isFiltering ? rawActivityRows.filter(isItemMatch) : rawActivityRows;
    const hasExpandableContent = children.length > 0 || activityRows.length > 0;
    const canToggleRow = hasExpandableContent && !(isSubHead && expandActivitiesFromHead) && !isFiltering;
    const displayBudget = isHead
      ? getHeadBudget(item)
      : isSubHead
        ? getSubHeadBudget(item)
        : parseNumber(item.budget_amount);

    return (
      <React.Fragment key={item.id}>
        <tr
          className="border-b hover:bg-muted/10 cursor-pointer"
          onClick={() => canToggleRow && toggleExpand(item.id)}
        >
          <td className="p-3 text-foreground" style={{ paddingLeft: `${12 + indent}px` }}>
            <div className="flex items-start gap-2">
              {hasExpandableContent
                ? (isExp
                  ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />)
                : <div className="w-4" />}
              <span className={`text-xs px-1.5 py-0.5 mt-0.5 rounded shrink-0 ${levelColors[item.level] || levelColors[3]}`}>L{item.level}</span>
              <span className="text-xs font-mono font-semibold text-primary mt-0.5 shrink-0 min-w-[3rem]">{item.code}</span>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{item.title}</span>
                {isSubHead && activityRows.length > 0 && (
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {activityRows.length} activities
                  </span>
                )}
              </div>
            </div>
          </td>
          <td className="p-3 text-right text-sm font-semibold">{fmt(displayBudget)}</td>
          <td className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${item.progress || 0}%`,
                    backgroundColor: item.progress >= 80 ? '#10b981' : item.progress >= 40 ? '#f59e0b' : '#6366f1',
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{item.progress || 0}%</span>
            </div>
          </td>
          <td className="p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </td>
        </tr>

        {isExp && isSubHead && activityRows.length > 0 && (
          <tr className="border-b bg-muted/20">
            <td colSpan={4} className="p-3">
              <div className="overflow-x-auto border rounded-lg bg-background">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-semibold whitespace-nowrap min-w-[240px]">Activity Code</th>
                      <th className="text-left p-2 font-semibold">Level</th>
                      <th className="text-left p-2 font-semibold">Activity ID</th>
                      <th className="text-left p-2 font-semibold">Activity Name</th>
                      <th className="text-right p-2 font-semibold">Total Qty</th>
                      <th className="text-left p-2 font-semibold">Unit</th>
                      <th className="text-right p-2 font-semibold">Lumsum Rate</th>
                      <th className="text-right p-2 font-semibold">Budget</th>
                      <th className="text-left p-2 font-semibold">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityRows.map((activityRow) => (
                      <tr key={activityRow.id} className="border-b last:border-b-0">
                        <td className="p-2 font-mono text-[11px] whitespace-nowrap">{activityRow.activity_code || '—'}</td>
                        <td className="p-2">{String(activityRow.level_label || '').trim() || `L${activityRow.level || 3}`}</td>
                        <td className="p-2 font-mono">{activityRow.activity_id || activityRow.code}</td>
                        <td className="p-2">{activityRow.title}</td>
                        <td className="p-2 text-right">{parseNumber(activityRow.planned_quantity).toLocaleString()}</td>
                        <td className="p-2">{activityRow.unit || '—'}</td>
                        <td className="p-2 text-right">{parseNumber(activityRow.lumsum_rate).toLocaleString()}</td>
                        <td className="p-2 text-right font-semibold">{fmt(activityRow.budget_amount)}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${parseNumber(activityRow.progress)}%`,
                                  backgroundColor: parseNumber(activityRow.progress) >= 80
                                    ? '#10b981'
                                    : parseNumber(activityRow.progress) >= 40
                                      ? '#f59e0b'
                                      : '#6366f1',
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground">{parseNumber(activityRow.progress).toFixed(2)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        )}

        {isExp && children.map((child) => renderRow(child, items, depth + 1, expandActivitiesFromHead || isHead))}
      </React.Fragment>
    );
  };

  const renderL3Row = (item) => {
    const parentItem = sortedWbsItems.find((candidate) => candidate.id === item.parent_id);
    const linkedAct = activities.find((activity) => activity.wbs_item_id === item.id);
    const linkedBud = budgetItems.find((budget) => budget.wbs_item_id === item.id);

    return (
      <tr key={item.id} className="border-b hover:bg-muted/10">
        <td className="p-3 text-foreground">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${levelColors[item.level] || levelColors[3]}`}>L{item.level}</span>
              <span className="text-xs font-mono font-semibold text-primary min-w-[3rem]">{item.code}</span>
              <span className="font-medium text-sm">{item.title}</span>
            </div>
            {parentItem && (
              <p className="text-[11px] text-muted-foreground">
                Parent: <span className="font-mono">{parentItem.code}</span> — {parentItem.title}
              </p>
            )}
            {(linkedAct || linkedBud) && (
              <div className="flex flex-wrap gap-2 mt-1">
                {linkedAct && (
                  <Badge variant="outline" className="text-[10px] text-blue-600 bg-blue-50/50 border-blue-200 py-0 px-1.5 font-normal">
                    📅 {linkedAct.activity_id || 'Act'}: {linkedAct.name}
                  </Badge>
                )}
                {linkedBud && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-50/50 border-emerald-200 py-0 px-1.5 font-normal">
                    💰 {linkedBud.code || 'Bud'}: {linkedBud.title}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </td>
        <td className="p-3 text-right text-sm font-semibold">{fmt(item.budget_amount)}</td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${item.progress || 0}%`,
                  backgroundColor: item.progress >= 80 ? '#10b981' : item.progress >= 40 ? '#f59e0b' : '#6366f1',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{item.progress || 0}%</span>
          </div>
        </td>
        <td className="p-3">
          <div className="flex gap-1 justify-end">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        </td>
      </tr>
    );
  };

  const renderTemplateRow = (item, depth = 0) => {
    const children = getTemplateChildren(item.wbs_id);
    const isExp = templateExpanded[item.wbs_id];
    const indent = depth * 20;

    return (
      <React.Fragment key={item.wbs_id}>
        <tr className="border-b hover:bg-muted/10">
          <td className="p-3" style={{ paddingLeft: `${12 + indent}px` }}>
            <div className="flex items-center gap-2">
              {children.length > 0 ? (
                <button type="button" onClick={() => toggleTemplateExpand(item.wbs_id)} className="p-0.5">
                  {isExp ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
              ) : <div className="w-5" />}
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${levelColors[item.level]}`}>L{item.level}</span>
              <span className="text-sm font-mono font-semibold text-primary min-w-[3rem]">{item.wbs_id}</span>
              <span className="text-sm font-medium">{item.title}</span>
            </div>
          </td>
          {isAdmin && (
            <td className="p-3">
              <div className="flex gap-1 justify-end">
                {item.level === 1 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Add sub-item" onClick={() => openAddTemplate(item)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditTemplate(item)}><Pencil className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteTemplateMutation.mutate(item.wbs_id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </td>
          )}
        </tr>
        {isExp && children.map(child => renderTemplateRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">WBS Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-sans">
            Select a project and sub-project to view or manage WBS items
          </p>
        </div>
        {activeTab === 'project' && (
          <Button className="gap-2" disabled={!wbsReady} onClick={openAddWbs}>
            <Plus className="w-4 h-4" /> Add WBS Item
          </Button>
        )}
        {activeTab === 'template' && isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={resetTemplateMutation.isPending}
              onClick={() => {
                if (templateItems.length === 0 || confirm('Reload standard WBS heads (L1 only)? This replaces the current template and removes existing sub-heads.')) {
                  resetTemplateMutation.mutate();
                }
              }}
            >
              {resetTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Load Standard Data
            </Button>
            <Button className="gap-2" onClick={() => openAddTemplate()}>
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="project" className="gap-2"><Layers className="w-4 h-4" /> Project WBS</TabsTrigger>
          <TabsTrigger value="template" className="gap-2"><BookTemplate className="w-4 h-4" /> Standard Template</TabsTrigger>
        </TabsList>

        <TabsContent value="project" className="space-y-4 mt-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Project *</Label>
              <Select value={projectFilter} onValueChange={handleProjectChange}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Sub Project *</Label>
              <Select
                value={subProjectFilter}
                onValueChange={setSubProjectFilter}
                disabled={!projectFilter}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder={projectFilter ? 'Select sub-project' : 'Select project first'} />
                </SelectTrigger>
                <SelectContent>
                  {subProjects.map(sp => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {wbsReady && (
              <div className="flex flex-wrap gap-2 items-end">
                {!hasL1Data && (
                  <Button className="gap-2" onClick={() => openUploadDialog('l1')}>
                    <Upload className="w-4 h-4" />
                    Upload L1 / L2 WBS
                  </Button>
                )}

                {hasL1Data && (
                  <Button variant="outline" className="gap-2" onClick={() => openUploadDialog('l1')}>
                    <Upload className="w-4 h-4" />
                    Update L1 / L2 Upload
                  </Button>
                )}

                {hasL1Data && (
                  <Button
                    variant={hasL3Data ? 'outline' : 'default'}
                    className="gap-2"
                    onClick={() => openUploadDialog('l3')}
                  >
                    <Upload className="w-4 h-4" />
                    {hasL3Data ? 'Update L3 Upload' : 'Upload L3 WBS'}
                  </Button>
                )}

                {!hasL1Data && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Template mode</Label>
                      <Select value={applyMode} onValueChange={setApplyMode}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="merge">Merge (keep existing)</SelectItem>
                          <SelectItem value="replace">Replace all</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={applyTemplateMutation.isPending}
                      onClick={applyStandardWbs}
                    >
                      {applyTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Apply Standard Heads
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {wbsReady && selectedProject && selectedSubProject && (
            <p className="text-sm text-muted-foreground">
              Showing WBS for <span className="font-medium text-foreground">{selectedProject.name}</span>
              {' → '}
              <span className="font-medium text-foreground">{selectedSubProject.name}</span>
            </p>
          )}

          {applyMessage && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">{applyMessage}</div>
          )}


          {wbsReady && hasL1Data && hasL3Data && (
            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              Both L1 / L2 and L3 WBS are uploaded. Use tabs to review each layer separately.
            </div>
          )}

          {!projectFilter ? (
            <EmptyState
              icon={Layers}
              title="Select a project"
              description="Choose a project first, then select a sub-project to view its WBS."
            />
          ) : !subProjectFilter ? (
            subProjects.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No sub-projects"
                description="Add sub-projects (towers, blocks, phases) under Projects before managing WBS."
              />
            ) : (
              <EmptyState
                icon={Building2}
                title="Select a sub-project"
                description="Choose a sub-project to view or apply the standard WBS format."
              />
            )
          ) : (
            <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Items', value: wbsItems.length },
              { label: 'L1 / L2 Items', value: l1L2Items.length },
              { label: 'L3 Items', value: l3Items.length },
              { label: 'Avg Progress', value: `${avgProgress}%` },
              { label: 'L1 Budget', value: fmt(totalBudget) },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 font-sans">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-sans">Loading WBS...</div>
          ) : wbsItems.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="No WBS uploaded"
              description="Upload L1 / L2 WBS first. After that, upload L3 WBS activities for this sub-project."
              actionLabel="Upload L1 / L2 WBS"
              onAction={() => openUploadDialog('l1')}
            />
          ) : (
            <div className="space-y-4">
              {/* Premium Collapsible Multi-Feature Filter Card */}
              <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-base">Filter WBS Items</h3>
                    {isFiltering && (
                      <Badge className="bg-primary/10 text-primary border-none hover:bg-primary/15 font-sans text-xs px-2 py-0.5">
                        Active
                      </Badge>
                    )}
                  </div>
                  {isFiltering && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground font-sans px-2"
                      onClick={clearAllFilters}
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear Filters
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Label className="text-xs text-muted-foreground mb-1 block font-sans">Search Query</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search code, title, details..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm font-sans"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block font-sans">Progress Status</Label>
                    <Select value={filterProgress} onValueChange={setFilterProgress}>
                      <SelectTrigger className="h-9 text-sm font-sans"><SelectValue /></SelectTrigger>
                      <SelectContent className="font-sans text-sm">
                        <SelectItem value="all">All Progress</SelectItem>
                        <SelectItem value="not_started">Not Started (0%)</SelectItem>
                        <SelectItem value="in_progress">In Progress (1-99%)</SelectItem>
                        <SelectItem value="completed">Completed (100%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col">
                    <Label className="text-xs text-muted-foreground mb-1 block font-sans">Floor / Level</Label>
                    <Popover open={levelPickerOpen} onOpenChange={setLevelPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={levelPickerOpen}
                          className="w-full h-9 justify-between font-normal font-sans bg-background border-input text-sm text-left px-3"
                        >
                          <span className="truncate">
                            {filterLevelLabel === 'all' ? 'All Levels' : filterLevelLabel}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0 font-sans" align="start">
                        <Command>
                          <CommandInput placeholder="Search floor/level..." className="h-9 font-sans text-xs" />
                          <CommandList className="max-h-[250px] overflow-y-auto">
                            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No levels found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="all"
                                onSelect={() => {
                                  setFilterLevelLabel('all');
                                  setLevelPickerOpen(false);
                                }}
                                className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                              >
                                <span>All Levels</span>
                                {filterLevelLabel === 'all' && <Check className="h-3.5 w-3.5 text-primary" />}
                              </CommandItem>
                              {availableLevelLabels.map((lbl) => (
                                <CommandItem
                                  key={lbl}
                                  value={lbl}
                                  onSelect={() => {
                                    setFilterLevelLabel(lbl);
                                    setLevelPickerOpen(false);
                                  }}
                                  className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                                >
                                  <span>{lbl}</span>
                                  {filterLevelLabel === lbl && <Check className="h-3.5 w-3.5 text-primary" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block font-sans">WBS Level</Label>
                    <Select value={filterWbsLevel} onValueChange={setFilterWbsLevel}>
                      <SelectTrigger className="h-9 text-sm font-sans"><SelectValue /></SelectTrigger>
                      <SelectContent className="font-sans text-sm">
                        <SelectItem value="all">All Levels (L1-L3)</SelectItem>
                        <SelectItem value="1">Level 1 (Category)</SelectItem>
                        <SelectItem value="2">Level 2 (Sub-Category)</SelectItem>
                        <SelectItem value="3">Level 3 (Activity)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 focus:outline-none font-sans"
                  >
                    {showFiltersPanel ? 'Hide Budget Settings' : 'Set Budget Settings'}
                  </button>
                </div>

                {showFiltersPanel && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-dashed">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block font-sans">Min Budget (₹)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 10000"
                        value={minBudget}
                        onChange={(e) => setMinBudget(e.target.value)}
                        className="h-9 text-sm font-sans"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block font-sans">Max Budget (₹)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 500000"
                        value={maxBudget}
                        onChange={(e) => setMaxBudget(e.target.value)}
                        className="h-9 text-sm font-sans"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Tabs value={wbsViewTab} onValueChange={setWbsViewTab} className="space-y-4">
                <TabsList className="font-sans">
                  <TabsTrigger value="l1" className="gap-2">
                    L1 / L2 WBS
                    {isFiltering && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-semibold">
                        {filteredL1L2Items.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="l3" disabled={!hasL3Data} className="gap-2">
                    L3 WBS
                    {isFiltering && hasL3Data && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-semibold">
                        {filteredL3Items.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="l1">
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm font-sans">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-3 font-semibold">WBS ID / Name</th>
                            <th className="text-right p-3 font-semibold">Budget</th>
                            <th className="text-left p-3 font-semibold">Progress</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredL1Items.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-muted-foreground font-sans">
                                No matching categories or sub-items found.
                              </td>
                            </tr>
                          ) : (
                            filteredL1Items.map((item) => renderRow(item, filteredL1L2Items, 0))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="l3">
                  {!hasL3Data ? (
                    <EmptyState
                      icon={FileSpreadsheet}
                      title="L3 WBS not uploaded"
                      description="Upload L3 activity rows to enable this tab for detailed activity-level WBS."
                      actionLabel="Upload L3 WBS"
                      onAction={() => openUploadDialog('l3')}
                    />
                  ) : (
                    <Card>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm font-sans">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-3 font-semibold">WBS ID / Activity</th>
                              <th className="text-right p-3 font-semibold">Budget</th>
                              <th className="text-left p-3 font-semibold">Progress</th>
                              <th className="text-right p-3 font-semibold">Add/Remove</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredL3Items.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-muted-foreground font-sans">
                                  No matching activities found for current filter settings.
                                </td>
                              </tr>
                            ) : (
                              filteredL3Items.map((item) => renderL3Row(item))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
            </>
          )}
        </TabsContent>

        <TabsContent value="template" className="space-y-4 mt-4">
          {applyMessage && activeTab === 'template' && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">{applyMessage}</div>
          )}

          {templateLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading template...</div>
          ) : templateItems.length === 0 ? (
            <EmptyState
              icon={BookTemplate}
              title="Standard template is empty"
              description="Load the 68-item WBS format (Earth Work, RCC Work, Masonary & Plaster, … through Misc & Cleaning)."
              actionLabel={isAdmin ? 'Load Standard Data' : undefined}
              onAction={isAdmin ? () => resetTemplateMutation.mutate() : undefined}
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-semibold">WBS ID / WBS Name</th>
                      {isAdmin && <th className="text-right p-3 font-semibold w-28">Add/Remove</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {l1Template.map(item => renderTemplateRow(item, 0))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* WBS Upload Dialog */}
      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          if (!open) closeUploadDialog();
          else setShowUploadDialog(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-6xl font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload & Preview WBS
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Upload Type *</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="l1">L1 / L2 WBS</SelectItem>
                    <SelectItem value="l3">L3 WBS</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{WBS_UPLOAD_TYPES[uploadType].note}</p>
              </div>
              <div className="md:col-span-2">
                <Label>Upload Sheet *</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="mt-1"
                  onChange={async (event) => {
                    const nextFile = event.target.files?.[0] || null;
                    setUploadFile(nextFile);
                    setUploadRows([]);
                    setUploadErrors([]);
                    if (nextFile) {
                      await parseSelectedUploadFile(nextFile, uploadType);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports template columns like <span className="font-mono">WBS ID</span> and <span className="font-mono">Activity ID</span>.
                </p>
              </div>
            </div>

            {uploadErrors.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-700 mb-1">Upload warnings</p>
                <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5 max-h-24 overflow-y-auto">
                  {uploadErrors.map((message, idx) => (
                    <li key={`${message}_${idx}`}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Preview rows: <span className="font-semibold text-foreground">{uploadRows.length}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={addUploadRow}>
                  <Plus className="w-4 h-4" />
                  Add Row
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!uploadFile || parsingUpload}
                  onClick={() => parseSelectedUploadFile(uploadFile, uploadType)}
                >
                  {parsingUpload ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Refresh Preview
                </Button>
              </div>
            </div>

            {uploadRows.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-2 font-semibold min-w-[110px]">WBS ID</th>
                        <th className="text-left p-2 font-semibold min-w-[180px]">WBS Name</th>
                        <th className="text-left p-2 font-semibold min-w-[90px]">Level</th>
                        <th className="text-left p-2 font-semibold min-w-[120px]">Activity ID</th>
                        <th className="text-left p-2 font-semibold min-w-[220px]">Activity Name</th>
                        <th className="text-left p-2 font-semibold min-w-[260px]">Activity Description</th>
                        <th className="text-right p-2 font-semibold min-w-[110px]">Total Qty</th>
                        <th className="text-left p-2 font-semibold min-w-[90px]">Unit</th>
                        <th className="text-right p-2 font-semibold min-w-[120px]">Lumsum Rate</th>
                        <th className="text-right p-2 font-semibold min-w-[100px]">Total Days</th>
                        <th className="p-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadRows.map((row) => (
                        <tr
                          key={row.temp_id}
                          className={`border-t ${uploadRowIssues[row.temp_id] ? 'bg-red-50/70 border-red-200' : ''}`}
                        >
                          <td className="p-2 align-top">
                            <Input
                              value={row.code}
                              onChange={(event) => updateUploadRow(row.temp_id, 'code', event.target.value)}
                              placeholder="e.g. 1.1"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.wbs_name || ''}
                              onChange={(event) => updateUploadRow(row.temp_id, 'wbs_name', event.target.value)}
                              placeholder="WBS name"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.level_label || ''}
                              onChange={(event) => updateUploadRow(row.temp_id, 'level_label', event.target.value)}
                              placeholder="e.g. PL / L2"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.activity_id}
                              onChange={(event) => updateUploadRow(row.temp_id, 'activity_id', event.target.value)}
                              placeholder="Optional"
                            />
                            {uploadRowIssues[row.temp_id]?.map((issue) => (
                              <p key={issue} className="text-[11px] text-destructive mt-1">
                                {issue}
                              </p>
                            ))}
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.activity_name || ''}
                              onChange={(event) => updateUploadRow(row.temp_id, 'activity_name', event.target.value)}
                              placeholder="Activity name"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.activity_description || ''}
                              onChange={(event) => updateUploadRow(row.temp_id, 'activity_description', event.target.value)}
                              placeholder="Activity description"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              type="number"
                              value={row.total_qty}
                              onChange={(event) => updateUploadRow(row.temp_id, 'total_qty', event.target.value)}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={row.unit}
                              onChange={(event) => updateUploadRow(row.temp_id, 'unit', event.target.value)}
                              placeholder="m2, nos"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              type="number"
                              value={row.lumsum_rate}
                              onChange={(event) => updateUploadRow(row.temp_id, 'lumsum_rate', event.target.value)}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              type="number"
                              value={row.total_days}
                              onChange={(event) => updateUploadRow(row.temp_id, 'total_days', event.target.value)}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeUploadRow(row.temp_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={FileSpreadsheet}
                title="No preview rows"
                description="Upload an Excel/CSV file to preview, edit, and confirm WBS rows."
              />
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={closeUploadDialog}>Cancel</Button>
              <Button
                className="gap-2"
                disabled={confirmingUpload || parsingUpload || uploadRows.length === 0 || hasBlockingUploadIssues}
                onClick={handleConfirmUpload}
              >
                {confirmingUpload ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Confirm & Submit Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Project WBS Dialog */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) { setEditItem(null); setForm(defaultForm); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg font-sans">
          <DialogHeader><DialogTitle>{editItem ? 'Edit WBS Item' : 'Add WBS Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Project *</Label>
                <Select
                  value={form.project_id}
                  onValueChange={v => setForm({ ...form, project_id: v, sub_project_id: '' })}
                  disabled={!!editItem || (!!projectFilter && !!subProjectFilter)}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Sub Project *</Label>
                <Select
                  value={form.sub_project_id}
                  onValueChange={v => setForm({ ...form, sub_project_id: v })}
                  disabled={!!editItem || (!!projectFilter && !!subProjectFilter) || !form.project_id}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {formSubProjects.map(sp => (
                      <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!isReadOnlyMetaEdit ? (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Level</Label>
                  <Select value={String(form.level)} onValueChange={v => setForm({ ...form, level: parseInt(v), parent_id: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">L1 — Major Category</SelectItem>
                      <SelectItem value="2">L2 — Sub Category</SelectItem>
                      <SelectItem value="3">L3 — Work Package</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/20">
                For existing WBS items, only WBS Name and Description are editable.
              </div>
            )}
            {!isReadOnlyMetaEdit && form.level > 1 && (
              <div><Label>Parent Item</Label>
                <Select value={form.parent_id} onValueChange={v => setForm({ ...form, parent_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select parent" /></SelectTrigger>
                  <SelectContent>
                    {wbsItems.filter(w => w.level < form.level && w.project_id === form.project_id && w.sub_project_id === form.sub_project_id).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.code} — {w.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isReadOnlyMetaEdit && (
              <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-muted/20">
                <div><Label>Link Schedule Activity</Label>
                  <Select value={form.activity_id || 'none'} onValueChange={v => setForm({ ...form, activity_id: v === 'none' ? '' : v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="No linked activity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Unlink</SelectItem>
                      {activities.filter(a => !form.project_id || a.project_id === form.project_id).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.activity_id || 'ACT'} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Link Budget Item</Label>
                  <Select value={form.budget_item_id || 'none'} onValueChange={v => setForm({ ...form, budget_item_id: v === 'none' ? '' : v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="No linked budget" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Unlink</SelectItem>
                      {budgetItems.filter(b => b.level > 1 && (!form.project_id || b.project_id === form.project_id)).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.code} — {b.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {!isReadOnlyMetaEdit && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>WBS ID *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1.2" /></div>
                <div><Label>Order Index</Label><Input type="number" value={form.order_index} onChange={e => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} /></div>
              </div>
            )}
            <div><Label>WBS Name *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            {!isReadOnlyMetaEdit && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Planned Qty</Label><Input type="number" value={form.planned_quantity} onChange={e => setForm({ ...form, planned_quantity: e.target.value })} /></div>
                  <div><Label>Actual Qty</Label><Input type="number" value={form.actual_quantity} onChange={e => setForm({ ...form, actual_quantity: e.target.value })} /></div>
                  <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="m², m³, pcs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Budget (₹)</Label><Input type="number" value={form.budget_amount} onChange={e => setForm({ ...form, budget_amount: e.target.value })} /></div>
                  <div><Label>Progress (%)</Label><Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: parseFloat(e.target.value) || 0 })} /></div>
                </div>
              </>
            )}
            <Button
              className="w-full mt-2"
              disabled={isReadOnlyMetaEdit ? !form.title : (!form.project_id || !form.sub_project_id || !form.title || !form.code)}
              onClick={handleSubmit}
            >
              {editItem ? 'Update Item' : 'Add WBS Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Standard Template Dialog */}
      <Dialog open={showTemplateEdit} onOpenChange={v => { setShowTemplateEdit(v); if (!v) { setEditTemplateItem(null); setTemplateForm(defaultTemplateForm); } }}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle>{editTemplateItem ? 'Edit Standard WBS Item' : 'Add Standard WBS Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>WBS ID</Label>
                <Input value={templateForm.wbs_id} disabled={!!editTemplateItem} onChange={e => setTemplateForm({ ...templateForm, wbs_id: e.target.value })} />
              </div>
              <div>
                <Label>Level</Label>
                <Input value={`L${templateForm.level}`} disabled />
              </div>
            </div>
            {templateForm.parent_wbs_id && (
              <div>
                <Label>Parent WBS ID</Label>
                <Input value={templateForm.parent_wbs_id} disabled />
              </div>
            )}
            <div>
              <Label>WBS Name *</Label>
              <Input value={templateForm.title} onChange={e => setTemplateForm({ ...templateForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={templateForm.description || ''} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} rows={2} />
            </div>
            <Button className="w-full" disabled={!templateForm.wbs_id || !templateForm.title} onClick={handleTemplateSubmit}>
              {editTemplateItem ? 'Save Changes' : 'Add to Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
