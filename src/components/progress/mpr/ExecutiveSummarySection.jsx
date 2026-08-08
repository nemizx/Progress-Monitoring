import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCheck, ShieldCheck, PenTool } from 'lucide-react';

export default function ExecutiveSummarySection({
  value,
  onChange,
  locked,
  signOff = {},
  onSignOffChange,
  submittedBy = '',
}) {
  const currentSignOff = {
    preparedByName: signOff?.preparedByName || submittedBy || '',
    preparedByTitle: signOff?.preparedByTitle || 'Site Engineer',
    checkedByName: signOff?.checkedByName ?? '',
    checkedByTitle: signOff?.checkedByTitle ?? '',
    endorsedByName: signOff?.endorsedByName ?? '',
    endorsedByTitle: signOff?.endorsedByTitle ?? '',
  };

  const handleFieldChange = (field, val) => {
    if (!onSignOffChange) return;
    onSignOffChange({
      ...currentSignOff,
      [field]: val,
    });
  };

  const preparedNameDisplay = submittedBy || currentSignOff.preparedByName || 'Logged-in User';

  return (
    <div className="space-y-4 font-sans">
      <Card className="border shadow-sm p-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Executive Summary</div>
        <ReactQuill
          theme="snow"
          value={value || ''}
          onChange={onChange}
          readOnly={locked}
          placeholder="Summarize overall project status, key highlights, and outlook for the month..."
          className="bg-background [&_.ql-editor]:min-h-[220px] [&_.ql-editor]:text-sm"
        />
      </Card>

      {/* Signatories / Authorization Fields */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
            <UserCheck className="w-4 h-4 text-primary" /> Report Signatories & Authorization
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Prepared By - Auto Read-Only */}
            <div className="p-3 border rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                  <PenTool className="w-3.5 h-3.5 text-blue-600" /> Prepared By
                </div>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">Auto</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Name (Auto from logged-in user)</Label>
                <Input
                  value={preparedNameDisplay}
                  disabled
                  readOnly
                  className="h-8 text-xs bg-slate-100/90 text-slate-700 font-semibold cursor-not-allowed border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Designation / Role</Label>
                <Input
                  value={currentSignOff.preparedByTitle}
                  onChange={(e) => handleFieldChange('preparedByTitle', e.target.value)}
                  disabled={locked}
                  placeholder="e.g. Site Engineer"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            {/* Checked By - Starts Blank */}
            <div className="p-3 border rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide border-b pb-2">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Checked By
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Name</Label>
                <Input
                  value={currentSignOff.checkedByName}
                  onChange={(e) => handleFieldChange('checkedByName', e.target.value)}
                  disabled={locked}
                  placeholder="e.g. Amit Gaikwad"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Designation / Role</Label>
                <Input
                  value={currentSignOff.checkedByTitle}
                  onChange={(e) => handleFieldChange('checkedByTitle', e.target.value)}
                  disabled={locked}
                  placeholder="e.g. Project Manager"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            {/* Endorsed By - Starts Blank */}
            <div className="p-3 border rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide border-b pb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" /> Endorsed By
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Name</Label>
                <Input
                  value={currentSignOff.endorsedByName}
                  onChange={(e) => handleFieldChange('endorsedByName', e.target.value)}
                  disabled={locked}
                  placeholder="e.g. Kedar Mashalkar Sir"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Designation / Role</Label>
                <Input
                  value={currentSignOff.endorsedByTitle}
                  onChange={(e) => handleFieldChange('endorsedByTitle', e.target.value)}
                  disabled={locked}
                  placeholder="e.g. AGM"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
