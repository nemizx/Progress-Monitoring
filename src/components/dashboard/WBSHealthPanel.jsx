import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Layers, ArrowRight, CheckCircle2, AlertTriangle, Clock, Activity } from 'lucide-react';

const statusConfig = {
  not_started: { label: 'Not Started', color: 'bg-slate-400', text: 'text-slate-600', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500', text: 'text-blue-700', dot: 'bg-blue-500' },
  completed: { label: 'Completed', color: 'bg-emerald-500', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  delayed: { label: 'Delayed', color: 'bg-red-500', text: 'text-red-700', dot: 'bg-red-500' },
  on_hold: { label: 'On Hold', color: 'bg-amber-500', text: 'text-amber-700', dot: 'bg-amber-500' },
};

function HealthBar({ progress, status }) {
  const cfg = statusConfig[status] || statusConfig.not_started;
  const color = status === 'delayed' ? 'bg-red-500' :
    status === 'completed' ? 'bg-emerald-500' :
    status === 'in_progress' ? 'bg-blue-500' :
    status === 'on_hold' ? 'bg-amber-500' : 'bg-slate-300';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(progress || 0, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{progress || 0}%</span>
    </div>
  );
}

function StatusDot({ status }) {
  const cfg = statusConfig[status] || statusConfig.not_started;
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot} shrink-0 mt-1`} />
  );
}

export default function WBSHealthPanel({ projectFilter }) {
  const { data: wbsItems = [], isLoading } = useQuery({
    queryKey: ['wbs-dashboard', projectFilter],
    queryFn: () => projectFilter
      ? base44.entities.WBSItem.filter({ project_id: projectFilter }, 'order_index', 200)
      : base44.entities.WBSItem.list('order_index', 200),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities-dashboard', projectFilter],
    queryFn: () => projectFilter
      ? base44.entities.ScheduleActivity.filter({ project_id: projectFilter }, 'order_index', 500)
      : base44.entities.ScheduleActivity.list('order_index', 500),
  });

  // Roll up status from activities to WBS items
  const getWBSStatus = (wbsId) => {
    const linked = activities.filter(a => a.wbs_item_id === wbsId);
    if (linked.length === 0) return 'not_started';
    if (linked.some(a => a.status === 'delayed')) return 'delayed';
    if (linked.every(a => a.status === 'completed')) return 'completed';
    if (linked.some(a => a.status === 'in_progress')) return 'in_progress';
    if (linked.some(a => a.status === 'on_hold')) return 'on_hold';
    return 'not_started';
  };

  const l1Items = wbsItems.filter(w => w.level === 1 || !w.parent_id);
  const getChildren = (id) => wbsItems.filter(w => w.parent_id === id);

  const healthSummary = {
    completed: wbsItems.filter(w => (w.progress || 0) >= 100).length,
    delayed: wbsItems.filter(w => getWBSStatus(w.id) === 'delayed').length,
    inProgress: wbsItems.filter(w => getWBSStatus(w.id) === 'in_progress').length,
    notStarted: wbsItems.filter(w => getWBSStatus(w.id) === 'not_started').length,
  };

  if (isLoading) return null;

  if (wbsItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" /> WBS Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">No WBS items yet. <Link to="/wbs" className="text-accent underline">Build your WBS</Link></p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" /> WBS Health
          </CardTitle>
          <Link to="/wbs" className="text-xs text-accent font-medium flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Mini summary pills */}
        <div className="flex flex-wrap gap-2 mt-2">
          {[
            { icon: CheckCircle2, label: `${healthSummary.completed} done`, color: 'text-emerald-600 bg-emerald-50' },
            { icon: Activity, label: `${healthSummary.inProgress} active`, color: 'text-blue-600 bg-blue-50' },
            { icon: AlertTriangle, label: `${healthSummary.delayed} delayed`, color: 'text-red-600 bg-red-50' },
            { icon: Clock, label: `${healthSummary.notStarted} pending`, color: 'text-slate-500 bg-slate-50' },
          ].map(s => (
            <span key={s.label} className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${s.color}`}>
              <s.icon className="w-3 h-3" />{s.label}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 max-h-80 overflow-y-auto pr-1">
        {l1Items.slice(0, 8).map(l1 => {
          const status = getWBSStatus(l1.id);
          const children = getChildren(l1.id).slice(0, 4);
          const cfg = statusConfig[status] || statusConfig.not_started;

          return (
            <div key={l1.id} className="space-y-1.5">
              {/* L1 row */}
              <div className="flex items-start gap-2">
                <StatusDot status={status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold truncate">{l1.code && <span className="text-muted-foreground font-mono text-xs mr-1">{l1.code}</span>}{l1.title}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ml-2 ${cfg.text} ${cfg.color.replace('bg-', 'bg-').replace('500', '100').replace('400', '100')}`}>{cfg.label}</span>
                  </div>
                  <HealthBar progress={l1.progress} status={status} />
                </div>
              </div>

              {/* L2 children */}
              {children.length > 0 && (
                <div className="ml-4 space-y-1.5 border-l-2 border-muted pl-3">
                  {children.map(child => {
                    const cStatus = getWBSStatus(child.id);
                    return (
                      <div key={child.id} className="flex items-start gap-2">
                        <StatusDot status={cStatus} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-xs text-muted-foreground truncate">{child.title}</p>
                            <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">{child.progress || 0}%</span>
                          </div>
                          <HealthBar progress={child.progress} status={cStatus} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}