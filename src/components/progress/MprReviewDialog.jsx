import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, HelpCircle, FileCheck, Lock, Printer } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

function SectionTitle({ title, tooltip }) {
  if (!tooltip) {
    return <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h3>;
  }
  return (
    <div className="flex items-center gap-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h3>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3 h-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help normal-case" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-center font-normal normal-case">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function ColumnHeader({ label, tooltip }) {
  if (!tooltip) return <>{label}</>;
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3 h-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help normal-case" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[200px] text-center font-normal normal-case">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function ReviewSection({ section }) {
  if (section.layout === 'html') {
    const isEmpty = !section.html || section.html.replace(/<[^>]*>/g, '').trim() === '';
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 border-b">
          <SectionTitle title={section.title} tooltip={section.tooltip} />
        </div>
        {isEmpty ? (
          <p className="text-xs text-muted-foreground p-4">No entries for this section.</p>
        ) : (
          <div
            className="p-4 text-xs prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: section.html }}
          />
        )}
      </div>
    );
  }

  if (!section?.rows?.length) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 border-b">
          <SectionTitle title={section.title} tooltip={section.tooltip} />
        </div>
        <p className="text-xs text-muted-foreground p-4">No entries for this section.</p>
      </div>
    );
  }

  const alignClass = (align) => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/40 px-4 py-2 border-b flex items-center justify-between gap-2">
        <SectionTitle title={section.title} tooltip={section.tooltip} />
        {section.pctLabel ? (
          <span className="text-xs font-semibold text-emerald-700">{section.pctLabel}</span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="border-b bg-muted/20">
              {section.columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-2 font-semibold text-muted-foreground whitespace-nowrap ${alignClass(col.align)}`}
                >
                  <ColumnHeader label={col.label} tooltip={col.tooltip} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, idx) => (
              <tr key={row.id || idx} className="border-b last:border-0">
                {section.columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-2 align-top text-foreground whitespace-nowrap ${alignClass(col.align)} ${
                      col.align === 'right' ? 'font-mono' : ''
                    }`}
                  >
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MprReviewDialog({
  open,
  onOpenChange,
  meta,
  sections,
  onConfirm,
  onApprove,
  onPrint,
  isSubmitting,
}) {
  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-lg font-heading">Review &amp; Submit MPR</DialogTitle>
            <DialogDescription className="text-sm">
              Review the monthly progress report below. You can save as submitted or approve &amp; lock the report for{' '}
              <span className="font-semibold text-foreground">{meta?.monthLabel}</span>.
            </DialogDescription>
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
              {meta?.projectName && (
                <span>
                  <span className="font-semibold text-foreground">Project:</span> {meta.projectName}
                </span>
              )}
              {meta?.submittedBy && (
                <span>
                  <span className="font-semibold text-foreground">Submitted by:</span> {meta.submittedBy}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {meta?.elevationPhotoUrl && (
              <div className="p-4 border rounded-xl bg-slate-900 text-white flex items-center gap-4 shadow-sm">
                <div className="w-32 h-24 rounded-lg overflow-hidden shrink-0 border border-slate-700 bg-slate-950 flex items-center justify-center">
                  <img src={meta.elevationPhotoUrl} alt="Project Elevation" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                    Project Elevation View
                  </span>
                  <h4 className="font-bold text-sm text-white">{meta.projectName || 'Project Elevation'}</h4>
                  <p className="text-xs text-slate-300">Project elevation photo from Project Master for user MPR print reports.</p>
                </div>
              </div>
            )}

            {sections.map((section) => (
              <ReviewSection key={section.title} section={section} />
            ))}
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-2">
            {onPrint && (
              <Button
                type="button"
                variant="outline"
                onClick={onPrint}
                disabled={isSubmitting}
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                Print Report (PDF)
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              variant="secondary"
              className="gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              Save &amp; Submit
            </Button>
            {onApprove && (
              <Button
                type="button"
                onClick={onApprove}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Approve &amp; Lock
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
