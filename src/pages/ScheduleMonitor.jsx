import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { toast } from "@/components/ui/use-toast";
import StatusBadge from '@/components/shared/StatusBadge';
import { 
  ChevronDown, 
  ChevronRight, 
  Play, 
  Check, 
  Calendar, 
  AlertTriangle, 
  Search, 
  Layers, 
  Plus, 
  Maximize2, 
  Minimize2, 
  LayoutGrid, 
  Columns, 
  ArrowRight,
  CloudSun
} from 'lucide-react';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';
import {
  filterActivitiesBySubProject,
  filterBudgetBySubProject,
  filterProgressBySubProject,
  filterWbsBySubProject,
} from '@/lib/subProjectScope';

const BUDGET_HEADS = [
  { code: '01-PRE', title: 'Preliminaries & Site Setup' },
  { code: '02-EXC', title: 'Excavation & Earthworks' },
  { code: '03-SUB', title: 'Substructure & Foundation' },
  { code: '04-SUP', title: 'Superstructure RCC Frame' },
  { code: '05-MAS', title: 'Masonry & Partition Walls' },
  { code: '06-WPF', title: 'Waterproofing & Insulation' },
  { code: '07-PLT', title: 'Internal Plastering' },
  { code: '08-FLR', title: 'Tiling & Flooring' },
  { code: '09-DW',  title: 'Doors, Windows & Glazing' },
  { code: '10-ELE', title: 'Electrical Systems' },
  { code: '11-PLU', title: 'Plumbing & Sanitary' },
  { code: '12-MEC', title: 'HVAC & Ventilation' },
  { code: '13-FF',  title: 'Fire Fighting & Alarms' },
  { code: '14-PNT', title: 'Wall Painting & Finishes' },
  { code: '15-LND', title: 'Roadworks & Landscaping' },
  { code: '16-MIS', title: 'Contingencies & Miscellaneous' }
];

function dateRangeArray(start, end) {
  const a = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) a.push(new Date(d).toISOString().split('T')[0]);
  return a;
}

