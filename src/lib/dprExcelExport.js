import ExcelJS from 'exceljs';
import { normalizeDateKey } from '@/lib/formatters';

const COL_COUNT = 15;

const COL_WIDTHS = [8, 22, 18, 12, 12, 10, 10, 12, 12, 14, 14, 16, 18, 16, 18];

const BORDER_THIN = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const FILL_HEADER = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9E1F2' },
};

const FILL_SECTION = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFB4C6E7' },
};

const FILL_GROUP = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE9EDF4' },
};

const FILL_SUBTOTAL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};

const formatGBDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB');
};

const formatDMY = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
};

const calculateDaysElapsed = (start, end) => {
  if (!start || !end) return 0;
  const sDate = new Date(start);
  const eDate = new Date(end);
  return Math.max(0, Math.ceil((eDate - sDate) / (1000 * 60 * 60 * 24)));
};

const num = (value) => Number(value) || 0;

function padRow(cells, width) {
  const row = [...cells];
  while (row.length < width) row.push('');
  return row.slice(0, width);
}

function resolveRowWidth(cells, options) {
  if (options.width) return options.width;
  if (options.colSpan) return options.colSpan;
  let w = cells.filter((c) => c !== '').length || cells.length;
  if (options.merges) {
    options.merges.forEach(([c0, c1]) => {
      w = Math.max(w, c1);
    });
  }
  return Math.max(w, cells.length);
}

function createSheetBuilder(sheet) {
  let rowPtr = 1;

  const styleRange = (r, cStart, cEnd, style) => {
    for (let c = cStart; c <= cEnd; c++) {
      const cell = sheet.getCell(r, c);
      if (style.font) cell.font = { ...(cell.font || {}), ...style.font };
      if (style.fill) cell.fill = style.fill;
      if (style.border) cell.border = style.border;
      if (style.alignment) cell.alignment = { ...(cell.alignment || {}), ...style.alignment };
      if (style.numFmt) cell.numFmt = style.numFmt;
    }
  };

  const borderRange = (r0, c0, r1, c1) => {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        sheet.getCell(r, c).border = BORDER_THIN;
      }
    }
  };

  const mergeRow = (r, c0, c1) => {
    if (c1 <= c0) return;
    try {
      sheet.mergeCells(r, c0, r, c1);
    } catch {
      // skip overlapping merge
    }
  };

  const mergeCellBlock = (r0, c0, r1, c1) => {
    if (r1 < r0 || c1 < c0) return;
    if (r0 === r1 && c0 === c1) return;
    try {
      sheet.mergeCells(r0, c0, r1, c1);
    } catch {
      // skip overlapping merge
    }
  };

  const writeRow = (cells, options = {}) => {
    const width = resolveRowWidth(cells, options);
    const values = padRow(cells, width);
    const r = rowPtr;
    const excelRow = sheet.getRow(r);
    excelRow.height = options.height || 18;

    values.forEach((value, idx) => {
      const cell = excelRow.getCell(idx + 1);
      cell.value = value === '' ? null : value;
      cell.border = BORDER_THIN;
      cell.alignment = {
        vertical: 'middle',
        wrapText: Boolean(options.wrap),
        horizontal: options.align || 'left',
      };
    });

    styleRange(r, 1, width, {
      font: options.font || { size: 10 },
      fill: options.fill,
      alignment: { vertical: 'middle', wrapText: Boolean(options.wrap), horizontal: options.align || 'left' },
    });

    if (options.merges) {
      options.merges.forEach(([c0, c1]) => mergeRow(r, c0, c1));
    }

    rowPtr += 1;
    return r;
  };

  const spacer = (height = 6) => {
    sheet.getRow(rowPtr).height = height;
    rowPtr += 1;
  };

  const sectionTitle = (text, width = COL_COUNT) =>
    writeRow([text], {
      width,
      height: 22,
      font: { bold: true, size: 11, color: { argb: 'FF1F3864' } },
      fill: FILL_SECTION,
      align: 'left',
      merges: [[1, width]],
    });

  const groupLabel = (text, width = COL_COUNT) =>
    writeRow(['', text], {
      width,
      height: 20,
      font: { bold: true, size: 10 },
      fill: FILL_GROUP,
      merges: [[2, width]],
    });

  const tableHeader = (cells, mergeSpecs = [], width) =>
    writeRow(cells, {
      width: width ?? resolveRowWidth(cells, { merges: mergeSpecs }),
      height: 32,
      font: { bold: true, size: 9 },
      fill: FILL_HEADER,
      align: 'center',
      wrap: true,
      merges: mergeSpecs,
    });

  const dataRow = (cells, mergeSpecs = [], align = 'left', width) =>
    writeRow(cells, {
      width: width ?? resolveRowWidth(cells, { merges: mergeSpecs }),
      height: 18,
      font: { size: 10 },
      align,
      merges: mergeSpecs,
    });

  const subtotalRow = (cells, mergeSpecs = [], width) =>
    writeRow(cells, {
      width: width ?? resolveRowWidth(cells, { merges: mergeSpecs }),
      height: 20,
      font: { bold: true, size: 10 },
      fill: FILL_SUBTOTAL,
      align: 'right',
      merges: mergeSpecs,
    });

  const borderTable = (headerRow, lastRow, fromCol = 1, toCol = COL_COUNT) => {
    borderRange(headerRow, fromCol, lastRow, toCol);
  };

  return {
    sheet,
    writeRow,
    spacer,
    sectionTitle,
    groupLabel,
    tableHeader,
    dataRow,
    subtotalRow,
    borderTable,
    mergeRows: mergeCellBlock,
    get row() {
      return rowPtr;
    },
  };
}

