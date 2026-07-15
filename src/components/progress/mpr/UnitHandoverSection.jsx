import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function UnitHandoverSection({ value, onChange, locked }) {
  const update = (field, v) => onChange({ ...value, [field]: v });

  return (
    <Card className="border shadow-sm p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">Unit Handover (R) — Residential</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Plan</Label>
              <Input type="number" value={value?.rPlan ?? ''} onChange={(e) => update('rPlan', e.target.value)} disabled={locked} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Achieved</Label>
              <Input type="number" value={value?.rAchieved ?? ''} onChange={(e) => update('rAchieved', e.target.value)} disabled={locked} />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">Unit Handover (C) — Commercial</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Plan</Label>
              <Input type="number" value={value?.cPlan ?? ''} onChange={(e) => update('cPlan', e.target.value)} disabled={locked} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Achieved</Label>
              <Input type="number" value={value?.cAchieved ?? ''} onChange={(e) => update('cAchieved', e.target.value)} disabled={locked} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
