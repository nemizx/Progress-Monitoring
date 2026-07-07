import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, className }) {
  return (
    <Card className={cn("p-3 relative overflow-hidden group hover:shadow-md transition-all duration-300", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-xl font-bold font-heading tracking-tight">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn(
              "text-[10px] font-semibold",
              trend > 0 ? "text-emerald-600" : "text-red-500"
            )}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last week
            </p>
          )}
        </div>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </div>
        )}
      </div>
      <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full bg-accent/5 group-hover:bg-accent/10 transition-colors duration-500" />
    </Card>
  );
}