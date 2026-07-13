import React, { useState, useMemo, useEffect } from 'react';
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
  FileText, Loader2, Download, TrendingUp, AlertTriangle, DollarSign, FileSpreadsheet
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ContractorLabourTable from '@/components/progress/ContractorLabourTable';
import ReactMarkdown from 'react-markdown';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCompactCurrencyINR, formatCurrencyINR, normalizeDateKey } from '@/lib/formatters';
import { buildDprExcelWorkbook, downloadDprExcelWorkbook } from '@/lib/dprExcelExport';
import { buildWprExcelWorkbook, downloadWprExcelWorkbook } from '@/lib/wprExcelExport';
import { useToast } from '@/components/ui/use-toast';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import { buildWprWeeksList } from '@/lib/wprWeeks';
import { calcPct } from '@/lib/wprForm';

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
  const [selectedWprReportWeek, setSelectedWprReportWeek] = useState('');
  const [selectedWprReportMonth, setSelectedWprReportMonth] = useState('');
  const { toast } = useToast();

  const isReportReady = !!projectId;
  const selectedProject = projects.find((p) => p.id === projectId);

  // --- WPR Reports Queries ---
  const { data: allWprReports = [], isLoading: wprReportsLoading } = useQuery({
    queryKey: ['wpr-reports-all', projectId],
    queryFn: () => projectId ? base44.entities.WprReport.filter({ project_id: projectId }) : Promise.resolve([]),
    enabled: !!projectId,
  });

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
    queryFn: () => projectId && selectedDprDate ? base44.entities.TechnicalStaffAttendance.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // Contractors List
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-list'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 500),
  });

  // Contractor Labour Entries
  const { data: contractorLabours = [] } = useQuery({
    queryKey: ['contractor-labours-project-date', projectId, selectedDprDate],
    queryFn: () => projectId && selectedDprDate ? base44.entities.ContractorLabour.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // Material Status Entries
  const { data: materialStatusEntries = [] } = useQuery({
    queryKey: ['material-status-date', projectId, selectedDprDate],
    queryFn: () => projectId && selectedDprDate ? base44.entities.MaterialStatus.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
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
    queryFn: () => projectId && selectedDprDate ? base44.entities.MachineryDetail.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
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
    queryFn: () => projectId && selectedDprDate ? base44.entities.DaysReport.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // Status Reports
  const { data: statusReports = [] } = useQuery({
    queryKey: ['status-report-date', projectId, selectedDprDate],
    queryFn: () => projectId && selectedDprDate ? base44.entities.StatusReport.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // Special Site Visits
  const { data: specialSiteVisits = [] } = useQuery({
    queryKey: ['site-visits-date', projectId, selectedDprDate],
    queryFn: () => projectId && selectedDprDate ? base44.entities.SpecialSiteVisit.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // Critical Issues
  const { data: criticalIssues = [] } = useQuery({
    queryKey: ['critical-issues-date', projectId, selectedDprDate],
    queryFn: () => projectId && selectedDprDate ? base44.entities.CriticalIssue.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // Next Day's Plans
  const { data: nextDaysPlans = [] } = useQuery({
    queryKey: ['next-days-plans-date', projectId, selectedDprDate],
    queryFn: () => projectId && selectedDprDate ? base44.entities.NextDaysPlan.filter({ project_id: projectId, date: selectedDprDate }) : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // Progress entries for the specific DPR date (for Section A: Status of Work)
  const { data: dprDateProgressEntries = [], isLoading: dprProgressLoading } = useQuery({
    queryKey: ['progress-entries-dpr-date', projectId, selectedDprDate],
    queryFn: () => projectId && selectedDprDate
      ? base44.entities.ProgressEntry.filter({ project_id: projectId, date: selectedDprDate }, '-date', 2000)
      : Promise.resolve([]),
    enabled: !!projectId && !!selectedDprDate,
  });

  // All historical progress entries for cumulative calculations in Section A
  const { data: dprHistoricalProgress = [], isLoading: dprHistoricalLoading } = useQuery({
    queryKey: ['progress-entries-dpr-historical', projectId],
    queryFn: () => projectId
      ? base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 10000)
      : Promise.resolve([]),
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

  // --- WPR Weeks & Months Memo Lists ---
  const weeksList = useMemo(
    () => buildWprWeeksList({
      projectStartDate: selectedProject?.start_date || selectedProject?.created_date || null,
    }),
    [selectedProject?.start_date, selectedProject?.created_date, projectId]
  );

  const filledWprWeekIds = useMemo(() => {
    return new Set(allWprReports.map(r => r.week_id));
  }, [allWprReports]);

  const wprMonths = useMemo(() => {
    const months = [];
    const seen = new Set();
    for (const w of weeksList) {
      if (!seen.has(w.monthKey)) {
        seen.add(w.monthKey);
        months.push({
          key: w.monthKey,
          label: w.monthLabel
        });
      }
    }
    return months;
  }, [weeksList]);

  const filteredWprWeeks = useMemo(() => {
    return weeksList.filter(w => w.monthKey === selectedWprReportMonth && filledWprWeekIds.has(w.id));
  }, [weeksList, selectedWprReportMonth, filledWprWeekIds]);

  const handleWprReportMonthChange = (monthKey) => {
    setSelectedWprReportMonth(monthKey);
    const monthWeeks = weeksList.filter(w => w.monthKey === monthKey && filledWprWeekIds.has(w.id));
    if (monthWeeks.length) {
      setSelectedWprReportWeek(monthWeeks[0].id);
    } else {
      setSelectedWprReportWeek('');
    }
  };

  useEffect(() => {
    if (activeTab !== 'wpr-reports') return;
    if (!weeksList.length) {
      setSelectedWprReportWeek('');
      setSelectedWprReportMonth('');
      return;
    }
    const latestWeek = weeksList.find(w => filledWprWeekIds.has(w.id));
    const targetWeekId = selectedWprReportWeek && filledWprWeekIds.has(selectedWprReportWeek)
      ? selectedWprReportWeek
      : (latestWeek?.id || '');
    const weekObj = weeksList.find((w) => w.id === targetWeekId);
    setSelectedWprReportWeek(targetWeekId);
    setSelectedWprReportMonth(weekObj?.monthKey || latestWeek?.monthKey || weeksList[0]?.monthKey || '');
  }, [weeksList, filledWprWeekIds, activeTab, selectedWprReportWeek]);

  const wprWeekReports = useMemo(() => {
    if (!selectedWprReportWeek) return [];
    return allWprReports.filter(r => r.week_id === selectedWprReportWeek);
  }, [allWprReports, selectedWprReportWeek]);

  const parsedWprReports = useMemo(() => {
    return wprWeekReports.map(r => {
      try {
        return {
          ...r,
          parsedForm: JSON.parse(r.form_data || '{}')
        };
      } catch (e) {
        return { ...r, parsedForm: {} };
      }
    });
  }, [wprWeekReports]);

  const wprMonthReports = useMemo(() => {
    if (!selectedWprReportMonth) return [];
    const monthWeeks = weeksList.filter(w => w.monthKey === selectedWprReportMonth);
    const monthWeekIds = new Set(monthWeeks.map(w => w.id));
    return allWprReports.filter(r => monthWeekIds.has(r.week_id));
  }, [allWprReports, selectedWprReportMonth, weeksList]);

  const parsedWprMonthReports = useMemo(() => {
    return wprMonthReports.map(r => {
      try {
        return {
          ...r,
          parsedForm: JSON.parse(r.form_data || '{}')
        };
      } catch (e) {
        return { ...r, parsedForm: {} };
      }
    });
  }, [wprMonthReports]);

  const formatWprDate = (dateStr) => {
    if (!dateStr || dateStr === '—' || dateStr === '0') return dateStr || '—';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const getSummaryForReports = (reports) => {
    const sumField = (key, subKey) => {
      return reports.reduce((sum, r) => {
        const val = r.parsedForm?.[key]?.[subKey];
        return sum + (Number(val) || 0);
      }, 0);
    };

    const countSectionRows = (key, field = 'plan') => {
      return reports.reduce((sum, r) => {
        const rows = r.parsedForm?.[key] || [];
        return sum + rows.filter(row => row.name && String(row[field] || '').trim() !== '').length;
      }, 0);
    };

    const avgField = (key, subKey) => {
      let count = 0;
      const sum = reports.reduce((acc, r) => {
        const val = r.parsedForm?.[key]?.[subKey];
        if (val !== undefined && val !== null && val !== '') {
          count++;
          return acc + Number(val);
        }
        return acc;
      }, 0);
      return count > 0 ? sum / count : 0;
    };

    const getAvgLabourField = (subKey) => {
      const uniqueWeeks = new Set(reports.map(r => r.week_id));
      if (!uniqueWeeks.size) return 0;
      const total = sumField('avgLabour', subKey);
      return Math.round(total / uniqueWeeks.size);
    };

    const getRatingField = (key, subKey, defaultVal) => {
      const avg = avgField(key, subKey);
      return avg > 0 ? Math.round(avg) : defaultVal;
    };

    const getTimelineDate = (subKey) => {
      if (!reports.length) return '';
      const validDates = reports
        .map(r => r.parsedForm?.timelineMonthly?.[subKey])
        .filter(Boolean);
      return validDates.length ? validDates[validDates.length - 1] : '';
    };

    return {
      avgLabour: {
        plan: getAvgLabourField('plan'),
        achieved: getAvgLabourField('achieved'),
      },
      milestones: {
        plan: sumField('milestones', 'plan'),
        achieved: sumField('milestones', 'achieved'),
      },
      qualityRating: {
        plan: getRatingField('qualityRating', 'plan', 10),
        achieved: getRatingField('qualityRating', 'achieved', 0),
      },
      healthSafetyRating: {
        plan: getRatingField('healthSafetyRating', 'plan', 10),
        achieved: getRatingField('healthSafetyRating', 'achieved', 0),
      },
      materialRequisitions: {
        plan: countSectionRows('materialRequisitions', 'plan'),
        achieved: countSectionRows('materialRequisitions', 'achieved'),
      },
      billsToCertify: {
        plan: countSectionRows('billsToCertify', 'plan'),
        achieved: countSectionRows('billsToCertify', 'achieved'),
      },
      leadershipInputs: {
        plan: countSectionRows('leadershipInputs', 'plan'),
        achieved: countSectionRows('leadershipInputs', 'achieved'),
      },
      mockUpActivities: {
        plan: countSectionRows('mockUpActivities', 'plan'),
        achieved: countSectionRows('mockUpActivities', 'achieved'),
      },
      contractorsMobilized: {
        plan: countSectionRows('contractorsMobilized', 'plan'),
        achieved: countSectionRows('contractorsMobilized', 'achieved'),
      },
      contractorReviewMeeting: {
        plan: sumField('contractorReviewMeeting', 'plan'),
        achieved: sumField('contractorReviewMeeting', 'achieved'),
      },
      keyPlanActivities: {
        plan: countSectionRows('keyPlanActivities', 'plan'),
        achieved: countSectionRows('keyPlanActivities', 'achieved'),
      },
      valueOfWorkDone: {
        plan: sumField('valueOfWorkDone', 'plan'),
        achieved: sumField('valueOfWorkDone', 'achieved'),
      },
      workMethodology: {
        plan: countSectionRows('workMethodology', 'plan'),
        achieved: countSectionRows('workMethodology', 'achieved'),
      },
      supportRequired: {
        plan: countSectionRows('supportRequired', 'plan'),
        achieved: countSectionRows('supportRequired', 'achieved'),
      },
      timelineMonthly: {
        startDate: getTimelineDate('startDate'),
        endDate: getTimelineDate('endDate'),
      }
    };
  };

  const wprSummaryData = useMemo(() => {
    if (!parsedWprReports.length) return [];

    const monthly = getSummaryForReports(parsedWprMonthReports);
    const weekly = getSummaryForReports(parsedWprReports);

    const labels = [
      { id: 1, name: '1. Avg.No Of Labour Allocated', unit: 'Nos', key: 'avgLabour' },
      { id: 2, name: '2. No. of Construction Milestones to Achieve:Building wise', unit: 'Nos', key: 'milestones' },
      { id: 3, name: '3. Quality Rating', unit: 'Rating', key: 'qualityRating' },
      { id: 4, name: '4. Health And Safety Rating', unit: 'Rating', key: 'healthSafetyRating' },
      { id: 5, name: '5. No. of Requisition of Material(Indent to raise considering material lead time)-(Kindly Refer the Annexure 1)', unit: 'Nos', key: 'materialRequisitions' },
      { id: 6, name: '6. No. of Bills to be certified - (Contractors/Material)-(Kindly Refer the Annexure 2)', unit: 'Nos', key: 'billsToCertify' },
      { id: 7, name: '7. No. of leadership input/client inputs/consultant inputs to be adopted- (Kindly Refer the Annexure 3)', unit: 'Nos', key: 'leadershipInputs' },
      { id: 8, name: '8. Planned Mock up Activity Trainings Done-(Kindly Refer the Annexure 4)', unit: 'Nos', key: 'mockUpActivities' },
      { id: 9, name: '9. No. of contractors to be mobilized after WO-(Kindly Refer the Annexure 5)', unit: 'Nos', key: 'contractorsMobilized' },
      { id: 10, name: '10. Contractor review meeting conducted', unit: 'Nos', key: 'contractorReviewMeeting' },
      { id: 11, name: '11. Upto 5 Key Activity Planned - Including Infra-(Kindly Refer the Annexure 6)', unit: 'Nos', key: 'keyPlanActivities' },
      { id: 12, name: '12. Value of Work Done', unit: 'INR', key: 'valueOfWorkDone', isCurrency: true },
      { id: 13, name: '13. No. of Work Methodology discussed-(Kindly Refer the Annexure 7)', unit: 'Nos', key: 'workMethodology' },
      { id: 14, name: '14. Support Required/Decision On-(Kindly Refer the Annexure 8)', unit: 'Nos', key: 'supportRequired' },
      { id: 15, name: '15. Timeline Monthly', unit: '—', key: 'timelineMonthly', isDate: true },
    ];

    const calcWprRowPct = (plan, achieved) => {
      const p = parseFloat(plan) || 0;
      const a = parseFloat(achieved) || 0;
      if (p === 0 && a === 0) return 0;
      if (p === 0 && a > 0) return 100;
      return Math.min(Math.round((a / p) * 100), 100);
    };

    return labels.map(label => {
      let mPlan = 0;
      let mAchieved = 0;
      let wPlan = 0;
      let wAchieved = 0;

      if (label.isDate) {
        mPlan = monthly.timelineMonthly?.startDate || '—';
        mAchieved = monthly.timelineMonthly?.endDate || '—';
        wPlan = '0';
        wAchieved = '0';
      } else {
        mPlan = monthly[label.key]?.plan ?? 0;
        mAchieved = monthly[label.key]?.achieved ?? 0;
        wPlan = weekly[label.key]?.plan ?? 0;
        wAchieved = weekly[label.key]?.achieved ?? 0;
      }

      const mPct = label.isDate ? null : calcWprRowPct(mPlan, mAchieved);
      const wPct = label.isDate ? null : calcWprRowPct(wPlan, wAchieved);

      return {
        ...label,
        monthlyPlan: mPlan,
        monthlyAchieved: mAchieved,
        monthlyPct: mPct !== null ? `${mPct}%` : '—',
        weeklyPlan: wPlan,
        weeklyAchieved: wAchieved,
        weeklyPct: wPct !== null ? `${wPct}%` : '—',
        rawMonthlyPct: mPct,
        rawWeeklyPct: wPct,
      };
    });
  }, [parsedWprMonthReports, parsedWprReports, weeksList]);

  const wprTotals = useMemo(() => {
    if (!wprSummaryData.length) return { monthly: '0%', weekly: '0%' };
    const activeRows = wprSummaryData.filter(r => !r.isDate);
    if (!activeRows.length) return { monthly: '0%', weekly: '0%' };

    const sumMonthly = activeRows.reduce((sum, r) => sum + (r.rawMonthlyPct || 0), 0);
    const sumWeekly = activeRows.reduce((sum, r) => sum + (r.rawWeeklyPct || 0), 0);

    const mAvg = (sumMonthly / activeRows.length).toFixed(2);
    const wAvg = (sumWeekly / activeRows.length).toFixed(2);

    return {
      monthly: `${mAvg}%`,
      weekly: `${wAvg}%`,
    };
  }, [wprSummaryData]);

  const wprDetailedSections = useMemo(() => {
    const sections = [
      { key: 'materialRequisitions', title: '5. No of Requisition Of Material', nameLabel: 'Requisition' },
      { key: 'billsToCertify', title: '6. Bills to certify', nameLabel: 'Bills to Certify' },
      { key: 'leadershipInputs', title: '7. No. of leadership input / client inputs / consultant inputs to be adopted', nameLabel: 'Feedback' },
      { key: 'mockUpActivities', title: '8. Mock up Activity', nameLabel: 'Mock up Activity' },
      { key: 'contractorsMobilized', title: '9. Contractors to be Mobilized', nameLabel: 'Contractor' },
      { key: 'keyPlanActivities', title: '11. Key Plan Activity', nameLabel: 'Activity Name' },
      { key: 'workMethodology', title: '13. Work Methodology Details', nameLabel: 'Work Methodology' },
      { key: 'supportRequired', title: '14. Support Required / Decision On Details', nameLabel: 'Support Required / Decision On' },
    ];

    return sections.map(sec => {
      const monthlyNames = new Set();
      parsedWprMonthReports.forEach(report => {
        const rows = report.parsedForm?.[sec.key] || [];
        rows.forEach(r => {
          if (r.name && String(r.name).trim()) {
            monthlyNames.add(String(r.name).trim());
          }
        });
      });

      const uniqueNames = Array.from(monthlyNames);

      const rows = uniqueNames.map(name => {
        let monthlyPlan = 0;
        let monthlyAchieved = 0;
        parsedWprMonthReports.forEach(report => {
          const sRows = report.parsedForm?.[sec.key] || [];
          sRows.forEach(r => {
            if (r.name && String(r.name).trim().toLowerCase() === name.toLowerCase()) {
              monthlyPlan += parseFloat(r.plan) || 0;
              monthlyAchieved += parseFloat(r.achieved) || 0;
            }
          });
        });

        let weeklyPlan = 0;
        let weeklyAchieved = 0;
        let weeklyRemark = '';
        let hasWeekly = false;

        parsedWprReports.forEach(report => {
          const sRows = report.parsedForm?.[sec.key] || [];
          sRows.forEach(r => {
            if (r.name && String(r.name).trim().toLowerCase() === name.toLowerCase()) {
              weeklyPlan += parseFloat(r.plan) || 0;
              weeklyAchieved += parseFloat(r.achieved) || 0;
              weeklyRemark = r.remark || '';
              hasWeekly = true;
            }
          });
        });

        const calcRowPct = (plan, achieved) => {
          const p = parseFloat(plan) || 0;
          const a = parseFloat(achieved) || 0;
          if (p === 0 && a === 0) return 0;
          if (p === 0 && a > 0) return 100;
          return Math.min(Math.round((a / p) * 100), 100);
        };

        const mPctVal = calcRowPct(monthlyPlan, monthlyAchieved);
        const wPctVal = hasWeekly ? calcRowPct(weeklyPlan, weeklyAchieved) : null;

        return {
          name,
          monthlyPlan,
          monthlyAchieved,
          monthlyPct: `${mPctVal}%`,
          weeklyPlan: hasWeekly ? weeklyPlan : null,
          weeklyAchieved: hasWeekly ? weeklyAchieved : null,
          weeklyPct: wPctVal !== null ? `${wPctVal}%` : '—',
          remark: hasWeekly ? weeklyRemark : '—',
          hasWeekly,
        };
      });

      const filteredRows = rows.filter(r => r.monthlyPlan > 0 || r.monthlyAchieved > 0);

      return {
        ...sec,
        rows: filteredRows
      };
    });
  }, [parsedWprMonthReports, parsedWprReports]);

  // Helper date formatter
  const formatDateDMY = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  };

  // --- Dynamic Calculations for DPR worksheet ---
  const dprWorksheetData = useMemo(() => {
    if (!projectId) return [];

    // Use dedicated date-scoped entries for today's data; historical for cumulative
    const entriesForSelectedDate = dprDateProgressEntries.filter(e => !e._is_aggregated);
    const historicalEntries = dprHistoricalProgress.filter(
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
  }, [projectId, projectWbsItems, dprDateProgressEntries, dprHistoricalProgress, budgetItems, selectedDprDate, nextDaysPlans]);

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
    const formatAttendanceStatus = (status) => {
      if (status === 'present') return 'Present';
      if (status === 'absent') return 'Absent';
      return 'Not marked';
    };

    return staffAttendance
      .filter((row) => row.status === 'present' || row.status === 'absent')
      .map((row, i) => {
      const matchedStaff = technicalStaff.find(s => s.id === row.technical_staff_id);
      return {
        ...row,
        srNo: i + 1,
        name: matchedStaff?.name || 'Unknown Employee',
        designation: matchedStaff?.designation || 'Staff',
        remarks: formatAttendanceStatus(row.status),
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
        progressEntries: dprHistoricalProgress,
      });

      await downloadDprExcelWorkbook(workbook, filename);
      toast({ title: 'DPR Excel Exported', description: `Saved as ${filename}` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: err.message || 'Could not export DPR Excel.', variant: 'destructive' });
    }
  };

  const handleExportWprExcel = async () => {
    if (!projectId || !selectedWprReportWeek) return;

    toast({ title: 'Exporting WPR Excel...', description: 'Assembling progress datasets.' });
    try {
      const { workbook, filename } = await buildWprExcelWorkbook({
        selectedProject,
        selectedWprReportWeek,
        weeksList,
        wprSummaryData,
        wprTotals,
        wprDetailedSections,
      });

      await downloadWprExcelWorkbook(workbook, filename);
      toast({ title: 'WPR Excel Exported', description: `Saved as ${filename}` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: err.message || 'Could not export WPR Excel.', variant: 'destructive' });
    }
  };

  const handleExportWprPdf = async () => {
    if (!selectedWprReportWeek) return;
    toast({ title: 'Exporting PDF...', description: 'Assembling document pages.' });
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const summaryCard = document.getElementById('wpr-summary-card');
      const detailedCards = Array.from(document.querySelectorAll('.wpr-detail-card'));
      
      if (!summaryCard) throw new Error('Summary card not found');

      // Create a landscape jsPDF instance
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // A4 Landscape dimensions
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 10;
      const maxPageHeight = pageHeight - margin;

      let currentY = margin;
      let isFirstPage = true;

      const allElements = [summaryCard, ...detailedCards];

      for (const element of allElements) {
        const canvas = await html2canvas(element, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc, clonedEl) => {
            const el = clonedEl || clonedDoc.getElementById(element.id);
            if (el) {
              el.style.overflow = 'visible';
              el.style.height = 'auto';
              el.style.maxHeight = 'none';
              
              let parent = el.parentElement;
              while (parent) {
                parent.style.overflow = 'visible';
                parent = parent.parentElement;
              }

              const wrappers = el.querySelectorAll('.overflow-x-auto');
              wrappers.forEach(w => {
                w.style.overflow = 'visible';
                w.style.overflowX = 'visible';
                w.style.width = 'auto';
                w.style.maxHeight = 'none';
              });
            }
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.7);
        const maxImgWidth = pageWidth - (2 * margin); // 277 mm
        const maxImgHeight = pageHeight - (2 * margin); // 190 mm

        let imgWidth = maxImgWidth;
        let imgHeight = (canvas.height * imgWidth) / canvas.width;

        // If the card height exceeds a single page height, scale it down to fit perfectly
        if (imgHeight > maxImgHeight) {
          const scale = maxImgHeight / imgHeight;
          imgWidth = imgWidth * scale;
          imgHeight = maxImgHeight;
        }

        // If it doesn't fit on the current page's remaining space, start a new page
        if (!isFirstPage && currentY + imgHeight > maxPageHeight) {
          pdf.addPage('a4', 'landscape');
          currentY = margin;
        }

        // Center the card horizontally on the page
        const xOffset = margin + (maxImgWidth - imgWidth) / 2;

        pdf.addImage(imgData, 'JPEG', xOffset, currentY, imgWidth, imgHeight, undefined, 'FAST');
        currentY += imgHeight + 6; // gap between cards
        isFirstPage = false;
      }

      const weekObj = weeksList.find(w => w.id === selectedWprReportWeek);
      const filename = `WPR_Report_${weekObj?.startDate || 'week'}.pdf`;
      pdf.save(filename);
      toast({ title: 'PDF Exported', description: `Saved as ${filename}` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: err.message || 'Could not export WPR PDF.', variant: 'destructive' });
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
            <TabsTrigger value="wpr-reports" className="text-xs font-semibold">WPR Reports</TabsTrigger>
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
                  <span>A. STATUS OF THE WORK</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-sans min-w-[1200px]">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-2.5 text-center font-bold w-[60px] border-r">Sr. No</th>
                        <th className="p-2.5 text-left font-bold w-[120px] border-r whitespace-nowrap">Activity ID</th>
                        <th className="p-2.5 text-left font-bold min-w-[300px] border-r">Activity Name</th>
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
                            <td className="p-2.5 text-center text-muted-foreground border-r">{index}</td>
                            <td className="p-2.5 border-r font-mono text-[10px] whitespace-nowrap">{item.activity_code || '—'}</td>
                            <td className="p-2.5 border-r font-semibold px-4">{item.title}</td>
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

            {/* B. Technical Staff */}
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
                        <td colSpan={4} className="text-center p-6 text-muted-foreground">No technical staff attendance entries for this date.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* C. Contractor Labour preview */}
            <Card className="shadow-sm border overflow-hidden">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold">C. BUILDING WISE MANPOWER DETAILS & ALLOCATION</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(() => {
                  const assignedIds = new Set(subProjects.map((s) => s.id));
                  const unassigned = contractorLabourData.filter(
                    (l) => !l.sub_project_id || !assignedIds.has(l.sub_project_id)
                  );
                  const subSections = subProjects
                    .map((sub) => ({
                      sub,
                      items: contractorLabourData.filter((l) => l.sub_project_id === sub.id),
                    }))
                    .filter(({ items }) => items.length > 0);

                  if (contractorLabourData.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground p-6 text-center">
                        No contractor labour entries logged for this date.
                      </p>
                    );
                  }

                  const tableRows = [];
                  let ctr = 0;
                  subSections.forEach(({ sub, items }) => {
                    tableRows.push({ _groupLabel: sub.name });
                    items.forEach((l) => {
                      tableRows.push({ ...l, sr: ++ctr });
                    });
                  });
                  if (unassigned.length > 0) {
                    if (subSections.length > 0) {
                      tableRows.push({ _groupLabel: 'Other / Unassigned' });
                    }
                    unassigned.forEach((l) => {
                      tableRows.push({ ...l, sr: ++ctr });
                    });
                  }

                  return (
                    <ContractorLabourTable
                      rows={tableRows}
                      showGroupLabels
                      emptyMessage="No contractor labour entries logged for this date."
                    />
                  );
                })()}
              </CardContent>
            </Card>

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
          {/* WPR Reports Tab */}
          <TabsContent value="wpr-reports" className="mt-4 space-y-6">
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex flex-wrap gap-4 items-end flex-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Select Month</Label>
                    <Select value={selectedWprReportMonth} onValueChange={handleWprReportMonthChange}>
                      <SelectTrigger className="w-full sm:w-44 bg-background">
                        <SelectValue placeholder="Choose Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {wprMonths.map(m => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Select Week</Label>
                    <Select
                      value={selectedWprReportWeek}
                      onValueChange={setSelectedWprReportWeek}
                      disabled={!filteredWprWeeks.length}
                    >
                      <SelectTrigger className="w-full sm:w-60 bg-background">
                        <SelectValue placeholder={filteredWprWeeks.length ? 'Choose Week' : 'No filled weeks available'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredWprWeeks.map(w => (
                          <SelectItem key={w.id} value={w.id}>
                            Week {w.weekNum} ({w.startDate} to {w.endDate})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleExportWprPdf}
                    disabled={!selectedWprReportWeek}
                    variant="outline"
                    className="gap-2 border-slate-300 text-slate-700 font-semibold h-10 text-sm"
                  >
                    <FileText className="w-4 h-4 text-rose-600" /> Export PDF
                  </Button>
                  <Button
                    onClick={handleExportWprExcel}
                    disabled={!selectedWprReportWeek}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedWprReportWeek && parsedWprReports.length > 0 ? (
              <div id="wpr-report-print-container" className="space-y-6 bg-slate-50/50 p-2 rounded-lg">
                
                {/* 1. Summary Card */}
                <Card id="wpr-summary-card" className="shadow-sm border p-6 bg-white">
                  <div className="text-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold font-heading tracking-tight text-slate-800">PLANEDGE MONITOR</h2>
                    <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mt-0.5">Weekly Progress Monitoring Report</h3>
                    <p className="text-sm font-semibold text-primary mt-2">{selectedProject?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {weeksList.find(w => w.id === selectedWprReportWeek)?.label}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      A. BUILDING WISE WEEKLY PROGRESS MONITORING REPORT (SUMMARY)
                    </h4>
                    
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-xs font-sans border-separate border-spacing-0 border-t border-l border-slate-200">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="p-3 text-left font-bold border-r border-slate-200 align-bottom pb-1 bg-slate-200 min-w-[200px] text-slate-800">Area of Review</th>
                            <th className="p-3 text-center font-bold border-r border-slate-200 align-bottom pb-1 bg-slate-200 min-w-[60px] text-slate-800">Unit</th>
                            <th colSpan={3} className="p-3 text-center font-bold border-r border-b border-slate-200 bg-slate-200 text-slate-800">Monthly</th>
                            <th colSpan={3} className="p-2.5 text-center font-bold border-r border-b border-slate-200 bg-slate-200 text-slate-800">
                              {weeksList.find(w => w.id === selectedWprReportWeek) ? `Week ${weeksList.find(w => w.id === selectedWprReportWeek).weekNum}` : 'Weekly'}
                              {" "}
                              ({weeksList.find(w => w.id === selectedWprReportWeek) ? `${formatWprDate(weeksList.find(w => w.id === selectedWprReportWeek).startDate)} to ${formatWprDate(weeksList.find(w => w.id === selectedWprReportWeek).endDate)}` : ''})
                            </th>
                          </tr>
                          <tr className="bg-slate-50 text-[10px]">
                            <th className="border-r border-b border-slate-200 bg-slate-200 h-4"></th>
                            <th className="border-r border-b border-slate-200 bg-slate-200 h-4"></th>
                            <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Plan</th>
                            <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Achieved</th>
                            <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">% Achieved</th>
                            <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Plan</th>
                            <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Achieved</th>
                            <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">% Achieved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wprSummaryData.map((item) => {
                            let mPlanDisplay = item.monthlyPlan;
                            let mAchievedDisplay = item.monthlyAchieved;
                            let wPlanDisplay = item.weeklyPlan;
                            let wAchievedDisplay = item.weeklyAchieved;

                            if (item.isDate) {
                              mPlanDisplay = formatWprDate(mPlanDisplay);
                              mAchievedDisplay = formatWprDate(mAchievedDisplay);
                              wPlanDisplay = formatWprDate(wPlanDisplay);
                              wAchievedDisplay = formatWprDate(wAchievedDisplay);
                            } else if (item.isCurrency) {
                              mPlanDisplay = mPlanDisplay ? `Rs. ${Number(mPlanDisplay).toLocaleString('en-IN')}` : '0';
                              mAchievedDisplay = mAchievedDisplay ? `Rs. ${Number(mAchievedDisplay).toLocaleString('en-IN')}` : '0';
                              wPlanDisplay = wPlanDisplay ? `Rs. ${Number(wPlanDisplay).toLocaleString('en-IN')}` : '0';
                              wAchievedDisplay = wAchievedDisplay ? `Rs. ${Number(wAchievedDisplay).toLocaleString('en-IN')}` : '0';
                            }

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="p-2.5 border-r border-b border-slate-200 font-semibold text-slate-700">{item.name}</td>
                                <td className="p-2.5 border-r border-b border-slate-200 text-center font-medium text-slate-600">{item.unit}</td>
                                <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-slate-700">{mPlanDisplay}</td>
                                <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-semibold text-slate-850">{mAchievedDisplay}</td>
                                <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-bold text-emerald-650 bg-emerald-50">{item.monthlyPct}</td>
                                <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-slate-700">{wPlanDisplay}</td>
                                <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-semibold text-slate-850">{wAchievedDisplay}</td>
                                <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-bold text-emerald-650 bg-emerald-50">{item.weeklyPct}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-100 font-bold text-slate-800 text-[11px]">
                            <td className="p-2.5 border-r border-b border-slate-200 bg-slate-100/80">Total</td>
                            <td className="p-2.5 border-r border-b border-slate-200 text-center bg-slate-100/80">—</td>
                            <td className="p-2.5 border-r border-b border-slate-200 text-right bg-slate-100/80">—</td>
                            <td className="p-2.5 border-r border-b border-slate-200 text-right bg-slate-100/80">—</td>
                            <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-emerald-700 bg-slate-100/80">{wprTotals.monthly}</td>
                            <td className="p-2.5 border-r border-b border-slate-200 text-right bg-slate-100/80">—</td>
                            <td className="p-2.5 border-r border-b border-slate-200 text-right bg-slate-100/80">—</td>
                            <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-emerald-700 bg-slate-100/80">{wprTotals.weekly}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>

                {/* 2. Detailed Cards Loop */}
                {wprDetailedSections.map((sec) => {
                  if (!sec.rows || sec.rows.length === 0) return null;

                  return (
                    <Card key={sec.key} className="wpr-detail-card shadow-sm border p-6 bg-white">
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                          {sec.title}
                        </h4>

                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-xs font-sans border-separate border-spacing-0 border-t border-l border-slate-200">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="p-2.5 text-center font-bold w-[60px] border-r border-slate-200 align-bottom pb-1 bg-slate-200 text-slate-800">Sr. No</th>
                                <th className="p-2.5 text-left font-bold border-r border-slate-200 align-bottom pb-1 bg-slate-200 text-slate-800">{sec.nameLabel} Name</th>
                                <th colSpan={3} className="p-2.5 text-center font-bold border-r border-b border-slate-200 bg-slate-200 text-slate-800">Monthly</th>
                                <th colSpan={3} className="p-2.5 text-center font-bold border-r border-b border-slate-200 bg-slate-200 text-slate-800">
                                  {weeksList.find(w => w.id === selectedWprReportWeek) ? `Week ${weeksList.find(w => w.id === selectedWprReportWeek).weekNum}` : 'Weekly'}
                                </th>
                                <th className="p-2.5 text-left font-bold border-r border-slate-200 align-bottom pb-1 bg-slate-200 text-slate-800">Remarks</th>
                              </tr>
                              <tr className="bg-slate-50 text-[10px]">
                                <th className="border-r border-b border-slate-200 bg-slate-200 h-4"></th>
                                <th className="border-r border-b border-slate-200 bg-slate-200 h-4"></th>
                                <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Plan</th>
                                <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Achieved</th>
                                <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">% Comp.</th>
                                <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Plan</th>
                                <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">Achieved</th>
                                <th className="p-2 text-right font-bold border-r border-b border-slate-200 text-slate-700 bg-slate-50">% Comp.</th>
                                <th className="border-r border-b border-slate-200 bg-slate-200 h-4"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sec.rows.map((r, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 text-center text-muted-foreground border-r border-b border-slate-200">{idx + 1}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 font-medium text-slate-700">{r.name}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-slate-700">{r.monthlyPlan}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-semibold text-slate-850">{r.monthlyAchieved}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-bold text-emerald-650 bg-emerald-50">{r.monthlyPct}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-slate-700">{r.weeklyPlan !== null ? r.weeklyPlan : '—'}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-semibold text-slate-850">{r.weeklyAchieved !== null ? r.weeklyAchieved : '—'}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono font-bold text-emerald-650 bg-emerald-50">{r.weeklyPct}</td>
                                  <td className="p-2.5 border-r border-b border-slate-200 text-slate-600">{r.remark || '—'}</td>
                                </tr>
                              ))}
                              {(() => {
                                const sectionMPlanTotal = sec.rows.reduce((s, r) => s + (Number(r.monthlyPlan) || 0), 0);
                                const sectionMAchievedTotal = sec.rows.reduce((s, r) => s + (Number(r.monthlyAchieved) || 0), 0);
                                const sectionMPct = sectionMPlanTotal > 0 ? Math.min(Math.round((sectionMAchievedTotal / sectionMPlanTotal) * 100), 100) : 0;

                                const sectionWPlanTotal = sec.rows.reduce((s, r) => s + (Number(r.weeklyPlan) || 0), 0);
                                const sectionWAchievedTotal = sec.rows.reduce((s, r) => s + (Number(r.weeklyAchieved) || 0), 0);
                                const sectionWPct = sectionWPlanTotal > 0 ? Math.min(Math.round((sectionWAchievedTotal / sectionWPlanTotal) * 100), 100) : 0;

                                return (
                                  <tr className="bg-slate-100 font-bold text-slate-800 text-[11px]">
                                    <td className="p-2.5 border-r border-b border-slate-200 text-center bg-slate-100/80">—</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 bg-slate-100/80">Total</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono bg-slate-100/80">{sectionMPlanTotal}</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono bg-slate-100/80">{sectionMAchievedTotal}</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-emerald-700 bg-slate-100/80">{sectionMPct}%</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono bg-slate-100/80">{sectionWPlanTotal}</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono bg-slate-100/80">{sectionWAchievedTotal}</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 text-right font-mono text-emerald-700 bg-slate-100/80">{sectionWPct}%</td>
                                    <td className="p-2.5 border-r border-b border-slate-200 bg-slate-100/80">—</td>
                                  </tr>
                                );
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border border-dashed shadow-none p-12 text-center">
                <p className="text-sm text-muted-foreground font-sans">
                  {wprMonths.length === 0 
                    ? 'No WPR weekly data filled or submitted yet for this project.'
                    : 'Select a Month and Week above to view the WPR Weekly progress report.'}
                </p>
              </Card>
            )}
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