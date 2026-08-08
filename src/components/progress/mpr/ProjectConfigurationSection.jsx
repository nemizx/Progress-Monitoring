import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyProjectConfigRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'building', label: 'Building', type: 'text', width: '12%' },
  { key: 'buildingDetails', label: 'Building Details', type: 'textarea', width: '18%' },
  {
    key: 'noOfFloor',
    label: 'No of Floor',
    type: 'number',
    align: 'right',
    width: '8%',
  },
  {
    key: 'noOfUnitsResidential',
    label: 'Units (Resi)',
    tooltip: 'No of Units Residential',
    type: 'number',
    align: 'right',
    width: '10%',
  },
  {
    key: 'noOfUnitsCommercial',
    label: 'Units (Comm)',
    tooltip: 'No of Unit Commercial',
    type: 'number',
    align: 'right',
    width: '10%',
  },
  {
    key: 'areaPerUnitResidential',
    label: 'Area (Resi)',
    tooltip: 'Approximate area As per unit Residential',
    type: 'number',
    align: 'right',
    width: '11%',
  },
  {
    key: 'areaPerUnitCommercial',
    label: 'Area (Comm)',
    tooltip: 'Approximate area As per unit Commercial',
    type: 'number',
    align: 'right',
    width: '11%',
  },
];

export default function ProjectConfigurationSection({ rows, onChange, locked }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (safeRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          No Sub Projects found for the selected Project.
        </p>
        {!locked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onChange([createEmptyProjectConfigRow()])}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </Button>
        )}
      </div>
    );
  }

  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={safeRows}
      onChange={onChange}
      createRow={createEmptyProjectConfigRow}
      locked={locked}
      fitContainer
      canRemoveRow={(row) => row?.source !== 'project_master'}
      emptyFallbackRows={false}
    />
  );
}
