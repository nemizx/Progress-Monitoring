import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Card } from '@/components/ui/card';

export default function ExecutiveSummarySection({ value, onChange, locked }) {
  return (
    <Card className="border shadow-sm p-3">
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        readOnly={locked}
        placeholder="Summarize overall project status, key highlights, and outlook for the month..."
        className="bg-background [&_.ql-editor]:min-h-[220px] [&_.ql-editor]:text-sm"
      />
    </Card>
  );
}
