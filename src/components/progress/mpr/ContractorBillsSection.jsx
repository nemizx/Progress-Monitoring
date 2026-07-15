import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyContractorBillRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'work', label: 'Work', type: 'text', placeholder: 'e.g. RCC work for slab' },
  { key: 'raBillNo', label: 'RA Bill No', type: 'text', placeholder: 'e.g. RA-12' },
  { key: 'agencyName', label: 'Name of Agency', type: 'text', placeholder: 'e.g. L&T Construction' },
  { key: 'amount', label: 'Amount', type: 'currency', align: 'right', placeholder: '0.00' },
];

export default function ContractorBillsSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyContractorBillRow}
      locked={locked}
      minWidth={900}
    />
  );
}
