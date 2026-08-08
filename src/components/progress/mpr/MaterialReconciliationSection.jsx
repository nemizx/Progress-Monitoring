import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ensureMaterialReconciliationTemplate,
  calcReconciliationDiffs,
  sumReconciliationGroup,
} from '@/lib/mprForm';
import { formatNumberIndian } from '@/lib/formatters';

function fmt(n) {
  if (n === '' || n == null || Number.isNaN(Number(n))) return '—';
  return formatNumberIndian(Number(n));
}

function LabelCell({ label }) {
  return (
    <th className="p-1 font-semibold text-[9px] leading-tight text-slate-700 border border-slate-300 bg-slate-100 text-center align-middle">
      {label}
    </th>
  );
}

/** Second header row: letter alone, or letter+formula (e.g. F=D-E) as in Planedge screenshot. */
function CodeCell({ code }) {
  return (
    <th className="p-0.5 font-semibold text-[9px] text-slate-800 border border-slate-300 bg-sky-50 text-center whitespace-nowrap">
      {code || ''}
    </th>
  );
}

function ReadonlyNum({ value }) {
  return (
    <div className="h-7 flex items-center justify-end px-1.5 text-[10px] rounded-sm bg-muted/40 font-mono select-none">
      {fmt(value)}
    </div>
  );
}

function NumInput({ value, onChange, locked }) {
  return (
    <Input
      type="number"
      step="any"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={locked}
      className="h-7 text-[10px] text-right bg-background font-mono px-1.5"
    />
  );
}

