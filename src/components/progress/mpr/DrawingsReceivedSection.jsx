import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyDrawingReceivedRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'drawingType', label: 'Drawing type', type: 'text' },
  { key: 'drawingName', label: 'Drawing Name', type: 'text' },
  { key: 'drawingNo', label: 'Drawing No', type: 'text' },
  { key: 'buildingName', label: 'Building Name', type: 'text' },
  { key: 'revNo', label: 'Rev No.', type: 'text' },
  { key: 'noOfCopies', label: 'No. of copies', type: 'number', align: 'right' },
  { key: 'receivedDate', label: 'Received date', type: 'date' },
];

export default function DrawingsReceivedSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyDrawingReceivedRow}
      locked={locked}
      minWidth={1200}
    />
  );
}
