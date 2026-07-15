import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyMaterialReconciliationRow } from '@/lib/mprForm';
import { formatNumberIndian } from '@/lib/formatters';

const num = (v) => parseFloat(v) || 0;
const diff = (a, b) => formatNumberIndian((num(a) - num(b)).toFixed(2));

const COLUMNS = [
  { key: 'materialDescription', label: 'Material Description', type: 'text' },
  { key: 'unit', label: 'Unit', type: 'text' },
  { key: 'theoreticalConsumption', label: 'Theoretical Consumption for the month', type: 'number', align: 'right' },
  { key: 'actualConsumption', label: 'Actual Consumption for the month', type: 'number', align: 'right' },
  {
    key: 'difference1', label: 'Difference', type: 'readonly', align: 'right',
    tooltip: 'Theoretical Consumption − Actual Consumption',
    render: (row) => diff(row.theoreticalConsumption, row.actualConsumption),
  },
  { key: 'physicalStockRegister', label: 'Physical stock as per stock register', type: 'number', align: 'right' },
  { key: 'physicalStockVerification', label: 'Physical stock as per broad physical verification', type: 'number', align: 'right' },
  {
    key: 'difference2', label: 'Difference', type: 'readonly', align: 'right',
    tooltip: 'Physical stock (register) − Physical stock (verification)',
    render: (row) => diff(row.physicalStockRegister, row.physicalStockVerification),
  },
  { key: 'cummReceived', label: 'Cumm. Received material from start of project', type: 'number', align: 'right' },
  { key: 'certifiedCummConsumption', label: 'Certified Cumm. Actual consumption', type: 'number', align: 'right' },
  {
    key: 'difference3', label: 'Difference', type: 'readonly', align: 'right',
    tooltip: 'Cumm. Received − Certified Cumm. Actual consumption',
    render: (row) => diff(row.cummReceived, row.certifiedCummConsumption),
  },
  { key: 'errorToBeAudited', label: 'Error to be audited', type: 'text' },
  { key: 'remark', label: 'Remark', type: 'text' },
];

export default function MaterialReconciliationSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyMaterialReconciliationRow}
      locked={locked}
      minWidth={2000}
    />
  );
}
