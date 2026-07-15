import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { formatInputCurrency, parseCurrencyInputValue } from '@/lib/formatters';

function HeaderCell({ label, tooltip, align = 'left', width }) {
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th
      className={`p-2.5 font-semibold text-xs text-muted-foreground uppercase ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      style={width ? { width } : undefined}
    >
      <div className={`flex items-center gap-1 select-none ${justify}`}>
        <span>{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </th>
  );
}

function Cell({ col, row, onChange, locked }) {
  const value = row[col.key] ?? '';
  const disabled = locked || col.type === 'readonly';
  const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '';

  if (col.type === 'readonly') {
    const display = col.render ? col.render(row) : (value === '' || value === null ? '—' : value);
    return (
      <td className="p-2">
        <div className={`h-8.5 flex items-center px-3 text-xs rounded-md bg-muted/40 font-mono select-none ${alignClass}`}>
          {display}
        </div>
      </td>
    );
  }

  if (col.type === 'textarea') {
    return (
      <td className="p-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(row.id, col.key, e.target.value)}
          placeholder={col.placeholder}
          disabled={disabled}
          className="text-xs bg-background resize-none min-h-[42px]"
        />
      </td>
    );
  }

  if (col.type === 'currency') {
    return (
      <td className="p-2">
        <Input
          type="text"
          inputMode="decimal"
          value={formatInputCurrency(value)}
          onChange={(e) => onChange(row.id, col.key, parseCurrencyInputValue(e.target.value))}
          placeholder={col.placeholder}
          disabled={disabled}
          className={`h-8.5 text-xs bg-background w-full ${alignClass}`}
        />
      </td>
    );
  }

  if (col.type === 'select') {
    return (
      <td className="p-2">
        <Select
          value={value || undefined}
          onValueChange={(v) => onChange(row.id, col.key, v)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8.5 text-xs bg-background">
            <SelectValue placeholder={col.placeholder || 'Select'} />
          </SelectTrigger>
          <SelectContent>
            {(col.options || []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    );
  }

  return (
    <td className="p-2">
      <Input
        type={col.type || 'text'}
        value={value}
        onChange={(e) => onChange(row.id, col.key, e.target.value)}
        placeholder={col.placeholder}
        disabled={disabled}
        className={`h-8.5 text-xs bg-background w-full ${alignClass}`}
        step={col.type === 'number' ? 'any' : undefined}
      />
    </td>
  );
}

/**
 * Generic add/remove multi-row table shared by most MPR sections.
 * columns: [{ key, label, type: 'text'|'number'|'date'|'select'|'textarea'|'readonly', align, tooltip, options, render, width, placeholder }]
 */
export default function MprMultiRowTable({
  columns,
  rows,
  onChange,
  createRow,
  locked = false,
  minWidth = 900,
  tableLayout = 'auto',
}) {
  const updateRow = (id, field, value) => {
    if (locked) return;
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = (index) => {
    if (locked) return;
    const copy = [...rows];
    copy.splice(index + 1, 0, createRow());
    onChange(copy);
  };

  const removeRow = (index) => {
    if (locked) return;
    const filtered = rows.filter((_, i) => i !== index);
    onChange(filtered.length === 0 ? [createRow()] : filtered);
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans border-collapse" style={{ minWidth: minWidth || undefined, tableLayout }}>
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase w-10">#</th>
                {columns.map((col) => (
                  <HeaderCell key={col.key} label={col.label} tooltip={col.tooltip} align={col.align} width={col.width} />
                ))}
                {!locked && (
                  <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground uppercase w-24">Add/Remove</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="p-2 text-xs text-muted-foreground align-middle">{index + 1}</td>
                  {columns.map((col) => (
                    <Cell key={col.key} col={col} row={row} onChange={updateRow} locked={locked} />
                  ))}
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
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </TooltipProvider>
  );
}
