import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, Calendar, Save, X, ChevronsUpDown } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { formatCompactCurrencyINR, formatCurrencyINR, normalizeDateKey } from '@/lib/formatters';
import { useAuth } from '@/lib/AuthContext';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';
import TechnicalStaffAttendancePanel from '@/components/progress/TechnicalStaffAttendancePanel';
import ContractorLabourPanel from '@/components/progress/ContractorLabourPanel';
import MaterialStatusPanel from '@/components/progress/MaterialStatusPanel';
import MachineriesDetailsPanel from '@/components/progress/MachineriesDetailsPanel';
import DaysReportPanel from '@/components/progress/DaysReportPanel';
import StatusReportPanel from '@/components/progress/StatusReportPanel';
import SpecialSiteVisitsPanel from '@/components/progress/SpecialSiteVisitsPanel';
import CriticalIssuesPanel from '@/components/progress/CriticalIssuesPanel';
import NextDaysPlansPanel from '@/components/progress/NextDaysPlansPanel';
import DprReviewDialog from '@/components/progress/DprReviewDialog';
import WprSheetPanel from '@/components/progress/WprSheetPanel';
import { filterBudgetBySubProject, filterProgressBySubProject, filterWbsBySubProject } from '@/lib/subProjectScope';
import { buildWprWeeksList, getDefaultWprWeekId } from '@/lib/wprWeeks';

const weatherIcons = { clear: '☀️', cloudy: '⛅', rainy: '🌧️', stormy: '⛈️', hot: '🌡️' };
const normalizeActivityKey = (value) => String(value || '').trim().toLowerCase();

const TAB_FROM_PARAM = { dpr: 'sheet', wpr: 'wpr', mpr: 'mpr', history: 'history' };
const PARAM_FROM_TAB = { sheet: 'dpr', wpr: 'wpr', mpr: 'mpr', history: 'history' };
const TAB_TITLES = { sheet: 'DPR', wpr: 'WPR', mpr: 'MPR', history: 'Aggregated Logs & History' };

const highlightText = (text, highlight) => {
  if (!text) return '—';
  if (!highlight || !highlight.trim()) return text;
  const escaped = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 text-amber-950 font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const mapForecastToWeatherCondition = (weatherCode, maxTemp) => {
  const code = Number(weatherCode);
  const temp = Number(maxTemp);

  if (Number.isFinite(temp) && temp >= 37) return 'hot';
  if ([95, 96, 99].includes(code)) return 'stormy';
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86].includes(code)
  ) return 'rainy';
  if ([0].includes(code)) return 'clear';
  return 'cloudy';
};

