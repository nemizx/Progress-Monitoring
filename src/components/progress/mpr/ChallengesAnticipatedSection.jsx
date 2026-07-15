import React from 'react';
import MprMultiRowTable from './MprMultiRowTable';
import { createEmptyChallengeAnticipatedRow } from '@/lib/mprForm';

const COLUMNS = [
  { key: 'challenge', label: 'Challenges anticipated in the next month', type: 'textarea' },
  { key: 'actionToBeTaken', label: 'Actions to be taken', type: 'textarea' },
];

export default function ChallengesAnticipatedSection({ rows, onChange, locked }) {
  return (
    <MprMultiRowTable
      columns={COLUMNS}
      rows={rows}
      onChange={onChange}
      createRow={createEmptyChallengeAnticipatedRow}
      locked={locked}
      minWidth={800}
    />
  );
}
