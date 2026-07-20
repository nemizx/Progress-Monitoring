import ExcelJS from 'exceljs';

const BORDER_THIN = {
  top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
};

const FILL_HEADER = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' }, // Premium Dark Blue
};

const FILL_TOTALS = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F4F7' }, // Soft Slate Gray
};

export async function downloadLabourProductivityExcel(data, { projectName, subProjectName, fromDate, toDate }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Labour Productivity');

  sheet.views = [{ showGridLines: true }];

  // Column configurations
  sheet.columns = [
    { header: 'Sr. No', key: 'srNo', width: 8 },
    { header: 'Contractor Name', key: 'contractorName', width: 30 },
    { header: 'Type of Work', key: 'typeOfWork', width: 25 },
    { header: 'Executed Quantity', key: 'executedQty', width: 20 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Total Labour Deployed', key: 'totalLabour', width: 22 },
    { header: 'Productivity', key: 'productivity', width: 22 },
  ];

  // 1. Report Title Block
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'LABOUR PRODUCTIVITY ANALYTICS REPORT';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = FILL_HEADER;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 40;

  // 2. Metadata Info Rows
  sheet.getCell('A2').value = `Project: ${projectName || 'All Projects'}`;
  sheet.getCell('A2').font = { bold: true };
  if (subProjectName) {
    sheet.getCell('D2').value = `Sub-Project: ${subProjectName}`;
    sheet.getCell('D2').font = { bold: true };
  }

  const dateStr = fromDate && toDate ? `Period: ${fromDate} to ${toDate}` : 'Period: All Time';
  sheet.getCell('A3').value = dateStr;
  sheet.getCell('A3').font = { italic: true };

  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 20;
  sheet.addRow([]); // Blank spacer row

  // 3. Setup Headers (Row 5)
  const headerRow = sheet.getRow(5);
  headerRow.values = [
    'Sr. No',
    'Contractor Name',
    'Type of Work',
    'Executed Qty',
    'Unit',
    'Total Labour',
    'Productivity',
  ];
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = FILL_HEADER;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  // 4. Fill Data Rows
  let startRow = 6;
  let totalQty = 0;
  let totalLabour = 0;

  data.forEach((item, idx) => {
    const row = sheet.addRow([
      idx + 1,
      item.contractor_name,
      item.type_of_work,
      Number(item.executed_qty || 0),
      item.unit || '—',
      Number(item.total_labour || 0),
      `${Number(item.productivity || 0).toFixed(2)} ${item.unit || ''}/Labour`.trim(),
    ]);

    row.height = 22;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.border = BORDER_THIN;
    });

    totalQty += Number(item.executed_qty || 0);
    totalLabour += Number(item.total_labour || 0);
  });

  const endRow = sheet.lastRow.number;

  // 5. Add Totals Footer Row
  const totalRowNumber = endRow + 1;
  sheet.mergeCells(`A${totalRowNumber}:C${totalRowNumber}`);
  sheet.getCell(`A${totalRowNumber}`).value = 'Total / Average';
  sheet.getCell(`D${totalRowNumber}`).value = totalQty;
  sheet.getCell(`E${totalRowNumber}`).value = '—';
  sheet.getCell(`F${totalRowNumber}`).value = totalLabour;
  
  const avgProductivity = totalLabour > 0 ? (totalQty / totalLabour) : 0;
  sheet.getCell(`G${totalRowNumber}`).value = `${avgProductivity.toFixed(2)} /Labour`;

  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.height = 25;

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.fill = FILL_TOTALS;
    cell.border = BORDER_THIN;
    
    if (colNumber <= 3) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (colNumber === 4) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    } else if (colNumber === 5) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (colNumber === 6 || colNumber === 7) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (colNumber === 6) cell.numFmt = '#,##0';
    }
  });

  // 6. Write Workbook and Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  
  const filename = `${projectName ? projectName.replace(/\s+/g, '_') : 'Project'}_Labour_Productivity_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  
  window.URL.revokeObjectURL(url);
}
