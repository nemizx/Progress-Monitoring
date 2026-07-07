import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText, Loader2, Download, TrendingUp, AlertTriangle, Users, DollarSign,
  Calendar, Wrench, Clock, Coins, Package, HelpCircle, FileSpreadsheet
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCompactCurrencyINR, formatCurrencyINR, normalizeDateKey } from '@/lib/formatters';
import { buildDprExcelWorkbook, downloadDprExcelWorkbook } from '@/lib/dprExcelExport';
import { useToast } from '@/components/ui/use-toast';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';

const PIE_COLORS = ['#1e3a5f', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

export default function Reports() {
  // We use useProjectSubProject hook to load all projects and subprojects
  const {
    projects, subProjects, wbsItems: projectWbsItems, projectId, setProjectId
  } = useProjectSubProject({ fetchWbs: true });

  const [reportType, setReportType] = useState('daily');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboards');

  // Date selection for the DPR Reports tab
  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };
  const [selectedDprDate, setSelectedDprDate] = useState(getLocalDateString());
  const { toast } = useToast();

  const isReportReady = !!projectId;
  const selectedProject = projects.find((p) => p.id === projectId);

  // --- Date-based Queries for DPR Reports ---

  // Technical Staff List
  const { data: technicalStaff = [] } = useQuery({
    queryKey: ['technical-staff-project', projectId],
    queryFn: () => projectId ? base44.entities.TechnicalStaff.filter({ project_id: projectId }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Technical Staff Attendance
  const { data: staffAttendance = [] } = useQuery({
    queryKey: ['staff-attendance-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.TechnicalStaffAttendance.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Contractors List
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-list'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 500),
  });

  // Contractor Labour Entries
  const { data: contractorLabours = [] } = useQuery({
    queryKey: ['contractor-labours-project-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.ContractorLabour.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Material Status Entries
  const { data: materialStatusEntries = [] } = useQuery({
    queryKey: ['material-status-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.MaterialStatus.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Material Status History (to calculate till date values)
  const { data: materialStatusHistory = [] } = useQuery({
    queryKey: ['material-status-all', projectId, 'history'],
    queryFn: () => projectId ? base44.entities.MaterialStatus.filter({ project_id: projectId }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Machinery Details
  const { data: machineryDetailsEntries = [] } = useQuery({
    queryKey: ['machinery-details-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.MachineryDetail.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Machinery Details History
  const { data: machineryDetailsHistory = [] } = useQuery({
    queryKey: ['machinery-details-all', projectId, 'history'],
    queryFn: () => projectId ? base44.entities.MachineryDetail.filter({ project_id: projectId }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Days Reports (Day's Report)
  const { data: daysReports = [] } = useQuery({
    queryKey: ['days-report-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.DaysReport.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Status Reports
  const { data: statusReports = [] } = useQuery({
    queryKey: ['status-report-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.StatusReport.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Special Site Visits
  const { data: specialSiteVisits = [] } = useQuery({
    queryKey: ['site-visits-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.SpecialSiteVisit.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Critical Issues
  const { data: criticalIssues = [] } = useQuery({
    queryKey: ['critical-issues-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.CriticalIssue.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // Next Day's Plans
  const { data: nextDaysPlans = [] } = useQuery({
    queryKey: ['next-days-plans-date', projectId, selectedDprDate],
    queryFn: () => projectId ? base44.entities.NextDaysPlan.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  // --- Queries for Dashboard & Executive Summary (Project-wide, not subproject filtered) ---
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones-project', projectId],
    queryFn: () => projectId ? base44.entities.Milestone.filter({ project_id: projectId }, '-created_date', 500) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: scheduleTasks = [] } = useQuery({
    queryKey: ['schedule-activities-project', projectId],
    queryFn: () => projectId ? base44.entities.ScheduleActivity.filter({ project_id: projectId }, '-created_date', 500) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: progressEntries = [] } = useQuery({
    queryKey: ['progress', 'project-wide', projectId],
    queryFn: () => projectId ? base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 5000) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: changes = [] } = useQuery({
    queryKey: ['changes-project', projectId],
    queryFn: () => projectId ? base44.entities.ChangeEvent.filter({ project_id: projectId }, '-created_date', 200) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budget-project', projectId],
    queryFn: () => projectId ? base44.entities.BudgetItem.filter({ project_id: projectId }, 'code', 500) : Promise.resolve([]),
    enabled: !!projectId,
  });

  const filteredProjects = isReportReady && selectedProject ? [selectedProject] : [];
  const filteredMilestones = isReportReady ? milestones : [];
  const filteredTasks = isReportReady ? scheduleTasks : [];
  const filteredEntries = isReportReady ? progressEntries : [];
  const filteredChanges = isReportReady ? changes : [];
  const filteredBudget = isReportReady ? budgetItems : [];

  // Portfolio metrics
  const avgProgress = filteredProjects.length > 0 ? Math.round(filteredProjects.reduce((s, p) => s + (p.progress || 0), 0) / filteredProjects.length) : 0;
  const delayedCount = filteredProjects.filter(p => p.status === 'delayed').length;
  const totalBudget = filteredBudget.filter(b => b.level === 1).reduce((s, b) => s + (b.original_budget || 0), 0);
  const totalActual = filteredBudget.filter(b => b.level === 1).reduce((s, b) => s + (b.actual_cost || 0), 0);

  // Progress chart
  const byDate = {};
  filteredEntries.forEach(e => {
    const key = normalizeDateKey(e.date);
    if (key) byDate[key] = (byDate[key] || 0) + 1;
  });
  const progressChart = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, count]) => ({ date: date.slice(5), entries: count }));

  // Change category breakdown
  const changeCats = {};
  filteredChanges.forEach(c => { changeCats[c.category || 'other'] = (changeCats[c.category || 'other'] || 0) + 1; });
  const changeChart = Object.entries(changeCats).map(([name, value]) => ({ name: name.replace(/_/g,' '), value }));

  // Helper date formatter
  const formatDateDMY = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  };

  // --- Dynamic Calculations for DPR worksheet ---
  const dprWorksheetData = useMemo(() => {
    if (!projectId) return [];

    // Entries for selected date and all historical entries
    const entriesForSelectedDate = progressEntries.filter(
      (e) => normalizeDateKey(e.date) === selectedDprDate && !e._is_aggregated
    );
    const historicalEntries = progressEntries.filter(
      (e) => normalizeDateKey(e.date) <= selectedDprDate && !e._is_aggregated
    );

    // Build lookup maps
    const budgetMapByWbs = new Map();
    const budgetMapById = new Map();
    budgetItems.forEach(b => {
      if (b.wbs_item_id) budgetMapByWbs.set(b.wbs_item_id, b);
      budgetMapById.set(b.id, b);
    });
    const wbsMapById = new Map();
    projectWbsItems.forEach(w => wbsMapById.set(w.id, w));

    // --- Part 1: WBS-based rows (L3 activities) ---
    const wbsActivityItems = projectWbsItems.filter(item => {
      const levelNumber = Number(item.level);
      const levelText = String(item.level || '').trim().toLowerCase();
      const hasActivityId = String(item.activity_id || '').trim() !== '';
      return levelNumber === 3 || levelText === 'l3' || hasActivityId;
    });

    const wbsRowMap = new Map(); // track which budget_item_ids are already covered
    const wbsRows = wbsActivityItems.map(activity => {
      const linkedBudget = budgetMapByWbs.get(activity.id);
      const plannedQty = Number(linkedBudget?.quantity ?? activity.planned_quantity ?? 0) || 0;
      const rate = Number(linkedBudget?.cost_per_unit ?? activity.lumsum_rate ?? 0) || 0;

      const todayEntry = entriesForSelectedDate.find(e =>
        e.wbs_item_id === activity.id ||
        (e.budget_item_id && e.budget_item_id === linkedBudget?.id)
      );
      const todayQty = todayEntry ? Number(todayEntry.quantity_done || 0) : 0;

      const matchedHistory = historicalEntries.filter(e =>
        e.wbs_item_id === activity.id ||
        (e.budget_item_id && e.budget_item_id === linkedBudget?.id)
      );
      const cumulativeQty = matchedHistory.reduce((sum, e) => sum + Number(e.quantity_done || 0), 0);

      if (linkedBudget?.id) wbsRowMap.set(linkedBudget.id, true);

      const percentComp = plannedQty > 0 ? Math.min((cumulativeQty / plannedQty) * 100, 100) : 0;
      const cleanTitle = (activity.title || activity.name || '').toLowerCase();
      const cleanCode = (activity.activity_code || activity.activity_id || activity.code || '').toLowerCase();
      const tomorrowPlan = nextDaysPlans.find(p => {
        const desc = (p.description || '').toLowerCase();
        return (cleanTitle && desc.includes(cleanTitle)) || (cleanCode && desc.includes(cleanCode));
      });
      const tomorrowQty = tomorrowPlan ? Number(tomorrowPlan.quantity || 0) : 0;

      return {
        ...activity,
        _row_type: 'wbs',
        sub_project_id: activity.sub_project_id || null,
        activity_code: activity.activity_code || activity.activity_id || activity.code || '',
        title: linkedBudget?.title || activity.title || activity.name || 'Activity',
        unit: linkedBudget?.unit || activity.unit || '',
        planned_qty: plannedQty,
        rate,
        today_qty: todayQty,
        cumulative_qty: cumulativeQty,
        percent_comp: percentComp,
        today_vowd: todayQty * rate,
        cumulative_vowd: cumulativeQty * rate,
        tomorrow_qty: tomorrowQty,
        tomorrow_vowd: tomorrowQty * rate,
      };
    }).filter((item) => item.today_qty > 0 || item.tomorrow_qty > 0);

    // --- Part 2: Orphan entries — entries for this date that have NO matching WBS row ---
    const orphanEntries = entriesForSelectedDate.filter(e => {
      // Already covered by a wbs row?
      if (e.wbs_item_id && projectWbsItems.some(w => w.id === e.wbs_item_id)) return false;
      if (e.budget_item_id && wbsRowMap.has(e.budget_item_id)) return false;
      return true;
    });

    const orphanRows = orphanEntries.map((entry, idx) => {
      const budget = entry.budget_item_id ? budgetMapById.get(entry.budget_item_id) : null;
      const wbs = entry.wbs_item_id ? wbsMapById.get(entry.wbs_item_id) : null;
      const rate = Number(budget?.cost_per_unit || 0);
      const todayQty = Number(entry.quantity_done || 0);
      // cumulative for same budget/wbs item
      const cumHistory = historicalEntries.filter(e2 =>
        (entry.budget_item_id && e2.budget_item_id === entry.budget_item_id) ||
        (entry.wbs_item_id && e2.wbs_item_id === entry.wbs_item_id)
      );
      const cumulativeQty = cumHistory.reduce((s, e2) => s + Number(e2.quantity_done || 0), 0);
      const plannedQty = Number(budget?.quantity || 0);
      const percentComp = plannedQty > 0 ? Math.min((cumulativeQty / plannedQty) * 100, 100) : 0;

      return {
        id: entry.id + '_orphan',
        _row_type: 'orphan',
        sub_project_id: null, // will go into unassigned group
        activity_code: budget?.code || wbs?.activity_code || wbs?.code || '',
        title: budget?.title || wbs?.title || wbs?.name || entry.work_done_description || `Entry #${idx + 1}`,
        unit: entry.unit || budget?.unit || '',
        planned_qty: plannedQty,
        rate,
        today_qty: todayQty,
        cumulative_qty: cumulativeQty,
        percent_comp: percentComp,
        today_vowd: todayQty * rate,
        cumulative_vowd: cumulativeQty * rate,
        tomorrow_qty: 0,
        tomorrow_vowd: 0,
      };
    });

    return [...wbsRows, ...orphanRows];
  }, [projectId, projectWbsItems, progressEntries, budgetItems, selectedDprDate, nextDaysPlans]);

  // --- Dynamic Calculations for Contractor Labour ---
  const contractorLabourData = useMemo(() => {
    return contractorLabours.map(row => {
      const matchedContractor = contractors.find(c => c.id === row.contractor_id);
      const carpenter = Number(row.carpenter) || 0;
      const barbender = Number(row.barbender) || 0;
      const mason = Number(row.mason) || 0;
      const carpenterHelper = Number(row.carpenter_helper) || 0;
      const barbenderHelper = Number(row.barbender_helper) || 0;
      const mc = Number(row.mc) || 0;
      const fc = Number(row.fc) || 0;
      
      const total = carpenter + barbender + mason + carpenterHelper + barbenderHelper + mc + fc;

      return {
        ...row,
        contractor_name: matchedContractor?.name || 'Unknown Contractor',
        unit: row.unit || 'Nos',
        carpenter,
        barbender,
        mason,
        carpenter_helper: carpenterHelper,
        barbender_helper: barbenderHelper,
        mc,
        fc,
        total
      };
    });
  }, [contractorLabours, contractors]);

  // --- Dynamic Calculations for Material Status ---
  const materialStatusData = useMemo(() => {
    return materialStatusEntries.map(row => {
      const desc = row.description?.trim() || '';
      const todayRecVal = Number(row.today_rec) || 0;
      const todayConsumedVal = Number(row.today_consumed) || 0;
      const rateVal = Number(row.rate) || 0;

      let tillDateRec = 0;
      let tillDateConsumed = 0;

      if (desc) {
        const previousEntries = materialStatusHistory.filter(e => 
          e.description.toLowerCase() === desc.toLowerCase() &&
          normalizeDateKey(e.date) < selectedDprDate &&
          e.id !== row.id
        );
        tillDateRec = previousEntries.reduce((sum, e) => sum + (Number(e.today_rec) || 0), 0);
        tillDateConsumed = previousEntries.reduce((sum, e) => sum + (Number(e.today_consumed) || 0), 0);
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
  }, [materialStatusEntries, materialStatusHistory, selectedDprDate]);

  // --- Dynamic Calculations for Machinery Details ---
  const machineryDetailsData = useMemo(() => {
    return machineryDetailsEntries.map(row => {
      const name = row.machinery_name?.trim() || '';
      const nosVal = Number(row.nos) || 0;
      const todaysHoursVal = Number(row.todays_hours) || 0;
      const rateVal = Number(row.rate) || 0;

      let tillDateHours = 0;
      let tillDateAmount = 0;

      if (name) {
        const previousEntries = machineryDetailsHistory.filter(e => 
          e.machinery_name.toLowerCase() === name.toLowerCase() &&
          normalizeDateKey(e.date) < selectedDprDate &&
          e.id !== row.id
        );
        tillDateHours = previousEntries.reduce((sum, e) => sum + (Number(e.todays_hours) || 0), 0);
        tillDateAmount = previousEntries.reduce((sum, e) => sum + (Number(e.todays_amount) || 0), 0);
      }

      const todaysAmount = nosVal * todaysHoursVal * rateVal;
      const cumulativeHours = tillDateHours + todaysHoursVal;
      const cumulativeAmount = tillDateAmount + todaysAmount;

      return {
        ...row,
        till_date_hours: tillDateHours,
        cumulative_hours: cumulativeHours,
        rate_val: rateVal,
        till_date_amount: tillDateAmount,
        todays_amount: todaysAmount,
        cumulative_amount: cumulativeAmount
      };
    });
  }, [machineryDetailsEntries, machineryDetailsHistory, selectedDprDate]);

  // --- Dynamic Calculations for Technical Staff Details ---
  const technicalStaffData = useMemo(() => {
    return staffAttendance
      .filter((row) => row.status === 'present')
      .map((row, i) => {
      const matchedStaff = technicalStaff.find(s => s.id === row.technical_staff_id);
      return {
        ...row,
        srNo: i + 1,
        name: matchedStaff?.name || 'Unknown Employee',
        designation: matchedStaff?.designation || 'Staff',
        remarks: matchedStaff?.remark || ''
      };
    });
  }, [staffAttendance, technicalStaff]);

  // --- Export DPR to Excel (Antalya / Planedge template layout) ---
  const handleExportDprExcel = async () => {
    if (!projectId) return;

    toast({ title: 'Exporting Excel...', description: 'Assembling progress datasets.' });
    try {
      const { workbook, filename } = await buildDprExcelWorkbook({
        selectedProject,
        selectedDprDate,
        subProjects,
        dprWorksheetData,
        technicalStaffData,
        contractorLabourData,
        materialStatusData,
        machineryDetailsData,
        daysReports,
        statusReports,
        specialSiteVisits,
        criticalIssues,
        nextDaysPlans,
        progressEntries,
      });

      await downloadDprExcelWorkbook(workbook, filename);
      toast({ title: 'DPR Excel Exported', description: `Saved as ${filename}` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: err.message || 'Could not export DPR Excel.', variant: 'destructive' });
    }
  };

  // --- Executive LLM Report Generator ---
  const generateReport = async () => {
    if (!isReportReady) return;
    setGenerating(true);
    const today = new Date().toISOString().split('T')[0];
    const prompt = `Generate a professional ${reportType} construction progress report (${today}).

Project: ${selectedProject?.name} (${selectedProject?.status}, ${selectedProject?.progress}% complete)
Milestones: ${filteredMilestones.length} total, ${filteredMilestones.filter(m=>m.status==='completed').length} completed, ${filteredMilestones.filter(m=>m.status==='delayed').length} delayed
Schedule: ${filteredTasks.length} activities, ${filteredTasks.filter(t=>t.status==='completed').length} done, ${filteredTasks.filter(t=>t.status==='delayed').length} delayed
Progress Entries: ${filteredEntries.length} field entries, ${filteredEntries.reduce((s,e)=>s+(e.labor_count||0),0)} labor-days logged
Change Events: ${filteredChanges.length} total (${filteredChanges.filter(c=>c.status==='open').length} open), ${filteredChanges.reduce((s,c)=>s+(c.impact_days||0),0)} days schedule impact
Budget: ${formatCompactCurrencyINR(totalBudget)} budget, ${formatCompactCurrencyINR(totalActual)} spent

Sections: Executive Summary, Progress Overview, Schedule Status, Critical Path Update, Change Management, Resource Summary, Key Risks, Actions Required Next ${reportType==='daily'?'Day':reportType==='weekly'?'Week':'Month'}.
Format with markdown. Be specific, professional, and actionable.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setReport(result);
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1 font-sans">
            Executive dashboards, DPR/WPR/MPR spreadsheets, and portfolio analytics
          </p>
        </div>
      </div>

      {/* Project Selector Only */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Select Project *</Label>
          <Select value={projectId || undefined} onValueChange={setProjectId}>
            <SelectTrigger className="w-full sm:w-64 bg-background">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isReportReady ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/40 p-1 rounded-lg">
            <TabsTrigger value="dashboards" className="text-xs font-semibold">Dashboards</TabsTrigger>
            <TabsTrigger value="dpr-reports" className="text-xs font-semibold">DPR Reports</TabsTrigger>
            <TabsTrigger value="generate" className="text-xs font-semibold">Generate Summary Report</TabsTrigger>
          </TabsList>

          {/* 1. Dashboards Tab */}
          <TabsContent value="dashboards" className="mt-4 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Avg Progress" value={`${avgProgress}%`} icon={TrendingUp} />
              <StatCard title="Delayed Status" value={delayedCount > 0 ? 'Delayed' : 'On Track'} icon={AlertTriangle} />
              <StatCard title="Total Budget" value={formatCompactCurrencyINR(totalBudget)} icon={DollarSign} />
              <StatCard title="Schedule Tasks" value={filteredTasks.length} icon={FileText} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Project Health */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Project Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredProjects.slice(0, 6).map(p => (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground truncate flex-1">{p.name}</span>
                        <div className="flex items-center gap-2 ml-2">
                          <StatusBadge status={p.status} />
                          <span className="text-xs font-bold">{p.progress || 0}%</span>
                        </div>
                      </div>
                      <Progress value={p.progress || 0} className="h-1.5" />
                    </div>
                  ))}
                  {filteredProjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No projects</p>}
                </CardContent>
              </Card>

              {/* Progress Activity Chart */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">DPR Submissions — Last 14 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  {progressChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={progressChart}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="entries" fill="hsl(38, 92%, 50%)" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No progress data logged recently.</div>}
                </CardContent>
              </Card>

              {/* Change Category Breakdown */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Change Events by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {changeChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={changeChart} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="value" fill="hsl(222, 47%, 20%)" radius={[0,3,3,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No changes or site issues recorded.</div>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 2. DPR Reports Tab */}
          <TabsContent value="dpr-reports" className="mt-4 space-y-6">
            {/* Top Action Panel */}
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Select DPR Date</Label>
                  <Input
                    type="date"
                    value={selectedDprDate}
                    onChange={(e) => setSelectedDprDate(e.target.value)}
                    className="w-full sm:w-60 bg-background h-10 text-sm"
                  />
                </div>
                <div>
                  <Button onClick={handleExportDprExcel} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 text-sm">
                    <FileSpreadsheet className="w-4 h-4" /> Export DPR Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* A. Status of the Work Preview */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>A. STATUS OF THE WORK (Subproject-wise Bifurcated)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-sans min-w-[1200px]">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2.5 text-center font-bold w-[60px] border-r">Sr. No</th>
                        <th className="p-2.5 text-left font-bold w-[120px] border-r">Activity ID</th>
                        <th className="p-2.5 text-left font-bold border-r">Activity Name</th>
                        <th className="p-2.5 text-left font-bold w-[80px] border-r">Unit</th>
                        <th className="p-2.5 text-right font-bold w-[90px] border-r">Total Qty</th>
                        <th className="p-2.5 text-right font-bold w-[90px] border-r">Today Qty</th>
                        <th className="p-2.5 text-right font-bold w-[120px] border-r">Cumulative Qty</th>
                        <th className="p-2.5 text-right font-bold w-[80px] border-r">% Comp.</th>
                        <th className="p-2.5 text-right font-bold w-[130px] border-r">Today's VOWD</th>
                        <th className="p-2.5 text-right font-bold w-[140px] border-r">Cumulative VOWD</th>
                        <th className="p-2.5 text-right font-bold w-[120px] border-r">Qty for Tomorrow</th>
                        <th className="p-2.5 text-right font-bold w-[135px]">VOWD Tomorrow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const DprRow = ({ item, index }) => (
                          <tr key={item.id} className="border-b hover:bg-muted/10">
                            <td className="p-2.5 text-center text-muted-foreground border-r">{index + 1}</td>
                            <td className="p-2.5 border-r font-mono text-[10px]">{item.activity_code || '—'}</td>
                            <td className="p-2.5 border-r font-semibold">{item.title}</td>
                            <td className="p-2.5 border-r text-center">{item.unit || '—'}</td>
                            <td className="p-2.5 border-r text-right font-mono">{Number(item.planned_qty || 0).toFixed(2)}</td>
                            <td className="p-2.5 border-r text-right font-mono bg-amber-50/10 font-bold">{item.today_qty > 0 ? item.today_qty : '—'}</td>
                            <td className="p-2.5 border-r text-right font-mono">{Number(item.cumulative_qty || 0).toFixed(2)}</td>
                            <td className="p-2.5 border-r text-right font-mono font-bold text-slate-700">{Number(item.percent_comp || 0).toFixed(1)}%</td>
                            <td className="p-2.5 border-r text-right font-mono">{formatCurrencyINR(item.today_vowd)}</td>
                            <td className="p-2.5 border-r text-right font-mono font-semibold text-emerald-600">{formatCurrencyINR(item.cumulative_vowd)}</td>
                            <td className="p-2.5 border-r text-right font-mono text-muted-foreground">{item.tomorrow_qty > 0 ? item.tomorrow_qty : '—'}</td>
                            <td className="p-2.5 text-right font-mono text-muted-foreground">{formatCurrencyINR(item.tomorrow_vowd)}</td>
                          </tr>
                        );

                        const assignedSubProjectIds = new Set(subProjects.map(s => s.id));
                        const unassignedItems = dprWorksheetData.filter(w => !w.sub_project_id || !assignedSubProjectIds.has(w.sub_project_id));

                        const subSections = subProjects
                          .map(sub => ({ sub, items: dprWorksheetData.filter(w => w.sub_project_id === sub.id) }))
                          .filter(({ items }) => items.length > 0);

                        if (dprWorksheetData.length === 0) {
                          return (
                            <tr>
                              <td colSpan={12} className="text-center p-6 text-muted-foreground">No worksheet records or progress entries found for this date.</td>
                            </tr>
                          );
                        }

                        let srCounter = 0;
                        return (
                          <>
                            {subSections.map(({ sub, items }) => (
                              <React.Fragment key={sub.id}>
                                <tr className="bg-primary/5 font-semibold text-primary">
                                  <td colSpan={12} className="p-2 pl-4 text-xs font-bold border-b">{sub.name}</td>
                                </tr>
                                {items.map((item) => <DprRow key={item.id} item={item} index={++srCounter} />)}
                              </React.Fragment>
                            ))}
                            {unassignedItems.length > 0 && (
                              <React.Fragment>
                                {subSections.length > 0 && (
                                  <tr className="bg-muted/30 font-semibold text-muted-foreground">
                                    <td colSpan={12} className="p-2 pl-4 text-xs font-bold border-b">Other / Unassigned</td>
                                  </tr>
                                )}
                                {unassignedItems.map((item) => <DprRow key={item.id} item={item} index={++srCounter} />)}
                              </React.Fragment>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* B & C: Technical Staff & Contractor Labours */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* B. Technical Staff Details */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold">B. TECHNICAL STAFF DETAILS</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2 text-center w-[60px] border-r">Sr. No</th>
                        <th className="p-2 text-left border-r">Staff Name</th>
                        <th className="p-2 text-left border-r">Designation</th>
                        <th className="p-2 text-left">Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {technicalStaffData.map(s => (
                        <tr key={s.id} className="border-b">
                          <td className="p-2 text-center text-muted-foreground border-r">{s.srNo}</td>
                          <td className="p-2 border-r font-semibold text-foreground">{s.name}</td>
                          <td className="p-2 border-r text-muted-foreground">{s.designation}</td>
                          <td className="p-2 text-muted-foreground">{s.remarks || '—'}</td>
                        </tr>
                      ))}
                      {technicalStaffData.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center p-6 text-muted-foreground">No technical staff attendance entries present for this date.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* C. Contractor Labour preview */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold">C. BUILDING WISE MANPOWER DETAILS & ALLOCATION (Bifurcated)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="p-2 text-center w-[50px] border-r">Sr No</th>
                          <th className="p-2 text-left border-r">Contractor</th>
                          <th className="p-2 text-center w-[60px] border-r">Unit</th>
                          <th className="p-2 text-center border-r" colSpan={3}>Skilled (C / B / M)</th>
                          <th className="p-2 text-center border-r" colSpan={2}>Semi-Skilled (CH / BH)</th>
                          <th className="p-2 text-center border-r" colSpan={2}>Unskilled (MC / FC)</th>
                          <th className="p-2 text-right w-[80px]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                           const LabourRow = ({ l, idx }) => (
                             <tr key={l.id} className="border-b">
                               <td className="p-2 text-center text-muted-foreground border-r">{idx + 1}</td>
                               <td className="p-2 border-r font-semibold">{l.contractor_name}</td>
                               <td className="p-2 border-r text-center">{l.unit}</td>
                               <td className="p-2 text-center font-mono">{l.carpenter}</td>
                               <td className="p-2 text-center font-mono">{l.barbender}</td>
                               <td className="p-2 text-center border-r font-mono">{l.mason}</td>
                               <td className="p-2 text-center font-mono">{l.carpenter_helper}</td>
                               <td className="p-2 text-center border-r font-mono">{l.barbender_helper}</td>
                               <td className="p-2 text-center font-mono">{l.mc}</td>
                               <td className="p-2 text-center border-r font-mono">{l.fc}</td>
                               <td className="p-2 text-right font-bold text-slate-800 font-mono bg-muted/10">{l.total}</td>
                             </tr>
                           );
                           const assignedIds = new Set(subProjects.map(s => s.id));
                           const unassigned = contractorLabourData.filter(l => !l.sub_project_id || !assignedIds.has(l.sub_project_id));
                           const subSections = subProjects
                             .map(sub => ({ sub, items: contractorLabourData.filter(l => l.sub_project_id === sub.id) }))
                             .filter(({ items }) => items.length > 0);
                           if (contractorLabourData.length === 0) {
                             return (
                               <tr>
                                 <td colSpan={11} className="text-center p-6 text-muted-foreground">No contractor labour entries logged for this date.</td>
                               </tr>
                             );
                           }
                           let ctr = 0;
                           return (
                             <>
                               {subSections.map(({ sub, items }) => (
                                 <React.Fragment key={sub.id}>
                                   <tr className="bg-primary/5 font-semibold text-primary">
                                     <td colSpan={11} className="p-1.5 pl-4 text-xs font-bold border-b">{sub.name}</td>
                                   </tr>
                                   {items.map(l => <LabourRow key={l.id} l={l} idx={++ctr} />)}
                                 </React.Fragment>
                               ))}
                               {unassigned.length > 0 && (
                                 <React.Fragment>
                                   {subSections.length > 0 && (
                                     <tr className="bg-muted/30 font-semibold text-muted-foreground">
                                       <td colSpan={11} className="p-1.5 pl-4 text-xs font-bold border-b">Other / Unassigned</td>
                                     </tr>
                                   )}
                                   {unassigned.map(l => <LabourRow key={l.id} l={l} idx={++ctr} />)}
                                 </React.Fragment>
                               )}
                             </>
                           );
                         })()}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* D. Material Status preview */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold">D. MATERIAL STATUS</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[1200px]">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th colSpan={3} className="border-r"></th>
                        <th colSpan={3} className="text-center p-1.5 border-r font-bold text-muted-foreground">Received Qty</th>
                        <th colSpan={4} className="text-center p-1.5 border-r font-bold text-muted-foreground">Consumed Qty</th>
                        <th colSpan={4} className="text-center p-1.5 border-r font-bold text-muted-foreground">Amount</th>
                        <th></th>
                      </tr>
                      <tr className="bg-muted/60 border-b">
                        <th className="p-2 text-center border-r">Sr. No</th>
                        <th className="p-2 text-left border-r">Description</th>
                        <th className="p-2 text-left border-r">Unit</th>
                        <th className="p-2 text-right">Till Date Rec</th>
                        <th className="p-2 text-right">Today Rec</th>
                        <th className="p-2 text-right border-r">Total Received</th>
                        <th className="p-2 text-right">Till Date Consumption</th>
                        <th className="p-2 text-right">Today Consumption</th>
                        <th className="p-2 text-right">Total Consumption</th>
                        <th className="p-2 text-right border-r bg-emerald-50/10">Balance</th>
                        <th className="p-2 text-right">Rate</th>
                        <th className="p-2 text-right">Till Date</th>
                        <th className="p-2 text-right">Today Material Amount</th>
                        <th className="p-2 text-right border-r">Cumulative Amount</th>
                        <th className="p-2 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialStatusData.map((item, index) => (
                        <tr key={item.id} className="border-b hover:bg-muted/5">
                          <td className="p-2 text-center text-muted-foreground border-r">{index + 1}</td>
                          <td className="p-2 border-r font-semibold">{item.description}</td>
                          <td className="p-2 border-r text-center">{item.unit || '—'}</td>
                          <td className="p-2 text-right font-mono">{item.till_date_rec.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono bg-amber-50/10 font-bold">{item.today_rec_val.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono border-r font-semibold text-slate-700">{item.total_received.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{item.till_date_consumed.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono bg-amber-50/10 font-bold">{item.today_consumed_val.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{item.total_consumed.toFixed(2)}</td>
                          <td className={`p-2 text-right font-mono border-r font-bold ${item.balance < 0 ? 'text-red-600 bg-red-50/20' : 'text-emerald-700 bg-emerald-50/20'}`}>{item.balance.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{formatCurrencyINR(item.rate_val)}</td>
                          <td className="p-2 text-right font-mono">{formatCurrencyINR(item.till_date_amount)}</td>
                          <td className="p-2 text-right font-mono font-semibold">{formatCurrencyINR(item.today_amount)}</td>
                          <td className="p-2 text-right font-mono border-r font-bold text-emerald-600">{formatCurrencyINR(item.cumulative_amount)}</td>
                          <td className="p-2 text-muted-foreground">{item.remarks || '—'}</td>
                        </tr>
                      ))}
                      {materialStatusData.length === 0 && (
                        <tr>
                          <td colSpan={15} className="text-center p-6 text-muted-foreground">No material status logs logged for this date.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* E. Machinery Details preview */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold">E. MACHINERIES DETAILS</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[1100px]">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2 text-center w-[60px] border-r">Sr. No</th>
                        <th className="p-2 text-left border-r">Machinery Name</th>
                        <th className="p-2 text-right w-[80px] border-r">Nos</th>
                        <th className="p-2 text-right border-r">Till Date Hours</th>
                        <th className="p-2 text-right border-r">Today's Hours</th>
                        <th className="p-2 text-right border-r">Cumulative Hours</th>
                        <th className="p-2 text-right border-r">Rate</th>
                        <th className="p-2 text-right border-r">Till Date Amount</th>
                        <th className="p-2 text-right border-r">Today's Amount</th>
                        <th className="p-2 text-right">Cumulative Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machineryDetailsData.map((m, index) => (
                        <tr key={m.id} className="border-b hover:bg-muted/5">
                          <td className="p-2 text-center text-muted-foreground border-r">{index + 1}</td>
                          <td className="p-2 border-r font-semibold">{m.machinery_name}</td>
                          <td className="p-2 border-r text-right font-mono font-bold bg-amber-50/10">{m.nos}</td>
                          <td className="p-2 border-r text-right font-mono">{m.till_date_hours.toFixed(1)}</td>
                          <td className="p-2 border-r text-right font-mono bg-amber-50/10 font-bold">{Number(m.todays_hours).toFixed(1)}</td>
                          <td className="p-2 border-r text-right font-mono font-semibold text-slate-700">{m.cumulative_hours.toFixed(1)}</td>
                          <td className="p-2 border-r text-right font-mono">{formatCurrencyINR(m.rate_val)}</td>
                          <td className="p-2 border-r text-right font-mono">{formatCurrencyINR(m.till_date_amount)}</td>
                          <td className="p-2 border-r text-right font-mono font-semibold">{formatCurrencyINR(m.todays_amount)}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600">{formatCurrencyINR(m.cumulative_amount)}</td>
                        </tr>
                      ))}
                      {machineryDetailsData.length === 0 && (
                        <tr>
                          <td colSpan={10} className="text-center p-6 text-muted-foreground">No machinery run logs registered for this date.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Combined Site Logs & Reports (F to K) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Day's Report (F) */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold">F. DAY'S REPORT</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2 text-center w-[60px] border-r">Sr. No</th>
                        <th className="p-2 text-left border-r font-bold">Activity Description</th>
                        <th className="p-2 text-left font-bold w-[120px]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daysReports.map((item, index) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2 text-center text-muted-foreground border-r">{index + 1}</td>
                          <td className="p-2 border-r font-semibold text-slate-800">{item.description}</td>
                          <td className="p-2 text-muted-foreground">{item.remark || '—'}</td>
                        </tr>
                      ))}
                      {daysReports.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center p-6 text-muted-foreground">No day's report comments logged today.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Status Report (G) */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold">G. STATUS REPORT</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2 text-center w-[60px] border-r">Sr. No</th>
                        <th className="p-2 text-left border-r font-bold">Progress Description</th>
                        <th className="p-2 text-left font-bold w-[120px]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusReports.map((item, index) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2 text-center text-muted-foreground border-r">{index + 1}</td>
                          <td className="p-2 border-r font-semibold text-slate-800">{item.description}</td>
                          <td className="p-2 text-muted-foreground">{item.remark || '—'}</td>
                        </tr>
                      ))}
                      {statusReports.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center p-6 text-muted-foreground">No status report comments logged today.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Special Site Visits (H) */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold">H. SPECIAL SITE VISITS</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2 text-center w-[60px] border-r">Sr. No</th>
                        <th className="p-2 text-left border-r font-bold">Firm Name</th>
                        <th className="p-2 text-left border-r font-bold">Visitor Name</th>
                        <th className="p-2 text-left font-bold">Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specialSiteVisits.map((item, index) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2 text-center text-muted-foreground border-r">{index + 1}</td>
                          <td className="p-2 border-r font-semibold">{item.firm_name}</td>
                          <td className="p-2 border-r font-semibold text-slate-800">{item.visitor_name}</td>
                          <td className="p-2 text-muted-foreground">{item.purpose}</td>
                        </tr>
                      ))}
                      {specialSiteVisits.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center p-6 text-muted-foreground">No site visits recorded today.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Next Day's Plan (K) */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold">K. NEXT DAY'S PLAN</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2 text-center w-[60px] border-r">Sr. No</th>
                        <th className="p-2 text-left border-r font-bold">Planned Description</th>
                        <th className="p-2 text-center border-r font-bold w-[70px]">Unit</th>
                        <th className="p-2 text-right font-bold w-[90px]">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nextDaysPlans.map((item, index) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2 text-center text-muted-foreground border-r">{index + 1}</td>
                          <td className="p-2 border-r font-semibold text-slate-800">{item.description}</td>
                          <td className="p-2 border-r text-center text-muted-foreground">{item.unit || '—'}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-700">{item.quantity !== null && item.quantity !== undefined ? item.quantity : '—'}</td>
                        </tr>
                      ))}
                      {nextDaysPlans.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center p-6 text-muted-foreground">No plans logged for tomorrow.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 3. Generate Report Tab */}
          <TabsContent value="generate" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Report Period</label>
                    <Tabs value={reportType} onValueChange={setReportType}>
                      <TabsList>
                        <TabsTrigger value="daily">DPR</TabsTrigger>
                        <TabsTrigger value="weekly">WPR</TabsTrigger>
                        <TabsTrigger value="monthly">MPR</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <Button onClick={generateReport} disabled={generating || !isReportReady} className="gap-2">
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><FileText className="w-4 h-4" /> Generate Report</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {report && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-accent" />{reportType.toUpperCase()} Progress Report</CardTitle>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                      const blob = new Blob([report], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url;
                      a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.md`;
                      a.click(); URL.revokeObjectURL(url);
                    }}>
                      <Download className="w-3 h-3" /> Download
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none prose-headings:font-heading prose-headings:tracking-tight">
                    <ReactMarkdown>{report}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed font-sans">
          Select a project above to view dashboards and reports.
        </div>
      )}
    </div>
  );
}