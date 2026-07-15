import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyMaterialRequisitionRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'requisitionNo', label: 'Requisition No', type: 'text', placeholder: 'e.g. REQ-045' },
  { key: 'particulars', label: 'Particulars', type: 'text', placeholder: 'e.g. TMT Steel 12mm' },
  { key: 'unit', label: 'Unit', type: 'text', placeholder: 'e.g. MT' },
  { key: 'qty', label: 'Qty', type: 'number', align: 'right' },
  { key: 'receivedDate', label: 'Received Date', type: 'date' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
];

export default function MaterialRequisitionSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyMaterialRequisitionRow}
      locked={locked}
      minWidth={1100}
    />
  );
}
