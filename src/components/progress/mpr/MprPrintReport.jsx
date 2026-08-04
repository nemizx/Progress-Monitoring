import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, Loader2, FileText } from 'lucide-react';
import { formatCurrencyINR, formatNumberIndian, formatDateIndian } from '@/lib/formatters';
import './mprPrintReport.css';

export default function MprPrintReport({
  open = true,
  onClose,
  form = {},
  meta = {},
  projectData = {},
  projectDirectory = [],
  planVsAchievementRows = [],
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const reportRef = useRef(null);

  if (!open) return null;

  // Metadata fallbacks
  const projectName = meta.projectName || projectData.name || 'Project';
  const projectCode = meta.projectCode || projectData.project_code || 'PL1287';
  const monthConsidered = meta.monthLabel || 'July - 2026';
  const nextMonthLabel = meta.nextMonthLabel || 'August - 2026';
  const reportNo = meta.monthlyReportNo || `${projectCode}/MPR/${meta.monthId || '01'}`;
  const location = meta.location || projectData.location || 'Dhanori';
  const statusDate = meta.statusDate || formatDateIndian(new Date());
  const elevationPhotoUrl = meta.elevationPhotoUrl || projectData.elevation_photo_url || '';

  const docNo = meta.docNo || 'PLN – 03 – F03';
  const revNo = meta.revNo || 'R2';
  const docTitle = 'Monthly Progress';
  const docDate = meta.docDate || '14-12-18';
  const companyName = meta.companyName || 'PLANEDGE';

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

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // PDF Export Handler
  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const pages = reportRef.current?.querySelectorAll('.mpr-print-page');
      if (!pages || pages.length === 0) return;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        const canvas = await html2canvas(pageEl, {
          scale: 3, // High DPI resolution (300 DPI equivalent) for crisp rendering
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1200,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) pdf.addPage('a4', 'portrait');

        // Draw image preserving exact aspect ratio without vertical squishing
        pdf.addImage(
          imgData,
          'PNG',
          0,
          0,
          imgWidth,
          Math.min(imgHeight, pdfHeight),
          undefined,
          'SLOW'
        );
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
      <table className="mpr-footer-table">
        <tbody>
          <tr>
            <td>Doc. No.: {docNo}</td>
            <td>Rev. No.: {revNo}</td>
          </tr>
          <tr>
            <td>Title : {docTitle}</td>
            <td>Date: {docDate}</td>
          </tr>
        </tbody>
      </table>
      <div className="mpr-footer-branding">
        <span>Page {pageNo} of {totalPages}</span>
        <span className="mpr-planedge-logo">
          Project Managed By <strong>{companyName}</strong>
        </span>
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
        <div className="mpr-print-page">
          <div className="text-center pt-2 pb-4">
            <h1 className="text-xl font-bold uppercase tracking-wide border-b-2 border-slate-900 inline-block pb-1">
              MONTHLY PROGRESS REPORT
            </h1>
          </div>

          <div className="space-y-2 text-xs font-semibold px-2 mb-3">
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

          <div className="mpr-header-blue text-center py-2 text-sm font-bold border rounded-t-sm">
            {projectName}
          </div>

          <div className="border border-t-0 p-2 flex items-center justify-center min-h-[320px] bg-slate-50">
            {elevationPhotoUrl ? (
              <img src={elevationPhotoUrl} alt="Project Elevation" className="max-h-[380px] w-full object-contain rounded" />
            ) : (
              <div className="text-center py-20 text-slate-400 font-medium">
                [ Project Elevation Photograph ]
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-bold py-3 px-2">
            <div>LOCATION : &nbsp; {location}</div>
            <div>STATUS DATE : &nbsp; {statusDate}</div>
          </div>

          <div className="mt-auto mb-4">
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

          {renderFooter(1)}
        </div>

        {/* ==================== PAGE 2: MPR INDEX ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue text-center py-2 text-sm font-bold uppercase mb-4">
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
                { id: 1, desc: 'Executive Summary', page: '3' },
                { id: 2, desc: `Project Schedule Summary and Delay Report for month - ${monthConsidered}`, page: '4' },
                { id: 3, desc: 'Material Consumption Plan, VOWD and Labor Details', page: '5' },
                { id: 4, desc: `Plan V/s Achievement for month - ${monthConsidered}`, page: '5 - 8' },
                { id: 5, desc: `Contractor Bills for month - ${monthConsidered}`, page: '8' },
                { id: 6, desc: `Material Requisition Details for month - ${monthConsidered}`, page: '8 - 9' },
                { id: 7, desc: 'Cumulative Material Reconciliation Report', page: '9 - 10' },
                { id: 8, desc: `Work Orders issued in month - ${monthConsidered}`, page: '10' },
                { id: 9, desc: `List of Drawings received in month - ${monthConsidered}`, page: '10' },
                { id: 10, desc: `Challenges encountered in month - ${monthConsidered}`, page: '10' },
                { id: 11, desc: 'Key activities status', page: '11' },
                { id: 12, desc: `Forecast for Month - ${nextMonthLabel}`, page: '11 - 16' },
                { id: 13, desc: `List of Drawings Required for Month - ${nextMonthLabel}`, page: '16' },
                { id: 14, desc: `Challenges anticipated in Month - ${nextMonthLabel}`, page: '16' },
                { id: 15, desc: 'Project Information', page: '17' },
                { id: 16, desc: 'Project Directory', page: '18 - 19' },
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
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            1. Executive Summary for Month - {monthConsidered}
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
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            2. Project Schedule Summary - {monthConsidered}
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

          <div className="mpr-sub-header-blue py-1.5 px-3 text-xs font-bold mb-2">
            Delay Summary Report - {monthConsidered}
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
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            3. Material Consumption VOWD and Labor Details - {monthConsidered}
          </div>

          <table className="mpr-report-table text-xs mb-6">
            <thead>
              <tr>
                <th className="w-12">Sr No.</th>
                <th>Description</th>
                <th className="w-24">Target</th>
                <th className="w-24">Achieved</th>
                <th className="w-24">Balance</th>
                <th className="w-32">This month target</th>
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
                const target = val.target || 0;
                const achieved = val.achieved || 0;
                const balance = (parseFloat(target) || 0) - (parseFloat(achieved) || 0);
                const nextTarget = val.nextMonthTarget || 0;

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

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            4. Plan V/s Achievement for month - {monthConsidered}
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
              {planVsAchievementRows.slice(0, 13).map((row, idx) => {
                const pQty = parseFloat(row.plannedQty) || 0;
                const rate = parseFloat(row.rate) || 0;
                const pAmt = pQty * rate;
                const aQty = parseFloat(row.achievedQty) || 0;
                const aAmt = aQty * rate;

                return (
                  <tr key={row.id || idx}>
                    <td className="text-center font-semibold">{idx + 1}</td>
                    <td className="font-medium">{row.activity || row.activityDescription || '—'}</td>
                    <td className="text-center">{row.unit || '—'}</td>
                    <td className="text-right font-mono">{formatNumberIndian(rate)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(pQty)}</td>
                    <td className="text-right font-mono">{formatCurrencyINR(pAmt)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(aQty)}</td>
                    <td className="text-right font-mono">{formatCurrencyINR(aAmt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {renderFooter(5)}
        </div>

        {/* ==================== PAGE 6-7: PLAN VS ACHIEVEMENT CONTINUED ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            4. Plan V/s Achievement for month - {monthConsidered} (Continued)
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
              {planVsAchievementRows.slice(13, 35).map((row, idx) => {
                const pQty = parseFloat(row.plannedQty) || 0;
                const rate = parseFloat(row.rate) || 0;
                const pAmt = pQty * rate;
                const aQty = parseFloat(row.achievedQty) || 0;
                const aAmt = aQty * rate;

                return (
                  <tr key={row.id || idx}>
                    <td className="text-center font-semibold">{idx + 14}</td>
                    <td className="font-medium">{row.activity || row.activityDescription || '—'}</td>
                    <td className="text-center">{row.unit || '—'}</td>
                    <td className="text-right font-mono">{formatNumberIndian(rate)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(pQty)}</td>
                    <td className="text-right font-mono">{formatCurrencyINR(pAmt)}</td>
                    <td className="text-right font-mono">{formatNumberIndian(aQty)}</td>
                    <td className="text-right font-mono">{formatCurrencyINR(aAmt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {renderFooter(6)}
        </div>

        {/* ==================== PAGE 8: CONTRACTOR BILLS & REQUISITIONS ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            5. Contractor Bills for month - {monthConsidered}
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

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            6. Material Requisition Details for Month - {monthConsidered}
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
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            7. Cumulative Material Reconciliation Report For Month - {monthConsidered}
          </div>

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold mb-2">
            Steel & Cement Reconciliation Report
          </div>

          <table className="mpr-report-table text-[9px]">
            <thead>
              <tr>
                <th>Sr No.</th>
                <th>Material Description</th>
                <th>Unit</th>
                <th>Theoretical Cons.</th>
                <th>Actual Cons.</th>
                <th>Diff</th>
                <th>Physi Stock Reg.</th>
                <th>Physi Stock Verification</th>
                <th>Cum Received</th>
                <th>Cert. Cum Cons.</th>
                <th>Error to Audit</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {(form.materialReconciliation || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td className="font-medium">{row.materialDescription || '—'}</td>
                  <td className="text-center">{row.unit || '—'}</td>
                  <td className="text-right font-mono">{row.theoreticalConsumption || '0.0'}</td>
                  <td className="text-right font-mono">{row.actualConsumption || '0.0'}</td>
                  <td className="text-right font-mono">0.0</td>
                  <td className="text-right font-mono">{row.physicalStockRegister || '0.0'}</td>
                  <td className="text-right font-mono">{row.physicalStockVerification || '0.0'}</td>
                  <td className="text-right font-mono">{row.cummReceived || '0.0'}</td>
                  <td className="text-right font-mono">{row.certifiedCummConsumption || '0.0'}</td>
                  <td className="text-right font-mono">{row.errorToBeAudited || '0.0'}</td>
                  <td>{row.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold my-4">
            10. Challenges Encountered in month - {monthConsidered}
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
              {(form.challengesEncountered || []).map((row, idx) => (
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
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            11. Key Activities Status - {monthConsidered}
          </div>

          <table className="mpr-report-table text-xs mb-6">
            <thead>
              <tr>
                <th>Details</th>
                <th>Current month Plan</th>
                <th>Current month Status</th>
                <th>Upcoming month Forecast</th>
              </tr>
            </thead>
            <tbody>
              {(form.keyActivities || []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="font-semibold">{row.details || '—'}</td>
                  <td>{row.currentMonthPlan || '—'}</td>
                  <td className="font-medium">{row.currentMonthStatus || '—'}</td>
                  <td>{row.upcomingMonthForecast || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            12. Forecast for next Month - {nextMonthLabel}
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
                <th>Total Labor Required</th>
              </tr>
            </thead>
            <tbody>
              {(form.forecast || []).slice(0, 10).map((row, idx) => {
                const w1 = parseFloat(row.week1) || 0;
                const w2 = parseFloat(row.week2) || 0;
                const w3 = parseFloat(row.week3) || 0;
                const w4 = parseFloat(row.week4) || 0;
                const totQty = w1 + w2 + w3 + w4;
                const rate = parseFloat(row.rate) || 0;
                const totAmt = totQty * rate;

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
                    <td className="text-center">{row.drawingStatus || 'OK'}</td>
                    <td className="text-right font-mono">{row.totalLabourRequired || 40}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {renderFooter(11)}
        </div>

        {/* ==================== PAGE 16: DRAWINGS REQUIRED & CHALLENGES ANTICIPATED ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            13. List of Drawings required in next Month - {nextMonthLabel}
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

          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            14. Challenges Anticipated in next Month -- {nextMonthLabel}
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
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            15. Project Information
          </div>

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold mb-2">
            Project Location and Details
          </div>
          <table className="mpr-report-table text-xs mb-4">
            <tbody>
              <tr>
                <td className="w-12 text-center font-semibold">1</td>
                <td className="w-48 font-bold">Type of project</td>
                <td>{projectData.project_type || 'Residential Building'}</td>
              </tr>
              <tr>
                <td className="text-center font-semibold">2</td>
                <td className="font-bold">Location of Project</td>
                <td>{projectData.location || location}</td>
              </tr>
            </tbody>
          </table>

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold mb-2">
            Area Details
          </div>
          <table className="mpr-report-table text-xs mb-4">
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

          <div className="mpr-sub-header-blue py-1 px-3 text-xs font-bold mb-2">
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

        {/* ==================== PAGE 18-19: PROJECT DIRECTORY ==================== */}
        <div className="mpr-print-page">
          <div className="mpr-header-blue py-2 px-3 text-sm font-bold mb-4">
            16. Project Directory
          </div>

          <table className="mpr-report-table text-xs">
            <thead>
              <tr>
                <th className="w-12">Sr No.</th>
                <th>Name / Contact Person</th>
                <th>Designation / Agency</th>
                <th>Role / Scope</th>
                <th className="w-32">Contact No</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {(projectDirectory || []).length > 0 ? (
                projectDirectory.map((contact, idx) => (
                  <tr key={contact.id || idx}>
                    <td className="text-center font-semibold">{idx + 1}</td>
                    <td className="font-bold">{contact.name || '—'}</td>
                    <td>{contact.designation || contact.agency || '—'}</td>
                    <td>{contact.role || contact.scope || '—'}</td>
                    <td className="text-center font-mono">{contact.phone || contact.contactNo || '—'}</td>
                    <td>{contact.email || '—'}</td>
                  </tr>
                ))
              ) : (
                [
                  { name: 'Amit Gaikwad', agency: 'Planedge PM', role: 'Project Manager', phone: '+91 98220 00000', email: 'amit@planedge.in' },
                  { name: 'Aniket Vedpathak', agency: 'Planedge PM', role: 'Site Engineer', phone: '+91 98220 11111', email: 'aniket@planedge.in' },
                  { name: 'Kedar Mashalkar', agency: 'Planedge PM', role: 'AGM Operations', phone: '+91 98220 22222', email: 'kedar@planedge.in' },
                ].map((c, i) => (
                  <tr key={i}>
                    <td className="text-center font-semibold">{i + 1}</td>
                    <td className="font-bold">{c.name}</td>
                    <td>{c.agency}</td>
                    <td>{c.role}</td>
                    <td className="text-center font-mono">{c.phone}</td>
                    <td>{c.email}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {renderFooter(18)}
        </div>

      </div>
    </div>
  );
}
