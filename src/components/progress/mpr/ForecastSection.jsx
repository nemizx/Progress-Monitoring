import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Minus, HelpCircle, ChevronsUpDown } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { createEmptyForecastRow, forecastRowQty } from '@/lib/mprForm';
import { formatCurrencyINR, formatNumberIndian } from '@/lib/formatters';

const highlightText = (text, highlight) => {
  if (!text) return '—';
  if (!highlight || !highlight.trim()) return text;
  const escaped = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 text-amber-950 font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

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

function ActivityCombobox({ row, onSelect, locked, activityOptions }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearchQuery(''); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={locked}
          className="h-8.5 w-full min-w-[220px] justify-between font-normal text-xs px-2.5 bg-background"
        >
          <span className="truncate">{row.description || 'Search activity...'}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,520px)] p-0" align="start">
        <Command>
          <CommandInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Type activity code or name..."
          />
          <CommandList>
            <CommandEmpty>No activity found.</CommandEmpty>
            <CommandGroup>
              {activityOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.code} ${opt.title}`}
                  onSelect={() => {
                    onSelect(opt);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className="gap-3 items-start py-2.5"
                >
                  <span className="font-mono text-xs font-semibold whitespace-nowrap min-w-[170px] max-w-[220px] shrink-0">
                    {highlightText(opt.code || '—', searchQuery)}
                  </span>
                  <span className="flex-1 text-xs whitespace-normal break-words">
                    {highlightText(opt.title, searchQuery)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ForecastSection({ rows, onChange, locked, activityOptions = [] }) {
  const updateRow = (id, field, value) => {
    if (locked) return;
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleActivitySelect = (id, opt) => {
    onChange(rows.map((r) => (r.id === id ? {
      ...r,
      description: opt.title,
      unit: opt.unit || '',
      rate: opt.rate ?? '',
      wbsItemId: opt.wbsItemId || '',
      budgetItemId: opt.budgetItemId || '',
      activityKey: opt.activityKey || '',
    } : r)));
  };

  const addRow = (index) => {
    if (locked) return;
    const copy = [...rows];
    copy.splice(index + 1, 0, createEmptyForecastRow());
    onChange(copy);
  };

  const removeRow = (index) => {
    if (locked) return;
    const filtered = rows.filter((_, i) => i !== index);
    onChange(filtered.length === 0 ? [createEmptyForecastRow()] : filtered);
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans border-collapse min-w-[1700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase w-10">#</th>
                <HeaderCell label="Description" tooltip="Searchable leaf-level activity from the project's WBS/budget items." />
                <HeaderCell label="Unit" align="right" tooltip="Auto-filled from the selected activity." />
                <HeaderCell label="Week 1" align="right" />
                <HeaderCell label="Week 2" align="right" />
                <HeaderCell label="Week 3" align="right" />
                <HeaderCell label="Week 4" align="right" />
                <HeaderCell label="Quantity" align="right" tooltip="Sum of Week 1-4." />
                <HeaderCell label="Rate" align="right" tooltip="Auto-filled from the selected activity." />
                <HeaderCell label="Total Amount" align="right" tooltip="Quantity × Rate." />
                <HeaderCell label="Drawing Status" />
                <HeaderCell label="Total Labor Required" align="right" />
                <HeaderCell label="Cement Bags" align="right" />
                {!locked && <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground uppercase w-24">Add/Remove</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const qty = forecastRowQty(row);
                const amount = qty * (parseFloat(row.rate) || 0);
                return (
                  <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-2 text-xs text-muted-foreground align-middle">{index + 1}</td>
                    <td className="p-2">
                      <ActivityCombobox
                        row={row}
                        onSelect={(opt) => handleActivitySelect(row.id, opt)}
                        locked={locked}
                        activityOptions={activityOptions}
                      />
                    </td>
                    <td className="p-2">
                      <div className="h-8.5 flex items-center justify-end px-3 text-xs rounded-md bg-muted/40 font-mono select-none">{row.unit || '—'}</div>
                    </td>
                    {['week1', 'week2', 'week3', 'week4'].map((wk) => (
                      <td key={wk} className="p-2">
                        <Input type="number" step="any" value={row[wk]} onChange={(e) => updateRow(row.id, wk, e.target.value)} disabled={locked} className="h-8.5 text-xs text-right bg-background w-24" placeholder="0" />
                      </td>
                    ))}
                    <td className="p-2">
                      <div className="h-8.5 flex items-center justify-end px-3 text-xs rounded-md bg-muted/40 font-mono select-none font-semibold">{formatNumberIndian(qty)}</div>
                    </td>
                    <td className="p-2">
                      <div className="h-8.5 flex items-center justify-end px-3 text-xs rounded-md bg-muted/40 font-mono select-none">{row.rate !== '' && row.rate != null ? formatCurrencyINR(row.rate) : '—'}</div>
                    </td>
                    <td className="p-2">
                      <div className="h-8.5 flex items-center justify-end px-3 text-xs rounded-md bg-muted/50 font-mono select-none font-bold text-emerald-700">{formatCurrencyINR(amount)}</div>
                    </td>
                    <td className="p-2">
                      <Input type="text" value={row.drawingStatus} onChange={(e) => updateRow(row.id, 'drawingStatus', e.target.value)} disabled={locked} className="h-8.5 text-xs bg-background w-32" />
                    </td>
                    <td className="p-2">
                      <Input type="number" value={row.totalLabourRequired} onChange={(e) => updateRow(row.id, 'totalLabourRequired', e.target.value)} disabled={locked} className="h-8.5 text-xs text-right bg-background w-24" />
                    </td>
                    <td className="p-2">
                      <Input type="number" value={row.cementBags} onChange={(e) => updateRow(row.id, 'cementBags', e.target.value)} disabled={locked} className="h-8.5 text-xs text-right bg-background w-24" />
                    </td>
                    {!locked && (
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => addRow(index)}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7 text-destructive border-red-100 hover:bg-red-50 hover:text-destructive" onClick={() => removeRow(index)}>
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