export default function ScheduleMonitor() {
  const queryClient = useQueryClient();
  const {
    projects, subProjects, projectId, subProjectId, setProjectId, setSubProjectId,
    isReady, selectedProject, selectedSubProject,
  } = useProjectSubProject({ fetchWbs: false });

  // Queries
  const { data: activities = [] } = useQuery({ queryKey: ['activities-monitor'], queryFn: () => base44.entities.ScheduleActivity.list('order_index', 1000) });
  const { data: progressEntries = [] } = useQuery({ queryKey: ['progress-entries'], queryFn: () => base44.entities.ProgressEntry.list('-date', 1000) });
  const { data: budgetItems = [] } = useQuery({ queryKey: ['budget-items'], queryFn: () => base44.entities.BudgetItem.list('code', 1000) });
  const { data: wbsItems = [] } = useQuery({ queryKey: ['wbs-items'], queryFn: () => base44.entities.WBSItem.list('order_index', 1000) });
  const { data: scheduleTasks = [] } = useQuery({ queryKey: ['schedule-tasks'], queryFn: () => base44.entities.ScheduleTask.list('order_index', 1000) });

  // States
  const [kanbanGrouping, setKanbanGrouping] = React.useState('status'); // 'status' | 'phase'
  const [timelineZoom, setTimelineZoom] = React.useState('weeks'); // 'days' | 'weeks' | 'months'
  const [viewMode, setViewMode] = React.useState('split'); // 'table' | 'split' | 'timeline'
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showCriticalOnly, setShowCriticalOnly] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState({});
  const [selectedBudgetHeadId, setSelectedBudgetHeadId] = React.useState(null); // Selected master item
  const [selectedItem, setSelectedItem] = React.useState(null); // Drawer details item
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // Scroll Refs (Vertical Scroll sync inside Master & Detail)
  const masterLeftScrollRef = React.useRef(null);
  const masterRightScrollRef = React.useRef(null);
  const detailLeftScrollRef = React.useRef(null);
  const detailRightScrollRef = React.useRef(null);

  const isSyncingMasterLeft = React.useRef(false);
  const isSyncingMasterRight = React.useRef(false);
  const isSyncingDetailLeft = React.useRef(false);
  const isSyncingDetailRight = React.useRef(false);

  // Progress Logging Form State
  const [logForm, setLogForm] = React.useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    qty: '',
    labor: '',
    weather: 'Sunny',
    issues: ''
  });

  const today = new Date().toISOString().split('T')[0];

  // Mutations
  const updateActivityMutation = useMutation({ 
    mutationFn: ({ id, data }) => base44.entities.ScheduleActivity.update(id, data), 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities-monitor'] });
      toast({ title: "Activity Updated", description: "The activity status has been updated successfully." });
    } 
  });

  const updateTaskMutation = useMutation({ 
    mutationFn: ({ id, data }) => base44.entities.ScheduleTask.update(id, data), 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
      toast({ title: "Task Updated", description: "The sub-task status has been updated." });
    } 
  });

  const createProgressMutation = useMutation({
    mutationFn: (data) => base44.entities.ProgressEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-entries'] });
      queryClient.invalidateQueries({ queryKey: ['activities-monitor'] });
      toast({ title: "Progress Logged", description: "Daily progress report has been filed and activity progress updated." });
      setLogForm({ date: new Date().toISOString().split('T')[0], description: '', qty: '', labor: '', weather: 'Sunny', issues: '' });
      setIsDrawerOpen(false);
    }
  });

  // Map budget_item_id -> budget item
  const budgetMap = React.useMemo(() => {
    const m = {};
    (budgetItems || []).forEach(b => { m[b.id] = b; });
    return m;
  }, [budgetItems]);

  // Group progress entries by wbs_item (via budgetItem -> wbs_item_id)
  const progressByWbs = React.useMemo(() => {
    const map = {};
    (progressEntries || []).forEach(e => {
      const b = budgetMap[e.budget_item_id];
      const wbs = b ? b.wbs_item_id : null;
      const key = e.wbs_item_id || wbs || e.project_id || 'global';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [progressEntries, budgetMap]);

  const computeExpectedProgress = (act) => {
    if (!act.planned_start || !act.planned_end) return 0;
    const start = new Date(act.planned_start);
    const end = new Date(act.planned_end);
    const total = (end - start) / (1000*60*60*24) + 1;
    const elapsed = (new Date(today) - start) / (1000*60*60*24) + 1;
    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  };

  // Derive activity-level metrics from progress reports and optionally persist
  React.useEffect(() => {
    if (!activities || activities.length === 0) return;
    activities.forEach(act => {
      const related = progressByWbs[act.wbs_item_id] || [];
      if (related.length === 0) return;
      const uniqueDates = [...new Set(related.map(r => r.date))];
      const activeDays = uniqueDates.length;
      const duration = Math.max(1, act.duration_days || 1);
      const derivedProgress = Math.min(100, Math.round((activeDays / duration) * 100));

      const earliest = related.reduce((m, r) => (!m || r.date < m) ? r.date : m, null);
      const latest = related.reduce((m, r) => (!m || r.date > m) ? r.date : m, null);

      const expected = computeExpectedProgress(act);
      let computedStatus = act.status;
      if (derivedProgress >= 100) computedStatus = 'completed';
      else if (earliest && (!act.actual_start || act.actual_start === null) && earliest <= today) computedStatus = 'in_progress';
      else if (latest && act.planned_end && latest > act.planned_end && derivedProgress < expected) computedStatus = 'delayed';

      // Persist only when meaningful changes detected (status changed or progress increased by >=5)
      const progressDelta = (derivedProgress || 0) - (act.progress || 0);
      if (computedStatus !== act.status || progressDelta >= 5) {
        const update = {};
        if (computedStatus !== act.status) update.status = computedStatus;
        if (progressDelta >= 1) update.progress = Math.max(act.progress || 0, derivedProgress);
        if (earliest && (!act.actual_start || act.actual_start === null)) update.actual_start = earliest;
        if (computedStatus === 'completed' && (!act.actual_end || act.actual_end === null)) update.actual_end = latest || today;
        if (Object.keys(update).length > 0) {
          updateActivityMutation.mutate({ id: act.id, data: update });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, progressByWbs, today]);

  // Project + sub-project scoped data
  const projectWbsAll = React.useMemo(
    () => wbsItems.filter((w) => !projectId || w.project_id === projectId),
    [wbsItems, projectId]
  );

  const projectWbsItems = React.useMemo(
    () => (isReady ? filterWbsBySubProject(projectWbsAll, subProjectId) : []),
    [projectWbsAll, subProjectId, isReady]
  );

  const projectBudgetAll = React.useMemo(
    () => budgetItems.filter((b) => !projectId || b.project_id === projectId),
    [budgetItems, projectId]
  );

  const projectBudgetItems = React.useMemo(
    () => (isReady ? filterBudgetBySubProject(projectBudgetAll, projectWbsAll, subProjectId) : []),
    [projectBudgetAll, projectWbsAll, subProjectId, isReady]
  );

  const projectActivities = React.useMemo(
    () => (isReady ? filterActivitiesBySubProject(
      activities.filter((a) => !projectId || a.project_id === projectId),
      projectWbsAll,
      subProjectId
    ) : []),
    [activities, projectId, projectWbsAll, subProjectId, isReady]
  );

  const projectTasks = React.useMemo(
    () => scheduleTasks.filter((t) => !projectId || t.project_id === projectId),
    [scheduleTasks, projectId]
  );

  const projectProgressEntries = React.useMemo(
    () => (isReady ? filterProgressBySubProject(
      progressEntries.filter((p) => !projectId || p.project_id === projectId),
      projectBudgetAll,
      projectWbsAll,
      subProjectId
    ) : []),
    [progressEntries, projectId, projectBudgetAll, projectWbsAll, subProjectId, isReady]
  );

  // Dynamic Tree Grid Construction
  const treeData = React.useMemo(() => {
    let heads = projectBudgetItems.filter(b => b.level === 1 || !b.parent_id);
    if (heads.length === 0) {
      heads = BUDGET_HEADS.map((h, i) => ({
        id: `temp_bud_${i+1}`,
        code: h.code,
        title: h.title,
        level: 1,
        original_budget: 0
      }));
    }
    heads = [...heads].sort((a,b) => (a.code || '').localeCompare(b.code || ''));

    const findBudgetHeadParent = (budItem) => {
      if (budItem.level === 1) return budItem;
      if (budItem.parent_id) {
        const parent = projectBudgetItems.find(b => b.id === budItem.parent_id);
        if (parent) return findBudgetHeadParent(parent);
      }
      const prefix = budItem.code ? budItem.code.split('-')[0] : '';
      if (prefix) {
        const head = heads.find(h => h.code && h.code.startsWith(prefix));
        if (head) return head;
      }
      return null;
    };

    const findHeuristicBudgetHead = (act) => {
      const name = (act.name || '').toLowerCase();
      const phase = (act.phase || '').toLowerCase();
      const getHeadByCode = (code) => heads.find(h => h.code === code) || heads[0];

      if (phase === 'foundation') {
        if (name.includes('mobil') || name.includes('setup')) return getHeadByCode('01-PRE').id;
        if (name.includes('excav') || name.includes('shor') || name.includes('earth')) return getHeadByCode('02-EXC').id;
        return getHeadByCode('03-SUB').id;
      }
      if (phase === 'structure') return getHeadByCode('04-SUP').id;
      if (phase === 'mep') {
        if (name.includes('elect') || name.includes('conduit') || name.includes('wire')) return getHeadByCode('10-ELE').id;
        if (name.includes('plumb') || name.includes('pipe') || name.includes('drain')) return getHeadByCode('11-PLU').id;
        if (name.includes('hvac') || name.includes('duct') || name.includes('vent')) return getHeadByCode('12-MEC').id;
        if (name.includes('fire') || name.includes('alarm')) return getHeadByCode('13-FF').id;
        return getHeadByCode('10-ELE').id;
      }
      if (phase === 'finishing') {
        if (name.includes('facade') || name.includes('glaz') || name.includes('curtain')) return getHeadByCode('09-DW').id;
        if (name.includes('drywall') || name.includes('gyp') || name.includes('partition')) return getHeadByCode('05-MAS').id;
        if (name.includes('plaster')) return getHeadByCode('07-PLT').id;
        if (name.includes('tile') || name.includes('floor')) return getHeadByCode('08-FLR').id;
        if (name.includes('paint') || name.includes('finish')) return getHeadByCode('14-PNT').id;
        return getHeadByCode('08-FLR').id;
      }
      if (phase === 'handover') {
        if (name.includes('landscap') || name.includes('road')) return getHeadByCode('15-LND').id;
        return getHeadByCode('16-MIS').id;
      }
      return getHeadByCode('16-MIS').id;
    };

    const getBudgetHeadId = (act) => {
      if (!act.wbs_item_id) return findHeuristicBudgetHead(act);
      const directBud = projectBudgetItems.find(b => b.wbs_item_id === act.wbs_item_id);
      if (directBud) {
        const pHead = findBudgetHeadParent(directBud);
        if (pHead) return pHead.id;
      }
      const wbsItem = projectWbsItems.find(w => w.id === act.wbs_item_id);
      if (wbsItem && wbsItem.parent_id) {
        const parentBud = projectBudgetItems.find(b => b.wbs_item_id === wbsItem.parent_id);
        if (parentBud) {
          const pHead = findBudgetHeadParent(parentBud);
          if (pHead) return pHead.id;
        }
      }
      return findHeuristicBudgetHead(act);
    };

    const headActivitiesMap = {};
    heads.forEach(h => { headActivitiesMap[h.id] = []; });

    projectActivities.forEach(act => {
      const headId = getBudgetHeadId(act);
      if (headActivitiesMap[headId]) {
        headActivitiesMap[headId].push(act);
      } else {
        const misHead = heads.find(h => h.code === '16-MIS') || heads[heads.length - 1];
        if (misHead && headActivitiesMap[misHead.id]) {
          headActivitiesMap[misHead.id].push(act);
        }
      }
    });

    return heads.map(head => {
      const acts = headActivitiesMap[head.id] || [];
      const mappedActivities = acts
        .filter(act => {
          if (showCriticalOnly && !act.is_critical_path) return false;
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (act.name || '').toLowerCase().includes(q) || (act.activity_id || '').toLowerCase().includes(q);
          }
          return true;
        })
        .map(act => {
          const relatedTasks = projectTasks.filter(t => {
            const tName = (t.name || '').toLowerCase();
            const aName = (act.name || '').toLowerCase();
            return tName === aName || aName.includes(tName) || tName.includes(aName);
          });

          const relatedProgress = projectProgressEntries.filter(e => {
            if (e.wbs_item_id && act.wbs_item_id && e.wbs_item_id === act.wbs_item_id) return true;
            if (e.activity_id && e.activity_id === act.id) return true;
            const bItem = projectBudgetItems.find(b => b.id === e.budget_item_id);
            return bItem && bItem.wbs_item_id && act.wbs_item_id && bItem.wbs_item_id === act.wbs_item_id;
          });

          return {
            ...act,
            type: 'activity',
            level: 2,
            tasks: relatedTasks.map(t => ({ ...t, type: 'task', level: 3 })),
            progressEntries: relatedProgress.map(p => ({ ...p, type: 'progress_log', level: 4 }))
          };
        });

      const starts = mappedActivities.map(a => a.planned_start).filter(Boolean);
      const ends = mappedActivities.map(a => a.planned_end).filter(Boolean);
      const minStart = starts.length > 0 ? starts.sort()[0] : null;
      const maxEnd = ends.length > 0 ? ends.sort().reverse()[0] : null;
      const totalProg = mappedActivities.reduce((s, a) => s + (a.progress || 0), 0);
      const avgProg = mappedActivities.length > 0 ? Math.round(totalProg / mappedActivities.length) : 0;

      return {
        ...head,
        type: 'budget_head',
        level: 1,
        planned_start: minStart,
        planned_end: maxEnd,
        progress: avgProg,
        activities: mappedActivities
      };
    });
  }, [projectBudgetItems, projectActivities, projectWbsItems, projectTasks, projectProgressEntries, searchQuery, showCriticalOnly]);

  // Default selection for master-detail
  React.useEffect(() => {
    if (treeData.length > 0 && !selectedBudgetHeadId) {
      const activeHead = treeData.find(h => h.activities.length > 0) || treeData[0];
      setSelectedBudgetHeadId(activeHead.id);
    }
  }, [treeData, selectedBudgetHeadId]);

  // Master Rows (Executive Overview: always exactly 16 budget heads)
  const masterRows = React.useMemo(() => {
    return treeData.map(head => ({
      id: head.id,
      item: head,
      type: 'budget_head',
      level: 1,
      code: head.code,
      name: head.title,
      status: head.progress >= 100 ? 'completed' : head.progress > 0 ? 'in_progress' : 'not_started',
      progress: head.progress,
      start_date: head.planned_start,
      end_date: head.planned_end,
      hasActivities: head.activities.length > 0
    }));
  }, [treeData]);

  // Detail Rows (Underlying Activities/Tasks for the Selected Head Only)
  const detailRows = React.useMemo(() => {
    if (!selectedBudgetHeadId) return [];
    const selectedHead = treeData.find(h => h.id === selectedBudgetHeadId);
    if (!selectedHead) return [];

    const rows = [];
    selectedHead.activities.forEach(act => {
      rows.push({
        id: act.id,
        item: act,
        type: 'activity',
        level: 2,
        code: act.activity_id,
        name: act.name,
        status: act.status,
        progress: act.progress,
        start_date: act.planned_start,
        end_date: act.planned_end,
        is_critical_path: act.is_critical_path,
        hasChildren: act.tasks.length > 0 || act.progressEntries.length > 0
      });

      if (expandedRows[act.id]) {
        act.tasks.forEach(task => {
          rows.push({
            id: task.id,
            item: task,
            type: 'task',
            level: 3,
            code: `T-${task.order_index + 1}`,
            name: task.name,
            status: task.status,
            progress: task.progress,
            start_date: task.start_date,
            end_date: task.end_date,
            is_critical_path: task.is_critical_path,
            hasChildren: false
          });
        });

        act.progressEntries.forEach(log => {
          rows.push({
            id: log.id,
            item: log,
            type: 'progress_log',
            level: 4,
            code: 'LOG',
            name: `${log.date}: ${log.work_done_description}`,
            status: 'completed',
            progress: 100,
            start_date: log.date,
            end_date: log.date,
            hasChildren: false
          });
        });
      }
    });
    return rows;
  }, [treeData, selectedBudgetHeadId, expandedRows]);

  // Gantt Scale date span boundaries (Shared by both Master and Detail)
  const { minDate, datesList, pxPerDay } = React.useMemo(() => {
    const allDates = projectActivities.flatMap(a => [a.planned_start, a.planned_end]).filter(Boolean);
    let startDt = allDates.length > 0 ? new Date(allDates.sort()[0]) : new Date(today);
    let endDt = allDates.length > 0 ? new Date(allDates.sort().reverse()[0]) : new Date(today);

    // Apply padding buffers
    startDt.setDate(startDt.getDate() - 10);
    endDt.setDate(endDt.getDate() + 30);

    const dates = dateRangeArray(startDt.toISOString().split('T')[0], endDt.toISOString().split('T')[0]);
    let dayWidth = 12; // default 'weeks' scale
    if (timelineZoom === 'days') dayWidth = 32;
    else if (timelineZoom === 'months') dayWidth = 4;

    return {
      minDate: startDt,
      datesList: dates,
      pxPerDay: dayWidth
    };
  }, [projectActivities, timelineZoom, today]);

  // Master Vertical Scroll Sync
  React.useEffect(() => {
    const left = masterLeftScrollRef.current;
    const right = masterRightScrollRef.current;
    if (!left || !right) return;

    const syncRight = () => {
      if (isSyncingMasterRight.current) { isSyncingMasterRight.current = false; return; }
      isSyncingMasterLeft.current = true;
      right.scrollTop = left.scrollTop;
    };
    const syncLeft = () => {
      if (isSyncingMasterLeft.current) { isSyncingMasterLeft.current = false; return; }
      isSyncingMasterRight.current = true;
      left.scrollTop = right.scrollTop;
    };

    left.addEventListener('scroll', syncRight);
    right.addEventListener('scroll', syncLeft);
    return () => {
      left.removeEventListener('scroll', syncRight);
      right.removeEventListener('scroll', syncLeft);
    };
  }, [viewMode]);

  // Detail Vertical Scroll Sync
  React.useEffect(() => {
    const left = detailLeftScrollRef.current;
    const right = detailRightScrollRef.current;
    if (!left || !right) return;

    const syncRight = () => {
      if (isSyncingDetailRight.current) { isSyncingDetailRight.current = false; return; }
      isSyncingDetailLeft.current = true;
      right.scrollTop = left.scrollTop;
    };
    const syncLeft = () => {
      if (isSyncingDetailLeft.current) { isSyncingDetailLeft.current = false; return; }
      isSyncingDetailRight.current = true;
      left.scrollTop = right.scrollTop;
    };

    left.addEventListener('scroll', syncRight);
    right.addEventListener('scroll', syncLeft);
    return () => {
      left.removeEventListener('scroll', syncRight);
      right.removeEventListener('scroll', syncLeft);
    };
  }, [viewMode, selectedBudgetHeadId]);

  // Horizontal Scroll Sync between Master and Detail timelines
  React.useEffect(() => {
    const mRight = masterRightScrollRef.current;
    const dRight = detailRightScrollRef.current;
    if (!mRight || !dRight) return;

    const syncDetailH = () => {
      dRight.scrollLeft = mRight.scrollLeft;
    };
    const syncMasterH = () => {
      mRight.scrollLeft = dRight.scrollLeft;
    };

    mRight.addEventListener('scroll', syncDetailH);
    dRight.addEventListener('scroll', syncMasterH);
    return () => {
      mRight.removeEventListener('scroll', syncDetailH);
      dRight.removeEventListener('scroll', syncMasterH);
    };
  }, [viewMode, selectedBudgetHeadId]);

  // Toggle detail rows helper
  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAllDetails = () => {
    const newExpanded = {};
    if (!selectedBudgetHeadId) return;
    const selectedHead = treeData.find(h => h.id === selectedBudgetHeadId);
    if (selectedHead) {
      selectedHead.activities.forEach(act => {
        newExpanded[act.id] = true;
      });
    }
    setExpandedRows(newExpanded);
  };

  const handleCollapseAllDetails = () => {
    setExpandedRows({});
  };

  // Open Details Drawer
  const openDetails = (row) => {
    setSelectedItem(row);
    const matchingBud = projectBudgetItems.find(b => b.wbs_item_id === row.item.wbs_item_id) || 
                       projectBudgetItems.find(b => b.id === row.item.budget_item_id);
    const parentHead = treeData.find(h => h.id === row.id) || 
                       treeData.find(h => h.activities.some(a => a.id === row.id));

    setLogForm(prev => ({
      ...prev,
      description: '',
      qty: '',
      labor: '',
      weather: 'Sunny',
      issues: '',
      budgetItem: matchingBud,
      budgetHead: parentHead
    }));
    setIsDrawerOpen(true);
  };

  // Submit Daily Log Progress
  const submitDailyLog = () => {
    if (!logForm.description) {
      toast({ title: "Validation Error", description: "Please provide a description of the work performed.", variant: "destructive" });
      return;
    }

    const payload = {
      project_id: projectId,
      budget_item_id: logForm.budgetItem?.id || logForm.budgetHead?.id || '',
      wbs_item_id: selectedItem?.item.wbs_item_id || '',
      activity_id: selectedItem?.id,
      date: logForm.date,
      report_type: 'daily',
      submitted_by: 'Supervisor',
      work_done_description: logForm.description,
      quantity_done: parseFloat(logForm.qty) || 0,
      unit: selectedItem?.item.unit || 'm3',
      labor_count: parseInt(logForm.labor) || 0,
      weather_condition: logForm.weather,
      issues_reported: logForm.issues || 'None.',
      status: 'approved',
      value_of_work_done: (parseFloat(logForm.qty) || 0) * (logForm.budgetItem?.cost_per_unit || 0)
    };

    createProgressMutation.mutate(payload);
  };

  // Render Kanban Data
  const kanbanColumns = React.useMemo(() => {
    if (kanbanGrouping === 'status') {
      const states = [
        { id: 'not_started', title: 'Not Started', color: 'border-t-slate-400 bg-slate-50/50' },
        { id: 'in_progress', title: 'In Progress', color: 'border-t-blue-500 bg-blue-50/20' },
        { id: 'delayed', title: 'Delayed', color: 'border-t-rose-500 bg-rose-50/20' },
        { id: 'completed', title: 'Completed', color: 'border-t-emerald-500 bg-emerald-50/20' }
      ];
      return states.map(col => ({
        ...col,
        items: projectActivities.filter(a => a.status === col.id || (col.id === 'not_started' && !a.status))
      }));
    } else {
      const phasesList = [
        { id: 'foundation', title: 'Foundation', color: 'border-t-amber-500 bg-amber-50/10' },
        { id: 'structure', title: 'Structure & Framing', color: 'border-t-indigo-500 bg-indigo-50/10' },
        { id: 'mep', title: 'MEP Services', color: 'border-t-sky-500 bg-sky-50/10' },
        { id: 'finishing', title: 'Interior & Exterior Finishes', color: 'border-t-teal-500 bg-teal-50/10' },
        { id: 'handover', title: 'Handover & Closeout', color: 'border-t-emerald-500 bg-emerald-50/10' },
        { id: 'other', title: 'Other/Misc', color: 'border-t-slate-400 bg-slate-50/10' }
      ];
      return phasesList.map(col => ({
        ...col,
        items: projectActivities.filter(a => a.phase === col.id)
      }));
    }
  }, [projectActivities, kanbanGrouping]);

  const selectedHeadName = React.useMemo(() => {
    return BUDGET_HEADS.find(h => h.code === selectedBudgetHeadId?.split('_')[2]?.toUpperCase())?.title || 
           treeData.find(h => h.id === selectedBudgetHeadId)?.title || "Selected Head";
  }, [selectedBudgetHeadId, treeData]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-1">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 to-transparent p-6 rounded-xl border border-primary/10">
        <div>
          <h1 className="text-3xl font-heading font-black tracking-tight text-primary">Schedule Monitoring Console</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">MS Project interactive Gantt timeline & status Kanban dashboards.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <ProjectSubProjectSelector
            projects={projects}
            subProjects={subProjects}
            projectId={projectId}
            subProjectId={subProjectId}
            onProjectChange={setProjectId}
            onSubProjectChange={setSubProjectId}
          />
        </div>
      </div>

      {isReady && selectedProject && selectedSubProject && (
        <p className="text-sm text-muted-foreground px-1">
          Monitoring <span className="font-medium text-foreground">{selectedProject.name}</span>
          {' → '}
          <span className="font-medium text-foreground">{selectedSubProject.name}</span>
        </p>
      )}

      <SubProjectGate projectId={projectId} subProjectId={subProjectId} subProjects={subProjects}>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <div className="flex items-center justify-between border-b pb-1">
          <TabsList className="bg-muted/50 p-1 rounded-lg border">
            <TabsTrigger value="timeline" className="font-semibold text-sm flex items-center gap-1.5 px-4"><Layers className="w-4 h-4" /> Timeline View</TabsTrigger>
            <TabsTrigger value="kanban" className="font-semibold text-sm flex items-center gap-1.5 px-4"><LayoutGrid className="w-4 h-4" /> Kanban Status Board</TabsTrigger>
          </TabsList>

          {/* Quick Stats Banner */}
          <div className="hidden lg:flex items-center gap-6 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Completed: {projectActivities.filter(a => a.status === 'completed').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Active: {projectActivities.filter(a => a.status === 'in_progress').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Delayed: {projectActivities.filter(a => a.status === 'delayed').length}</span>
            </div>
          </div>
        </div>

        {/* --- TIMELINE VIEW --- */}
        <TabsContent value="timeline" className="space-y-4 outline-none">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-card/60 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search activities..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 w-60 h-9 text-xs bg-background/50 border-muted-foreground/20 focus-visible:ring-primary/20"
                />
              </div>
              <Button 
                variant={showCriticalOnly ? "destructive" : "outline"} 
                size="sm"
                onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                className="h-9 font-semibold text-xs transition-all"
              >
                {showCriticalOnly ? "Showing Critical Path" : "Highlight Critical Path"}
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {/* Expand / Collapse Actions for Detail View */}
              <div className="flex border rounded-lg overflow-hidden bg-background">
                <Button variant="ghost" size="sm" onClick={handleExpandAllDetails} className="h-8 text-[11px] font-semibold border-r rounded-none px-3">Expand Detail</Button>
                <Button variant="ghost" size="sm" onClick={handleCollapseAllDetails} className="h-8 text-[11px] font-semibold rounded-none px-3">Collapse Detail</Button>
              </div>

              {/* View Layout Controls */}
              <div className="flex items-center border rounded-lg bg-background p-0.5">
                <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('table')} title="Grid Only">
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant={viewMode === 'split' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('split')} title="Split Pane">
                  <Columns className="w-3.5 h-3.5" />
                </Button>
                <Button variant={viewMode === 'timeline' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('timeline')} title="Gantt Only">
                  <Minimize2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Zoom Scales */}
              <div className="flex items-center border rounded-lg bg-background p-0.5">
                {['days', 'weeks', 'months'].map(scale => (
                  <Button 
                    key={scale}
                    variant={timelineZoom === scale ? 'secondary' : 'ghost'} 
                    size="sm"
                    className="h-7 text-[10px] font-bold capitalize px-3"
                    onClick={() => setTimelineZoom(scale)}
                  >
                    {scale}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            
            {/* MASTER: Executive Overview (The 16 Budget Heads) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 pl-1">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Executive Overview (16 Budget Heads)</h2>
              </div>
              <Card className="overflow-hidden border shadow-md">
                <div className="flex h-[200px] relative bg-card">
                  
                  {/* Master Grid Table */}
                  {(viewMode === 'split' || viewMode === 'table') && (
                    <div 
                      ref={masterLeftScrollRef}
                      className={`overflow-y-auto border-r scrollbar-thin select-none ${viewMode === 'table' ? 'w-full' : 'w-[45%]'}`}
                      style={{ height: '100%' }}
                    >
                      {/* Master Header */}
                      <div className="flex sticky top-0 bg-muted/95 backdrop-blur z-20 border-b font-semibold text-xs text-muted-foreground uppercase h-8 items-center">
                        <div className="flex-1 pl-4">Budget Head</div>
                        <div className="w-20 text-center">Progress</div>
                        <div className="w-24 pr-4 text-right">Details</div>
                      </div>

                      {/* Master Rows */}
                      <div className="divide-y">
                        {masterRows.map((row, idx) => {
                          const isSelected = row.id === selectedBudgetHeadId;
                          return (
                            <div 
                              key={`${row.id}-${idx}`}
                              onClick={() => setSelectedBudgetHeadId(row.id)}
                              className={`flex h-10 items-center cursor-pointer hover:bg-muted/30 transition-colors text-xs font-semibold ${
                                isSelected ? 'bg-primary/5 border-l-4 border-l-primary font-bold' : ''
                              }`}
                            >
                              <div className="flex-1 pl-4 flex items-center gap-2 truncate">
                                <span className="font-mono text-[10px] text-muted-foreground">{row.code}</span>
                                <span className="truncate">{row.name}</span>
                              </div>
                              <div className="w-20 flex justify-center font-mono font-bold text-muted-foreground">{row.progress}%</div>
                              <div className="w-24 pr-4 text-right">
                                <span className="text-[10px] font-bold text-primary/70">{row.item.activities.length} Acts</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Master Timeline Panel */}
                  {(viewMode === 'split' || viewMode === 'timeline') && (
                    <div 
                      ref={masterRightScrollRef}
                      className="overflow-auto flex-1 select-none scrollbar-thin relative bg-muted/5"
                      style={{ height: '100%' }}
                    >
                      {/* Master Gantt Header */}
                      <div className="sticky top-0 z-20 border-b bg-muted/95 backdrop-blur h-8 flex flex-col justify-center text-[9px] text-muted-foreground font-mono" style={{ width: datesList.length * pxPerDay }}>
                        <div className="flex h-full relative">
                          {datesList.filter((_, idx) => idx % 30 === 0).map((d, idx) => (
                            <div 
                              key={idx} 
                              className="absolute border-r pl-2 h-full flex items-center font-bold" 
                              style={{ left: idx * 30 * pxPerDay }}
                            >
                              {new Date(d).toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Master Gantt Rows */}
                      <div className="relative divide-y" style={{ width: datesList.length * pxPerDay }}>
                        {/* Background Grid */}
                        <div className="absolute inset-y-0 left-0 flex pointer-events-none z-0">
                          {datesList.map((d, idx) => {
                            const isMon = new Date(d).getDay() === 1;
                            if (timelineZoom === 'days' || (timelineZoom === 'weeks' && isMon)) {
                              return <div key={idx} className="border-r h-full border-muted/20" style={{ width: pxPerDay }} />;
                            }
                            return <div key={idx} style={{ width: pxPerDay }} />;
                          })}
                        </div>

                        {/* Summary bars */}
                        {masterRows.map((row, idx) => {
                          const isSelected = row.id === selectedBudgetHeadId;
                          if (!row.start_date || !row.end_date) {
                            return <div key={`master-gantt-empty-${idx}`} className="h-10" />;
                          }

                          const startIdx = Math.max(0, datesList.indexOf(row.start_date));
                          const endIdx = Math.max(0, datesList.indexOf(row.end_date));
                          const duration = Math.max(1, (endIdx - startIdx) + 1);

                          const left = startIdx * pxPerDay;
                          const width = duration * pxPerDay;

                          return (
                            <div 
                              key={`master-gantt-row-${idx}`} 
                              onClick={() => setSelectedBudgetHeadId(row.id)}
                              className="h-10 relative flex items-center z-10 cursor-pointer"
                            >
                              <div 
                                className={`absolute h-3.5 bg-slate-700/60 rounded transition-all ${
                                  isSelected ? 'ring-2 ring-primary ring-offset-1 shadow' : ''
                                }`}
                                style={{ left, width }}
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-950 rounded-l" />
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-slate-950 rounded-r" />
                                <div className="h-full bg-slate-950/50 rounded-l" style={{ width: `${row.progress || 0}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </Card>
            </div>

            {/* DETAIL: Drilling-down Schedule Gantt Timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                  <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-wider">
                    Detailed Timeline: <span className="text-foreground capitalize">{selectedHeadName}</span>
                  </h2>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Rows: {detailRows.filter(r => r.level === 2).length} activities · {detailRows.filter(r => r.level === 3).length} sub-tasks
                </div>
              </div>

              <Card className="overflow-hidden border shadow-lg">
                <div className="flex h-[320px] relative bg-card">
                  
                  {/* Detail Grid Table */}
                  {(viewMode === 'split' || viewMode === 'table') && (
                    <div 
                      ref={detailLeftScrollRef}
                      className={`overflow-y-auto border-r scrollbar-thin select-none ${viewMode === 'table' ? 'w-full' : 'w-[45%]'}`}
                      style={{ height: '100%' }}
                    >
                      {/* Detail Header */}
                      <div className="flex sticky top-0 bg-muted/95 backdrop-blur z-20 border-b font-semibold text-xs text-muted-foreground uppercase h-8 items-center">
                        <div className="flex-1 pl-4">Task Name / ID</div>
                        <div className="w-20 text-center">Status</div>
                        <div className="w-20 text-center">Progress</div>
                        <div className="w-20 pr-4 text-right">Action</div>
                      </div>

                      {/* Detail Rows */}
                      <div className="divide-y">
                        {detailRows.map((row, idx) => {
                          const isExpanded = expandedRows[row.id];
                          const paddingLeft = (row.level - 2) * 20 + 16;

                          return (
                            <div 
                              key={`${row.id}-${idx}`}
                              className={`flex h-10 items-center hover:bg-muted/30 transition-colors text-xs ${
                                row.item.is_critical_path ? 'bg-rose-50/20 hover:bg-rose-50/30' : ''
                              }`}
                            >
                              <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: `${paddingLeft}px` }}>
                                {row.hasChildren ? (
                                  <button 
                                    onClick={() => toggleRow(row.id)}
                                    className="mr-1.5 p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
                                  >
                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                ) : (
                                  <div className="w-4" />
                                )}
                                <span className="font-mono text-[10px] text-muted-foreground mr-1.5 shrink-0">{row.code}</span>
                                <span className={`truncate ${row.level === 2 ? 'font-semibold text-foreground' : 'text-muted-foreground text-[11px]'}`}>{row.name}</span>
                              </div>

                              <div className="w-20 flex justify-center shrink-0">
                                {row.level !== 4 && <StatusBadge status={row.status} className="text-[9px] scale-90" />}
                              </div>

                              <div className="w-20 flex items-center gap-1 shrink-0 pr-2">
                                {row.level !== 4 && (
                                  <>
                                    <div className="w-full h-1 bg-muted rounded overflow-hidden">
                                      <div className="h-full bg-primary rounded" style={{ width: `${row.progress || 0}%` }} />
                                    </div>
                                    <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">{row.progress || 0}%</span>
                                  </>
                                )}
                              </div>

                              <div className="w-20 pr-4 flex justify-end shrink-0">
                                {row.level === 2 && (
                                  <Button 
                                    variant="ghost" 
                                    size="xs"
                                    onClick={() => openDetails(row)}
                                    className="h-6 text-[10px] font-bold text-primary flex items-center gap-0.5 hover:bg-primary/5"
                                  >
                                    Manage <ArrowRight className="w-2.5 h-2.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {detailRows.length === 0 && (
                          <div className="text-center py-16 text-xs text-muted-foreground font-semibold">
                            No activities mapped to this budget head. Click another head above to view.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detail Gantt Chart Pane */}
                  {(viewMode === 'split' || viewMode === 'timeline') && (
                    <div 
                      ref={detailRightScrollRef}
                      className="overflow-auto flex-1 select-none scrollbar-thin relative bg-muted/5"
                      style={{ height: '100%' }}
                    >
                      {/* Detail Gantt Header */}
                      <div className="sticky top-0 z-20 border-b bg-muted/95 backdrop-blur h-8 flex flex-col justify-center text-[9px] text-muted-foreground font-mono" style={{ width: datesList.length * pxPerDay }}>
                        <div className="flex h-full relative">
                          {datesList.map((d, idx) => {
                            const isMon = new Date(d).getDay() === 1;
                            if (timelineZoom === 'days' || (timelineZoom === 'weeks' && isMon)) {
                              return (
                                <div 
                                  key={idx} 
                                  className="absolute border-r pl-1 h-full flex items-center text-[8px]" 
                                  style={{ left: idx * pxPerDay, width: pxPerDay }}
                                >
                                  {timelineZoom === 'days' ? d.slice(8) : d.slice(5)}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>

                      {/* Detail Gantt Rows */}
                      <div className="relative divide-y" style={{ width: datesList.length * pxPerDay }}>
                        {/* Background lines */}
                        <div className="absolute inset-y-0 left-0 flex pointer-events-none z-0">
                          {datesList.map((d, idx) => {
                            const isMon = new Date(d).getDay() === 1;
                            if (timelineZoom === 'days' || (timelineZoom === 'weeks' && isMon)) {
                              return <div key={idx} className="border-r h-full border-muted/20" style={{ width: pxPerDay }} />;
                            }
                            return <div key={idx} style={{ width: pxPerDay }} />;
                          })}
                        </div>

                        {/* Today line overlay */}
                        {datesList.includes(today) && (
                          <div 
                            className="absolute top-0 bottom-0 border-l border-red-500/80 border-dashed z-10 pointer-events-none flex flex-col justify-start items-center"
                            style={{ left: datesList.indexOf(today) * pxPerDay }}
                          >
                            <span className="bg-red-500 text-white font-mono text-[7px] px-1 rounded-b shadow">TODAY</span>
                          </div>
                        )}

                        {/* Rows */}
                        {detailRows.map((row, idx) => {
                          if (!row.start_date || !row.end_date) {
                            return <div key={`detail-gantt-empty-${idx}`} className="h-10" />;
                          }

                          const startIdx = Math.max(0, datesList.indexOf(row.start_date));
                          const endIdx = Math.max(0, datesList.indexOf(row.end_date));
                          const duration = Math.max(1, (endIdx - startIdx) + 1);

                          const left = startIdx * pxPerDay;
                          const width = duration * pxPerDay;

                          return (
                            <div key={`detail-gantt-row-${idx}`} className="h-10 relative flex items-center z-10">
                              {/* LEVEL 2: Activity Bar */}
                              {row.type === 'activity' && (
                                <div 
                                  onClick={() => openDetails(row)}
                                  className={`absolute h-5 rounded shadow-sm cursor-pointer flex items-center pl-1.5 text-[8px] font-bold text-white transition-all overflow-hidden ${
                                    row.status === 'completed' ? 'bg-emerald-500 hover:bg-emerald-600' :
                                    row.status === 'in_progress' ? 'bg-blue-500 hover:bg-blue-600' :
                                    row.status === 'delayed' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-slate-400 hover:bg-slate-500'
                                  } ${row.is_critical_path ? 'ring-2 ring-red-500 ring-offset-1 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : ''}`}
                                  style={{ left, width }}
                                >
                                  <div className="absolute left-0 top-0 bottom-0 bg-black/20 pointer-events-none" style={{ width: `${row.progress || 0}%` }} />
                                  <span className="relative z-10 truncate pr-0.5">{row.name} ({row.progress || 0}%)</span>
                                </div>
                              )}

                              {/* LEVEL 3: Sub-task Bar */}
                              {row.type === 'task' && (
                                <div 
                                  className={`absolute h-2.5 rounded flex items-center pl-1 text-[7px] text-white font-mono ${
                                    row.status === 'completed' ? 'bg-emerald-600/80' :
                                    row.status === 'in_progress' ? 'bg-blue-600/80' : 'bg-slate-400/80'
                                  }`}
                                  style={{ left, width }}
                                >
                                  <span className="truncate">{row.name}</span>
                                </div>
                              )}

                              {/* LEVEL 4: Progress Log diamond */}
                              {row.type === 'progress_log' && (
                                <div className="absolute flex items-center justify-center cursor-pointer group" style={{ left }}>
                                  <div className="w-3 h-3 bg-indigo-600 border border-white rotate-45 transform shadow" />
                                  <div className="absolute left-5 hidden group-hover:block bg-slate-900 text-white text-[9px] p-2 rounded shadow-xl w-48 z-30 pointer-events-none leading-relaxed">
                                    <p className="font-bold text-indigo-400">{row.item.date}</p>
                                    <p className="mt-0.5">{row.item.work_done_description}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </Card>
            </div>
            
          </div>
        </TabsContent>

        {/* --- KANBAN STATUS BOARD --- */}
        <TabsContent value="kanban" className="space-y-4 outline-none">
          {/* Kanban Controls */}
          <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Cards By:</Label>
              <div className="flex border rounded-lg overflow-hidden bg-background p-0.5">
                <Button 
                  variant={kanbanGrouping === 'status' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setKanbanGrouping('status')}
                  className="h-8 text-xs font-bold px-4"
                >
                  Project Status
                </Button>
                <Button 
                  variant={kanbanGrouping === 'phase' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setKanbanGrouping('phase')}
                  className="h-8 text-xs font-bold px-4"
                >
                  Construction Phase
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-medium">
              Click cards to edit schedule dates, adjust progress logs, or report new activity progress.
            </div>
          </div>

          {/* Kanban Columns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kanbanColumns.map(col => (
              <div 
                key={col.id} 
                className={`border-t-4 rounded-xl border p-4 shadow-sm space-y-4 flex flex-col min-h-[400px] bg-muted/10 ${col.color}`}
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-black text-sm tracking-tight text-foreground flex items-center gap-2">
                    {col.title}
                    <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {col.items.length}
                    </span>
                  </h3>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 flex-1">
                  {col.items.map(it => {
                    const expected = computeExpectedProgress(it);
                    const delayed = today > (it.planned_end || today) && it.status !== 'completed';
                    
                    return (
                      <div 
                        key={it.id} 
                        onClick={() => openDetails({ id: it.id, item: it, type: 'activity' })}
                        className={`p-4 border rounded-xl bg-card hover:shadow-md transition-all cursor-pointer border-l-4 group ${
                          it.is_critical_path ? 'border-l-rose-500 ring-1 ring-rose-500/20' : 'border-l-primary/30'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {it.activity_id}
                            </span>
                            {it.is_critical_path && (
                              <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" /> CRITICAL
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-relaxed group-hover:text-primary transition-colors">
                            {it.name}
                          </h4>

                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{it.planned_start || '—'} to {it.planned_end || '—'}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-bold font-mono">
                              <span className="text-muted-foreground">Progress</span>
                              <span>{it.progress || 0}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded overflow-hidden">
                              <div 
                                className={`h-full rounded ${delayed ? 'bg-rose-500' : 'bg-primary'}`} 
                                style={{ width: `${it.progress || 0}%` }} 
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t pt-2 mt-1 text-[9px] text-muted-foreground">
                            <span>Expected: {expected}%</span>
                            {it.assigned_crew && (
                              <span className="font-semibold text-primary truncate max-w-[120px]">
                                👥 {it.assigned_crew}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {col.items.length === 0 && (
                    <div className="text-center py-12 text-xs text-muted-foreground font-medium border border-dashed rounded-xl bg-muted/5">
                      No activities in this column
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      </SubProjectGate>

      {/* --- SIDE DETAILS DRAWER (ACTION SHEET) --- */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto z-[60] bg-background border-l shadow-2xl p-6">
          <SheetHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded">
                {selectedItem?.item.activity_id || 'ACTIVITY'}
              </span>
              {selectedItem?.item.is_critical_path && (
                <span className="text-[9px] font-extrabold text-red-600 bg-red-100 border border-red-300 px-2.5 py-1 rounded-full animate-pulse">
                  CRITICAL PATH
                </span>
              )}
            </div>
            <SheetTitle className="text-lg font-black text-foreground mt-3 text-left">
              {selectedItem?.name || selectedItem?.item.name}
            </SheetTitle>
            <SheetDescription className="text-left leading-relaxed text-xs">
              {selectedItem?.item.description || 'Details for this construction schedule activity item.'}
            </SheetDescription>
          </SheetHeader>

          {/* Activity Metrics & Status Panel */}
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-xl p-3 bg-muted/5 text-left">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Duration</span>
                <p className="text-sm font-bold text-foreground mt-1">{selectedItem?.item.duration_days || '—'} Days</p>
              </div>
              <div className="border rounded-xl p-3 bg-muted/5 text-left">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Phase</span>
                <p className="text-sm font-bold capitalize text-foreground mt-1">{selectedItem?.item.phase || '—'}</p>
              </div>
              <div className="border rounded-xl p-3 bg-muted/5 text-left col-span-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Dates</span>
                <p className="text-xs font-mono font-bold text-foreground mt-1">
                  📅 {selectedItem?.item.planned_start || '—'} → {selectedItem?.item.planned_end || '—'}
                </p>
              </div>
            </div>

            {/* Status updates buttons */}
            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Update Status</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  size="sm" 
                  variant={selectedItem?.item.status === 'in_progress' ? 'default' : 'outline'}
                  onClick={() => updateActivityMutation.mutate({ id: selectedItem.id, data: { status: 'in_progress' } })}
                  className="text-xs font-bold"
                >
                  <Play className="w-3.5 h-3.5 mr-1" /> Start
                </Button>
                <Button 
                  size="sm"
                  variant={selectedItem?.item.status === 'completed' ? 'default' : 'outline'}
                  onClick={() => updateActivityMutation.mutate({ id: selectedItem.id, data: { status: 'completed', progress: 100 } })}
                  className="text-xs font-bold"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Complete
                </Button>
                <Button 
                  size="sm"
                  variant={selectedItem?.item.status === 'delayed' ? 'destructive' : 'outline'}
                  onClick={() => updateActivityMutation.mutate({ id: selectedItem.id, data: { status: 'delayed' } })}
                  className="text-xs font-bold"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Delay
                </Button>
              </div>
            </div>

            {/* Slider to adjust progress */}
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between text-xs font-bold uppercase">
                <Label className="text-muted-foreground">Adjust Progress</Label>
                <span className="font-mono text-primary">{selectedItem?.item.progress || 0}%</span>
              </div>
              <Slider 
                value={[selectedItem?.item.progress || 0]}
                onValueChange={(val) => {
                  setSelectedItem(prev => ({ ...prev, item: { ...prev.item, progress: val[0] } }));
                }}
                onValueCommit={(val) => {
                  updateActivityMutation.mutate({ id: selectedItem.id, data: { progress: val[0] } });
                }}
                max={100} 
                step={5} 
                className="w-full"
              />
              <p className="text-[10px] text-muted-foreground">Slide to adjust the activity progress directly. Log reports below for daily automatic rollup.</p>
            </div>

            {/* INLINE progress logger form */}
            <div className="border-t pt-6 space-y-4 text-left">
              <h3 className="font-black text-sm text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" /> Report New Progress
              </h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] font-bold">Report Date</Label>
                    <Input 
                      type="date" 
                      value={logForm.date}
                      onChange={e => setLogForm({ ...logForm, date: e.target.value })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold">Labor Count</Label>
                    <Input 
                      type="number" 
                      placeholder="Workers"
                      value={logForm.labor}
                      onChange={e => setLogForm({ ...logForm, labor: e.target.value })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] font-bold">Quantity Done</Label>
                    <Input 
                      type="number" 
                      placeholder={`Qty (${selectedItem?.item.unit || 'm3'})`}
                      value={logForm.qty}
                      onChange={e => setLogForm({ ...logForm, qty: e.target.value })}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold">Weather</Label>
                    <Select 
                      value={logForm.weather} 
                      onValueChange={v => setLogForm({ ...logForm, weather: v })}
                    >
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Sunny', 'Rainy', 'Windy', 'Overcast'].map(w => (
                          <SelectItem key={w} value={w} className="text-xs">{w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] font-bold">Work Done Description *</Label>
                  <Textarea 
                    placeholder="Describe specific work completed today..."
                    value={logForm.description}
                    onChange={e => setLogForm({ ...logForm, description: e.target.value })}
                    rows={2}
                    className="mt-1 text-xs resize-none"
                  />
                </div>

                <div>
                  <Label className="text-[10px] font-bold">Issues Reported (Optional)</Label>
                  <Input 
                    placeholder="e.g. Pump breakdown, soft clay delay"
                    value={logForm.issues}
                    onChange={e => setLogForm({ ...logForm, issues: e.target.value })}
                    className="h-8 mt-1 text-xs"
                  />
                </div>

                <Button 
                  onClick={submitDailyLog}
                  disabled={createProgressMutation.isPending}
                  className="w-full h-9 mt-2 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  {createProgressMutation.isPending ? "Filing Report..." : "Submit Progress Log"}
                </Button>
              </div>
            </div>

            {/* Daily progress logs history */}
            {selectedItem?.item.progressEntries && selectedItem.item.progressEntries.length > 0 && (
              <div className="border-t pt-6 space-y-3 text-left">
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wide">Filed Progress History</h4>
                <div className="space-y-3">
                  {selectedItem.item.progressEntries.map(log => (
                    <div key={log.id} className="border rounded-xl p-3 bg-muted/10 space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-500">
                        <span>{log.date}</span>
                        <span className="flex items-center gap-1"><CloudSun className="w-3 h-3 text-amber-500" /> {log.weather_condition}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-relaxed">
                        {log.work_done_description}
                      </p>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground border-t pt-1.5 mt-1.5">
                        <span>Labor: {log.labor_count} workers</span>
                        <span className="font-bold text-indigo-600">Qty: {log.quantity_done} {log.unit || 'm3'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
