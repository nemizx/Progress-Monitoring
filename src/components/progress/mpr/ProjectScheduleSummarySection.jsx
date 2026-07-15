import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyScheduleSummaryRow, diffDays, todayDateKey } from '@/lib/mprForm';

const SCHEDULE_COLUMNS = [
  { key: 'monthConsidered', label: 'Month Considered', type: 'text', placeholder: 'e.g. June-2026' },
  { key: 'revisedCompletionDate', label: 'Revised Completion Date', type: 'date' },
  { key: 'trackedCompletionDate', label: 'Tracked Completion Date', type: 'date' },
  {
    key: 'delayDuration', label: 'Delay Duration', type: 'readonly', align: 'right',
    tooltip: 'Tracked Completion Date − Revised Completion Date, in days.',
    render: (row) => {
      const d = diffDays(row.trackedCompletionDate, row.revisedCompletionDate);
      return d === null ? '—' : d;
    },
  },
  {
    key: 'balanceDuration', label: 'Balance Duration', type: 'readonly', align: 'right',
    tooltip: 'Tracked Completion Date − today, in days.',
    render: (row) => {
      const d = diffDays(row.trackedCompletionDate, todayDateKey());
      return d === null ? '—' : d;
    },
  },
];

function PreviousMonthsTable({ previousRows }) {
  if (!previousRows?.length) return null;
  return (
    <div className="overflow-x-auto border rounded-lg mb-3">
      <table className="w-full text-sm font-sans border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase w-10">#</th>
            {SCHEDULE_COLUMNS.map((col) => (
              <th key={col.key} className={`p-2.5 font-semibold text-xs text-muted-foreground uppercase ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previousRows.map((row, idx) => (
            <tr key={row.monthConsidered || idx} className="border-b last:border-0 bg-muted/10">
              <td className="p-2 text-xs text-muted-foreground">{idx + 1}</td>
              {SCHEDULE_COLUMNS.map((col) => (
                <td key={col.key} className={`p-2 text-xs font-mono ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.type === 'readonly' ? col.render(row) : (row[col.key] || '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProjectScheduleSummarySection({
  rows,
  onChange,
  previousRows,
  duration,
  onDurationChange,
  locked,
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-semibold text-foreground mb-2 block">Month-wise Completion Tracking</Label>
        <PreviousMonthsTable previousRows={previousRows} />
        <MprMultiRowTable
          columns={SCHEDULE_COLUMNS}
          rows={rows}
          onChange={onChange}
          createRow={createEmptyScheduleSummaryRow}
          locked={locked}
          minWidth={1100}
        />
      </div>

      <div>
        <Label className="text-sm font-semibold text-foreground mb-2 block">Project Duration</Label>
        <Card className="border shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Estimated Duration of Project</Label>
              <Input
                value={duration?.estimatedDuration || ''}
                onChange={(e) => onDurationChange({ ...duration, estimatedDuration: e.target.value })}
                placeholder="Enter Estimated Duration of Project"
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Planned Duration</Label>
              <Input
                value={duration?.plannedDuration || ''}
                onChange={(e) => onDurationChange({ ...duration, plannedDuration: e.target.value })}
                placeholder="Enter Planned Duration"
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Baseline Start Date</Label>
              <Input
                type="date"
                value={duration?.baselineStartDate || ''}
                onChange={(e) => onDurationChange({ ...duration, baselineStartDate: e.target.value })}
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Baseline Completion Date</Label>
              <Input
                type="date"
                value={duration?.baselineCompletionDate || ''}
                onChange={(e) => onDurationChange({ ...duration, baselineCompletionDate: e.target.value })}
                disabled={locked}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