export async function buildDprExcelWorkbook({
  selectedProject,
  selectedDprDate,
  subProjects,
  dprWorksheetData,
  technicalStaffData,
  contractorLabourData,
  materialStatusData,
  machineryDetailsData,
  daysReports,
  statusReports,
  specialSiteVisits,
  criticalIssues,
  nextDaysPlans,
  progressEntries,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Progress Monitoring';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('DPR', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  COL_WIDTHS.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const b = createSheetBuilder(sheet);

  const startDateStr = formatGBDate(selectedProject?.start_date);
  const endDateStr = formatGBDate(selectedProject?.end_date);
  const totalDurationDays =
    selectedProject?.start_date && selectedProject?.end_date
      ? calculateDaysElapsed(selectedProject.start_date, selectedProject.end_date)
      : 0;
  const todayDaysElapsed = selectedProject?.start_date
    ? calculateDaysElapsed(selectedProject.start_date, selectedDprDate)
    : 0;
  const balanceDaysDuration = totalDurationDays - todayDaysElapsed;
  const estimatedCost = num(selectedProject?.budget);
  const projectCode = selectedProject?.project_code || 'N/A';
  const projectName = selectedProject?.name || '';

  let totalTodayVowd = 0;
  let totalCumulativeVowd = 0;
  let totalTomorrowVowd = 0;
  let totalTomorrowQty = 0;
  dprWorksheetData.forEach((item) => {
    totalTodayVowd += num(item.today_vowd);
    totalCumulativeVowd += num(item.cumulative_vowd);
    totalTomorrowVowd += num(item.tomorrow_vowd);
    totalTomorrowQty += num(item.tomorrow_qty);
  });
  const balanceCost = estimatedCost - totalCumulativeVowd;

  // --- Document header ---
  b.spacer(8);
  b.writeRow(
    ['Daily Progress Report', '', '', '', '', '', '', '', '', '', '', 'Doc. No - PLN - 03 - F01', '', 'Rev. No.: R1', ''],
    {
      height: 28,
      font: { bold: true, size: 14, color: { argb: 'FF1F3864' } },
      align: 'center',
      merges: [[1, 11], [12, 13], [14, 15]],
    }
  );
  b.writeRow(
    ['', '', '', '', '', '', '', '', '', '', '', 'Title Name: Daily Progress Report', '', 'Rev. Date: 09-11-17', ''],
    { height: 18, font: { size: 10 }, merges: [[12, 13], [14, 15]] }
  );
  b.spacer(8);

  const metaStart = b.row;
  b.writeRow([`Project Name         : ${projectName}`], { font: { bold: true, size: 10 }, merges: [[1, COL_COUNT]] });
  b.writeRow(
    [`Project Code          : ${projectCode}`, '', '', '', '', '', '', '', '', '', '', 'Date                    :', ` ${selectedDprDate} 00:00:00.0`, '', ''],
    { font: { size: 10 }, merges: [[1, 5], [12, 13]] }
  );
  b.writeRow(
    [`Start Date              :  ${startDateStr}`, '', '', '', '', '', '', '', '', '', '', 'End Date            :', endDateStr, '', ''],
    { font: { size: 10 }, merges: [[1, 5], [12, 13]] }
  );
  b.writeRow(
    [`Today (Day's)       :  ${todayDaysElapsed}`, '', '', '', '', '', '', '', '', '', '', 'Total Duration  :', totalDurationDays, '', ''],
    { font: { size: 10 }, merges: [[1, 5], [12, 13]] }
  );
  b.writeRow(
    [`Balance Duration:  ${balanceDaysDuration}`, '', '', '', '', '', '', '', '', '', '', 'Estimated Cost :', estimatedCost, '', ''],
    { font: { size: 10 }, merges: [[1, 5], [12, 13]] }
  );
  b.writeRow(['', '', '', '', '', '', '', '', '', '', '', 'Balance Cost     :', balanceCost, '', ''], {
    font: { bold: true, size: 10 },
    merges: [[12, 13]],
  });
  b.borderTable(metaStart, b.row - 1, 1, COL_COUNT);
  b.spacer(10);

  // --- A. Daily Planning Details ---
  b.sectionTitle('A. Daily Planning Details');

  const assignedSubProjectIds = new Set(subProjects.map((s) => s.id));
  const sectionAGroups = [
    ...subProjects.map((sub) => ({
      label: sub.name,
      items: dprWorksheetData.filter((w) => w.sub_project_id === sub.id),
    })),
  ];
  const unassignedItems = dprWorksheetData.filter(
    (w) => !w.sub_project_id || !assignedSubProjectIds.has(w.sub_project_id)
  );
  if (unassignedItems.length > 0) {
    sectionAGroups.push({ label: 'Other / Unassigned', items: unassignedItems });
  }

  const activityHeaderCells = [
    'Sr. No', 'Activity ID', 'Activity Name', '', '', '', 'Unit', 'Total Qty', 'Today Qty',
    'Cumulative Completed Qty', '% Comp.', "Today's VOWD", 'Cumulative VOWD',
    'QTY Plan for Tomorrow', 'VOWD Plan for Tomorrow',
  ];
  const activityHeaderMerges = [[3, 6]];

  sectionAGroups.forEach(({ label, items }) => {
    if (items.length === 0) return;

    b.groupLabel(label);
    const tableStart = b.tableHeader(activityHeaderCells, activityHeaderMerges);

    let subTodayVowd = 0;
    let subCumulativeVowd = 0;
    let subTomorrowVowd = 0;
    let subTomorrowQty = 0;

    items.forEach((item, index) => {
      subTodayVowd += num(item.today_vowd);
      subCumulativeVowd += num(item.cumulative_vowd);
      subTomorrowVowd += num(item.tomorrow_vowd);
      subTomorrowQty += num(item.tomorrow_qty);

      b.dataRow(
        [
          index + 1,
          item.activity_code || '',
          item.title || '',
          '', '', '',
          item.unit || '',
          num(item.planned_qty),
          num(item.today_qty) || '',
          num(item.cumulative_qty),
          `${num(item.percent_comp).toFixed(1)}%`,
          num(item.today_vowd),
          num(item.cumulative_vowd),
          num(item.tomorrow_qty) || '',
          num(item.tomorrow_vowd) || '',
        ],
        [[3, 6]],
        'left'
      );
    });

    const subR = b.subtotalRow(
      ['', '', '', '', '', '', '', '', '', '', label, subTodayVowd, subCumulativeVowd, subTomorrowQty, subTomorrowVowd],
      [[1, 10]]
    );
    b.borderTable(tableStart, subR);
    b.spacer(6);
  });

  if (dprWorksheetData.length > 0) {
    b.subtotalRow(
      ['', '', '', '', '', '', 'Project Total', '', '', '', '', totalTodayVowd, totalCumulativeVowd, '', totalTomorrowVowd],
      [[7, 11]]
    );
  }
  b.spacer(10);

  // --- B. Technical Staff ---
  b.sectionTitle('B. TECHNICAL STAFF DETAILS', 8);
  const staffHdr = b.tableHeader(['Sr. No', 'Name Of Staff', '', '', 'Designation', '', '', 'Remark'], [[2, 4], [5, 7]]);
  if (technicalStaffData.length === 0) {
    const er = b.dataRow([1, 'No staff attendance records logged today.', '', '', '', '', '', ''], [[2, 8]]);
    b.borderTable(staffHdr, er, 1, 8);
  } else {
    technicalStaffData.forEach((staff) => {
      b.dataRow([staff.srNo, staff.name, '', '', staff.designation, '', '', staff.remarks || ''], [[2, 4], [5, 7]]);
    });
    b.borderTable(staffHdr, b.row - 1, 1, 8);
  }
  b.spacer(10);

  // --- C. Manpower ---
  b.sectionTitle('C. BUILDING WISE MANPOWER DETAILS AND ALLOCATION');
  let grandTotalLabour = 0;

  subProjects.forEach((sub) => {
    const subLabour = contractorLabourData.filter((l) => l.sub_project_id === sub.id);
    if (subLabour.length === 0) return;

    b.groupLabel(sub.name);
    const topHdr = b.tableHeader(
      ['Sr. No', 'Contractor Name', '', '', 'Unit', 'Skilled Labour', '', '', '', 'Semi Skilled Labour', '', '', 'Unskilled Labour', '', 'Total'],
      [[6, 9], [10, 12], [13, 14]]
    );
    const subHdr = b.tableHeader(
      ['', '', '', '', '', 'Carpentar', 'Barbender', 'Mason', 'Other', 'Carpenter Helper', 'Barbender Helper', 'Other', 'M/C', 'F/C', ''],
      []
    );
    b.mergeRows(topHdr, 1, subHdr, 1);
    b.mergeRows(topHdr, 2, subHdr, 4);
    b.mergeRows(topHdr, 5, subHdr, 5);
    b.mergeRows(topHdr, 15, subHdr, 15);

    let subTotalLabour = 0;
    subLabour.forEach((l, index) => {
      subTotalLabour += num(l.total);
      b.dataRow(
        [
          index + 1, l.contractor_name, '', '', l.unit || '',
          num(l.carpenter), num(l.barbender), num(l.mason), num(l.skilled_other),
          num(l.carpenter_helper), num(l.barbender_helper), num(l.semi_skilled_other), num(l.mc), num(l.fc), num(l.total),
        ],
        [[2, 4]]
      );
    });
    grandTotalLabour += subTotalLabour;
    const subTotR = b.subtotalRow(['', '', '', '', '', '', '', '', '', '', '', '', sub.name, subTotalLabour, ''], [[1, 12]]);
    b.borderTable(topHdr, subTotR);
    b.spacer(6);
  });

  if (grandTotalLabour > 0) {
    b.subtotalRow(['', '', '', '', '', '', '', '', '', '', '', '', 'Project Total', grandTotalLabour, ''], [[1, 12]]);
  }
  b.spacer(10);

  // --- D. Material Status ---
  b.sectionTitle('D. MATERIAL STATUS');
  b.tableHeader(['', '', '', 'Received Qty', '', '', 'Consumed Qty', '', '', '', 'Amount', '', '', '', ''], [[4, 6], [7, 10], [11, 14]]);
  const matHdr = b.tableHeader(
    ['Sr. No', 'Description', 'Unit', 'Till Date Rec Qty', 'Today Rec Qty', 'Total Received Qty',
      'Till Date Consumption', 'Today Consumption', 'Total Consumption', 'Balance', 'Rate',
      'Till Date Amount', 'Today Material Amount', 'Cumulative Material Amount', 'Remarks']
  );
  if (materialStatusData.length === 0) {
    const er = b.dataRow([1, 'No material status records logged today.', '', '', '', '', '', '', '', '', '', '', '', '', ''], [[2, 15]]);
    b.borderTable(matHdr, er);
  } else {
    materialStatusData.forEach((item, index) => {
      b.dataRow([
        index + 1, item.description, item.unit,
        num(item.till_date_rec), num(item.today_rec_val), num(item.total_received),
        num(item.till_date_consumed), num(item.today_consumed_val), num(item.total_consumed),
        num(item.balance), num(item.rate_val), num(item.till_date_amount),
        num(item.today_amount), num(item.cumulative_amount), item.remarks || '',
      ]);
    });
    b.borderTable(matHdr, b.row - 1);
  }
  b.spacer(10);

  // --- E. Machineries ---
  b.sectionTitle('E. MACHINERIES DETAILS');
  const machHdr = b.tableHeader(
    ['Sr. No', 'Name of Machineries', '', '', '', '', '', 'Nos', 'Till Date Total Hours',
      'Todays Total Hours', 'Cumulative Total Hours', 'Rate', 'Till Date Total Amount',
      'Todays Amount', 'Cumulative Total Amount'],
    [[2, 7]]
  );
  if (machineryDetailsData.length === 0) {
    const er = b.dataRow([1, 'No machinery records logged today.', '', '', '', '', '', 0, 0, 0, 0, 0, 0, 0, 0], [[2, 7]]);
    b.borderTable(machHdr, er);
  } else {
    machineryDetailsData.forEach((m, index) => {
      b.dataRow([
        index + 1, m.machinery_name, '', '', '', '', '',
        num(m.nos), num(m.till_date_hours), num(m.todays_hours), num(m.cumulative_hours),
        num(m.rate_val), num(m.till_date_amount), num(m.todays_amount), num(m.cumulative_amount),
      ], [[2, 7]]);
    });
    b.borderTable(machHdr, b.row - 1);
  }
  b.spacer(10);

  // --- F. Day's Report ---
  b.sectionTitle("F. DAY'S REPORT", 6);
  const daysHdr = b.tableHeader(['Sr. No', 'Description', '', '', '', 'Remark'], [[2, 5]]);
  if (daysReports.length === 0) {
    const er = b.dataRow([1, 'No descriptions entered today.', '', '', '', ''], [[2, 5]]);
    b.borderTable(daysHdr, er, 1, 6);
  } else {
    daysReports.forEach((item, index) => {
      b.dataRow([index + 1, item.description, '', '', '', item.remark || ''], [[2, 5]]);
    });
    b.borderTable(daysHdr, b.row - 1, 1, 6);
  }
  b.spacer(10);

  // --- G. Status Report ---
  b.sectionTitle('G. STATUS REPORT', 6);
  const statusHdr = b.tableHeader(['Sr. No', 'Description', '', '', '', 'Remark'], [[2, 5]]);
  if (statusReports.length === 0) {
    const er = b.dataRow([1, 'No status report entries entered today.', '', '', '', ''], [[2, 5]]);
    b.borderTable(statusHdr, er, 1, 6);
  } else {
    statusReports.forEach((item, index) => {
      b.dataRow([index + 1, item.description, '', '', '', item.remark || ''], [[2, 5]]);
    });
    b.borderTable(statusHdr, b.row - 1, 1, 6);
  }
  b.spacer(10);

  // --- H. Site Visits ---
  b.sectionTitle('H. SPECIAL SITE VISITS', 7);
  const visitHdr = b.tableHeader(['Sr. No', 'Name of the Firm', '', '', 'Name of Visitor', '', 'Purpose'], [[2, 4], [5, 6]]);
  if (specialSiteVisits.length === 0) {
    const er = b.dataRow([1, 'No special visits recorded today.', '', '', '', '', ''], [[2, 4], [5, 6]]);
    b.borderTable(visitHdr, er, 1, 7);
  } else {
    specialSiteVisits.forEach((visit, index) => {
      b.dataRow([index + 1, visit.firm_name, '', '', visit.visitor_name, '', visit.purpose], [[2, 4], [5, 6]]);
    });
    b.borderTable(visitHdr, b.row - 1, 1, 7);
  }
  b.spacer(10);

  // --- I. Critical Issues ---
  b.sectionTitle('I. CRITICAL ISSUES', 6);
  const critHdr = b.tableHeader(['Sr. No', 'Description', '', '', '', 'Remark'], [[2, 5]]);
  if (criticalIssues.length === 0) {
    const er = b.dataRow([1, 'No critical issues reported today.', '', '', '', ''], [[2, 5]]);
    b.borderTable(critHdr, er, 1, 6);
  } else {
    criticalIssues.forEach((item, index) => {
      b.dataRow([index + 1, item.description, '', '', '', item.remark || ''], [[2, 5]]);
    });
    b.borderTable(critHdr, b.row - 1, 1, 6);
  }
  b.spacer(10);

  // --- J. Weather ---
  b.sectionTitle('J. WEATHER REPORT', 7);
  const weatherHdr = b.tableHeader(['Sr. No', 'Description', '', '', '', '', 'Remarks'], [[2, 6]]);
  const firstEntryWithWeather = progressEntries.find(
    (e) => normalizeDateKey(e.date) === selectedDprDate && e.weather_condition
  );
  const todayWeather = firstEntryWithWeather?.weather_condition || 'Sunny';
  const weatherR = b.dataRow([1, todayWeather, '', '', '', '', ''], [[2, 6]]);
  b.borderTable(weatherHdr, weatherR, 1, 7);
  b.spacer(10);

  // --- K. Next Day's Plan ---
  b.sectionTitle("K. NEXT DAY'S PLAN", 8);
  const planHdr = b.tableHeader(['Sr. No', 'Description', '', '', '', '', 'Unit', 'Quantity'], [[2, 6]]);
  if (nextDaysPlans.length === 0) {
    const er = b.dataRow([1, 'No activity plan logged for tomorrow.', '', '', '', '', '', ''], [[2, 6]]);
    b.borderTable(planHdr, er, 1, 8);
  } else {
    nextDaysPlans.forEach((plan, index) => {
      b.dataRow([index + 1, plan.description, '', '', '', '', plan.unit || '', plan.quantity ?? ''], [[2, 6]]);
    });
    b.borderTable(planHdr, b.row - 1, 1, 8);
  }

  // Freeze top rows for scrolling
  sheet.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];

  const filename = `${projectName || 'Project'}_DPR_${formatDMY(selectedDprDate)}.xlsx`;
  return { workbook, filename };
}

export async function downloadDprExcelWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
