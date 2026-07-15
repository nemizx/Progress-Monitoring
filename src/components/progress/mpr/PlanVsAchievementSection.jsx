import React from 'react';
import { Card } from '@/components/ui/card';
import { formatCurrencyINR, formatNumberIndian } from '@/lib/formatters';

export default function PlanVsAchievementSection({ rows }) {
  return (
    <Card className="overflow-hidden border shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans border-collapse min-w-[1200px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase w-10">Sr.</th>
              <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase">Activity Description</th>
              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground uppercase w-20">Unit</th>
              <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-28">Rate</th>
              <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-28">Planned QTY</th>
              <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-36">Planned Amount</th>
              <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-28">Achieved QTY</th>
              <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-36">Achieved Amt</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row, idx) => (
              <tr key={row.activityKey || idx} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                <td className="p-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                <td className="p-2.5 text-xs font-semibold text-foreground">{row.activity || '—'}</td>
                <td className="p-2.5 text-xs text-center text-muted-foreground">{row.unit || '—'}</td>
                <td className="p-2.5 text-xs text-right font-mono">{row.rate ? formatCurrencyINR(row.rate) : '—'}</td>
                <td className="p-2.5 text-xs text-right font-mono">{row.plannedQty ? formatNumberIndian(row.plannedQty) : '—'}</td>
                <td className="p-2.5 text-xs text-right font-mono font-semibold">{formatCurrencyINR(row.plannedAmount || 0)}</td>
                <td className="p-2.5 text-xs text-right font-mono">{formatNumberIndian(row.achievedQty || 0)}</td>
                <td className="p-2.5 text-xs text-right font-mono font-semibold text-emerald-700">{formatCurrencyINR(row.achievedAmount || 0)}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground text-xs font-sans">
                  No forecasted or executed activities found for this month yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
