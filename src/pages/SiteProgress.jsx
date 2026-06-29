import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, Calendar, Check, Save, X, ChevronsUpDown } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { formatCompactCurrencyINR, formatCurrencyINR } from '@/lib/formatters';
import { useAuth } from '@/lib/AuthContext';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';
import { filterBudgetBySubProject, filterProgressBySubProject, filterWbsBySubProject } from '@/lib/subProjectScope';

const weatherIcons = { clear: '☀️', cloudy: '⛅', rainy: '🌧️', stormy: '⛈️', hot: '🌡️' };
const normalizeActivityKey = (value) => String(value || '').trim().toLowerCase();

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

  const {
    projects, subProjects, wbsItems: allWbsItems, projectId, subProjectId,
    setProjectId, setSubProjectId, isReady, selectedProject, selectedSubProject,
  } = useProjectSubProject({ fetchWbs: true });

  const [typeFilter, setTypeFilter] = useState('');
  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet', 'wpr', 'mpr', 'history'
  const [dprState, setDprState] = useState({});
  const [activeBudgetIds, setActiveBudgetIds] = useState([]);
  const [weatherCondition, setWeatherCondition] = useState('clear');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState('');
  const [weatherError, setWeatherError] = useState('');
  const [weatherManuallyEdited, setWeatherManuallyEdited] = useState(false);
  const [submittedBy, setSubmittedBy] = useState('Supervisor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadedScope, setLoadedScope] = useState(null);
  const [lockedScopes, setLockedScopes] = useState({});
  
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const weatherManualRef = useRef(false);

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
  const formattedSelectedDate = new Date(selectedReportDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getWeeksList = () => {
    const weeks = [];
    const curr = new Date();
    for (let i = 0; i < 8; i++) {
      const startOfWeek = new Date(curr);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) - (i * 7);
      startOfWeek.setDate(diff);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];
      
      const tempDate = new Date(startOfWeek.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      
      weeks.push({
        id: `week_${i}`,
        label: `Week ${weekNum} (${startStr} to ${endStr})`,
        startDate: startStr,
        endDate: endStr
      });
    }
    return weeks;
  };

  const getMonthsList = () => {
    const months = [];
    const curr = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(curr.getFullYear(), curr.getMonth() - i, 1);
      const monthName = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const startStr = d.toISOString().split('T')[0];
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const endStr = nextMonth.toISOString().split('T')[0];
      
      months.push({
        id: `month_${i}`,
        label: monthName,
        startDate: startStr,
        endDate: endStr
      });
    }
    return months;
  };

  const weeksList = getWeeksList();
  const monthsList = getMonthsList();

  const [selectedWeek, setSelectedWeek] = useState(weeksList[0]?.id || '');
  const [selectedMonth, setSelectedMonth] = useState(monthsList[0]?.id || '');

  // Redirect non-admins if they try to access history directly
  useEffect(() => {
    if (activeTab === 'history' && !isAdmin) {
      setActiveTab('sheet');
    }
  }, [activeTab, isAdmin]);

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
          entry.date === selectedReportDate &&
          (entry.report_type === 'daily' || !entry.report_type) &&
          !entry._is_aggregated
      ),
    [entries, selectedReportDate]
  );
  const isScopeLockedLocally = scopeKey ? Boolean(lockedScopes[scopeKey]) : false;
  const isSelectedDateLocked = isScopeLockedLocally || dprEntriesForSelectedDate.length > 0;

  useEffect(() => {
    setSelectedActivityId('');
    setActivityPickerOpen(false);
  }, [scopeKey]);

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
          daily: 'weather_code,temperature_2m_max',
          start_date: selectedReportDate,
          end_date: selectedReportDate,
        });

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`);
        if (!weatherRes.ok) {
          throw new Error('Could not fetch weather forecast.');
        }
        const weatherJson = await weatherRes.json();
        const weatherCode = weatherJson?.daily?.weather_code?.[0];
        const maxTemp = weatherJson?.daily?.temperature_2m_max?.[0];
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

  // Pre-populate active line items for selected DPR date
  useEffect(() => {
    if (!isReady) {
      setActiveBudgetIds([]);
      return;
    }
    const selectedDateItemIds = dprEntriesForSelectedDate
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
      .filter(Boolean);
    setActiveBudgetIds([...new Set(selectedDateItemIds)]);
  }, [
    scopeKey,
    dprEntriesForSelectedDate,
    isReady,
    worksheetRowByBudgetId,
    worksheetRowByWbsId,
    worksheetRowByActivityId,
    getEntryActivityKey,
  ]);

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

  const handleAddActivity = (id) => {
    if (isSelectedDateLocked) return;
    if (!id) return;
    if (activeBudgetIds.includes(id)) return;

    const row = worksheetRowById.get(id);
    
    setActiveBudgetIds(prev => [...prev, id]);
    setDprState(prev => ({
      ...prev,
      [id]: prev[id] || {
        qty_executed: '',
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
    setActiveBudgetIds(prev => prev.filter(id => id !== bItemId));
    setDprState(prev => {
      const updated = { ...prev };
      delete updated[bItemId];
      return updated;
    });
  };

  const handleSaveDpr = async () => {
    if (isSelectedDateLocked) {
      toast({
        title: 'Date Locked',
        description: 'DPR is already submitted for this date and cannot be changed.',
        variant: 'destructive',
      });
      return;
    }
    if (activeBudgetIds.length === 0) {
      toast({
        title: 'No Activity Selected',
        description: 'Add at least one activity before saving DPR.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let savedCount = 0;
      let deletedCount = 0;
      const persistedEntryIds = {};

      for (const rowId of activeBudgetIds) {
        const state = dprState[rowId];
        const row = worksheetRowById.get(rowId);
        if (!row || !state) continue;

        const hasValue = state.qty_executed !== '' || state.labor_count !== '' || state.description !== '' || state.issues !== '';

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
          // Only send wbs_item_id for WBS-only rows; older DBs may not have this column yet.
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
              next[rowId] = {
                ...next[rowId],
                entry_id: entryId,
              };
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
        setLockedScopes((prev) => ({
          ...prev,
          [scopeKey]: true,
        }));
      }
      
      setLoadedScope(null); // force clean sync on re-fetch
      toast({
        title: 'DPR Saved',
        description: `Saved ${savedCount} row${savedCount === 1 ? '' : 's'}${deletedCount ? `, removed ${deletedCount}` : ''}.`,
      });
    } catch (e) {
      console.error('Error saving DPR:', e);
      const msg = e?.message || 'Unable to save DPR. Please check backend logs.';
      toast({
        title: 'Failed to Save DPR',
        description: msg,
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
    
    return currentQty !== dbQty || currentLabor !== dbLabor || currentDesc !== dbDesc || currentIssues !== dbIssues || currentWBS !== dbWBS;
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
  const selectedActivityOption = searchableActivities.find((item) => item.row_id === selectedActivityId);
  const addActivityDisabled = isSelectedDateLocked || !selectedActivityOption;

  // Active budget items listed in DPR sheet
  const activeBudgetItems = activeBudgetIds
    .map((rowId) => worksheetRowById.get(rowId))
    .filter(Boolean);
  const modifiedCount = activeBudgetIds.filter(id => isRowModified(id)).length;

  // Aggregated data generator helpers for WPR/MPR
  const buildAggregatedData = (start, end) => {
    const data = [];
    const scopedEntries = entries.filter(
      (e) => e.date >= start && e.date <= end && (e.report_type === 'daily' || !e.report_type) && !e._is_aggregated
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

  const getWeeklyAggregatedData = (start, end) => buildAggregatedData(start, end);
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
  const weeklyData = currentWeekObj ? getWeeklyAggregatedData(currentWeekObj.startDate, currentWeekObj.endDate) : [];

  // Monthly MPR computations
  const currentMonthObj = monthsList.find(m => m.id === selectedMonth) || monthsList[0];
  const monthlyData = currentMonthObj ? getMonthlyAggregatedData(currentMonthObj.startDate, currentMonthObj.endDate) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Site Progress</h1>
          <p className="text-sm text-muted-foreground mt-1 font-sans">
            Log progress with the strict DPR worksheet, or review weekly and monthly rollups.
          </p>
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
      />

      {isReady && selectedProject && selectedSubProject && (
        <p className="text-sm text-muted-foreground">
          Progress for <span className="font-medium text-foreground">{selectedProject.name}</span>
          {' → '}
          <span className="font-medium text-foreground">{selectedSubProject.name}</span>
        </p>
      )}

      <SubProjectGate projectId={projectId} subProjectId={subProjectId} subProjects={subProjects}>
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
        <button 
          onClick={() => setActiveTab('sheet')} 
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'sheet' 
              ? 'border-primary text-primary font-semibold' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Daily DPR Sheet
        </button>
        <button 
          onClick={() => setActiveTab('wpr')} 
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'wpr' 
              ? 'border-primary text-primary font-semibold' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Weekly WPR Sheet
        </button>
        <button 
          onClick={() => setActiveTab('mpr')} 
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'mpr' 
              ? 'border-primary text-primary font-semibold' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Monthly MPR Sheet
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('history')} 
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'history' 
                ? 'border-primary text-primary font-semibold' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Aggregated Logs & History
          </button>
        )}
      </div>

      {/* 1. Daily DPR Sheet Tab */}
      {activeTab === 'sheet' && (
        <div className="space-y-4">
          {isReady ? (
            <>
              {/* DPR context card */}
              <div className="flex flex-wrap gap-4 items-center bg-card border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Reporting Date</p>
                    <Input
                      type="date"
                      value={selectedReportDate}
                      onChange={(event) => setSelectedReportDate(event.target.value)}
                      className="h-9 w-40 font-semibold"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">{formattedSelectedDate}</p>
                  </div>
                </div>
                
                <div className="h-8 w-px bg-border hidden md:block" />
                
                <div className="flex flex-col gap-1">
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
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(weatherIcons).map(([key, icon]) => (
                        <SelectItem key={key} value={key}>{icon} {key.charAt(0).toUpperCase() + key.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {weatherLoading
                      ? 'Fetching weather from project location...'
                      : weatherError
                        ? weatherError
                        : weatherInfo
                          ? `Auto-filled from ${weatherInfo} (editable)`
                          : 'Weather is editable.'}
                  </p>
                </div>
                
                <div className="h-8 w-px bg-border hidden md:block" />
                
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Submitted By</span>
                  <Input 
                    value={submittedBy}
                    onChange={e => setSubmittedBy(e.target.value)}
                    className="h-9 w-40 font-semibold"
                    placeholder="Name..."
                    disabled={isSelectedDateLocked}
                  />
                </div>
                
                <div className="ml-auto flex items-center gap-3">
                  {!isSelectedDateLocked && modifiedCount > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs px-2.5 py-1 font-bold">
                      ⚠️ {modifiedCount} unsaved row{modifiedCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Button 
                    onClick={handleSaveDpr} 
                    disabled={isSubmitting || !isReady || isSelectedDateLocked} 
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-5 shadow-sm transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {isSelectedDateLocked ? 'Date Locked' : (isSubmitting ? 'Saving DPR...' : 'Save DPR')}
                  </Button>
                </div>
              </div>

              {isSelectedDateLocked && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  DPR is already filled for this date. This date is locked and cannot be submitted again.
                </div>
              )}

              {/* Searchable Activity Selector */}
              <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add Activity to Worksheet</div>
                {worksheetCarryForwardCount > 0 && (
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    {worksheetCarryForwardCount} legacy L1 activit{worksheetCarryForwardCount === 1 ? 'y is' : 'ies are'} carried into L3 because consumed quantity exists.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Search Activity</Label>
                    <Popover open={activityPickerOpen} onOpenChange={setActivityPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          disabled={isSelectedDateLocked || searchableActivities.length === 0}
                          className="h-9 mt-0.5 justify-between font-normal"
                        >
                          {selectedActivityOption
                            ? `${selectedActivityOption.code || '—'}: ${selectedActivityOption.title}${
                                selectedActivityOption.is_l1_carry_forward ? ' (L1 carried)' : ''
                              }`
                            : (searchableActivities.length === 0 ? 'No activities available' : 'Search by activity code or name...')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(90vw,560px)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Type activity code or name..." />
                          <CommandList>
                            <CommandEmpty>No activity found.</CommandEmpty>
                            <CommandGroup>
                              {searchableActivities.map((item) => (
                                <CommandItem
                                  key={item.row_id}
                                  value={`${item.code || ''} ${item.title || ''}`}
                                  onSelect={() => {
                                    setSelectedActivityId(item.row_id);
                                    setActivityPickerOpen(false);
                                  }}
                                  className="gap-3"
                                >
                                  <span className="font-mono text-xs font-semibold whitespace-nowrap min-w-[170px] max-w-[220px] truncate">
                                    {item.code || '—'}
                                  </span>
                                  <span className="truncate flex-1">{item.title}</span>
                                  {item.is_l1_carry_forward && (
                                    <span className="text-[10px] font-medium text-sky-700 bg-sky-100 border border-sky-200 rounded px-1.5 py-0.5">
                                      L1 carried
                                    </span>
                                  )}
                                  {selectedActivityId === item.row_id && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      if (!selectedActivityOption) return;
                      handleAddActivity(selectedActivityOption.row_id);
                      setSelectedActivityId('');
                    }}
                    disabled={addActivityDisabled}
                    className={`font-semibold h-9 px-6 gap-1.5 ${
                      addActivityDisabled
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary hover:bg-primary/95 text-white'
                    }`}
                  >
                    <span>➕</span> {isSelectedDateLocked ? 'Date Locked' : 'Add Activity'}
                  </Button>
                </div>
              </div>

              {/* Sheet Table */}
              {entriesLoading ? (
                <div className="text-center py-12 text-muted-foreground text-sm font-sans">Loading worksheets...</div>
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
                    <table className="w-full text-sm font-sans border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="sticky left-0 bg-muted z-20 text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)] w-[320px] min-w-[320px]">Line Item</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Qty Pending</th>
                          <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-32">Qty Executed</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Prog Before</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Prog After</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Budget Pending</th>
                          <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Budget Consumed</th>
                          <th className="text-center p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-24">Labourers</th>
                          <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Work Description</th>
                          <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Issues</th>
                          <th className="p-3 w-12 border-l"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeBudgetItems.map(bItem => {
                          const rowId = bItem.row_id;
                          
                          const itemProgress = entries.filter(
                            e => rowMatchesEntry(bItem, e) &&
                            (e.report_type === 'daily' || !e.report_type) && 
                            !e._is_aggregated
                          );
                          
                          const qtyBefore = itemProgress
                            .filter(e => e.date < selectedReportDate)
                            .reduce((sum, e) => sum + (parseFloat(e.quantity_done) || 0), 0);
                          
                          const state = dprState[rowId] || {};
                          const qtyExecuted = parseFloat(state.qty_executed) || 0;
                          
                          const qtyPending = Math.max(0, bItem.quantity - qtyBefore);
                          const progressBefore = bItem.quantity > 0 ? (qtyBefore / bItem.quantity) * 100 : 0;
                          
                          const qtyAfter = qtyBefore + qtyExecuted;
                          const progressAfter = bItem.quantity > 0 ? (qtyAfter / bItem.quantity) * 100 : 0;
                          
                          const plannedBudget = bItem.quantity * bItem.cost_per_unit;
                          const budgetConsumed = qtyAfter * bItem.cost_per_unit;
                          const budgetPending = Math.max(0, plannedBudget - budgetConsumed);
                          
                          const isMilestone = milestones.some(m => m.id === bItem.milestone_id || m.title.toUpperCase().includes(bItem.title.toUpperCase()));
                          const isComplete = progressAfter >= 100;
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
                              {/* Sticky Line Item */}
                              <td className={`sticky left-0 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 p-3 text-xs font-medium transition-colors w-[320px] min-w-[320px] ${
                                rowModified 
                                  ? 'bg-amber-50/95 dark:bg-amber-950/20' 
                                  : isComplete 
                                    ? 'bg-emerald-50/95 dark:bg-emerald-950/20' 
                                    : isCarryForwardRow
                                      ? 'bg-sky-50/95 dark:bg-sky-950/20'
                                      : 'bg-card'
                              }`}>
                                <p className="font-semibold text-foreground leading-normal">{bItem.title}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">{bItem.code}</p>
                                {isCarryForwardRow && (
                                  <p className="text-[10px] mt-1 inline-flex items-center rounded border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-sky-700">
                                    L1 carried to L3 (consumed {Number(bItem.carry_forward_consumed_qty || 0).toLocaleString()})
                                  </p>
                                )}
                              </td>

                              {/* Qty Pending */}
                              <td className="p-3 text-right font-mono text-xs whitespace-nowrap font-medium text-slate-700">
                                {[qtyPending.toLocaleString(), bItem.unit].filter(Boolean).join(' ')}
                              </td>
                              
                              {/* Qty Executed Input */}
                              <td className="p-3 text-center">
                                <Input 
                                  type="number"
                                  step="any"
                                  className="w-24 text-right h-8 text-xs font-mono font-semibold"
                                  placeholder="0"
                                  value={state.qty_executed ?? ''}
                                  onChange={e => handleInputChange(rowId, 'qty_executed', e.target.value)}
                                  disabled={isSelectedDateLocked}
                                />
                              </td>
                              
                              {/* Progress Before */}
                              <td className="p-3 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                {progressBefore.toFixed(1)}%
                              </td>
                              
                              {/* Progress After */}
                              <td className="p-3 text-right font-mono text-xs whitespace-nowrap">
                                <span className={
                                  isComplete 
                                    ? 'text-emerald-600 font-bold' 
                                    : progressAfter > progressBefore 
                                      ? 'text-blue-600 font-bold' 
                                      : 'font-medium'
                                }>
                                  {progressAfter.toFixed(1)}%
                                </span>
                                {isComplete && (
                                  <div className="text-[8px] text-emerald-600 font-extrabold uppercase tracking-tight flex items-center justify-end gap-0.5 mt-0.5">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" /> Done
                                    {isMilestone && <span className="bg-amber-100 text-amber-800 text-[8px] px-1 py-0.2 rounded font-extrabold ml-1 border border-amber-200">🏆 MS</span>}
                                  </div>
                                )}
                              </td>
                              
                              {/* Budget Pending */}
                              <td className="p-3 text-right font-mono text-xs whitespace-nowrap text-slate-600">
                                {fmtFull(budgetPending)}
                              </td>
                              
                              {/* Budget Consumed */}
                              <td className="p-3 text-right font-mono text-xs whitespace-nowrap text-emerald-600 font-bold">
                                {fmtFull(budgetConsumed)}
                              </td>
                              
                              {/* Labourer Count Input */}
                              <td className="p-3 text-center">
                                <Input 
                                  type="number"
                                  className="w-16 text-right h-8 text-xs font-mono"
                                  placeholder="0"
                                  value={state.labor_count ?? ''}
                                  onChange={e => handleInputChange(rowId, 'labor_count', e.target.value)}
                                  disabled={isSelectedDateLocked}
                                />
                              </td>
                              
                              {/* Description Input */}
                              <td className="p-3">
                                <Input 
                                  type="text"
                                  className="w-40 h-8 text-xs font-sans"
                                  placeholder="Work done details..."
                                  value={state.description ?? ''}
                                  onChange={e => handleInputChange(rowId, 'description', e.target.value)}
                                  disabled={isSelectedDateLocked}
                                />
                              </td>
                              
                              {/* Issues Input */}
                              <td className="p-3">
                                <Input 
                                  type="text"
                                  className="w-40 h-8 text-xs font-sans text-destructive placeholder:text-destructive/40"
                                  placeholder="Add issue/delay details..."
                                  value={state.issues ?? ''}
                                  onChange={e => handleInputChange(rowId, 'issues', e.target.value)}
                                  disabled={isSelectedDateLocked}
                                />
                              </td>
                              
                              {/* Action: Remove row */}
                              <td className="p-3 border-l text-center">
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
          <div className="flex flex-wrap gap-4 items-center bg-card border rounded-xl p-4 shadow-sm">
            <span className="text-sm font-semibold text-muted-foreground">Select Week:</span>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Choose Week" />
              </SelectTrigger>
              <SelectContent>
                {weeksList.map(w => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-base font-bold">Aggregated Weekly Progress Log ({currentWeekObj?.label})</CardTitle>
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
                      <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase">Weekly Qty Done</th>
                      <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase">Value of Work</th>
                      <th className="text-right p-3 font-semibold text-xs text-muted-foreground uppercase">Labour Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.map(row => (
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
                    {weeklyData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs font-sans">
                          No daily progress logged during this week.
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

      {/* 3. Monthly MPR Sheet Tab */}
      {activeTab === 'mpr' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center bg-card border rounded-xl p-4 shadow-sm">
            <span className="text-sm font-semibold text-muted-foreground">Select Month:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose Month" />
              </SelectTrigger>
              <SelectContent>
                {monthsList.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Log Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Log Types</SelectItem>
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