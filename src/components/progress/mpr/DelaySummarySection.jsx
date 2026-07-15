import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyDelayRow, diffDays } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'activity', label: 'Activity', type: 'text', width: '16%' },
  { key: 'percentComplete', label: '% Complete', type: 'number', align: 'right', placeholder: '0', width: '8%' },
  { key: 'baselineDate', label: 'As per baseline schedule', type: 'date', width: '150px' },
  { key: 'trackedDate', label: 'As per Tracked schedule', type: 'date', width: '150px' },
  {
    key: 'delayDuration', label: 'Delay Duration (Days)', type: 'readonly', align: 'right', width: '9%',
    tooltip: 'Tracked schedule date − Baseline schedule date, in days.',
    render: (row) => {
      const d = diffDays(row.trackedDate, row.baselineDate);
      return d === null ? '—' : d;
    },
  },
  { key: 'accountabilityRemarks', label: 'Accountability and Remarks for delay', type: 'textarea', width: '22%' },
  { key: 'correctiveActions', label: 'Corrective Actions for the same', type: 'textarea', width: '22%' },
];

export default function DelaySummarySection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyDelayRow}
      locked={locked}
      minWidth={0}
      tableLayout="fixed"
    />
  );
}
