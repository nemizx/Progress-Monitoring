import ExcelJS from 'exceljs';

const COL_COUNT = 6;
const COL_WIDTHS = [10, 60, 15, 20, 20, 20];

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

export async function buildWprExcelWorkbook({
  selectedProject,
  selectedWprReportWeek,
  weeksList,
  wprSummaryData,
  wprDetailedSections,
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('WPR Report');

  // Set column widths
  COL_WIDTHS.forEach((width, idx) => {
    sheet.getColumn(idx + 1).width = width;
  });

  const b = createSheetBuilder(sheet);
  const projectName = selectedProject?.name || 'Project';
  const weekObj = weeksList.find((w) => w.id === selectedWprReportWeek);
  const weekLabel = weekObj?.label || 'Selected Week';

  // --- Title Headers ---
  b.writeRow(['PLANEDGE MONITOR'], {
    height: 24,
    font: { bold: true, size: 14, color: { argb: 'FF1F3864' } },
    align: 'center',
    merges: [[1, COL_COUNT]],
  });
  b.writeRow(['WEEKLY PROGRESS MONITORING REPORT'], {
    height: 20,
    font: { bold: true, size: 11, color: { argb: 'FF595959' } },
    align: 'center',
    merges: [[1, COL_COUNT]],
  });
  b.writeRow([projectName], {
    height: 18,
    font: { bold: true, size: 10 },
    align: 'center',
    merges: [[1, COL_COUNT]],
  });
  b.writeRow([weekLabel], {
    height: 18,
    font: { size: 10 },
    align: 'center',
    merges: [[1, COL_COUNT]],
  });
  b.spacer(12);

  // --- Section A: Summary ---
  b.sectionTitle('A. BUILDING WISE WEEKLY PROGRESS MONITORING REPORT (SUMMARY)');
  const sumHdr = b.tableHeader(['Sr. No', 'Line Item / Parameter', 'Unit', 'Planned', 'Achieved', '% Comp.']);
  
  wprSummaryData.forEach((item, index) => {
    const formattedPlan = item.isCurrency ? `Rs. ${num(item.plan).toLocaleString('en-IN')}` : item.plan;
    const formattedAchieved = item.isCurrency ? `Rs. ${num(item.achieved).toLocaleString('en-IN')}` : item.achieved;
    b.dataRow([
      index + 1,
      item.name,
      item.unit,
      formattedPlan,
      formattedAchieved,
      item.pct,
    ]);
  });
  b.borderTable(sumHdr, b.row - 1);
  b.spacer(12);

  // --- Section B: Details ---
  wprDetailedSections.forEach((sec) => {
    if (!sec.subprojects || sec.subprojects.length === 0) return;

    b.sectionTitle(sec.title);
    const detailHdr = b.tableHeader(['Sr. No', `${sec.nameLabel} Details`, 'Plan', 'Achieved', '% Comp.', 'Remarks']);

    let sectionPlanTotal = 0;
    let sectionAchievedTotal = 0;

    sec.subprojects.forEach((sub) => {
      const isSingleProjectWise = sub.subProjectName === 'Project-wise';
      if (!isSingleProjectWise) {
        b.groupLabel(sub.subProjectName);
      }

      let subPlanTotal = 0;
      let subAchievedTotal = 0;

      sub.rows.forEach((r, idx) => {
        const planVal = num(r.plan);
        const achievedVal = num(r.achieved);
        subPlanTotal += planVal;
        subAchievedTotal += achievedVal;

        b.dataRow([
          idx + 1,
          r.name || '—',
          r.plan || '—',
          r.achieved || '—',
          r.pct !== null ? `${r.pct}%` : '—',
          r.remark || '—',
        ]);
      });

      sectionPlanTotal += subPlanTotal;
      sectionAchievedTotal += subAchievedTotal;

      if (!isSingleProjectWise) {
        const subPct = subPlanTotal > 0 ? Math.min(Math.round((subAchievedTotal / subPlanTotal) * 100), 100) : 0;
        b.subtotalRow([
          '',
          `${sub.subProjectName} Subtotal`,
          subPlanTotal,
          subAchievedTotal,
          `${subPct}%`,
          '',
        ]);
      }
    });

    const overallPct = sectionPlanTotal > 0 ? Math.min(Math.round((sectionAchievedTotal / sectionPlanTotal) * 100), 100) : 0;
    const totRow = b.subtotalRow([
      '',
      'Section Total',
      sectionPlanTotal,
      sectionAchievedTotal,
      `${overallPct}%`,
      '',
    ]);
    b.borderTable(detailHdr, totRow);
    b.spacer(12);
  });

  // Freeze top rows for scrolling
  sheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];

  const filename = `${projectName.replace(/\s+/g, '_')}_WPR_${weekObj?.startDate || 'week'}.xlsx`;
  return { workbook, filename };
}

export async function downloadWprExcelWorkbook(workbook, filename) {
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
