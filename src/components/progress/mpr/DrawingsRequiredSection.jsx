import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyDrawingRequiredRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'drawingType', label: 'Drawing Type', type: 'text' },
  { key: 'buildingName', label: 'Building Name', type: 'text' },
  { key: 'drawingName', label: 'Drawing Name', type: 'text' },
  { key: 'requiredDate', label: 'Required date', type: 'date' },
  { key: 'requiredFrom', label: 'Required From', type: 'text', placeholder: 'e.g. Architect / Consultant' },
];

export default function DrawingsRequiredSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyDrawingRequiredRow}
      locked={locked}
      minWidth={1100}
    />
  );
}
