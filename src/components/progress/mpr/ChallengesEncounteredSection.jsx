import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyChallengeRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'challenge', label: 'Challenges encountered in this month', type: 'textarea' },
  { key: 'correctiveAction', label: 'Corrective Actions Taken', type: 'textarea' },
];

export default function ChallengesEncounteredSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyChallengeRow}
      locked={locked}
      minWidth={800}
    />
  );
}
