import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  WPR_PLANNING_PARAMETERS,
  createEmptyPlanForNextMonthRow,
  planForNextMonthRowTotal,
  calcForecastWeeklyVowd,
} from '@/lib/mprForm';
import { formatCurrencyINR, formatNumberIndian } from '@/lib/formatters';

function HeaderCell({ label, tooltip, align }) {
  return (
    <th className={`p-2.5 font-semibold text-xs text-muted-foreground uppercase ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className={`flex items-center gap-1 select-none ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </th>
  );
}

// Always resolve the parameter label from the current master list rather than the
// name stored on the row, so renaming a parameter here also updates rows that were
// saved earlier under the old label (e.g. existing draft/approved MPRs).
const PARAM_NAME_BY_KEY = new Map(WPR_PLANNING_PARAMETERS.map((p) => [p.key, p.name]));

export default function PlanForNextMonthSection({ rows = [], onChange, locked, forecastRows = [] }) {
  const vowdByWeek = React.useMemo(() => ({
    week1: calcForecastWeeklyVowd(forecastRows, 'week1'),
    week2: calcForecastWeeklyVowd(forecastRows, 'week2'),
    week3: calcForecastWeeklyVowd(forecastRows, 'week3'),
    week4: calcForecastWeeklyVowd(forecastRows, 'week4'),
  }), [forecastRows]);

  const vowdTotal = vowdByWeek.week1 + vowdByWeek.week2 + vowdByWeek.week3 + vowdByWeek.week4;

  // Ensure rows match master parameters if missing
  const effectiveRows = React.useMemo(() => {
    if (!rows || rows.length === 0) {
      return WPR_PLANNING_PARAMETERS.map((param) =>
        createEmptyPlanForNextMonthRow(param.key, param.name, param.unit, param.isMultiRow)
      );
    }

    // Merge missing master parameters if old saved form didn't have them
    const existingKeys = new Set(rows.map((r) => r.parameterKey));
    const missingMasterRows = WPR_PLANNING_PARAMETERS.filter((p) => !existingKeys.has(p.key)).map((p) =>
      createEmptyPlanForNextMonthRow(p.key, p.name, p.unit, p.isMultiRow)
    );

    return [...rows, ...missingMasterRows];
  }, [rows]);

  const paramNumbers = React.useMemo(() => {
    const map = new Map();
    let currentNum = 0;
    effectiveRows.forEach((r) => {
      if (!map.has(r.parameterKey)) {
        currentNum += 1;
        map.set(r.parameterKey, currentNum);
      }
    });
    return map;
  }, [effectiveRows]);

  const updateRow = (id, field, value) => {
    if (locked) return;
    onChange(effectiveRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addSubItemRow = (paramKey, paramName, unit, index) => {
    if (locked) return;
    const newRow = createEmptyPlanForNextMonthRow(paramKey, paramName, unit, true);
    const copy = [...effectiveRows];
    copy.splice(index + 1, 0, newRow);
    onChange(copy);
  };

  const removeSubItemRow = (id, paramKey) => {
    if (locked) return;
    const sameParamRows = effectiveRows.filter((r) => r.parameterKey === paramKey);
    if (sameParamRows.length <= 1) {
      // Don't delete the last row for a parameter; clear its inputs instead
      onChange(
        effectiveRows.map((r) =>
          r.id === id ? { ...r, subItemName: '', week1: '', week2: '', week3: '', week4: '' } : r
        )
      );
      return;
    }
    onChange(effectiveRows.filter((r) => r.id !== id));
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border shadow-sm">
        <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">Weekly Plan for Next Month</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase w-10">#</th>
                <HeaderCell label="Parameter / Activity Name" tooltip="WPR Planning Parameter or specific activity description." />
                <HeaderCell label="Week 1 Plan" align="right" tooltip="Target value for Week 1 of next month." />
                <HeaderCell label="Week 2 Plan" align="right" tooltip="Target value for Week 2 of next month." />
                <HeaderCell label="Week 3 Plan" align="right" tooltip="Target value for Week 3 of next month." />
                <HeaderCell label="Week 4 Plan" align="right" tooltip="Target value for Week 4 of next month." />
                <HeaderCell label="Total Month Plan" align="right" tooltip="Cumulative target for the entire month (Week 1–4 sum)." />
                {!locked && <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground uppercase w-20">Sub-item</th>}
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map((row, index) => {
                const isVowd = row.parameterKey === 'valueOfWorkDone';
                const isReadOnlyRating = row.parameterKey === 'qualityRating' || row.parameterKey === 'healthSafetyRating';
                const isReadOnlyParam = isVowd || isReadOnlyRating;
                const total = isVowd ? vowdTotal : planForNextMonthRowTotal(row);

                // Check if this parameter is the first occurrence in the table for row numbering & master label
                const isFirstOfGroup =
                  index === 0 || effectiveRows[index - 1].parameterKey !== row.parameterKey;

                return (
                  <tr
                    key={row.id}
                    className={`border-b hover:bg-muted/20 transition-colors ${
                      isFirstOfGroup ? 'bg-muted/10 font-medium' : ''
                    }`}
                  >
                    <td className="p-2 text-xs text-muted-foreground align-middle font-mono">
                      {isFirstOfGroup ? paramNumbers.get(row.parameterKey) : ''}
                    </td>

                    <td className="p-2">
                      <div className="space-y-1">
                        {isFirstOfGroup && (
                          <span className="text-xs font-semibold text-foreground block">
                            {PARAM_NAME_BY_KEY.get(row.parameterKey) || row.parameterName || 'Parameter'}
                          </span>
                        )}
                        {row.isMultiRow && (
                          <Input
                            type="text"
                            value={row.subItemName || ''}
                            onChange={(e) => updateRow(row.id, 'subItemName', e.target.value)}
                            disabled={locked}
                            placeholder="Enter specific activity or item description..."
                            className="h-7 text-xs bg-background"
                          />
                        )}
                      </div>
                    </td>

                    {['week1', 'week2', 'week3', 'week4'].map((wk) => {
                      const val = isVowd
                        ? vowdByWeek[wk]
                        : isReadOnlyRating
                        ? '10'
                        : (row[wk] ?? '');

                      const displayVal = isVowd ? formatCurrencyINR(val) : val;

                      return (
                        <td key={wk} className="p-2">
                          <Input
                            type={isVowd ? 'text' : 'number'}
                            step="any"
                            value={displayVal}
                            onChange={(e) => updateRow(row.id, wk, e.target.value)}
                            disabled={locked || isReadOnlyParam}
                            readOnly={isReadOnlyParam}
                            className={`h-8 text-xs text-right w-28 ${
                              isReadOnlyParam ? 'bg-muted/60 font-semibold cursor-not-allowed select-none' : 'bg-background'
                            }`}
                            placeholder="0"
                          />
                        </td>
                      );
                    })}

                    <td className="p-2">
                      <div className="h-8 flex items-center justify-end px-3 text-xs rounded-md bg-muted/50 font-mono font-semibold text-emerald-700 select-none">
                        {isReadOnlyRating ? '10' : isVowd ? formatCurrencyINR(total) : formatNumberIndian(total)}
                      </div>
                    </td>

                    {!locked && (
                      <td className="p-2 text-center">
                        {row.isMultiRow && (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() =>
                                addSubItemRow(
                                  row.parameterKey,
                                  PARAM_NAME_BY_KEY.get(row.parameterKey) || row.parameterName,
                                  row.unit,
                                  index
                                )
                              }
                              title="Add sub-item"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-destructive border-red-100 hover:bg-red-50 hover:text-destructive"
                              onClick={() => removeSubItemRow(row.id, row.parameterKey)}
                              title="Remove sub-item"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
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
