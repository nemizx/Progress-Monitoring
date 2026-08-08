import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, Loader2, FileText } from 'lucide-react';
import { formatCurrencyINR, formatNumberIndian, formatDateIndian } from '@/lib/formatters';
import { BRANDING } from '@/config/branding';
import { getProjectTypeLabel } from '@/lib/projectTypes';
import {
  ensureMaterialReconciliationTemplate,
  calcReconciliationDiffs,
  sumReconciliationGroup,
  ensureKeyActivitiesTemplate,
  ensureWorkCompletionStatus,
  WORK_COMPLETION_BUILDING_ROWS,
  WORK_COMPLETION_SUBPROJECT_PAGE_SIZE,
  getWorkCompletionSubProjects,
  chunkWorkCompletionSubProjects,
  getWorkCompletionCell,
} from '@/lib/mprForm';
import './mprPrintReport.css';

export default function MprPrintReport({
  open = true,
  onClose,
  form = {},
  meta = {},
  projectData = {},
  planVsAchievementRows = [],
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const reportRef = useRef(null);

  if (!open) return null;

  const reconciliationBase = ensureMaterialReconciliationTemplate(form.materialReconciliation);
  const reconciliationRows = reconciliationBase.map((row) => {
    if (row.rowType !== 'total' || !row.totalGroup) return row;
    return {
      ...row,
      theoreticalConsumption: sumReconciliationGroup(reconciliationBase, row.totalGroup, 'theoreticalConsumption'),
      actualConsumption: sumReconciliationGroup(reconciliationBase, row.totalGroup, 'actualConsumption'),
      physicalStockRegister: sumReconciliationGroup(reconciliationBase, row.totalGroup, 'physicalStockRegister'),
      physicalStockVerification: sumReconciliationGroup(reconciliationBase, row.totalGroup, 'physicalStockVerification'),
      cummReceived: sumReconciliationGroup(reconciliationBase, row.totalGroup, 'cummReceived'),
      certifiedCummConsumption: sumReconciliationGroup(reconciliationBase, row.totalGroup, 'certifiedCummConsumption'),
    };
  });
  const keyActivityRows = ensureKeyActivitiesTemplate(form.keyActivities);
  const workCompletionData = ensureWorkCompletionStatus(form.workCompletionStatus);
  const workCompletionSubProjects = getWorkCompletionSubProjects(
    form.projectConfiguration,
    projectData.building_configurations
  );
  const workCompletionChunks = chunkWorkCompletionSubProjects(
    workCompletionSubProjects,
    WORK_COMPLETION_SUBPROJECT_PAGE_SIZE
  );

  // Metadata — project-driven; blank placeholders when master data is missing
  const projectName = meta.projectName || projectData.name || '—';
  const projectCode = meta.projectCode || projectData.project_code || '—';
  const monthConsidered = meta.monthLabel || '—';
  const nextMonthLabel = meta.nextMonthLabel || '—';
  const reportNo = meta.monthlyReportNo || (projectCode !== '—' ? `${projectCode}/MPR/${meta.monthId || '—'}` : '—');
  const location = meta.location || projectData.location || '—';
  const statusDate = meta.statusDate || formatDateIndian(new Date());
  const elevationPhotoUrl = meta.elevationPhotoUrl || projectData.elevation_photo_url || '';

  const docNo = meta.docNo || 'PLN – 03 – F03';
  const revNo = meta.revNo || 'R2';
  const docTitle = 'Monthly Progress';
  const docDate = meta.docDate || '—';
  const companyName = meta.companyName || BRANDING.companyName;
  const footerLogoSrc = meta.footerLogoUrl || BRANDING.logoSrc;

  const projectBuildingConfigs = (() => {
    const raw = projectData.building_configurations;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Sign-off
  const preparedBy = {
    name: form.signOff?.preparedByName || meta.submittedBy || '',
    title: form.signOff?.preparedByTitle || 'Site Engineer',
  };
  const checkedBy = {
    name: form.signOff?.checkedByName ?? (meta.checkedBy?.name || ''),
    title: form.signOff?.checkedByTitle ?? (meta.checkedBy?.title || ''),
  };
  const endorsedBy = {
    name: form.signOff?.endorsedByName ?? (meta.endorsedBy?.name || ''),
    title: form.signOff?.endorsedByTitle ?? (meta.endorsedBy?.title || ''),
  };

  // Parse Executive Summary bullet points
  const getExecSummaryPoints = () => {
    const raw = form.executiveSummary || '';
    if (typeof raw === 'string') {
      const stripped = raw
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]*>/g, '\n')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      return stripped.length > 0 ? stripped : ['No executive summary entries recorded for this month.'];
    }
    return ['No executive summary entries recorded for this month.'];
  };

  const execPoints = getExecSummaryPoints();

  // "January 2026" -> "January 26" for section headings (as in report template).
  const toShortYearLabel = (label) => {
    if (!label || typeof label !== 'string') return label;
    return label.replace(/\b(\d{4})\b/, (year) => year.slice(-2));
  };
  const monthConsideredShort = toShortYearLabel(monthConsidered);
  const nextMonthLabelShort = toShortYearLabel(nextMonthLabel);

  const PLAN_VS_ACHIEVEMENT_PAGE_SIZE = 13;
  const hasPlanVsAchievementContinued = planVsAchievementRows.length > PLAN_VS_ACHIEVEMENT_PAGE_SIZE;

  const planVsAchievementRowAmounts = (row) => {
    const pQty = parseFloat(row.plannedQty) || 0;
    const rate = parseFloat(row.rate) || 0;
    const aQty = parseFloat(row.achievedQty) || 0;
    const pAmt = parseFloat(row.plannedAmount) || pQty * rate;
    const aAmt = parseFloat(row.achievedAmount) || aQty * rate;
    return { pQty, rate, aQty, pAmt, aAmt };
  };

  const planVsAchievementTotals = planVsAchievementRows.reduce(
    (acc, row) => {
      const { pAmt, aAmt } = planVsAchievementRowAmounts(row);
      acc.plannedAmount += pAmt;
      acc.achievedAmount += aAmt;
      return acc;
    },
    { plannedAmount: 0, achievedAmount: 0 }
  );

  const renderPlanVsAchievementTotalRow = () => (
    <tr className="font-bold">
      <td colSpan={5} className="text-right">Total</td>
      <td className="text-right font-mono">{formatCurrencyINR(planVsAchievementTotals.plannedAmount, { decimals: 2 })}</td>
      <td></td>
      <td className="text-right font-mono">{formatCurrencyINR(planVsAchievementTotals.achievedAmount, { decimals: 2 })}</td>
    </tr>
  );

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // PDF Export Handler — true A4 pages with a drawn border on every page
  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const pages = reportRef.current?.querySelectorAll('.mpr-print-page');
      if (!pages || pages.length === 0) return;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth(); // 210
      const pageH = pdf.internal.pageSize.getHeight(); // 297

      // Outer margin to page edge, then border, then small gap to content
      const edgeMargin = 8;
      const borderGap = 2;
      const contentX = edgeMargin + borderGap;
      const contentY = edgeMargin + borderGap;
      const contentW = pageW - 2 * contentX;
      const contentH = pageH - 2 * contentY;

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];

        // Capture at the element's natural A4 width (avoid windowWidth stretch).
        // Hide CSS border/shadow so we draw a clean A4 border in the PDF.
        const prevShadow = pageEl.style.boxShadow;
        const prevBorder = pageEl.style.border;
        const prevTransform = pageEl.style.transform;
        pageEl.style.boxShadow = 'none';
        pageEl.style.border = 'none';
        pageEl.style.transform = 'none';

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: pageEl.offsetWidth,
          height: pageEl.offsetHeight,
          windowWidth: pageEl.offsetWidth,
          windowHeight: pageEl.offsetHeight,
        });

        pageEl.style.boxShadow = prevShadow;
        pageEl.style.border = prevBorder;
        pageEl.style.transform = prevTransform;

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const canvasRatio = canvas.width / canvas.height;
        const areaRatio = contentW / contentH;

        let drawW;
        let drawH;
        if (canvasRatio > areaRatio) {
          drawW = contentW;
          drawH = contentW / canvasRatio;
        } else {
          drawH = contentH;
          drawW = contentH * canvasRatio;
        }

        const x = contentX + (contentW - drawW) / 2;
        const y = contentY;

        if (i > 0) pdf.addPage('a4', 'portrait');

        // White page background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, pageH, 'F');

        pdf.addImage(imgData, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');

        // Draw A4 page border (always visible — not reliant on CSS capture)
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.6);
        pdf.rect(edgeMargin, edgeMargin, pageW - 2 * edgeMargin, pageH - 2 * edgeMargin);
      }

      pdf.save(`MPR_Report_${projectCode}_${monthConsidered.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error generating MPR PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const renderFooter = (pageNo, totalPages = 19) => (
    <div className="mpr-doc-footer no-print-break">
      <div className="mpr-footer-row">
        <div className="mpr-footer-left">
          <table className="mpr-footer-table">
            <tbody>
              <tr>
                <td className="mpr-footer-cell-label">Doc. No.: {docNo}</td>
                <td className="mpr-footer-cell-label">Rev. No.: {revNo}</td>
              </tr>
              <tr>
                <td className="mpr-footer-cell-label">Title : {docTitle}</td>
                <td className="mpr-footer-cell-label">Date: {docDate}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mpr-footer-center">
          {pageNo != null ? `Page ${pageNo} of ${totalPages}` : ''}
        </div>

        <div className="mpr-footer-right">
          <div className="mpr-footer-managed-by">Project Managed By</div>
          <img
            src={footerLogoSrc}
            alt={companyName}
            className="mpr-planedge-logo-img"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm overflow-y-auto flex flex-col items-center py-6 px-4">
      {/* Top Floating Control Bar */}
      <div className="no-print sticky top-2 z-50 bg-white dark:bg-slate-800 border rounded-xl shadow-xl px-6 py-3 mb-6 flex items-center justify-between w-full max-w-5xl">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Monthly Progress Report (MPR) Print Preview</h3>
            <p className="text-xs text-slate-500">{projectName} ({projectCode}) &bull; {monthConsidered}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Report Pages Printable Wrapper */}
      <div ref={reportRef} className="mpr-print-container">
        
        {/* ==================== PAGE 1: COVER PAGE ==================== */}
        <div className="mpr-print-page mpr-cover-page">
          <div className="text-center pt-1 pb-2 shrink-0">
            <h1 className="text-xl font-bold uppercase tracking-wide border-b-2 border-slate-900 inline-block pb-1">
              MONTHLY PROGRESS REPORT
            </h1>
          </div>

          <div className="space-y-1.5 text-xs font-semibold px-2 mb-2 shrink-0">
            <div className="grid grid-cols-[140px_1fr] items-center">
              <span>Project Name</span>
              <span>: &nbsp; <strong className="text-sm text-slate-900">{projectName}</strong></span>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center">
              <span>Project Code</span>
              <span>: &nbsp; {projectCode}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center">
              <span>Month Considered</span>
              <span>: &nbsp; {monthConsidered}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center">
              <span>Monthly report no</span>
              <span>: &nbsp; {reportNo}</span>
            </div>
          </div>

          <div className="mpr-project-name-box shrink-0">
            {projectName}
          </div>

          <div className="mpr-elevation-box">
            {elevationPhotoUrl ? (
              <img
                src={elevationPhotoUrl}
                alt="Project Elevation Photograph"
                className="mpr-elevation-image"
              />
            ) : (
              <div className="mpr-elevation-placeholder">
                No Project Elevation Image Available
              </div>
            )}
          </div>

          <div className="mpr-cover-bottom shrink-0">
            <div className="grid grid-cols-2 gap-4 text-xs font-bold py-2 px-2">
              <div>LOCATION : &nbsp; {location}</div>
              <div className="text-right">STATUS DATE : &nbsp; {statusDate}</div>
            </div>

            <div className="mb-2">
              <table className="mpr-report-table text-center text-xs">
                <thead>
                  <tr>
                    <th className="w-1/3">Prepared By</th>
                    <th className="w-1/3">Checked By</th>
                    <th className="w-1/3">Endorsed By</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3">
                      <div className="font-bold">{preparedBy.name}</div>
                      <div className="text-[10px] text-slate-600">{preparedBy.title}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-bold">{checkedBy.name}</div>
                      <div className="text-[10px] text-slate-600">{checkedBy.title}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-bold">{endorsedBy.name}</div>
                      <div className="text-[10px] text-slate-600">{endorsedBy.title}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {renderFooter(1)}
        </div>

        {/* ==================== PAGE 2: MPR INDEX ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue text-center py-2 text-sm font-bold uppercase">
            MPR INDEX
          </div>

          <table className="mpr-report-table">
            <thead>
              <tr>
                <th className="w-16">Sr.No.</th>
                <th>Description</th>
                <th className="w-24">Page No.</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: 1, desc: `Executive Summary for Month - ${monthConsideredShort}`, page: '3' },
                { id: 2, desc: `Project Schedule Summary and Delay Report for Month - ${monthConsideredShort}`, page: '4' },
                { id: 3, desc: `Material Consumption Plan, VOWD and Labor Details for Month - ${monthConsideredShort}`, page: '5' },
                { id: 4, desc: `Plan V/s Achievement for Month - ${monthConsideredShort}`, page: hasPlanVsAchievementContinued ? '5 - 6' : '5' },
                { id: 5, desc: `Work Completion Status for Month - ${monthConsideredShort}`, page: '—' },
                { id: 6, desc: `Contractor Bills for Month - ${monthConsideredShort}`, page: '—' },
                { id: 7, desc: `Material Requisition Details for Month - ${monthConsideredShort}`, page: '—' },
                { id: 8, desc: `Cumulative Material Reconciliation Report for Month - ${monthConsideredShort}`, page: '—' },
                { id: 9, desc: `Work Orders issued in Month - ${monthConsideredShort}`, page: '—' },
                { id: 10, desc: `List of Drawings received in Month - ${monthConsideredShort}`, page: '—' },
                { id: 11, desc: `Challenges encountered in Month - ${monthConsideredShort}`, page: '—' },
                { id: 12, desc: `Key activities status for Month - ${monthConsideredShort}`, page: '—' },
                { id: 13, desc: `Forecast for Month - ${nextMonthLabelShort}`, page: '—' },
                { id: 14, desc: `List of Drawings Required for Month - ${nextMonthLabelShort}`, page: '—' },
                { id: 15, desc: `Challenges anticipated in Month - ${nextMonthLabelShort}`, page: '—' },
                { id: 16, desc: 'Project Information', page: '—' },
                { id: 17, desc: 'Project Directory', page: '—' },
              ].map((item) => (
                <tr key={item.id}>
                  <td className="text-center font-semibold">{item.id}</td>
                  <td className="px-3 font-medium">{item.desc}</td>
                  <td className="text-center font-semibold">{item.page}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {renderFooter(2)}
        </div>

        {/* ==================== PAGE 3: EXECUTIVE SUMMARY ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            1. Executive Summary for Month - {monthConsideredShort}
          </div>

          <div className="space-y-3 px-2 text-xs leading-relaxed">
            {execPoints.map((point, index) => (
              <div key={index} className="flex gap-3">
                <span className="font-bold min-w-[20px] text-slate-700">{index + 1}.</span>
                <span className="text-slate-900">{point}</span>
              </div>
            ))}
          </div>

          {renderFooter(3)}
        </div>

        {/* ==================== PAGE 4: SCHEDULE & DELAY SUMMARY ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            2. Project Schedule Summary for Month - {monthConsideredShort}
          </div>

          <div className="space-y-2 text-xs border p-3 bg-slate-50 rounded-sm mb-4">
            <div className="flex justify-between border-b pb-1">
              <span className="font-bold">Estimated duration of project -</span>
              <span>{form.projectDuration?.estimatedDuration || '1,204'} days</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="font-bold">1. Baseline Start Date -</span>
              <span>{form.projectDuration?.baselineStartDate || formatDateIndian(projectData.start_date) || '08/01/2024'}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="font-bold">2. Baseline Completion Date -</span>
              <span>{form.projectDuration?.baselineCompletionDate || formatDateIndian(projectData.end_date) || '30/04/2026'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">3. Planned Duration -</span>
              <span>{form.projectDuration?.plannedDuration || '1,265'} days</span>
            </div>
          </div>

          <table className="mpr-report-table text-xs text-center mb-6">
            <thead>
              <tr>
                <th>Month Considered</th>
                <th>Revised Completion Date</th>
                <th>Tracked Completion Date</th>
                <th>Delay duration</th>
                <th>Balance Duration</th>
              </tr>
            </thead>
            <tbody>
              {(form.scheduleSummaryRows || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="font-bold">{row.monthConsidered || monthConsidered}</td>
                  <td>{row.revisedCompletionDate || '12/06/2026'}</td>
                  <td>{row.trackedCompletionDate || '22/01/2028'}</td>
                  <td className="text-red-600 font-semibold">{row.delayDuration || '589'}</td>
                  <td className="font-semibold">{row.balanceDuration || '-539'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mpr-sub-header-blue py-1.5 px-3 text-xs font-bold">
            Delay Summary Report for Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-xs">
            <thead>
              <tr>
                <th>Activity</th>
                <th className="w-16">% Complete</th>
                <th>Finish Date Baseline</th>
                <th>Finish Date Tracked</th>
                <th className="w-16">Delay Duration</th>
                <th>Accountability & Remarks</th>
                <th>Corrective Actions</th>
              </tr>
            </thead>
            <tbody>
              {(form.delayRows || []).length > 0 ? (
                form.delayRows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td className="font-medium">{row.activity || '—'}</td>
                    <td className="text-center">{row.percentComplete ?? '0.0'}</td>
                    <td className="text-center">{row.baselineDate || '—'}</td>
                    <td className="text-center">{row.trackedDate || '—'}</td>
                    <td className="text-center font-bold text-red-600">{row.delayDuration || '—'}</td>
                    <td>{row.accountabilityRemarks || '—'}</td>
                    <td>{row.correctiveActions || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center text-slate-400 py-3">No delays reported for this period.</td>
                </tr>
              )}
            </tbody>
          </table>

          {renderFooter(4)}
        </div>

        {/* ==================== PAGE 5: MATERIAL CONSUMPTION & PLAN VS ACHIEVEMENT ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            3. Material Consumption VOWD and Labor Details for Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-xs mb-6">
            <thead>
              <tr>
                <th className="w-12">Sr No.</th>
                <th>Description</th>
                <th className="w-24">Target</th>
                <th className="w-24">Achieved</th>
                <th className="w-24">Balance</th>
                <th className="w-32">Next Month Target</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: 1, desc: 'Value Of Work Done(VOWD)', key: 'vowd' },
                { id: 2, desc: 'Cement(Bags)', key: 'cement' },
                { id: 3, desc: 'Steel(MT)', key: 'steel' },
                { id: 4, desc: 'Mandays(Nos)', key: 'mandays' },
                { id: 5, desc: 'Average Man Power', key: 'avgManpower' },
              ].map((item) => {
                const val = form.materialConsumption?.[item.key] || {};
                // Labour count (Average Man Power) is always a whole number, never decimal.
                const round = item.key === 'avgManpower' ? Math.round : (n) => n;
                const target = round(parseFloat(val.target) || 0);
                const achieved = round(parseFloat(val.achieved) || 0);
                const balance = target - achieved;
                const nextTarget = round(parseFloat(val.nextMonthTarget) || 0);

                return (
                  <tr key={item.id}>
                    <td className="text-center font-semibold">{item.id}</td>
                    <td className="font-semibold">{item.desc}</td>
                    <td className="text-right font-mono">{formatNumberIndian(target)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(achieved)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(balance)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(nextTarget)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            4. Plan V/s Achievement for Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-xs">
            <thead>
              <tr>
                <th className="w-10">Sr No.</th>
                <th>Activity Description</th>
                <th className="w-14">Unit</th>
                <th className="w-16">Rate</th>
                <th className="w-20">Planned Qty</th>
                <th className="w-24">Planned Amount</th>
                <th className="w-20">Achieved Qty</th>
                <th className="w-24">Achieved Amount</th>
              </tr>
            </thead>
            <tbody>
              {planVsAchievementRows.slice(0, PLAN_VS_ACHIEVEMENT_PAGE_SIZE).map((row, idx) => {
                const { rate, pQty, pAmt, aQty, aAmt } = planVsAchievementRowAmounts(row);

                return (
                  <tr key={row.id || idx}>
                    <td className="text-center font-semibold">{idx + 1}</td>
                    <td className="font-medium">{row.activity || row.activityDescription || '—'}</td>
                    <td className="text-center">{row.unit || '—'}</td>
                    <td className="text-right font-mono">{formatNumberIndian(rate, 2)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(pQty, 2)}</td>
                    <td className="text-right font-mono">{formatCurrencyINR(pAmt, { decimals: 2 })}</td>
                    <td className="text-right font-mono">{formatNumberIndian(aQty, 2)}</td>
                    <td className="text-right font-mono">{formatCurrencyINR(aAmt, { decimals: 2 })}</td>
                  </tr>
                );
              })}
              {!hasPlanVsAchievementContinued && renderPlanVsAchievementTotalRow()}
            </tbody>
          </table>

          {renderFooter(5)}
        </div>

        {/* ==================== PAGE 6-7: PLAN VS ACHIEVEMENT CONTINUED (only when needed) ==================== */}
        {hasPlanVsAchievementContinued && (
          <div className="mpr-print-page">
            <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
              4. Plan V/s Achievement for Month - {monthConsideredShort} (Continued)
            </div>

            <table className="mpr-report-table text-xs">
              <thead>
                <tr>
                  <th className="w-10">Sr No.</th>
                  <th>Activity Description</th>
                  <th className="w-14">Unit</th>
                  <th className="w-16">Rate</th>
                  <th className="w-20">Planned Qty</th>
                  <th className="w-24">Planned Amount</th>
                  <th className="w-20">Achieved Qty</th>
                  <th className="w-24">Achieved Amount</th>
                </tr>
              </thead>
              <tbody>
                {planVsAchievementRows.slice(PLAN_VS_ACHIEVEMENT_PAGE_SIZE, 35).map((row, idx) => {
                  const { rate, pQty, pAmt, aQty, aAmt } = planVsAchievementRowAmounts(row);

                  return (
                    <tr key={row.id || idx}>
                      <td className="text-center font-semibold">{idx + PLAN_VS_ACHIEVEMENT_PAGE_SIZE + 1}</td>
                      <td className="font-medium">{row.activity || row.activityDescription || '—'}</td>
                      <td className="text-center">{row.unit || '—'}</td>
                      <td className="text-right font-mono">{formatNumberIndian(rate, 2)}</td>
                      <td className="text-right font-mono">{formatNumberIndian(pQty, 2)}</td>
                      <td className="text-right font-mono">{formatCurrencyINR(pAmt, { decimals: 2 })}</td>
                      <td className="text-right font-mono">{formatNumberIndian(aQty, 2)}</td>
                      <td className="text-right font-mono">{formatCurrencyINR(aAmt, { decimals: 2 })}</td>
                    </tr>
                  );
                })}
                {renderPlanVsAchievementTotalRow()}
              </tbody>
            </table>

            {renderFooter(6)}
          </div>
        )}

        {/* ==================== WORK COMPLETION STATUS (max 3 subprojects / page) ==================== */}
        {workCompletionChunks.map((chunk, chunkIdx) => {
          const displaySubs = chunk || [];
          const continued = chunkIdx > 0 ? ' (Continued)' : '';
          const subColSpan = displaySubs.length * 2;
          return (
            <div className="mpr-print-page mpr-wcs-page" key={`wcs-building-${chunkIdx}`}>
              <div className="mpr-header-blue py-1.5 px-3 text-xs font-bold text-center uppercase shrink-0">
                5. Work Completion Status for Month - {monthConsideredShort}{continued}
              </div>

              <div className="mpr-wcs-table-wrap">
                <table className="mpr-report-table text-[8px] mpr-wcs-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="w-10">SR NO</th>
                      <th rowSpan={2}>ACTIVITY</th>
                      <th rowSpan={2} className="w-12">Unit</th>
                      {displaySubs.map((sp) => (
                        <th key={sp.key} colSpan={2} className="uppercase">
                          {sp.name}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {displaySubs.map((sp) => (
                        <React.Fragment key={`${sp.key}-h`}>
                          <th>Total Flats</th>
                          <th>Completed Flats</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {WORK_COMPLETION_BUILDING_ROWS.map((row) => {
                      if (row.rowType === 'section') {
                        return (
                          <tr key={row.id} className="mpr-wcs-section">
                            <td colSpan={3 + subColSpan} className="font-bold text-left">
                              {row.activity}
                            </td>
                          </tr>
                        );
                      }
                      if (row.rowType === 'group') {
                        return (
                          <tr key={row.id} className="mpr-wcs-group">
                            <td className="text-center font-bold">{row.srNo}</td>
                            <td className="font-bold text-left" colSpan={2 + subColSpan}>
                              {row.activity}
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={row.id}>
                          <td className="text-center font-semibold">{row.srNo}</td>
                          <td className="text-left">{row.activity}</td>
                          <td className="text-center">{row.unit}</td>
                          {displaySubs.map((sp) => {
                            const cell = getWorkCompletionCell(workCompletionData, row.id, sp.key);
                            return (
                              <React.Fragment key={`${row.id}-${sp.key}`}>
                                <td className="text-center font-mono">
                                  {cell.totalFlats === '' || cell.totalFlats == null ? '—' : cell.totalFlats}
                                </td>
                                <td className="text-center font-mono">
                                  {cell.completedFlats === '' || cell.completedFlats == null ? '—' : cell.completedFlats}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {renderFooter(null)}
            </div>
          );
        })}

        {/* ==================== CONTRACTOR BILLS & REQUISITIONS ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            6. Contractor Bills for Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-xs mb-6">
            <thead>
              <tr>
                <th className="w-10">Sr No.</th>
                <th className="w-24">Date</th>
                <th>Work</th>
                <th className="w-24">RA Bill No</th>
                <th>Name of Agency</th>
                <th className="w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(form.contractorBills || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="text-center">{row.date || '—'}</td>
                  <td>{row.work || '—'}</td>
                  <td className="text-center font-semibold">{row.raBillNo || '—'}</td>
                  <td>{row.agencyName || row.nameOfAgency || '—'}</td>
                  <td className="text-right font-mono font-semibold">{formatCurrencyINR(row.amount || 0)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td colSpan="5" className="text-right px-3 py-1.5">Total Amount</td>
                <td className="text-right font-mono py-1.5">
                  {formatCurrencyINR((form.contractorBills || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            7. Material Requisition Details for Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-xs">
            <thead>
              <tr>
                <th className="w-10">Sr No.</th>
                <th className="w-24">Date</th>
                <th className="w-24">Requisition No</th>
                <th>Particulars</th>
                <th className="w-14">Unit</th>
                <th className="w-16">Qty</th>
                <th className="w-24">Received Date</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(form.materialRequisitions || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="text-center">{row.date || '—'}</td>
                  <td className="text-center font-semibold">{row.requisitionNo || '—'}</td>
                  <td className="font-medium">{row.particulars || '—'}</td>
                  <td className="text-center">{row.unit || '—'}</td>
                  <td className="text-right font-mono">{row.qty || '0'}</td>
                  <td className="text-center">{row.receivedDate || '—'}</td>
                  <td>{row.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {renderFooter(8)}
        </div>

        {/* ==================== PAGE 9-10: MATERIAL RECONCILIATION & CHALLENGES ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-1.5 px-3 text-xs font-bold">
            8. Cumulative Material Reconciliation Report for Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table mpr-recon-table">
            <thead>
              <tr>
                <th>Sr No.</th>
                <th>Material Description</th>
                <th>Unit</th>
                <th>Theoretical Cons.</th>
                <th>Actual Cons.</th>
                <th>Difference</th>
                <th>Physi Stock Reg.</th>
                <th>Physi Stock Broad</th>
                <th>Difference</th>
                <th>Cumm Received</th>
                <th>Cert. Cum Cons.</th>
                <th>Difference</th>
                <th>Error to Audit</th>
                <th>Remark</th>
              </tr>
              <tr className="mpr-recon-code-row">
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>D</th>
                <th>E</th>
                <th>F=D-E</th>
                <th>G</th>
                <th>H</th>
                <th>I=G-H</th>
                <th>J</th>
                <th>K</th>
                <th>L=J-K</th>
                <th>M=L-G</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reconciliationRows.map((row, idx) => {
                if (row.rowType === 'section') {
                  return (
                    <tr key={row.id || `sec-${idx}`} className="mpr-recon-section">
                      <td colSpan={14}>{row.materialDescription}</td>
                    </tr>
                  );
                }

                const isTotal = row.rowType === 'total';
                const diffs = calcReconciliationDiffs(row);
                const n = (v) => parseFloat(v) || 0;

                return (
                  <tr key={row.id || idx} className={isTotal ? 'mpr-recon-total' : ''}>
                    <td className="text-center">{isTotal ? '—' : (row.srNo || idx + 1)}</td>
                    <td>{row.materialDescription || '—'}</td>
                    <td className="text-center">{row.unit || '—'}</td>
                    <td className="text-right font-mono">{formatNumberIndian(n(row.theoreticalConsumption))}</td>
                    <td className="text-right font-mono">{formatNumberIndian(n(row.actualConsumption))}</td>
                    <td className="text-right font-mono">{formatNumberIndian(diffs.diffDE)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(n(row.physicalStockRegister))}</td>
                    <td className="text-right font-mono">{formatNumberIndian(n(row.physicalStockVerification))}</td>
                    <td className="text-right font-mono">{formatNumberIndian(diffs.diffGH)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(n(row.cummReceived))}</td>
                    <td className="text-right font-mono">{formatNumberIndian(n(row.certifiedCummConsumption))}</td>
                    <td className="text-right font-mono">{formatNumberIndian(diffs.diffJK)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(diffs.errorAudited)}</td>
                    <td>{isTotal ? '—' : (row.remark || '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {renderFooter(9)}
        </div>

        {/* ==================== PAGE 10: WORK ORDERS, DRAWINGS RECEIVED & CHALLENGES ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            9. Work Orders Issued in Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-[9px] mb-5">
            <thead>
              <tr>
                <th className="w-8">Sr No.</th>
                <th>Item</th>
                <th>Issued To</th>
                <th>Scope Of Work</th>
                <th>Rate</th>
                <th>Contract Amount</th>
                <th>Issue Date</th>
                <th>Start date</th>
                <th>Completion Date</th>
                <th>WO Status</th>
              </tr>
            </thead>
            <tbody>
              {((form.workOrders || []).length > 0 ? form.workOrders : [{}]).map((row, idx) => {
                const statusLabel =
                  row.woStatus === 'signed'
                    ? 'Signed'
                    : row.woStatus === 'not_signed'
                      ? 'Not Signed'
                      : (row.woStatus || '—');
                return (
                  <tr key={row.id || idx}>
                    <td className="text-center font-semibold">{idx + 1}</td>
                    <td className="font-medium">{row.item || '—'}</td>
                    <td>{row.issuedTo || '—'}</td>
                    <td>{row.scopeOfWork || '—'}</td>
                    <td className="text-right font-mono">{formatNumberIndian(parseFloat(row.rate) || 0)}</td>
                    <td className="text-right font-mono">{formatCurrencyINR(parseFloat(row.contractAmount) || 0)}</td>
                    <td className="text-center">{row.issueDate || '—'}</td>
                    <td className="text-center">{row.startDate || '—'}</td>
                    <td className="text-center">{row.completionDate || '—'}</td>
                    <td className="text-center">{statusLabel}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={4} className="text-left px-2">Total</td>
                <td className="text-right font-mono">—</td>
                <td className="text-right font-mono">
                  {formatCurrencyINR(
                    (form.workOrders || []).reduce((s, r) => s + (parseFloat(r.contractAmount) || 0), 0)
                  )}
                </td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
              </tr>
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            10. List of Drawings Received in Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-[9px] mb-5">
            <thead>
              <tr>
                <th className="w-8">Sr No.</th>
                <th>Drawing type</th>
                <th>Drawing Name</th>
                <th>Drawing No</th>
                <th>Building Name</th>
                <th>Rev No.</th>
                <th>No. of copies</th>
                <th>Received date</th>
              </tr>
            </thead>
            <tbody>
              {((form.drawingsReceived || []).length > 0 ? form.drawingsReceived : [{}]).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="font-medium">{row.drawingType || '—'}</td>
                  <td>{row.drawingName || '—'}</td>
                  <td>{row.drawingNo || '—'}</td>
                  <td>{row.buildingName || '—'}</td>
                  <td className="text-center">{row.revNo || '—'}</td>
                  <td className="text-right font-mono">{row.noOfCopies === '' || row.noOfCopies == null ? '—' : formatNumberIndian(row.noOfCopies)}</td>
                  <td className="text-center">{row.receivedDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            11. Challenges Encountered in Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-xs">
            <thead>
              <tr>
                <th className="w-12">Sr No.</th>
                <th>Challenges encountered in this month</th>
                <th>Corrective Actions Taken</th>
              </tr>
            </thead>
            <tbody>
              {((form.challengesEncountered || []).length > 0 ? form.challengesEncountered : [{}]).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="font-medium">{row.challenge || '—'}</td>
                  <td>{row.correctiveAction || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {renderFooter(10)}
        </div>

        {/* ==================== PAGE 11: KEY ACTIVITIES & FORECAST FOR NEXT MONTH ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            12. Key Activities Status for Month - {monthConsideredShort}
          </div>

          <table className="mpr-report-table text-xs mb-6">
            <thead>
              <tr>
                <th className="w-40">Details</th>
                <th>Current month (Plan)</th>
                <th>Current month (Status)</th>
                <th className="bg-sky-50">Upcoming month (Forecast)</th>
              </tr>
            </thead>
            <tbody>
              {['start', 'finish'].map((catKey) => {
                const label =
                  catKey === 'start' ? 'Key activities to Start' : 'Key Activities to Finish';
                const groupRows = keyActivityRows.filter((r) => r.category === catKey);
                const rows =
                  groupRows.length > 0
                    ? groupRows
                    : [{ currentMonthPlan: '', currentMonthStatus: '', upcomingMonthForecast: '' }];
                return rows.map((row, idx) => (
                  <tr key={`${catKey}-${row.id || idx}`}>
                    {idx === 0 ? (
                      <td rowSpan={rows.length} className="font-bold text-center align-middle bg-slate-50">
                        {label}
                      </td>
                    ) : null}
                    <td>
                      {idx + 1}. {row.currentMonthPlan || '—'}
                    </td>
                    <td className="font-medium">{row.currentMonthStatus || '—'}</td>
                    <td className="bg-sky-50/40">
                      {idx + 1}. {row.upcomingMonthForecast || '—'}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            13. Forecast for Month - {nextMonthLabelShort}
          </div>

          <table className="mpr-report-table text-[9px]">
            <thead>
              <tr>
                <th className="w-8">Sr No.</th>
                <th>Description</th>
                <th className="w-10">Unit</th>
                <th>W1</th>
                <th>W2</th>
                <th>W3</th>
                <th>W4</th>
                <th>Total Planned Qty</th>
                <th>Rate</th>
                <th>Total Amount</th>
                <th>Drawing Status</th>
                <th>Cement Bags</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const forecastRows = form.forecast || [];
                let amountTotal = 0;
                const body = forecastRows.map((row, idx) => {
                  const w1 = parseFloat(row.week1) || 0;
                  const w2 = parseFloat(row.week2) || 0;
                  const w3 = parseFloat(row.week3) || 0;
                  const w4 = parseFloat(row.week4) || 0;
                  const totQty = w1 + w2 + w3 + w4;
                  const rate = parseFloat(row.rate) || 0;
                  const totAmt = totQty * rate;
                  amountTotal += totAmt;
                  const cement =
                    row.cementBags === '' || row.cementBags == null
                      ? '—'
                      : formatNumberIndian(row.cementBags);

                  return (
                    <tr key={row.id || idx}>
                      <td className="text-center font-semibold">{idx + 1}</td>
                      <td className="font-medium">{row.description || '—'}</td>
                      <td className="text-center">{row.unit || '—'}</td>
                      <td className="text-right font-mono">{w1}</td>
                      <td className="text-right font-mono">{w2}</td>
                      <td className="text-right font-mono">{w3}</td>
                      <td className="text-right font-mono">{w4}</td>
                      <td className="text-right font-mono font-semibold">{totQty}</td>
                      <td className="text-right font-mono">{formatNumberIndian(rate)}</td>
                      <td className="text-right font-mono font-semibold">{formatCurrencyINR(totAmt)}</td>
                      <td className="text-center">{row.drawingStatus?.trim() ? row.drawingStatus : '—'}</td>
                      <td className="text-right font-mono">{cement}</td>
                    </tr>
                  );
                });

                return (
                  <>
                    {body}
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={9} className="text-left px-2">Total</td>
                      <td className="text-right font-mono">{formatCurrencyINR(amountTotal)}</td>
                      <td className="text-center">—</td>
                      <td className="text-right">—</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>

          {renderFooter(11)}
        </div>

        {/* ==================== PAGE 16: DRAWINGS REQUIRED & CHALLENGES ANTICIPATED ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            14. List of Drawings Required for Month - {nextMonthLabelShort}
          </div>

          <table className="mpr-report-table text-xs mb-6">
            <thead>
              <tr>
                <th className="w-12">Sr No.</th>
                <th>Drawing Type</th>
                <th>Building Name</th>
                <th>Drawing Name</th>
                <th className="w-24">Required date</th>
                <th>Required From</th>
              </tr>
            </thead>
            <tbody>
              {(form.drawingsRequired || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="font-semibold">{row.drawingType || '—'}</td>
                  <td>{row.buildingName || '—'}</td>
                  <td>{row.drawingName || '—'}</td>
                  <td className="text-center">{row.requiredDate || '—'}</td>
                  <td>{row.requiredFrom || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            15. Challenges Anticipated in Month - {nextMonthLabelShort}
          </div>

          <table className="mpr-report-table text-xs">
            <thead>
              <tr>
                <th className="w-12">Sr No.</th>
                <th>Challenges anticipated in the next</th>
                <th>Actions to be taken</th>
              </tr>
            </thead>
            <tbody>
              {(form.challengesAnticipated || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="font-medium">{row.challenge || '—'}</td>
                  <td>{row.actionToBeTaken || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {renderFooter(16)}
        </div>

        {/* ==================== PAGE 17: PROJECT INFORMATION ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            16. Project Information
          </div>

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold">
            Project Location and Details
          </div>
          <table className="mpr-report-table text-xs">
            <tbody>
              <tr>
                <td className="w-12 text-center font-semibold">1</td>
                <td className="w-48 font-bold">Type of project</td>
                <td>{getProjectTypeLabel(projectData.project_type) || '—'}</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">2</td>
                <td className="font-bold">Location of Project</td>
                <td>{projectData.location || location || '—'}</td>
              </tr>
            </tbody>
          </table>

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold">
            Area Details
          </div>
          <table className="mpr-report-table text-xs">
            <tbody>
              <tr>
                <td className="w-8 text-center font-semibold">1</td>
                <td className="w-40 font-semibold">Plot Area</td>
                <td className="w-28 font-mono">{formatNumberIndian(projectData.plot_area || 0)}</td>
                <td className="w-8 text-center font-semibold">6</td>
                <td className="w-40 font-semibold">T. D. R, if any</td>
                <td className="w-28 font-mono">{formatNumberIndian(projectData.tdr || 0)}</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">2</td>
                <td className="font-semibold">Reservation Area</td>
                <td className="font-mono">{formatNumberIndian(projectData.reservation_area || 0)}</td>
                <td className="text-center font-semibold">7</td>
                <td className="font-semibold">RCC Slab Area</td>
                <td className="font-mono">{formatNumberIndian(projectData.rcc_slab_area || 0)} Sqft</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">3</td>
                <td className="font-semibold">Amenities Area</td>
                <td className="font-mono">{formatNumberIndian(projectData.amenities_area || 0)}</td>
                <td className="text-center font-semibold">8</td>
                <td className="font-semibold">Built up area</td>
                <td className="font-mono">{formatNumberIndian(projectData.built_up_area || 0)} Sqft</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">4</td>
                <td className="font-semibold">Open Space Area</td>
                <td className="font-mono">{formatNumberIndian(projectData.open_space_area || 0)}</td>
                <td className="text-center font-semibold">9</td>
                <td className="font-semibold">Saleable area</td>
                <td className="font-mono">{formatNumberIndian(projectData.saleable_area || 0)} Sqft</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">5</td>
                <td className="font-semibold">Sanctioned F. S. I.</td>
                <td className="font-mono">{formatNumberIndian(projectData.sanctioned_fsi || 0)}</td>
                <td colSpan="3"></td>
              </tr>
            </tbody>
          </table>

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold">
            Other Details
          </div>
          <table className="mpr-report-table text-xs">
            <tbody>
              <tr>
                <td className="w-12 text-center font-semibold">1</td>
                <td className="w-72 font-bold">N. A. Order No.</td>
                <td>{projectData.na_order_no || '—'}</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">2</td>
                <td className="font-bold">Sanction of building permit and Commencement Certificate No.</td>
                <td>{projectData.building_permit_cc_no || '—'}</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">3</td>
                <td className="font-bold">Fire and Emergency Service Department</td>
                <td>{projectData.fire_emergency_dept || '—'}</td>
              </tr>
            </tbody>
          </table>

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold">
            Building Configuration
          </div>
          <table className="mpr-report-table text-xs">
            <thead>
              <tr>
                <th className="w-10">Sr No.</th>
                <th>Building</th>
                <th>Building Details</th>
                <th className="w-16">No of Floor</th>
                <th>No of Units Resi.</th>
                <th>No of Unit Comm.</th>
                <th>Approx. Area Resi.</th>
                <th>Approx. Area Comm.</th>
              </tr>
            </thead>
            <tbody>
              {(projectBuildingConfigs.length > 0 ? projectBuildingConfigs : form.projectConfiguration || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="font-bold">{row.building || '—'}</td>
                  <td>{row.buildingDetails || row.building_details || '—'}</td>
                  <td className="text-center">{row.noOfFloor || row.no_of_floor || '—'}</td>
                  <td className="text-center">{row.noOfUnitsResidential || row.no_of_units_residential || '0'}</td>
                  <td className="text-center">{row.noOfUnitsCommercial || row.no_of_units_commercial || '0'}</td>
                  <td className="text-right font-mono">{formatNumberIndian(row.areaPerUnitResidential || row.approx_area_resi || 0)}</td>
                  <td className="text-right font-mono">{formatNumberIndian(row.areaPerUnitCommercial || row.approx_area_comm || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {renderFooter(17)}
        </div>

        {/* ==================== PROJECT DIRECTORY ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold">
            17. Project Directory
          </div>

          {renderFooter(18)}
        </div>

      </div>
    </div>
  );
}