export default function MaterialReconciliationSection({ rows, onChange, locked, monthLabel }) {
  const effectiveRows = useMemo(() => ensureMaterialReconciliationTemplate(rows), [rows]);

  // Persist normalized template (single Cum Total under Cement) back into form state
  React.useEffect(() => {
    const oldJson = JSON.stringify(
      (rows || []).map((r) => ({
        rowType: r.rowType,
        srNo: r.srNo,
        materialDescription: r.materialDescription,
        unit: r.unit,
        totalGroup: r.totalGroup,
      }))
    );
    const newJson = JSON.stringify(
      effectiveRows.map((r) => ({
        rowType: r.rowType,
        srNo: r.srNo,
        materialDescription: r.materialDescription,
        unit: r.unit,
        totalGroup: r.totalGroup,
      }))
    );
    if (oldJson !== newJson) {
      onChange(effectiveRows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRows]);

  const updateRow = (id, field, value) => {
    if (locked) return;
    onChange(effectiveRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const resolvedRows = useMemo(() => {
    return effectiveRows.map((row) => {
      if (row.rowType === 'total' && row.totalGroup) {
        return {
          ...row,
          theoreticalConsumption: sumReconciliationGroup(effectiveRows, row.totalGroup, 'theoreticalConsumption'),
          actualConsumption: sumReconciliationGroup(effectiveRows, row.totalGroup, 'actualConsumption'),
          physicalStockRegister: sumReconciliationGroup(effectiveRows, row.totalGroup, 'physicalStockRegister'),
          physicalStockVerification: sumReconciliationGroup(effectiveRows, row.totalGroup, 'physicalStockVerification'),
          cummReceived: sumReconciliationGroup(effectiveRows, row.totalGroup, 'cummReceived'),
          certifiedCummConsumption: sumReconciliationGroup(effectiveRows, row.totalGroup, 'certifiedCummConsumption'),
        };
      }
      return row;
    });
  }, [effectiveRows]);

  return (
    <Card className="overflow-hidden border shadow-sm">
      <div className="px-4 py-3 border-b bg-sky-50/80">
        <h3 className="text-sm font-bold text-slate-800">
          7. Cumulative Material Reconciliation Report
          {monthLabel ? ` For Month - ${monthLabel}` : ''}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Default Steel &amp; Cement layout — F / I / L / M are auto-calculated.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-sans border-collapse min-w-[1600px]">
          <thead>
            {/* Row 1 — main column names */}
            <tr>
              <LabelCell label="Sr No." />
              <LabelCell label="Material Description" />
              <LabelCell label="Unit" />
              <LabelCell label="Theoretical Consumption" />
              <LabelCell label="Actual Consumption" />
              <LabelCell label="Difference" />
              <LabelCell label="Physical stock as per stock register" />
              <LabelCell label="Physical stock as per broad physical" />
              <LabelCell label="Difference" />
              <LabelCell label="Cumm. Received material from start" />
              <LabelCell label="Certified Cumm. Actual consumption" />
              <LabelCell label="Difference" />
              <LabelCell label="Error to be audited" />
              <LabelCell label="Remark" />
            </tr>
            {/* Row 2 — letters + formulas in same row (matches screenshot) */}
            <tr>
              <CodeCell code="A" />
              <CodeCell code="B" />
              <CodeCell code="C" />
              <CodeCell code="D" />
              <CodeCell code="E" />
              <CodeCell code="F=D-E" />
              <CodeCell code="G" />
              <CodeCell code="H" />
              <CodeCell code="I=G-H" />
              <CodeCell code="J" />
              <CodeCell code="K" />
              <CodeCell code="L=J-K" />
              <CodeCell code="M=L-G" />
              <CodeCell code="" />
            </tr>
          </thead>
            <tbody>
              {resolvedRows.map((row) => {
                if (row.rowType === 'section') {
                  return (
                    <tr key={row.id} className="bg-sky-100">
                      <td
                        colSpan={14}
                        className="p-1.5 text-[10px] font-bold tracking-wide text-slate-900 border border-slate-300"
                      >
                        {row.materialDescription}
                      </td>
                    </tr>
                  );
                }

                const isTotal = row.rowType === 'total';
                const diffs = calcReconciliationDiffs(row);

                return (
                  <tr
                    key={row.id}
                    className={`border-b last:border-0 ${
                      isTotal
                        ? 'bg-slate-100 font-bold'
                        : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className={`p-1 text-center text-[10px] border border-slate-100 w-10 ${isTotal ? 'font-bold text-slate-900' : 'text-muted-foreground'}`}>
                      {isTotal ? '—' : row.srNo}
                    </td>
                    <td className={`p-1 text-[10px] border border-slate-100 min-w-[110px] ${isTotal ? 'font-bold text-slate-900' : 'font-medium text-foreground'}`}>
                      {row.materialDescription}
                    </td>
                    <td className={`p-1 text-center text-[10px] border border-slate-100 w-14 ${isTotal ? 'font-bold' : ''}`}>
                      {row.unit || (isTotal ? '—' : '')}
                    </td>

                    <td className="p-1 border border-slate-100 w-28">
                      {isTotal ? (
                        <ReadonlyNum value={row.theoreticalConsumption} />
                      ) : (
                        <NumInput
                          value={row.theoreticalConsumption}
                          onChange={(v) => updateRow(row.id, 'theoreticalConsumption', v)}
                          locked={locked}
                        />
                      )}
                    </td>
                    <td className="p-1 border border-slate-100 w-28">
                      {isTotal ? (
                        <ReadonlyNum value={row.actualConsumption} />
                      ) : (
                        <NumInput
                          value={row.actualConsumption}
                          onChange={(v) => updateRow(row.id, 'actualConsumption', v)}
                          locked={locked}
                        />
                      )}
                    </td>
                    <td className="p-1 border border-slate-100 w-24">
                      <ReadonlyNum value={diffs.diffDE} />
                    </td>

                    <td className="p-1 border border-slate-100 w-28">
                      {isTotal ? (
                        <ReadonlyNum value={row.physicalStockRegister} />
                      ) : (
                        <NumInput
                          value={row.physicalStockRegister}
                          onChange={(v) => updateRow(row.id, 'physicalStockRegister', v)}
                          locked={locked}
                        />
                      )}
                    </td>
                    <td className="p-1 border border-slate-100 w-28">
                      {isTotal ? (
                        <ReadonlyNum value={row.physicalStockVerification} />
                      ) : (
                        <NumInput
                          value={row.physicalStockVerification}
                          onChange={(v) => updateRow(row.id, 'physicalStockVerification', v)}
                          locked={locked}
                        />
                      )}
                    </td>
                    <td className="p-1 border border-slate-100 w-24">
                      <ReadonlyNum value={diffs.diffGH} />
                    </td>

                    <td className="p-1 border border-slate-100 w-28">
                      {isTotal ? (
                        <ReadonlyNum value={row.cummReceived} />
                      ) : (
                        <NumInput
                          value={row.cummReceived}
                          onChange={(v) => updateRow(row.id, 'cummReceived', v)}
                          locked={locked}
                        />
                      )}
                    </td>
                    <td className="p-1 border border-slate-100 w-28">
                      {isTotal ? (
                        <ReadonlyNum value={row.certifiedCummConsumption} />
                      ) : (
                        <NumInput
                          value={row.certifiedCummConsumption}
                          onChange={(v) => updateRow(row.id, 'certifiedCummConsumption', v)}
                          locked={locked}
                        />
                      )}
                    </td>
                    <td className="p-1 border border-slate-100 w-24">
                      <ReadonlyNum value={diffs.diffJK} />
                    </td>
                    <td className="p-1 border border-slate-100 w-24">
                      <ReadonlyNum value={diffs.errorAudited} />
                    </td>

                    <td className="p-1 border border-slate-100 min-w-[120px]">
                      {isTotal ? (
                        <div className="h-8 flex items-center px-2 text-xs text-muted-foreground">—</div>
                      ) : (
                        <Input
                          value={row.remark ?? ''}
                          onChange={(e) => updateRow(row.id, 'remark', e.target.value)}
                          disabled={locked}
                          className="h-7 text-[10px] bg-background px-1.5"
                          placeholder="Remark"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
  );
}
