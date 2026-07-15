import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyProjectConfigRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'building', label: 'Building', type: 'text' },
  { key: 'buildingDetails', label: 'Building Details', type: 'textarea' },
  { key: 'noOfFloor', label: 'No of Floor', type: 'number', align: 'right' },
  { key: 'noOfUnitsResidential', label: 'No of Units Residential', type: 'number', align: 'right' },
  { key: 'noOfUnitsCommercial', label: 'No of Unit Commercial', type: 'number', align: 'right' },
  { key: 'areaPerUnitResidential', label: 'Approximate area As per unit Residential', type: 'number', align: 'right' },
  { key: 'areaPerUnitCommercial', label: 'Approximate area As per unit Commercial', type: 'number', align: 'right' },
];

export default function ProjectConfigurationSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyProjectConfigRow}
      locked={locked}
      minWidth={1500}
    />
  );
}