export default function SiteProgress() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    projects, subProjects, wbsItems: allWbsItems, projectId, subProjectId,
    setProjectId, setSubProjectId, isReady, selectedProject, selectedSubProject,
  } = useProjectSubProject({ fetchWbs: true });

  const [typeFilter, setTypeFilter] = useState('');
  const tabParam = searchParams.get('tab') || 'dpr';
  const activeTab = TAB_FROM_PARAM[tabParam] || 'sheet';

  const setActiveTab = useCallback((tab) => {
    const nextParam = PARAM_FROM_TAB[tab] || 'dpr';
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', nextParam);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [sheetSubTab, setSheetSubTab] = useState('dpr'); // 'dpr', 'staff-attendance'
  const [dprState, setDprState] = useState({});
  const [manualRowIds, setManualRowIds] = useState([]);
  const [weatherCondition, setWeatherCondition] = useState('clear');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState('');
  const [weatherError, setWeatherError] = useState('');
  const [weatherManuallyEdited, setWeatherManuallyEdited] = useState(false);
  const [submittedBy, setSubmittedBy] = useState('Supervisor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [loadedScope, setLoadedScope] = useState(null);
  const [lockedScopes, setLockedScopes] = useState({});
  
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const weatherManualRef = useRef(false);
  const contractorRef = useRef(null);
  const staffRef = useRef(null);
  const materialRef = useRef(null);
  const machineryRef = useRef(null);
  const daysReportRef = useRef(null);
  const statusReportRef = useRef(null);
  const siteVisitsRef = useRef(null);
  const criticalIssuesRef = useRef(null);
  const nextDaysPlanRef = useRef(null);

  const dprPanelRefs = useMemo(
    () => [
      staffRef,
      contractorRef,
      materialRef,
      machineryRef,
      daysReportRef,
      statusReportRef,
      siteVisitsRef,
      criticalIssuesRef,
      nextDaysPlanRef,
    ],
    []
  );

  const queryClient = useQueryClient();

  // Populate submittedBy with user name/email automatically when loaded
  useEffect(() => {
    if (user) {
      setSubmittedBy(user.name || user.email || 'Supervisor');
    }
  }, [user]);

  // Helper date generators
  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const [selectedReportDate, setSelectedReportDate] = useState(getLocalDateString());

  const formattedSelectedDate = useMemo(() => {
    if (!selectedReportDate) return '';
    const d = new Date(`${selectedReportDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return selectedReportDate;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [selectedReportDate]);

  const getMonthsList = () => {
    const months = [];
    const curr = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(curr.getFullYear(), curr.getMonth() - i, 1);
      const monthName = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      const startStr = `${y}-${m}-01`;
      const endStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

      months.push({
        id: `month_${i}`,
        label: monthName,
        startDate: startStr,
        endDate: endStr
      });
    }
    return months;
  };

  const monthsList = getMonthsList();

  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(monthsList[0]?.id || '');
  const [selectedWprMonth, setSelectedWprMonth] = useState('');

  const weeksList = useMemo(
    () => buildWprWeeksList({
      projectStartDate: selectedProject?.start_date || selectedProject?.created_date || null,
    }),
    [selectedProject?.start_date, selectedProject?.created_date, projectId]
  );

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

  const filteredWeeksForDropdown = useMemo(() => {
    return weeksList.filter(w => w.monthKey === selectedWprMonth);
  }, [weeksList, selectedWprMonth]);

  const handleWprMonthChange = (monthKey) => {
    setSelectedWprMonth(monthKey);
    const monthWeeks = weeksList.filter(w => w.monthKey === monthKey);
    if (monthWeeks.length) {
      setSelectedWeek(monthWeeks[0].id);
    }
  };

  useEffect(() => {
    if (!weeksList.length) {
      setSelectedWeek('');
      setSelectedWprMonth('');
      return;
    }
    const targetWeekId = weeksList.some((w) => w.id === selectedWeek)
      ? selectedWeek
      : getDefaultWprWeekId(weeksList);
    const weekObj = weeksList.find((w) => w.id === targetWeekId);
    setSelectedWeek(targetWeekId);
    setSelectedWprMonth(weekObj?.monthKey || '');
  }, [weeksList, selectedWeek]);

  // Redirect non-admins if they try to access history directly
  useEffect(() => {
    if (activeTab === 'history' && !isAdmin) {
      setActiveTab('sheet');
    }
  }, [activeTab, isAdmin, setActiveTab]);

  const { data: allEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['progress', projectId],
    queryFn: () => projectId
      ? base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 200)
      : Promise.resolve([]),
    enabled: !!projectId,
  });

  const { data: allBudgetItems = [] } = useQuery({
    queryKey: ['budgetItems', projectId],
    queryFn: () => projectId
      ? base44.entities.BudgetItem.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => projectId
      ? base44.entities.Milestone.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId,
  });

  const wbsItems = useMemo(
    () => (isReady ? filterWbsBySubProject(allWbsItems, subProjectId) : []),
    [isReady, allWbsItems, subProjectId]
  );
  const budgetItems = useMemo(
    () => (isReady ? filterBudgetBySubProject(allBudgetItems, allWbsItems, subProjectId) : []),
    [isReady, allBudgetItems, allWbsItems, subProjectId]
  );
  const entries = useMemo(
    () => (isReady ? filterProgressBySubProject(allEntries, allBudgetItems, allWbsItems, subProjectId) : []),
    [isReady, allEntries, allBudgetItems, allWbsItems, subProjectId]
  );

  const budgetById = useMemo(
    () => new Map(budgetItems.map((item) => [item.id, item])),
    [budgetItems]
  );
  const budgetByWbsId = useMemo(() => {
    const map = new Map();
    budgetItems.forEach((item) => {
      if (item.wbs_item_id && !map.has(item.wbs_item_id)) {
        map.set(item.wbs_item_id, item);
      }
    });
    return map;
  }, [budgetItems]);
  const wbsById = useMemo(
    () => new Map(wbsItems.map((item) => [item.id, item])),
    [wbsItems]
  );

  const worksheetRows = useMemo(() => {
    const activityItems = wbsItems.filter((item) => {
      const levelNumber = Number(item.level);
      const levelText = String(item.level || '').trim().toLowerCase();
      const hasActivityId = String(item.activity_id || '').trim() !== '';
      return levelNumber === 3 || levelText === 'l3' || hasActivityId;
    });

    const toWorksheetRow = (activity, extra = {}) => {
      const linkedBudget = budgetByWbsId.get(activity.id);
      const activityKey = normalizeActivityKey(activity.activity_id || activity.code);
      const sourceType = String(activity.source_upload_type || '').trim().toLowerCase();
      const sourceLabel = sourceType === 'l1_activity' ? 'l1_activity' : sourceType === 'l3' ? 'l3' : 'legacy';
      const quantity = Number(linkedBudget?.quantity ?? activity.planned_quantity ?? 0) || 0;
      const rate = Number(linkedBudget?.cost_per_unit ?? activity.lumsum_rate ?? 0) || 0;

      return {
        row_id: `wbs_${activity.id}`,
        budget_item_id_ref: linkedBudget?.id || '',
        wbs_item_id: activity.id,
        title: linkedBudget?.title || activity.title || activity.name || 'Activity',
        code: linkedBudget?.code || activity.activity_code || activity.activity_id || activity.code || '',
        unit: linkedBudget?.unit || activity.unit || '',
        quantity,
        cost_per_unit: rate,
        parent_id: linkedBudget?.parent_id || null,
        level: linkedBudget?.level || 3,
        milestone_id: linkedBudget?.milestone_id || '',
        activity_id_key: activityKey,
        source_upload_type: sourceLabel,
        is_l1_carry_forward: Boolean(extra.isCarryForward),
        carry_forward_consumed_qty: Number(extra.consumedQty || 0),
      };
    };

    const l1Activities = activityItems.filter(
      (item) => String(item.source_upload_type || '').trim().toLowerCase() === 'l1_activity'
    );
    const l3Activities = activityItems.filter(
      (item) => String(item.source_upload_type || '').trim().toLowerCase() === 'l3'
    );
    const hasL3Activities = l3Activities.length > 0;

    if (!hasL3Activities) {
      const fallbackActivities = l1Activities.length > 0 ? l1Activities : activityItems;
      return fallbackActivities
        .map((activity) => toWorksheetRow(activity))
        .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
    }

    const l3ActivityKeys = new Set(
      l3Activities
        .map((item) => normalizeActivityKey(item.activity_id || item.code))
        .filter(Boolean)
    );

    const carryForwardRows = l1Activities
      .map((l1Activity) => {
        const activityKey = normalizeActivityKey(l1Activity.activity_id || l1Activity.code);
        if (!activityKey || l3ActivityKeys.has(activityKey)) return null;

        const linkedBudget = budgetByWbsId.get(l1Activity.id);
        const consumedQty = entries
          .filter(
            (entry) =>
              (entry.wbs_item_id && entry.wbs_item_id === l1Activity.id) ||
              (linkedBudget?.id && entry.budget_item_id === linkedBudget.id)
          )
          .reduce((sum, entry) => sum + (parseFloat(entry.quantity_done) || 0), 0);

        if (consumedQty <= 0) return null;
        return toWorksheetRow(l1Activity, { isCarryForward: true, consumedQty });
      })
      .filter(Boolean)
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));

    const l3Rows = l3Activities
      .map((activity) => toWorksheetRow(activity))
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));

    return [...l3Rows, ...carryForwardRows];
  }, [wbsItems, budgetByWbsId, entries]);

  const worksheetCarryForwardCount = useMemo(
    () => worksheetRows.filter((row) => row.is_l1_carry_forward).length,
    [worksheetRows]
  );

  const worksheetRowById = useMemo(
    () => new Map(worksheetRows.map((row) => [row.row_id, row])),
    [worksheetRows]
  );
  const worksheetRowByBudgetId = useMemo(() => {
    const map = new Map();
    worksheetRows.forEach((row) => {
      if (row.budget_item_id_ref) map.set(row.budget_item_id_ref, row);
    });
    return map;
  }, [worksheetRows]);
  const worksheetRowByWbsId = useMemo(() => {
    const map = new Map();
    worksheetRows.forEach((row) => {
      if (row.wbs_item_id) map.set(row.wbs_item_id, row);
    });
    return map;
  }, [worksheetRows]);
  const worksheetRowByActivityId = useMemo(() => {
    const map = new Map();
    worksheetRows.forEach((row) => {
      if (row.activity_id_key && !map.has(row.activity_id_key)) {
        map.set(row.activity_id_key, row);
      }
    });
    return map;
  }, [worksheetRows]);

  const getEntryActivityKey = useCallback((entry) => {
    if (!entry) return '';

    if (entry.wbs_item_id) {
      const wbsItem = wbsById.get(entry.wbs_item_id);
      const key = normalizeActivityKey(wbsItem?.activity_id || wbsItem?.code);
      if (key) return key;
    }

    if (entry.budget_item_id) {
      const budgetItem = budgetById.get(entry.budget_item_id);
      if (budgetItem?.wbs_item_id) {
        const linkedWbs = wbsById.get(budgetItem.wbs_item_id);
        const key = normalizeActivityKey(linkedWbs?.activity_id || linkedWbs?.code);
        if (key) return key;
      }
    }

    return '';
  }, [budgetById, wbsById]);

  const rowMatchesEntry = useCallback((row, entry) => {
    if (!row || !entry) return false;
    if (row.budget_item_id_ref && entry.budget_item_id === row.budget_item_id_ref) return true;
    if (row.wbs_item_id && entry.wbs_item_id === row.wbs_item_id) return true;
    const rowActivityKey = row.activity_id_key || '';
    const entryActivityKey = getEntryActivityKey(entry);
    if (rowActivityKey && entryActivityKey && rowActivityKey === entryActivityKey) return true;
    return false;
  }, [getEntryActivityKey]);

  const scopeKey = isReady ? `${projectId}:${subProjectId}:${selectedReportDate}` : null;
  const dprEntriesForSelectedDate = useMemo(
    () =>
      entries.filter(
        (entry) =>
          normalizeDateKey(entry.date) === selectedReportDate &&
          (entry.report_type === 'daily' || !entry.report_type) &&
          !entry._is_aggregated
      ),
    [entries, selectedReportDate]
  );
  const isScopeLockedLocally = scopeKey ? Boolean(lockedScopes[scopeKey]) : false;
  const isSelectedDateLocked =
    dprEntriesForSelectedDate.length > 0 || (isScopeLockedLocally && !entriesLoading);

  useEffect(() => {
    if (!scopeKey || entriesLoading) return;
    if (lockedScopes[scopeKey] && dprEntriesForSelectedDate.length === 0) {
      setLockedScopes((prev) => {
        if (!prev[scopeKey]) return prev;
        const next = { ...prev };
        delete next[scopeKey];
        return next;
      });
    }
  }, [scopeKey, entriesLoading, dprEntriesForSelectedDate.length, lockedScopes]);

  useEffect(() => {
    setActivityPickerOpen(false);
    setManualRowIds([]);
    setLoadedScope(null);
  }, [scopeKey]);

  const entryRowIds = useMemo(() => {
    if (!isReady) return [];
    return [
      ...new Set(
        dprEntriesForSelectedDate
          .map((entry) => {
            if (entry.budget_item_id) {
              const budgetRowId = worksheetRowByBudgetId.get(entry.budget_item_id)?.row_id;
              if (budgetRowId) return budgetRowId;
            }
            if (entry.wbs_item_id) {
              const wbsRowId = worksheetRowByWbsId.get(entry.wbs_item_id)?.row_id;
              if (wbsRowId) return wbsRowId;
            }
            const entryActivityKey = getEntryActivityKey(entry);
            if (entryActivityKey) {
              return worksheetRowByActivityId.get(entryActivityKey)?.row_id || null;
            }
            return null;
          })
          .filter(Boolean)
      ),
    ];
  }, [
    isReady,
    dprEntriesForSelectedDate,
    worksheetRowByBudgetId,
    worksheetRowByWbsId,
    worksheetRowByActivityId,
    getEntryActivityKey,
  ]);

  const activeBudgetIds = useMemo(
    () => [...new Set([...entryRowIds, ...manualRowIds])],
    [entryRowIds, manualRowIds]
  );

  useEffect(() => {
    weatherManualRef.current = false;
    setWeatherManuallyEdited(false);
    setWeatherInfo('');
    setWeatherError('');
  }, [projectId, subProjectId, selectedReportDate]);

  useEffect(() => {
    if (!isReady || !selectedProject?.location || weatherManuallyEdited) {
      return;
    }

    let cancelled = false;

    const fetchWeatherFromProjectLocation = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError('');

        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(selectedProject.location)}&count=1&language=en&format=json`
        );
        if (!geoRes.ok) {
          throw new Error('Could not reach weather geocoding service.');
        }
        const geoJson = await geoRes.json();
        const place = geoJson?.results?.[0];
        if (!place) {
          throw new Error('No weather location match found for project location.');
        }

        const weatherParams = new URLSearchParams({
          latitude: String(place.latitude),
          longitude: String(place.longitude),
          timezone: 'auto',
          current_weather: 'true',
          daily: 'weather_code,temperature_2m_max',
          start_date: selectedReportDate,
          end_date: selectedReportDate,
        });

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`);
        if (!weatherRes.ok) {
          throw new Error('Could not fetch weather forecast.');
        }
        const weatherJson = await weatherRes.json();
        
        const isTodaySelected = selectedReportDate === getLocalDateString();
        let weatherCode = weatherJson?.daily?.weather_code?.[0];
        let maxTemp = weatherJson?.daily?.temperature_2m_max?.[0];

        if (isTodaySelected && weatherJson?.current_weather) {
          weatherCode = weatherJson.current_weather.weathercode;
          maxTemp = weatherJson.current_weather.temperature;
        }

        const mappedWeather = mapForecastToWeatherCondition(weatherCode, maxTemp);

        if (cancelled || weatherManualRef.current) return;

        setWeatherCondition(mappedWeather);
        setWeatherInfo(`${place.name}${place.admin1 ? `, ${place.admin1}` : ''}`);
      } catch (error) {
        if (cancelled) return;
        setWeatherError(error.message || 'Unable to auto-fill weather from location.');
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };

    fetchWeatherFromProjectLocation();

    return () => {
      cancelled = true;
    };
  }, [isReady, selectedProject?.location, selectedReportDate, weatherManuallyEdited]);

  // Sync state for tabular DPR sheet fields
  useEffect(() => {
    if (!isReady) {
      setDprState({});
      setLoadedScope(null);
      return;
    }
    
    setDprState((prev) => {
      const next = {};

      activeBudgetIds.forEach((rowId) => {
        const row = worksheetRowById.get(rowId);
        if (!row) return;

        const selectedDateEntry = dprEntriesForSelectedDate.find((entry) => rowMatchesEntry(row, entry));
        const prevRow = scopeKey === loadedScope ? prev[rowId] || {} : {};

        next[rowId] = {
          qty_executed:
            prevRow.qty_executed !== undefined && prevRow.qty_executed !== ''
              ? prevRow.qty_executed
              : selectedDateEntry
                ? String(selectedDateEntry.quantity_done ?? '')
                : '',
          tomorrow_qty:
            prevRow.tomorrow_qty !== undefined && prevRow.tomorrow_qty !== ''
              ? prevRow.tomorrow_qty
              : '',
          labor_count:
            prevRow.labor_count !== undefined && prevRow.labor_count !== ''
              ? prevRow.labor_count
              : selectedDateEntry
                ? String(selectedDateEntry.labor_count ?? '')
                : '',
          description:
            prevRow.description !== undefined && prevRow.description !== ''
              ? prevRow.description
              : selectedDateEntry?.work_done_description || '',
          issues:
            prevRow.issues !== undefined && prevRow.issues !== ''
              ? prevRow.issues
              : selectedDateEntry?.issues_reported || '',
          entry_id: selectedDateEntry ? selectedDateEntry.id : null,
          wbs_item_id: prevRow.wbs_item_id || selectedDateEntry?.wbs_item_id || row.wbs_item_id || '',
        };
      });

      return next;
    });

    setLoadedScope(scopeKey);
  }, [scopeKey, activeBudgetIds, worksheetRowById, dprEntriesForSelectedDate, isReady, loadedScope, rowMatchesEntry]);

  const getQtyBeforeForRow = useCallback((row) => {
    const itemProgress = entries.filter(
      (e) => rowMatchesEntry(row, e) && (e.report_type === 'daily' || !e.report_type) && !e._is_aggregated
    );
    return itemProgress
      .filter((e) => normalizeDateKey(e.date) < selectedReportDate)
      .reduce((sum, e) => sum + (parseFloat(e.quantity_done) || 0), 0);
  }, [entries, rowMatchesEntry, selectedReportDate]);

  const handleInputChange = (budgetItemId, field, value) => {
    if (isSelectedDateLocked) return;
    setDprState(prev => ({
      ...prev,
      [budgetItemId]: {
        ...prev[budgetItemId],
        [field]: value
      }
    }));
  };

  const handleQtyExecutedChange = useCallback((rowId, rawValue) => {
    if (isSelectedDateLocked) return;

    const row = worksheetRowById.get(rowId);
    if (!row) return;

    const totalQty = parseFloat(row.quantity) || 0;
    const qtyBefore = getQtyBeforeForRow(row);
    const maxTodayQty = Math.max(0, totalQty - qtyBefore);

    if (rawValue === '' || rawValue === '.') {
      handleInputChange(rowId, 'qty_executed', rawValue);
      return;
    }

    const parsed = parseFloat(rawValue);
    if (Number.isNaN(parsed)) return;

    if (parsed < 0) {
      handleInputChange(rowId, 'qty_executed', '0');
      return;
    }

    if (parsed > maxTodayQty) {
      toast({
        title: 'Quantity limit reached',
        description: `Today Qty cannot exceed ${maxTodayQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${row.unit || ''}.`.trim(),
        variant: 'destructive',
      });
      handleInputChange(rowId, 'qty_executed', maxTodayQty > 0 ? String(maxTodayQty) : '0');
      return;
    }

    handleInputChange(rowId, 'qty_executed', rawValue);
  }, [isSelectedDateLocked, worksheetRowById, getQtyBeforeForRow, toast]);

  const handleAddActivity = (id) => {
    if (isSelectedDateLocked) return;
    if (!id) return;
    if (activeBudgetIds.includes(id)) return;

    const row = worksheetRowById.get(id);
    
    setManualRowIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setDprState(prev => ({
      ...prev,
      [id]: prev[id] || {
        qty_executed: '',
        tomorrow_qty: '',
        labor_count: '',
        description: '',
        issues: '',
        entry_id: null,
        wbs_item_id: row?.wbs_item_id || ''
      }
    }));
  };

  const handleRemoveActivity = async (bItemId) => {
    if (isSelectedDateLocked) return;
    const state = dprState[bItemId];
    if (state?.entry_id) {
      if (confirm('This will delete today\'s logged entry for this activity from the database. Are you sure?')) {
        await base44.entities.ProgressEntry.delete(state.entry_id);
        queryClient.invalidateQueries({ queryKey: ['progress'] });
      }
    }
    setManualRowIds((prev) => prev.filter((rowId) => rowId !== bItemId));
    setDprState(prev => {
      const updated = { ...prev };
      delete updated[bItemId];
      return updated;
    });
  };

  const handleSaveDpr = () => {
    if (isSelectedDateLocked) {
      toast({
        title: 'Date Locked',
        description: 'DPR is already submitted for this date and cannot be changed.',
        variant: 'destructive',
      });
      return;
    }

    for (const panelRef of dprPanelRefs) {
      const error = panelRef.current?.validate?.();
      if (error) {
        toast({
          title: 'Validation Error',
          description: error,
          variant: 'destructive',
        });
        return;
      }
    }

    setShowReviewDialog(true);
  };

  const persistWorksheetDpr = async () => {
    let savedCount = 0;
    let deletedCount = 0;
    const persistedEntryIds = {};

    for (const rowId of activeBudgetIds) {
      const state = dprState[rowId];
      const row = worksheetRowById.get(rowId);
      if (!row || !state) continue;

      const hasValue = state.qty_executed !== '' || state.tomorrow_qty !== '' || state.labor_count !== '' || state.description !== '' || state.issues !== '';

      if (hasValue) {
        const payload = {
          project_id: projectId,
          budget_item_id: row.budget_item_id_ref || null,
          date: selectedReportDate,
          report_type: 'daily',
          submitted_by: submittedBy || 'Supervisor',
          work_done_description: state.description || `Completed ${state.qty_executed} ${row.unit} of ${row.title}`,
          quantity_done: parseFloat(state.qty_executed) || 0,
          unit: row.unit,
          labor_count: parseFloat(state.labor_count) || 0,
          issues_reported: state.issues || '',
          weather_condition: weatherCondition,
          status: 'approved',
          value_of_work_done: (parseFloat(state.qty_executed) || 0) * (parseFloat(row.cost_per_unit) || 0),
          milestone_id: row.milestone_id || null,
        };
        const resolvedWbsItemId = state.wbs_item_id || row.wbs_item_id || '';
        if (!row.budget_item_id_ref && resolvedWbsItemId) {
          payload.wbs_item_id = resolvedWbsItemId;
        }

        if (state.entry_id) {
          const updatedEntry = await base44.entities.ProgressEntry.update(state.entry_id, payload);
          persistedEntryIds[rowId] = updatedEntry?.id || state.entry_id;
        } else {
          const createdEntry = await base44.entities.ProgressEntry.create(payload);
          persistedEntryIds[rowId] = createdEntry?.id || null;
        }
        savedCount += 1;
      } else if (state.entry_id) {
        await base44.entities.ProgressEntry.delete(state.entry_id);
        deletedCount += 1;
      }
    }

    if (Object.keys(persistedEntryIds).length > 0) {
      setDprState((prev) => {
        const next = { ...prev };
        Object.entries(persistedEntryIds).forEach(([rowId, entryId]) => {
          if (next[rowId]) {
            next[rowId] = { ...next[rowId], entry_id: entryId };
          }
        });
        return next;
      });
    }

    queryClient.invalidateQueries({ queryKey: ['progress'] });
    queryClient.invalidateQueries({ queryKey: ['budgetItems'] });
    queryClient.invalidateQueries({ queryKey: ['milestones'] });
    queryClient.invalidateQueries({ queryKey: ['wbs'] });

    if (savedCount > 0 && scopeKey) {
      setLockedScopes((prev) => ({ ...prev, [scopeKey]: true }));
    }

    setLoadedScope(null);
    return { savedCount, deletedCount };
  };

  const handleConfirmSubmitDpr = async () => {
    setIsSubmitting(true);
    try {
      const { savedCount, deletedCount } = await persistWorksheetDpr();

      for (const panelRef of dprPanelRefs) {
        if (panelRef.current?.save) {
          await panelRef.current.save();
        }
      }

      setShowReviewDialog(false);
      const detailParts = [];
      if (savedCount > 0) detailParts.push(`${savedCount} worksheet row${savedCount === 1 ? '' : 's'}`);
      if (deletedCount > 0) detailParts.push(`${deletedCount} removed`);
      toast({
        title: 'DPR Submitted',
        description: detailParts.length ? `All sections saved (${detailParts.join(', ')}).` : 'All sections saved successfully.',
      });
    } catch (e) {
      console.error('Error saving DPR:', e);
      toast({
        title: 'Failed to Save DPR',
        description: e?.message || 'Unable to save DPR. Please check backend logs.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRowModified = (rowId) => {
    const state = dprState[rowId];
    if (!state) return false;
    
    const row = worksheetRowById.get(rowId);
    if (!row) return false;

    const selectedDateEntry = dprEntriesForSelectedDate.find((entry) => rowMatchesEntry(row, entry));
    
    const currentQty = state.qty_executed === '' ? 0 : parseFloat(state.qty_executed) || 0;
    const dbQty = selectedDateEntry ? selectedDateEntry.quantity_done || 0 : 0;
    
    const currentLabor = state.labor_count === '' ? 0 : parseFloat(state.labor_count) || 0;
    const dbLabor = selectedDateEntry ? selectedDateEntry.labor_count || 0 : 0;
    
    const currentDesc = state.description || '';
    const dbDesc = selectedDateEntry ? selectedDateEntry.work_done_description || '' : '';
    
    const currentIssues = state.issues || '';
    const dbIssues = selectedDateEntry ? selectedDateEntry.issues_reported || '' : '';

    const currentWBS = state.wbs_item_id || '';
    const dbWBS = selectedDateEntry ? selectedDateEntry.wbs_item_id || '' : '';

    const currentTomorrow = state.tomorrow_qty === '' ? '' : String(state.tomorrow_qty);
    const hasTomorrowChange = currentTomorrow !== '';
    
    return currentQty !== dbQty || currentLabor !== dbLabor || currentDesc !== dbDesc || currentIssues !== dbIssues || currentWBS !== dbWBS || hasTomorrowChange;
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProgressEntry.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['budgetItems'] });
    },
  });

  const searchableActivities = useMemo(
    () => worksheetRows.filter((item) => !activeBudgetIds.includes(item.row_id)),
    [worksheetRows, activeBudgetIds]
  );

  // Active budget items listed in DPR sheet
  const activeBudgetItems = activeBudgetIds
    .map((rowId) => worksheetRowById.get(rowId))
    .filter(Boolean);
  const modifiedCount = activeBudgetIds.filter(id => isRowModified(id)).length;

  const getWorksheetReviewSection = useCallback(() => ({
    title: 'A. DPR Worksheet',
    columns: [
      {
        key: 'activity',
        label: 'Activity',
        render: (r) => (
          <div>
            {r.code && <div className="font-mono text-[10px] text-muted-foreground">{r.code}</div>}
            <div className="font-semibold">{r.title}</div>
          </div>
        ),
      },
      { key: 'unit', label: 'Unit' },
      { key: 'total_qty', label: 'Total Qty' },
      { key: 'today_qty', label: 'Today Qty' },
      { key: 'balance_qty', label: 'Balance Qty' },
      { key: 'cumulative_qty', label: 'Cumulative Qty' },
      { key: 'percent_comp', label: '% Comp.' },
      { key: 'today_vowd', label: "Today's VOWD", render: (r) => formatCurrencyINR(r.today_vowd) },
      { key: 'cumulative_vowd', label: 'Cumulative VOWD', render: (r) => formatCurrencyINR(r.cumulative_vowd) },
      { key: 'tomorrow_qty', label: 'QTY Plan Tomorrow' },
      { key: 'tomorrow_vowd', label: 'VOWD Plan Tomorrow', render: (r) => formatCurrencyINR(r.tomorrow_vowd) },
    ],
    rows: activeBudgetItems.map((row) => {
      const state = dprState[row.row_id] || {};
      const itemProgress = entries.filter(
        (e) => rowMatchesEntry(row, e) && (e.report_type === 'daily' || !e.report_type) && !e._is_aggregated
      );
      const qtyBefore = itemProgress
        .filter((e) => normalizeDateKey(e.date) < selectedReportDate)
        .reduce((sum, e) => sum + (parseFloat(e.quantity_done) || 0), 0);
      const todayQty = state.qty_executed === '' ? 0 : parseFloat(state.qty_executed) || 0;
      const tomorrowQty = state.tomorrow_qty === '' ? 0 : parseFloat(state.tomorrow_qty) || 0;
      const cumulativeQty = qtyBefore + todayQty;
      const rate = parseFloat(row.cost_per_unit) || 0;
      const totalQty = parseFloat(row.quantity) || 0;
      return {
        code: row.code || '',
        title: row.title,
        unit: row.unit || '—',
        total_qty: totalQty,
        today_qty: todayQty || '—',
        balance_qty: Math.max(0, totalQty - cumulativeQty),
        cumulative_qty: cumulativeQty,
        percent_comp: totalQty > 0 ? `${((cumulativeQty / totalQty) * 100).toFixed(1)}%` : '0%',
        today_vowd: todayQty * rate,
        cumulative_vowd: cumulativeQty * rate,
        tomorrow_qty: tomorrowQty || '—',
        tomorrow_vowd: tomorrowQty * rate,
      };
    }).filter((row) => row.today_qty !== '—' || row.tomorrow_qty !== '—'),
  }), [activeBudgetItems, dprState, entries, rowMatchesEntry, selectedReportDate]);

  const reviewSections = useMemo(() => {
    const sections = [getWorksheetReviewSection()];
    dprPanelRefs.forEach((panelRef) => {
      const data = panelRef.current?.getReviewData?.();
      if (data) sections.push(data);
    });
    sections.push({
      title: 'J. Weather Report',
      columns: [{ key: 'condition', label: 'Condition' }],
      rows: [{ condition: weatherCondition.charAt(0).toUpperCase() + weatherCondition.slice(1) }],
    });
    return sections;
  }, [getWorksheetReviewSection, dprPanelRefs, weatherCondition, showReviewDialog]);

  // Aggregated data generator helpers for WPR/MPR
  const buildAggregatedData = (start, end) => {
    const data = [];
    const scopedEntries = entries.filter(
      (e) => {
        const entryDate = normalizeDateKey(e.date);
        return entryDate >= start && entryDate <= end && (e.report_type === 'daily' || !e.report_type) && !e._is_aggregated;
      }
    );
    
    const grouped = {};
    scopedEntries.forEach((entry) => {
      const key = entry.budget_item_id || (entry.wbs_item_id ? `wbs_${entry.wbs_item_id}` : null);
      if (!key) return;

      if (!grouped[key]) {
        grouped[key] = {
          qtyDone: 0,
          value: 0,
          laborCount: 0,
          budgetItemId: entry.budget_item_id || '',
          wbsItemId: entry.wbs_item_id || '',
          activityKey: getEntryActivityKey(entry),
        };
      }

      grouped[key].qtyDone += parseFloat(entry.quantity_done) || 0;
      grouped[key].value += parseFloat(entry.value_of_work_done) || 0;
      grouped[key].laborCount += parseFloat(entry.labor_count) || 0;
      if (!grouped[key].wbsItemId && entry.wbs_item_id) grouped[key].wbsItemId = entry.wbs_item_id;
      if (!grouped[key].activityKey) grouped[key].activityKey = getEntryActivityKey(entry);
    });
    
    Object.entries(grouped).forEach(([itemId, metrics]) => {
      const mappedRow = (
        (metrics.budgetItemId ? worksheetRowByBudgetId.get(metrics.budgetItemId) : null) ||
        (metrics.wbsItemId ? worksheetRowByWbsId.get(metrics.wbsItemId) : null) ||
        (metrics.activityKey ? worksheetRowByActivityId.get(metrics.activityKey) : null)
      );
      const fallbackBudget = metrics.budgetItemId
        ? budgetItems.find((b) => b.id === metrics.budgetItemId)
        : null;
      const row = mappedRow || fallbackBudget;
      if (!row) return;

      const parentHead = budgetItems.find((p) => p.id === row.parent_id);
      const wbsItem = wbsItems.find((w) => w.id === (row.wbs_item_id || metrics.wbsItemId));
      
      data.push({
        id: itemId,
        title: row.title,
        code: row.code,
        domain: parentHead ? `${parentHead.code}: ${parentHead.title}` : '—',
        subProject: wbsItem ? wbsItem.title || wbsItem.name : '—',
        unit: row.unit,
        qtyDone: metrics.qtyDone,
        value: metrics.value,
        laborCount: metrics.laborCount
      });
    });

    return data.sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })
    );
  };

  const getMonthlyAggregatedData = (start, end) => buildAggregatedData(start, end);

  // History stats
  const filtered = entries.filter(e => !typeFilter || e.report_type === typeFilter);
  const draftCount = entries.filter(e => e.status === 'draft').length;
  const submittedCount = entries.filter(e => e.status === 'submitted').length;
  const approvedCount = entries.filter(e => e.status === 'approved').length;
  const totalLabor = entries.reduce((s, e) => s + (e.labor_count || 0), 0);

  const statusColor = {
    draft: 'bg-slate-100 text-slate-600',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700'
  };

  const fmt = (v) => formatCompactCurrencyINR(v);
  const fmtFull = (v) => formatCurrencyINR(v);

  // Weekly WPR computations
  const currentWeekObj = weeksList.find(w => w.id === selectedWeek) || weeksList[0];

  // Monthly MPR computations
  const currentMonthObj = monthsList.find(m => m.id === selectedMonth) || monthsList[0];
  const monthlyData = currentMonthObj ? getMonthlyAggregatedData(currentMonthObj.startDate, currentMonthObj.endDate) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            {TAB_TITLES[activeTab] || 'Site Progress'}
          </h1>
        </div>
      </div>

      {/* Primary Project + Sub Project Filter */}
      <ProjectSubProjectSelector
        projects={projects}
        subProjects={subProjects}
        projectId={projectId}
        subProjectId={subProjectId}
        onProjectChange={setProjectId}
        onSubProjectChange={setSubProjectId}
      >
        {activeTab === 'sheet' && projectId && subProjectId && (
          <>
            <div className="h-9 w-px bg-border hidden md:block self-end mb-1" />

            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg text-primary shrink-0 self-end mb-1">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Reporting Date</p>
                <Input
                  type="date"
                  value={selectedReportDate}
                  onChange={(event) => setSelectedReportDate(event.target.value)}
                  className="h-9 w-36 text-xs font-semibold px-2 py-1"
                />
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-none absolute">{formattedSelectedDate}</p>
              </div>
            </div>

            <div className="h-9 w-px bg-border hidden md:block self-end mb-1" />

            <div className="flex flex-col gap-1 justify-end">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Weather</span>
              <Select
                value={weatherCondition}
                onValueChange={(value) => {
                  weatherManualRef.current = true;
                  setWeatherManuallyEdited(true);
                  setWeatherCondition(value);
                }}
                disabled={isSelectedDateLocked}
              >
                <SelectTrigger className="w-32 h-9 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(weatherIcons).map(([key, icon]) => (
                    <SelectItem key={key} value={key} className="text-xs">{icon} {key.charAt(0).toUpperCase() + key.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-none absolute translate-y-10">
                {weatherLoading
                  ? 'Fetching weather...'
                  : weatherError
                    ? weatherError
                    : weatherInfo
                      ? `Auto-filled (${weatherInfo})`
                      : 'Weather is editable.'}
              </p>
            </div>
          </>
        )}
        {activeTab === 'wpr' && projectId && subProjectId && (
          <>
            <div className="h-9 w-px bg-border hidden md:block self-end mb-1" />

            <div className="flex flex-col gap-1 justify-end">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Select Month</span>
              <Select value={selectedWprMonth} onValueChange={handleWprMonthChange}>
                <SelectTrigger className="w-36 h-9 text-xs px-2">
                  <SelectValue placeholder="Choose Month" />
                </SelectTrigger>
                <SelectContent>
                  {wprMonths.map(m => (
                    <SelectItem key={m.key} value={m.key} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-9 w-px bg-border hidden md:block self-end mb-1" />

            <div className="flex flex-col gap-1 justify-end">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Select Week</span>
              <Select value={selectedWeek} onValueChange={setSelectedWeek} disabled={!filteredWeeksForDropdown.length}>
                <SelectTrigger className="w-52 h-9 text-xs px-2">
                  <SelectValue placeholder={filteredWeeksForDropdown.length ? 'Choose Week' : 'No weeks available'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredWeeksForDropdown.map(w => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      Week {w.weekNum} ({w.startDate} to {w.endDate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {activeTab === 'mpr' && projectId && subProjectId && (
          <>
            <div className="h-9 w-px bg-border hidden md:block self-end mb-1" />

            <div className="flex flex-col gap-1 justify-end flex-1 max-w-[260px]">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Select Month</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full h-9 text-xs px-2">
                  <SelectValue placeholder="Choose Month" />
                </SelectTrigger>
                <SelectContent>
                  {monthsList.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[9px] opacity-0 mt-0.5 leading-none">&nbsp;</p>
            </div>
          </>
        )}
      </ProjectSubProjectSelector>

      <SubProjectGate projectId={projectId} subProjectId={subProjectId} subProjects={subProjects}>


      {/* 1. Daily DPR Sheet Tab */}
      {activeTab === 'sheet' && (
        <div className="space-y-4">
          {isReady ? (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_-12px_rgba(15,23,42,0.18)] dark:from-slate-900/80 dark:via-slate-900/40 dark:to-slate-950/80 dark:border-primary/20">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2 flex-1">
                    {[
                      { id: 'dpr', label: 'DPR Worksheet' },
                      { id: 'contractor', label: 'Labour Details' },
                      { id: 'staff-attendance', label: 'Technical Staff Attendance' },
                      { id: 'material-status', label: 'Material Status' },
                      { id: 'machinery-details', label: 'Machineries Details' },
                      { id: 'days-report', label: "Day's Report" },
                      { id: 'status-report', label: 'Status Report' },
                      { id: 'special-site-visits', label: 'Special Site Visits' },
                      { id: 'critical-issues', label: 'Critical Issues' },
                      { id: 'next-days-plan', label: "Next Day's Plan" },
                    ].map((tab) => {
                      const isActive = sheetSubTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSheetSubTab(tab.id)}
                          className={`group relative inline-flex items-center rounded-xl px-3.5 py-2 text-left text-[12px] font-medium tracking-wide transition-all duration-200 ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_rgba(15,40,70,0.65)] ring-1 ring-primary/30'
                              : 'bg-slate-200/90 text-slate-700 ring-1 ring-slate-300/80 hover:-translate-y-0.5 hover:bg-slate-300/70 hover:text-slate-900 hover:shadow-md hover:ring-primary/25 dark:bg-slate-700/90 dark:text-slate-100 dark:ring-slate-500/70 dark:hover:bg-slate-600 dark:hover:text-white'
                          }`}
                        >
                          <span className="leading-tight">{tab.label}</span>
                          {isActive && (
                            <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {sheetSubTab === 'dpr' && !isSelectedDateLocked && modifiedCount > 0 && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] px-2 py-0.5 font-bold">
                        ⚠️ {modifiedCount} unsaved
                      </Badge>
                    )}
                    <Button
                      onClick={handleSaveDpr}
                      disabled={isSubmitting || !isReady || isSelectedDateLocked}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-5 text-sm shadow-sm transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {isSelectedDateLocked ? 'Date Locked' : 'Save DPR'}
                    </Button>
                  </div>
                </div>
              </div>

              {isSelectedDateLocked && (
                <div className="flex items-center gap-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    DPR is already submitted for <span className="font-semibold">{selectedReportDate}</span>.
                    {dprEntriesForSelectedDate.length > 0 && (
                      <span className="ml-1 text-emerald-700 font-semibold">
                        {dprEntriesForSelectedDate.length} progress entr{dprEntriesForSelectedDate.length === 1 ? 'y' : 'ies'} recorded.
                      </span>
                    )}
                    {' '}This date is locked and cannot be changed.
                  </span>
                </div>
              )}

              <div className={sheetSubTab === 'contractor' ? '' : 'hidden'}>
                <ContractorLabourPanel
                  ref={contractorRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'staff-attendance' ? '' : 'hidden'}>
                <TechnicalStaffAttendancePanel
                  ref={staffRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'material-status' ? '' : 'hidden'}>
                <MaterialStatusPanel
                  ref={materialRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'machinery-details' ? '' : 'hidden'}>
                <MachineriesDetailsPanel
                  ref={machineryRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'days-report' ? '' : 'hidden'}>
                <DaysReportPanel
                  ref={daysReportRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'status-report' ? '' : 'hidden'}>
                <StatusReportPanel
                  ref={statusReportRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'special-site-visits' ? '' : 'hidden'}>
                <SpecialSiteVisitsPanel
                  ref={siteVisitsRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'critical-issues' ? '' : 'hidden'}>
                <CriticalIssuesPanel
                  ref={criticalIssuesRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>
              <div className={sheetSubTab === 'next-days-plan' ? '' : 'hidden'}>
                <NextDaysPlansPanel
                  ref={nextDaysPlanRef}
                  projectId={projectId}
                  subProjectId={subProjectId}
                  selectedDate={selectedReportDate}
                  isDateLocked={isSelectedDateLocked}
                />
              </div>

              <DprReviewDialog
                open={showReviewDialog}
                onOpenChange={setShowReviewDialog}
                meta={{
                  date: selectedReportDate,
                  projectName: selectedProject?.name,
                  subProjectName: selectedSubProject?.name,
                  submittedBy,
                  weather: weatherCondition,
                }}
                sections={reviewSections}
                onConfirm={handleConfirmSubmitDpr}
                isSubmitting={isSubmitting}
              />

              {sheetSubTab === 'dpr' && (
                <>
              {/* Searchable Activity Selector */}
              <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add Activity to Worksheet</div>
                {worksheetCarryForwardCount > 0 && (
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    {worksheetCarryForwardCount} legacy L1 activit{worksheetCarryForwardCount === 1 ? 'y is' : 'ies are'} carried into L3 because consumed quantity exists.
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Search Activity</Label>
                  <Popover
                    open={activityPickerOpen}
                    onOpenChange={(open) => {
                      setActivityPickerOpen(open);
                      if (!open) {
                        setSearchQuery('');
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        disabled={isSelectedDateLocked || searchableActivities.length === 0}
                        className="h-9 mt-0.5 justify-between font-normal"
                      >
                        {isSelectedDateLocked
                          ? 'Date Locked'
                          : (searchableActivities.length === 0
                            ? 'No activities available'
                            : 'Search by activity code or name...')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(90vw,560px)] p-0"
                      align="start"
                      side="bottom"
                      sideOffset={6}
                      avoidCollisions={false}
                    >
                      <Command>
                        <CommandInput
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          placeholder="Type activity code or name..."
                        />
                        <CommandList>
                          <CommandEmpty>No activity found.</CommandEmpty>
                          <CommandGroup>
                            {searchableActivities.map((item) => (
                              <CommandItem
                                key={item.row_id}
                                value={`${item.code || ''} ${item.title || ''}`}
                                onSelect={() => {
                                  handleAddActivity(item.row_id);
                                  setActivityPickerOpen(false);
                                  setSearchQuery('');
                                }}
                                className="gap-3 items-start py-2.5"
                              >
                                <span className="font-mono text-xs font-semibold whitespace-nowrap min-w-[170px] max-w-[220px] shrink-0">
                                  {highlightText(item.code || '—', searchQuery)}
                                </span>
                                <span className="flex-1 text-xs whitespace-normal break-words">
                                  {highlightText(item.title, searchQuery)}
                                </span>
                                {item.is_l1_carry_forward && (
                                  <span className="text-[10px] font-medium text-sky-700 bg-sky-100 border border-sky-200 rounded px-1.5 py-0.5 shrink-0 self-center">
                                    L1 carried
                                  </span>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Sheet Table */}
              {entriesLoading ? (
                <div className="text-center py-12 text-muted-foreground text-sm font-sans">Loading worksheets...</div>
              ) : activeBudgetItems.length === 0 && isSelectedDateLocked && dprEntriesForSelectedDate.length > 0 ? (
                /* Fallback read-only view: date is locked, entries exist in DB but can't map to WBS rows */
                <Card className="overflow-hidden border shadow-sm">
                  <CardHeader className="pb-2 bg-emerald-50/60 border-b">
                    <CardTitle className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Submitted DPR Entries for {selectedReportDate}
                    </CardTitle>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-sans border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">#</th>
                          <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Activity / Description</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Qty Done</th>
                          <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Unit</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Labourers</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Value (VOWD)</th>
                          <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Work Description</th>
                          <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Issues</th>
                          <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dprEntriesForSelectedDate.map((entry, idx) => {
                          const linkedBudget = allBudgetItems.find(b => b.id === entry.budget_item_id);
                          const linkedWbs = allWbsItems.find(w => w.id === (entry.wbs_item_id || linkedBudget?.wbs_item_id));
                          const activityTitle = linkedBudget?.title || linkedWbs?.title || linkedWbs?.name || entry.work_done_description || `Entry #${idx + 1}`;
                          const activityCode = linkedBudget?.code || linkedWbs?.activity_code || linkedWbs?.code || '';
                          return (
                            <tr key={entry.id} className="border-b hover:bg-muted/10 transition-colors">
                              <td className="p-3 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                              <td className="p-3">
                                <p className="font-semibold text-xs text-foreground">{activityTitle}</p>
                                {activityCode && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{activityCode}</p>}
                              </td>
                              <td className="p-3 text-right font-mono text-xs font-bold text-foreground">
                                {Number(entry.quantity_done || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">{entry.unit || '—'}</td>
                              <td className="p-3 text-right font-mono text-xs">{entry.labor_count || 0}</td>
                              <td className="p-3 text-right font-mono text-xs font-semibold text-emerald-700">
                                {fmtFull(parseFloat(entry.value_of_work_done) || 0)}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground max-w-[180px] truncate" title={entry.work_done_description}>
                                {entry.work_done_description || '—'}
                              </td>
                              <td className="p-3 text-xs text-destructive max-w-[150px] truncate" title={entry.issues_reported}>
                                {entry.issues_reported || '—'}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  entry.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : entry.status === 'submitted'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-muted text-muted-foreground border-border'
                                }`}>
                                  {entry.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                                  {entry.status || 'draft'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/20 border-t">
                        <tr>
                          <td colSpan={2} className="p-3 text-xs font-bold text-muted-foreground">TOTAL</td>
                          <td className="p-3 text-right font-mono text-xs font-bold">
                            {dprEntriesForSelectedDate.reduce((s, e) => s + (parseFloat(e.quantity_done) || 0), 0).toLocaleString()}
                          </td>
                          <td colSpan={2} className="p-3 text-right font-mono text-xs font-semibold">
                            {dprEntriesForSelectedDate.reduce((s, e) => s + (parseFloat(e.labor_count) || 0), 0)} labourers
                          </td>
                          <td className="p-3 text-right font-mono text-xs font-bold text-emerald-700">
                            {fmtFull(dprEntriesForSelectedDate.reduce((s, e) => s + (parseFloat(e.value_of_work_done) || 0), 0))}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              ) : activeBudgetItems.length === 0 ? (
                <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground bg-muted/5 font-sans">
                  <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-semibold text-sm">DPR Worksheet Empty</p>
                  <p className="text-xs mt-1 text-muted-foreground/80 max-w-md mx-auto">
                    No activities selected for {selectedReportDate}. Use the searchable activity selector above to add activities and report progress.
                  </p>
                </div>
              ) : (
                <Card className="overflow-hidden border shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-sans border-collapse min-w-[1200px]">
                      <thead>
                        <tr className="border-b bg-[#D9E1F2]">
                          <th className="sticky left-0 z-20 bg-[#D9E1F2] text-left p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r min-w-[260px]">
                            Activity
                          </th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-16">Unit</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-24">Total Qty</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-24">Today Qty</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-24">Balance Qty</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-28">Cumulative Completed Qty</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-20">% Comp.</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-28">Today&apos;s VOWD</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-28">Cumulative VOWD</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-28">QTY Plan for Tomorrow</th>
                          <th className="text-center p-2.5 font-bold text-[11px] text-foreground uppercase tracking-wide border-r w-28">VOWD Plan for Tomorrow</th>
                          <th className="p-2.5 w-10 border-l bg-[#D9E1F2]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeBudgetItems.map((bItem) => {
                          const rowId = bItem.row_id;

                          const itemProgress = entries.filter(
                            (e) => rowMatchesEntry(bItem, e) &&
                            (e.report_type === 'daily' || !e.report_type) &&
                            !e._is_aggregated
                          );

                          const qtyBefore = itemProgress
                            .filter((e) => normalizeDateKey(e.date) < selectedReportDate)
                            .reduce((sum, e) => sum + (parseFloat(e.quantity_done) || 0), 0);

                          const state = dprState[rowId] || {};
                          const todayQty = state.qty_executed === '' ? 0 : parseFloat(state.qty_executed) || 0;
                          const tomorrowQty = state.tomorrow_qty === '' ? 0 : parseFloat(state.tomorrow_qty) || 0;
                          const cumulativeQty = qtyBefore + todayQty;
                          const totalQty = parseFloat(bItem.quantity) || 0;
                          const balanceQty = Math.max(0, totalQty - cumulativeQty);
                          const maxTodayQty = Math.max(0, totalQty - qtyBefore);
                          const rate = parseFloat(bItem.cost_per_unit) || 0;
                          const percentComp = totalQty > 0 ? (cumulativeQty / totalQty) * 100 : 0;
                          const todayVowd = todayQty * rate;
                          const cumulativeVowd = cumulativeQty * rate;
                          const tomorrowVowd = tomorrowQty * rate;

                          const isComplete = percentComp >= 100;
                          const isCarryForwardRow = bItem.is_l1_carry_forward;
                          const rowModified = isRowModified(rowId);

                          return (
                            <tr
                              key={rowId}
                              className={`border-b hover:bg-muted/20 transition-colors ${
                                rowModified
                                  ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                  : isComplete
                                    ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                    : isCarryForwardRow
                                      ? 'bg-sky-500/5 hover:bg-sky-500/10'
                                      : ''
                              }`}
                            >
                              <td className={`sticky left-0 border-r z-10 p-2.5 text-xs transition-colors min-w-[260px] ${
                                rowModified
                                  ? 'bg-amber-50/95 dark:bg-amber-950/20'
                                  : isComplete
                                    ? 'bg-emerald-50/95 dark:bg-emerald-950/20'
                                    : isCarryForwardRow
                                      ? 'bg-sky-50/95 dark:bg-sky-950/20'
                                      : 'bg-card'
                              }`}>
                                {bItem.code && (
                                  <p className="font-mono text-[10px] text-muted-foreground leading-tight">{bItem.code}</p>
                                )}
                                <p className="font-semibold text-foreground leading-snug mt-0.5">{bItem.title}</p>
                                {isCarryForwardRow && (
                                  <p className="text-[10px] mt-1 inline-flex items-center rounded border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-sky-700">
                                    L1 carried (consumed {Number(bItem.carry_forward_consumed_qty || 0).toLocaleString()})
                                  </p>
                                )}
                              </td>

                              <td className="p-2.5 text-center text-xs text-muted-foreground border-r">{bItem.unit || '—'}</td>

                              <td className="p-2.5 text-right font-mono text-xs border-r">
                                {totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>

                              <td className="p-2.5 text-center border-r">
                                <Input
                                  type="number"
                                  step="any"
                                  min={0}
                                  max={maxTodayQty}
                                  className="w-20 mx-auto text-right h-8 text-xs font-mono font-semibold"
                                  placeholder="0"
                                  value={state.qty_executed ?? ''}
                                  onChange={(e) => handleQtyExecutedChange(rowId, e.target.value)}
                                  disabled={isSelectedDateLocked || maxTodayQty <= 0}
                                  title={maxTodayQty > 0 ? `Max today: ${maxTodayQty}` : 'No balance quantity remaining'}
                                />
                              </td>

                              <td className="p-2.5 text-right font-mono text-xs border-r">
                                {balanceQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>

                              <td className="p-2.5 text-right font-mono text-xs border-r">
                                {cumulativeQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>

                              <td className="p-2.5 text-right font-mono text-xs border-r">
                                <span className={isComplete ? 'text-emerald-600 font-bold' : ''}>
                                  {percentComp.toFixed(1)}%
                                </span>
                              </td>

                              <td className="p-2.5 text-right font-mono text-xs border-r text-emerald-700">
                                {fmtFull(todayVowd)}
                              </td>

                              <td className="p-2.5 text-right font-mono text-xs border-r font-semibold">
                                {fmtFull(cumulativeVowd)}
                              </td>

                              <td className="p-2.5 text-center border-r">
                                <Input
                                  type="number"
                                  step="any"
                                  className="w-20 mx-auto text-right h-8 text-xs font-mono"
                                  placeholder="0"
                                  value={state.tomorrow_qty ?? ''}
                                  onChange={(e) => handleInputChange(rowId, 'tomorrow_qty', e.target.value)}
                                  disabled={isSelectedDateLocked}
                                />
                              </td>

                              <td className="p-2.5 text-right font-mono text-xs border-r text-muted-foreground">
                                {tomorrowQty > 0 ? fmtFull(tomorrowVowd) : '—'}
                              </td>

                              <td className="p-2.5 border-l text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveActivity(rowId)}
                                  className="w-7 h-7 hover:bg-destructive/10 text-destructive/80 hover:text-destructive"
                                  disabled={isSelectedDateLocked}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
              </>
              )}
            </>
          ) : (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground font-sans">
              Select a project from the dropdown to load the DPR worksheet.
            </div>
          )}
        </div>
      )}

      {/* 2. Weekly WPR Sheet Tab */}
      {activeTab === 'wpr' && (
        <div className="space-y-4">
          <WprSheetPanel
            projectId={projectId}
            subProjectId={subProjectId}
            selectedProject={selectedProject}
            selectedSubProject={selectedSubProject}
            week={currentWeekObj}
            submittedBy={submittedBy}
          />
        </div>
      )}

      {/* 3. Monthly MPR Sheet Tab */}
      {activeTab === 'mpr' && (
        <div className="space-y-4">
          <div className="space-y-4">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-base font-bold">Aggregated Monthly Progress Log ({currentMonthObj?.label})</CardTitle>
            </CardHeader>
            
            <Card className="overflow-hidden border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Line Item</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Domain</th>
                      <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Sub-Project</th>
                      <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase">Unit</th>
                      <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase">Monthly Qty Done</th>
                      <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase">Value of Work</th>
                      <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase">Labour Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(row => (
                      <tr key={row.id} className="border-b hover:bg-muted/10 transition-colors">
                        <td className="p-3 text-xs font-semibold whitespace-nowrap">{row.title}</td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{row.domain}</td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{row.subProject}</td>
                        <td className="p-3 text-center text-xs font-bold text-muted-foreground">{row.unit}</td>
                        <td className="p-3 text-right font-mono text-xs font-semibold">{row.qtyDone.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-xs text-emerald-600 font-bold">{fmtFull(row.value)}</td>
                        <td className="p-3 text-right font-mono text-xs">{row.laborCount}</td>
                      </tr>
                    ))}
                    {monthlyData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs font-sans">
                          No daily progress logged during this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 4. Aggregated Logs & History Tab */}
      {activeTab === 'history' && isAdmin && (
        <div className="space-y-6">
          {/* History Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Log Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Log Types</SelectItem>
                <SelectItem value="daily">Daily Logs (DPR)</SelectItem>
                <SelectItem value="weekly">Weekly Rollup (WPR)</SelectItem>
                <SelectItem value="monthly">Monthly Rollup (MPR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Draft Logs', value: draftCount, icon: Clock, color: 'text-slate-500' },
              { label: 'Submitted Logs', value: submittedCount, icon: ClipboardList, color: 'text-blue-600' },
              { label: 'Approved Logs', value: approvedCount, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Total Site Attendance', value: totalLabor, icon: AlertTriangle, color: 'text-amber-600' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <s.icon className={`w-8 h-8 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold font-sans">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Aggregated Logs List */}
          {entriesLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-sans">Loading log history...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No progress records found" description="Submitted progress entries will appear here." />
          ) : (
            <Card className="overflow-hidden border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-semibold text-xs">Date / Period</th>
                      <th className="text-left p-3 font-semibold text-xs">Type</th>
                      <th className="text-left p-3 font-semibold text-xs">Work Description & Line Item</th>
                      <th className="text-right p-3 font-semibold text-xs">Quantity Logged</th>
                      <th className="text-right p-3 font-semibold text-xs">Value of Work Done</th>
                      <th className="text-right p-3 font-semibold text-xs">Attendance</th>
                      <th className="text-left p-3 font-semibold text-xs">Weather</th>
                      <th className="text-left p-3 font-semibold text-xs">Status</th>
                      <th className="p-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => {
                      const bItem = budgetItems.find(b => b.id === e.budget_item_id);
                      return (
                        <tr key={e.id} className="border-b hover:bg-muted/10 transition-colors">
                          <td className="p-3 text-xs font-semibold whitespace-nowrap text-slate-700">{e.date}</td>
                          <td className="p-3">
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 ${
                                e.report_type === 'weekly' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                  : e.report_type === 'monthly'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {e.report_type}
                            </Badge>
                          </td>
                          <td className="p-3 max-w-xs">
                            <p className="truncate font-semibold text-foreground">{e.work_done_description || '—'}</p>
                            {bItem && (
                              <p className="text-[10px] text-primary font-bold mt-0.5 truncate flex items-center gap-1">
                                <span>🔗</span> {bItem.code}: {bItem.title}
                              </p>
                            )}
                            {e.issues_reported && (
                              <p className="text-[10px] text-destructive mt-0.5 truncate font-medium">
                                ⚠️ {e.issues_reported}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap font-mono font-medium text-xs">
                            {e.quantity_done ? `${e.quantity_done.toLocaleString()} ${e.unit || ''}` : '—'}
                          </td>
                          <td className="p-3 text-right text-emerald-600 font-bold font-mono text-xs whitespace-nowrap">
                            {e.value_of_work_done ? fmt(e.value_of_work_done) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-xs">{e.labor_count || 0}</td>
                          <td className="p-3 whitespace-nowrap text-xs">
                            {weatherIcons[e.weather_condition] || '—'}{' '}
                            <span className="capitalize text-muted-foreground">{e.weather_condition}</span>
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusColor[e.status] || ''}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {!e._is_aggregated ? (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-destructive hover:bg-destructive/10" 
                                onClick={() => deleteMutation.mutate(e.id)}
                              >
                                <span className="text-xs">🗑️</span>
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-[8px] bg-muted text-muted-foreground font-bold tracking-wider">AUTO</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
      </SubProjectGate>
    </div>
  );
}