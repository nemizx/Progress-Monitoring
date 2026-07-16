import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

function HeaderTooltip({ text }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="w-3 h-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help inline-block ml-1 align-middle" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-center font-sans font-normal normal-case">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ValueBox({ value }) {
  return (
    <div className="h-8 w-full min-w-0 flex items-center justify-center rounded-md border border-slate-200 bg-background px-1 text-xs font-mono text-foreground">
      {Number(value) || 0}
    </div>
  );
}

/**
 * Read-only contractor labour table matching the DPR Labour Details panel layout.
 * rows: { contractor | contractor_name, unit, carpenter, barbender, mason, skilled_other,
 *         carpenter_helper, barbender_helper, semi_skilled_other, mc, fc, total, groupLabel? }
 */
export default function ContractorLabourTable({
  rows = [],
  emptyMessage = 'No contractor labour entries.',
  showGroupLabels = false,
}) {
  if (!rows.length) {
    return (
      <p className="text-xs text-muted-foreground p-4 text-center">{emptyMessage}</p>
    );
  }

  return (
    <TooltipProvider>
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-sans border-collapse border-slate-200 min-w-[900px]">
        <thead>
          <tr className="border-b bg-muted/60 text-muted-foreground text-center">
            <th rowSpan={2} className="p-3 text-left font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 w-16">
              Sr. No
            </th>
            <th rowSpan={2} className="p-3 text-left font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 min-w-[240px]">
              Contractor Name
            </th>
            <th rowSpan={2} className="p-3 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 w-24">
              Unit
            </th>
            <th colSpan={4} className="p-2 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 bg-muted/20">
              Skilled Labour
              <HeaderTooltip text="Skilled tradespeople deployed by this contractor today." />
            </th>
            <th colSpan={3} className="p-2 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 bg-muted/30">
              Semi Skilled Labour
              <HeaderTooltip text="Semi-skilled helper labour deployed by this contractor today." />
            </th>
            <th colSpan={2} className="p-2 text-center font-bold text-[11px] uppercase tracking-wider border-r border-slate-200 bg-muted/20">
              Unskilled Labour
              <HeaderTooltip text="Unskilled male/female coolie labour deployed by this contractor today." />
            </th>
            <th rowSpan={2} className="p-3 text-right font-bold text-[11px] uppercase tracking-wider w-28">
              Total
              <HeaderTooltip text="Sum of all labour categories for this contractor today." />
            </th>
          </tr>
          <tr className="border-b bg-muted/40 text-[10px] text-muted-foreground text-center">
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px]">Carpentar</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px]">Barbender</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px]">Mason</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[72px]">Other</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/20 w-[90px]">Carpenter Helper</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/20 w-[90px]">Barbender Helper</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/20 w-[90px]">Other</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[60px]">M/C</th>
            <th className="p-2 text-center font-semibold uppercase border-r border-slate-200 bg-muted/10 w-[60px]">F/C</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            if (showGroupLabels && row._groupLabel) {
              return (
                <tr key={`group-${row._groupLabel}-${index}`} className="bg-primary/5 font-semibold text-primary">
                  <td colSpan={13} className="p-1.5 pl-4 text-xs font-bold border-b border-slate-200">
                    {row._groupLabel}
                  </td>
                </tr>
              );
            }

            const name = row.contractor_name || row.contractor || '—';
            const total = row.total ?? (
              (Number(row.carpenter) || 0)
              + (Number(row.barbender) || 0)
              + (Number(row.mason) || 0)
              + (Number(row.skilled_other) || 0)
              + (Number(row.carpenter_helper) || 0)
              + (Number(row.barbender_helper) || 0)
              + (Number(row.semi_skilled_other) || 0)
              + (Number(row.mc) || 0)
              + (Number(row.fc) || 0)
            );

            return (
              <tr key={row.id || `${name}-${index}`} className="border-b border-slate-200 hover:bg-muted/15">
                <td className="p-3 text-xs font-semibold text-muted-foreground border-r border-slate-200">
                  {row.sr ?? index + 1}
                </td>
                <td className="p-3 text-xs font-bold text-foreground border-r border-slate-200">
                  {name}
                </td>
                <td className="p-3 text-center border-r border-slate-200">
                  <span className="text-xs font-semibold text-slate-600">{row.unit || 'Nos'}</span>
                </td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.carpenter} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.barbender} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.mason} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.skilled_other} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.carpenter_helper} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.barbender_helper} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.semi_skilled_other} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.mc} /></td>
                <td className="p-1 text-center border-r border-slate-200"><ValueBox value={row.fc} /></td>
                <td className="p-3 text-right font-bold text-slate-800 font-mono text-xs">
                  {Number(total).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </TooltipProvider>
  );
}
