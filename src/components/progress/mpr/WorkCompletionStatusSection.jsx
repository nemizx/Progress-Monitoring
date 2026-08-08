import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  WORK_COMPLETION_BUILDING_ROWS,
  WORK_COMPLETION_SUBPROJECT_PAGE_SIZE,
  ensureWorkCompletionStatus,
  getWorkCompletionSubProjects,
  chunkWorkCompletionSubProjects,
  getWorkCompletionCell,
} from '@/lib/mprForm';

function CellInput({ value, onChange, locked, placeholder }) {
  return (
    <Input
      type="number"
      min="0"
      step="any"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={locked}
      placeholder={placeholder || '0'}
      className="h-8 text-xs text-center font-mono px-1"
    />
  );
}

export default function WorkCompletionStatusSection({
  value,
  onChange,
  locked,
  projectConfiguration = [],
  buildingConfigurationsRaw,
}) {
  const data = useMemo(() => ensureWorkCompletionStatus(value), [value]);
  const subProjects = useMemo(
    () => getWorkCompletionSubProjects(projectConfiguration, buildingConfigurationsRaw),
    [projectConfiguration, buildingConfigurationsRaw]
  );
  const chunks = useMemo(
    () => chunkWorkCompletionSubProjects(subProjects, WORK_COMPLETION_SUBPROJECT_PAGE_SIZE),
    [subProjects]
  );
  const [pageIndex, setPageIndex] = useState(0);
  const safePage = Math.min(pageIndex, Math.max(0, chunks.length - 1));
  const displaySubs = chunks[safePage] || [];

  const updateSubCell = (activityId, subKey, field, nextValue) => {
    if (locked || !subKey) return;
    const next = ensureWorkCompletionStatus(data);
    const byActivity = { ...(next.bySubProject[activityId] || {}) };
    const cell = { ...(byActivity[subKey] || { totalFlats: '', completedFlats: '' }), [field]: nextValue };
    byActivity[subKey] = cell;
    onChange({
      ...next,
      bySubProject: { ...next.bySubProject, [activityId]: byActivity },
    });
  };

  return (
    <Card className="overflow-hidden border shadow-sm">
      <div className="px-4 py-3 border-b bg-sky-50/80 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">Work Completion Status</h3>
        {chunks.length > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={safePage <= 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium text-slate-600 min-w-[88px] text-center">
              Page {safePage + 1} / {chunks.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={safePage >= chunks.length - 1}
              onClick={() => setPageIndex((p) => Math.min(chunks.length - 1, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {subProjects.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          No sub projects found. Add Sub Projects in Project Master (Building Configuration) first.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="p-2 border border-slate-200 w-14 text-center">
                  SR NO
                </th>
                <th rowSpan={2} className="p-2 border border-slate-200 text-left min-w-[220px]">
                  ACTIVITY
                </th>
                <th rowSpan={2} className="p-2 border border-slate-200 w-16 text-center">
                  Unit
                </th>
                {displaySubs.map((sp) => (
                  <th
                    key={sp.key}
                    colSpan={2}
                    className="p-2 border border-slate-200 text-center font-bold uppercase"
                  >
                    {sp.name}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50">
                {displaySubs.map((sp) => (
                  <React.Fragment key={`${sp.key}-sub`}>
                    <th className="p-1.5 border border-slate-200 text-center font-semibold">
                      Total Flats
                    </th>
                    <th className="p-1.5 border border-slate-200 text-center font-semibold">
                      Completed Flats
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORK_COMPLETION_BUILDING_ROWS.map((row) => {
                const subColSpan = Math.max(displaySubs.length * 2, 0);
                if (row.rowType === 'section') {
                  return (
                    <tr key={row.id} className="bg-sky-50">
                      <td
                        colSpan={3 + subColSpan}
                        className="p-2 border border-slate-200 font-bold text-slate-800"
                      >
                        {row.activity}
                      </td>
                    </tr>
                  );
                }
                if (row.rowType === 'group') {
                  return (
                    <tr key={row.id} className="bg-slate-50">
                      <td className="p-2 border border-slate-200 text-center font-bold">{row.srNo}</td>
                      <td className="p-2 border border-slate-200 font-bold" colSpan={2 + subColSpan}>
                        {row.activity}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.id} className="hover:bg-muted/20">
                    <td className="p-1.5 border border-slate-200 text-center font-semibold">{row.srNo}</td>
                    <td className="p-1.5 border border-slate-200">{row.activity}</td>
                    <td className="p-1.5 border border-slate-200 text-center">{row.unit}</td>
                    {displaySubs.map((sp) => {
                      const cell = getWorkCompletionCell(data, row.id, sp.key);
                      return (
                        <React.Fragment key={`${row.id}-${sp.key}`}>
                          <td className="p-1 border border-slate-200">
                            <CellInput
                              value={cell.totalFlats}
                              locked={locked}
                              onChange={(v) => updateSubCell(row.id, sp.key, 'totalFlats', v)}
                            />
                          </td>
                          <td className="p-1 border border-slate-200">
                            <CellInput
                              value={cell.completedFlats}
                              locked={locked}
                              onChange={(v) => updateSubCell(row.id, sp.key, 'completedFlats', v)}
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
