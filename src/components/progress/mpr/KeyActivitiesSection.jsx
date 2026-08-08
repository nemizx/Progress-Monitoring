import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus } from 'lucide-react';
import {
  KEY_ACTIVITY_CATEGORIES,
  createEmptyKeyActivityRow,
  ensureKeyActivitiesTemplate,
} from '@/lib/mprForm';

export default function KeyActivitiesSection({ rows, onChange, locked }) {
  const effectiveRows = useMemo(() => ensureKeyActivitiesTemplate(rows), [rows]);

  React.useEffect(() => {
    const oldJson = JSON.stringify(
      (rows || []).map((r) => ({
        id: r.id,
        category: r.category,
        currentMonthPlan: r.currentMonthPlan,
        currentMonthStatus: r.currentMonthStatus,
        upcomingMonthForecast: r.upcomingMonthForecast,
      }))
    );
    const newJson = JSON.stringify(
      effectiveRows.map((r) => ({
        id: r.id,
        category: r.category,
        currentMonthPlan: r.currentMonthPlan,
        currentMonthStatus: r.currentMonthStatus,
        upcomingMonthForecast: r.upcomingMonthForecast,
      }))
    );
    if (oldJson !== newJson) onChange(effectiveRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRows]);

  const updateRow = (id, field, value) => {
    if (locked) return;
    onChange(effectiveRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = (category) => {
    if (locked) return;
    onChange([...effectiveRows, createEmptyKeyActivityRow(category)]);
  };

  const removeRow = (id, category) => {
    if (locked) return;
    const group = effectiveRows.filter((r) => r.category === category);
    if (group.length <= 1) {
      // Keep at least one blank row in the group
      onChange(
        effectiveRows.map((r) =>
          r.id === id
            ? createEmptyKeyActivityRow(category, { id: r.id })
            : r
        )
      );
      return;
    }
    onChange(effectiveRows.filter((r) => r.id !== id));
  };

  return (
    <Card className="overflow-hidden border shadow-sm">
      <div className="px-4 py-3 border-b bg-sky-50/80">
        <h3 className="text-sm font-bold text-slate-800">11. Key Activities Status</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-2.5 text-xs font-semibold text-muted-foreground uppercase border border-slate-200 w-48 text-left">
                Details
              </th>
              <th className="p-2.5 text-xs font-semibold text-muted-foreground uppercase border border-slate-200 text-left">
                Current month (Plan)
              </th>
              <th className="p-2.5 text-xs font-semibold text-muted-foreground uppercase border border-slate-200 text-left">
                Current month (Status)
              </th>
              <th className="p-2.5 text-xs font-semibold text-muted-foreground uppercase border border-slate-200 text-left bg-sky-50">
                Upcoming month (Forecast)
              </th>
              {!locked ? (
                <th className="p-2.5 text-xs font-semibold text-muted-foreground uppercase border border-slate-200 w-24 text-center">
                  Add/Remove
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {KEY_ACTIVITY_CATEGORIES.map((cat) => {
              const groupRows = effectiveRows.filter((r) => r.category === cat.key);
              return groupRows.map((row, idx) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                  {idx === 0 ? (
                    <td
                      rowSpan={groupRows.length}
                      className="p-3 text-xs font-bold text-slate-800 border border-slate-200 bg-slate-50 align-middle text-center min-w-[160px]"
                    >
                      {cat.label}
                    </td>
                  ) : null}
                  <td className="p-1.5 border border-slate-100">
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground pt-2 shrink-0 w-4">
                        {idx + 1}.
                      </span>
                      <Input
                        value={row.currentMonthPlan ?? ''}
                        onChange={(e) => updateRow(row.id, 'currentMonthPlan', e.target.value)}
                        disabled={locked}
                        placeholder={idx === 0 ? 'e.g. Blg A - ext Plaster to start' : 'Plan item'}
                        className="h-8.5 text-xs bg-background"
                      />
                    </div>
                  </td>
                  <td className="p-1.5 border border-slate-100">
                    <Input
                      value={row.currentMonthStatus ?? ''}
                      onChange={(e) => updateRow(row.id, 'currentMonthStatus', e.target.value)}
                      disabled={locked}
                      placeholder="Done / Not Done"
                      className="h-8.5 text-xs bg-background"
                    />
                  </td>
                  <td className="p-1.5 border border-slate-100 bg-sky-50/40">
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground pt-2 shrink-0 w-4">
                        {idx + 1}.
                      </span>
                      <Input
                        value={row.upcomingMonthForecast ?? ''}
                        onChange={(e) => updateRow(row.id, 'upcomingMonthForecast', e.target.value)}
                        disabled={locked}
                        placeholder="Forecast item"
                        className="h-8.5 text-xs bg-background"
                      />
                    </div>
                  </td>
                  {!locked ? (
                    <td className="p-1.5 border border-slate-100 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {idx === groupRows.length - 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => addRow(cat.key)}
                            title={`Add row under ${cat.label}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <span className="w-7" />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(row.id, cat.key)}
                          title="Remove row"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
