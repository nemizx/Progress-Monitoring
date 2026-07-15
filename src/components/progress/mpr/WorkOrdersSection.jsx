import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyWorkOrderRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'item', label: 'Item', type: 'text' },
  { key: 'issuedTo', label: 'Issued To', type: 'text' },
  { key: 'scopeOfWork', label: 'Scope Of Work', type: 'textarea' },
  { key: 'rate', label: 'Rate', type: 'currency', align: 'right' },
  { key: 'contractAmount', label: 'Contract Amount', type: 'currency', align: 'right' },
  { key: 'issueDate', label: 'Issue Date', type: 'date' },
  { key: 'startDate', label: 'Start date', type: 'date' },
  { key: 'completionDate', label: 'Completion Date', type: 'date' },
  {
    key: 'woStatus', label: 'WO Status', type: 'select', placeholder: 'Select status',
    options: [{ value: 'signed', label: 'Signed' }, { value: 'not_signed', label: 'Not Signed' }],
  },
];

export default function WorkOrdersSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyWorkOrderRow}
      locked={locked}
      minWidth={1500}
    />
  );
}
