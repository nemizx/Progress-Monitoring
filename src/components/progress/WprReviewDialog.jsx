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
import { Loader2 } from 'lucide-react';

function ReviewSection({ section }) {
  if (!section?.rows?.length) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 border-b">
          <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">{section.title}</h3>
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
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">{section.title}</h3>
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
                  {col.label}
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

export default function WprReviewDialog({
  open,
  onOpenChange,
  meta,
  sections,
  onConfirm,
  isSubmitting,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-heading">Review &amp; Final Submit WPR</DialogTitle>
          <DialogDescription className="text-sm">
            Review the weekly progress report below before final submission for{' '}
            <span className="font-semibold text-foreground">{meta?.weekLabel}</span>.
            After submit, this week will be locked.
          </DialogDescription>
          <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
            {meta?.projectName && (
              <span>
                <span className="font-semibold text-foreground">Project:</span> {meta.projectName}
              </span>
            )}
            {meta?.subProjectName && (
              <span>
                <span className="font-semibold text-foreground">Sub-project:</span> {meta.subProjectName}
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
          {sections.map((section) => (
            <ReviewSection key={section.title} section={section} />
          ))}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-2">
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSubmitting ? 'Submitting...' : 'Confirm Final Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
