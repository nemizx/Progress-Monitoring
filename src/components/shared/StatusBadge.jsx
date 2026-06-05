import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  planning: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  on_hold: 'bg-slate-100 text-slate-600 border-slate-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  delayed: 'bg-red-100 text-red-700 border-red-200',
  not_started: 'bg-slate-100 text-slate-500 border-slate-200',
  blocked: 'bg-red-100 text-red-700 border-red-200',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  passed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  requires_rework: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
  minor: 'bg-slate-100 text-slate-500 border-slate-200',
  moderate: 'bg-amber-100 text-amber-700 border-amber-200',
  major: 'bg-orange-100 text-orange-700 border-orange-200',
};

export default function StatusBadge({ status, className }) {
  const label = (status || '').replace(/_/g, ' ');
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "capitalize font-medium text-[11px] border",
        statusStyles[status] || 'bg-muted text-muted-foreground',
        className
      )}
    >
      {label}
    </Badge>
  );
}