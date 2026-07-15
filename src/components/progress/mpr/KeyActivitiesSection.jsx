import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyKeyActivityRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'details', label: 'Details', type: 'textarea' },
  { key: 'currentMonthPlan', label: 'Current month Plan', type: 'textarea' },
  { key: 'currentMonthStatus', label: 'Current month Status', type: 'textarea' },
  { key: 'upcomingMonthForecast', label: 'Upcoming month (Forecast)', type: 'textarea' },
];

export default function KeyActivitiesSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyKeyActivityRow}
      locked={locked}
      minWidth={1300}
    />
  );
}
