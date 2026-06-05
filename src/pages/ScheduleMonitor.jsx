import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';

function dateRangeArray(start, end) {
  const a = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) a.push(new Date(d).toISOString().split('T')[0]);
  return a;
}

export default function ScheduleMonitor() {
  const queryClient = useQueryClient();
  const { data: activities = [] } = useQuery({ queryKey: ['activities-monitor'], queryFn: () => base44.entities.ScheduleActivity.list('order_index', 1000) });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date', 200) });
  const { data: progressEntries = [] } = useQuery({ queryKey: ['progress-entries'], queryFn: () => base44.entities.ProgressEntry.list('-date', 1000) });
  const { data: budgetItems = [] } = useQuery({ queryKey: ['budget-items'], queryFn: () => base44.entities.BudgetItem.list('code', 1000) });

  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.ScheduleActivity.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities-monitor'] }) });

  const today = new Date().toISOString().split('T')[0];

  // Kanban data grouped by phase and status
  const phases = ['foundation', 'structure', 'mep', 'finishing', 'handover', 'other'];
  const kanban = phases.map(phase => ({ phase, items: activities.filter(a => a.phase === phase).sort((x,y)=> (x.order_index||0)-(y.order_index||0)) }));

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
      const key = wbs || e.project_id || 'global';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [progressEntries, budgetMap]);

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
          updateMutation.mutate({ id: act.id, data: update });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, progressByWbs, today]);

  // Gantt data: compute date span
  const minDate = activities.reduce((min, a) => a.planned_start && (!min || a.planned_start < min) ? a.planned_start : min, null) || today;
  const maxDate = activities.reduce((max, a) => a.planned_end && (!max || a.planned_end > max) ? a.planned_end : max, null) || today;
  const dates = dateRangeArray(minDate, maxDate);
  const dayWidth = 18; // px per day for Gantt

  const computeExpectedProgress = (act) => {
    if (!act.planned_start || !act.planned_end) return 0;
    const start = new Date(act.planned_start);
    const end = new Date(act.planned_end);
    const total = (end - start) / (1000*60*60*24) + 1;
    const elapsed = (new Date(today) - start) / (1000*60*60*24) + 1;
    const pct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
    return pct;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Schedule Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">View project schedule as Kanban or Gantt; track delays and dependencies.</p>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <div className="grid grid-cols-3 gap-4">
            {kanban.map(col => (
              <Card key={col.phase}>
                <CardHeader>
                  <CardTitle className="text-sm capitalize">{col.phase}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {col.items.map(it => {
                      const expected = computeExpectedProgress(it);
                      const delayed = today > (it.planned_end || today) && it.status !== 'completed';
                      return (
                        <div key={it.id || it.activity_id} className="p-3 border rounded-md bg-card/50">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-mono text-xs text-muted-foreground">{it.activity_id}</div>
                                <div className="font-medium truncate">{it.name}</div>
                                {delayed && <div className="text-xs text-amber-700 ml-auto font-semibold">Delayed</div>}
                              </div>
                              <div className="text-xs text-muted-foreground">{it.planned_start || '—'} → {it.planned_end || '—'}</div>
                              <div className="mt-2 flex items-center gap-2">
                                <div className="w-full h-2 bg-muted rounded overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${it.progress || 0}%` }} />
                                </div>
                                <div className="text-xs w-12 text-right">{it.progress || 0}%</div>
                              </div>
                              <div className="text-[11px] mt-1">Expected: {expected}%</div>
                              {(it.predecessors || []).length > 0 && (<div className="text-[11px] text-muted-foreground mt-1">Pre: {(it.predecessors || []).join(', ')}</div>)}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: it.id, data: { status: 'in_progress' } })}>Start</Button>
                            <Button size="sm" onClick={() => updateMutation.mutate({ id: it.id, data: { status: 'completed', progress: 100 } })}>Complete</Button>
                            <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: it.id, data: { status: 'delayed' } })}>Mark Delayed</Button>
                          </div>
                        </div>
                      );
                    })}
                    {col.items.length === 0 && <div className="text-sm text-muted-foreground">No activities</div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="gantt">
          <Card>
            <CardContent>
              <div className="overflow-auto">
                <div className="min-w-max">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-48 text-sm font-semibold">Activity</div>
                    <div className="flex">{dates.map(d => <div key={d} className="text-xs text-muted-foreground" style={{ width: dayWidth }}>{d.slice(5)}</div>)}</div>
                  </div>
                  <div>
                    {activities.map(a => {
                      const left = Math.max(0, (new Date(a.planned_start || minDate) - new Date(minDate)) / (1000*60*60*24));
                      const width = Math.max(1, ( (new Date(a.planned_end || minDate) - new Date(a.planned_start || minDate)) / (1000*60*60*24) ) + 1);
                      const expected = computeExpectedProgress(a);
                      const delayed = today > (a.planned_end || today) && a.status !== 'completed';
                      return (
                        <div key={a.id || a.activity_id} className="flex items-center gap-2 mb-2">
                          <div className="w-48 text-sm truncate">{a.activity_id} — {a.name}</div>
                          <div className="relative" style={{ width: dates.length * dayWidth }}>
                            <div className="absolute left-0 top-0" style={{ transform: `translateX(${left * dayWidth}px)` }}>
                              <div className={`h-6 rounded-md ${delayed ? 'bg-amber-400/90' : 'bg-primary'}`} style={{ width: width * dayWidth }}>
                                <div className="h-full bg-white/30" style={{ width: `${a.progress || 0}%` }} />
                              </div>
                            </div>
                            { (a.predecessors || []).map(p => (
                              <div key={p} className="absolute text-[10px] text-muted-foreground" style={{ left: 0, top: '100%' }}>{/* placeholder for dependency arrows */}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
