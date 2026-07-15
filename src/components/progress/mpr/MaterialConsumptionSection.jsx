import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { formatCurrencyINR, formatNumberIndian, formatInputCurrency, parseCurrencyInputValue } from '@/lib/formatters';

const num = (v) => parseFloat(v) || 0;

const ROWS = [
  { key: 'vowd', label: 'Value Of Work Done (VOWD)', targetLocked: false, achievedLocked: true, isMonetary: true },
  { key: 'cement', label: 'Cement (Bags)', targetLocked: false, achievedLocked: false, isMonetary: false },
  { key: 'steel', label: 'Steel (MT)', targetLocked: true, achievedLocked: true, isMonetary: true, tooltip: 'Sourced from WBS sub-head 2.3 (Steel/Reinforcement) only.' },
  { key: 'mandays', label: 'Mandays (Nos)', targetLocked: false, achievedLocked: true, isMonetary: false },
  { key: 'avgManpower', label: 'Average Man Power', targetLocked: false, achievedLocked: true, isMonetary: false },
];

function ReadonlyCell({ value, isMonetary }) {
  const display = value === '' || value === null || value === undefined
    ? '—'
    : isMonetary ? formatCurrencyINR(value) : formatNumberIndian(value);
  return (
    <div className="h-8.5 flex items-center justify-end px-3 text-xs rounded-md bg-muted/40 font-mono select-none">
      {display}
    </div>
  );
}

export default function MaterialConsumptionSection({ value, onChange, locked }) {
  const updateRow = (key, field, v) => {
    onChange({ ...value, [key]: { ...value[key], [field]: v } });
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase">Description</th>
                <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-40">Target</th>
                <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-40">Achieved</th>
                <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-40">Balance</th>
                <th className="text-right p-2.5 font-semibold text-xs text-muted-foreground uppercase w-40">Next Month Target</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((rowDef) => {
                const row = value?.[rowDef.key] || {};
                const balance = (num(row.target) - num(row.achieved)).toFixed(2);
                return (
                  <tr key={rowDef.key} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 text-xs font-semibold text-foreground">
                      <div className="flex items-center gap-1">
                        <span>{rowDef.label}</span>
                        {rowDef.tooltip && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                              {rowDef.tooltip}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      {rowDef.targetLocked ? (
                        <ReadonlyCell value={row.target} isMonetary={rowDef.isMonetary} />
                      ) : rowDef.isMonetary ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={formatInputCurrency(row.target)}
                          onChange={(e) => updateRow(rowDef.key, 'target', parseCurrencyInputValue(e.target.value))}
                          disabled={locked}
                          className="h-8.5 text-xs text-right bg-background"
                        />
                      ) : (
                        <Input
                          type="number"
                          value={row.target ?? ''}
                          onChange={(e) => updateRow(rowDef.key, 'target', e.target.value)}
                          disabled={locked}
                          className="h-8.5 text-xs text-right bg-background"
                        />
                      )}
                    </td>
                    <td className="p-2">
                      {rowDef.achievedLocked ? (
                        <ReadonlyCell value={row.achieved} isMonetary={rowDef.isMonetary} />
                      ) : rowDef.isMonetary ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={formatInputCurrency(row.achieved)}
                          onChange={(e) => updateRow(rowDef.key, 'achieved', parseCurrencyInputValue(e.target.value))}
                          disabled={locked}
                          className="h-8.5 text-xs text-right bg-background"
                        />
                      ) : (
                        <Input
                          type="number"
                          value={row.achieved ?? ''}
                          onChange={(e) => updateRow(rowDef.key, 'achieved', e.target.value)}
                          disabled={locked}
                          className="h-8.5 text-xs text-right bg-background"
                        />
                      )}
                    </td>
                    <td className="p-2">
                      <ReadonlyCell value={balance} isMonetary={rowDef.isMonetary} />
                    </td>
                    <td className="p-2">
                      <ReadonlyCell value={row.nextMonthTarget} isMonetary={rowDef.isMonetary} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </TooltipProvider>
  );
}
