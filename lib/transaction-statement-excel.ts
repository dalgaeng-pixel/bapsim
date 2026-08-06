import ExcelJS from "exceljs";
import type { SupplierProfile } from "@/lib/types";
import type {
  TransactionStatement,
  TransactionStatementDay,
  TransactionStatementLocation
} from "@/lib/transaction-statement";

const TOTAL_COLUMNS = 13;
const GUTTER_COLUMN = 7;
const MIN_DETAIL_ROWS = 20;
const BLACK = "FF111111";
const LIGHT_GRAY = "FFF5F5F4";

type TableFields = {
  date: [number, number];
  lunch: [number, number];
  dinner: [number, number];
  amount: [number, number];
  remarks: [number, number];
};

type LocationBlock = {
  endRow: number;
  lunchSubtotalCell: string;
  dinnerSubtotalCell: string;
  amountSubtotalCell: string;
};

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}\uB144 ${Number(monthNumber)}\uC6D4`;
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "\uAC70\uB798\uBA85\uC138\uD45C";
}

function columnName(column: number) {
  let value = column;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function cellReference(column: number, row: number) {
  return `${columnName(column)}${row}`;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: BLACK } },
    left: { style: "thin", color: { argb: BLACK } },
    bottom: { style: "thin", color: { argb: BLACK } },
    right: { style: "thin", color: { argb: BLACK } }
  };
}

function styleRange(
  worksheet: ExcelJS.Worksheet,
  row: number,
  startColumn: number,
  endColumn: number,
  options: {
    bold?: boolean;
    fill?: string;
    fontSize?: number;
    horizontal?: ExcelJS.Alignment["horizontal"];
    numberFormat?: string;
    vertical?: ExcelJS.Alignment["vertical"];
    wrapText?: boolean;
  } = {}
) {
  for (let column = startColumn; column <= endColumn; column += 1) {
    const cell = worksheet.getCell(row, column);
    cell.font = {
      name: "\uB9D1\uC740 \uACE0\uB515",
      size: options.fontSize ?? 9,
      bold: options.bold ?? false,
      color: { argb: BLACK }
    };
    cell.alignment = {
      horizontal: options.horizontal ?? "center",
      vertical: options.vertical ?? "middle",
      wrapText: options.wrapText ?? false
    };
    cell.border = thinBorder();
    if (options.fill) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: options.fill }
      };
    }
    if (options.numberFormat) {
      cell.numFmt = options.numberFormat;
    }
  }
}

function setMergedValue(
  worksheet: ExcelJS.Worksheet,
  row: number,
  startColumn: number,
  endColumn: number,
  value: ExcelJS.CellValue,
  options: Parameters<typeof styleRange>[4] = {}
) {
  if (endColumn > startColumn) {
    worksheet.mergeCells(row, startColumn, row, endColumn);
  }
  const cell = worksheet.getCell(row, startColumn);
  cell.value = value;
  styleRange(worksheet, row, startColumn, endColumn, options);
  return cell;
}

function fieldsFor(startColumn: number, endColumn: number): TableFields {
  if (endColumn - startColumn + 1 === TOTAL_COLUMNS) {
    return {
      date: [startColumn, startColumn + 1],
      lunch: [startColumn + 2, startColumn + 3],
      dinner: [startColumn + 4, startColumn + 5],
      amount: [startColumn + 6, startColumn + 8],
      remarks: [startColumn + 9, endColumn]
    };
  }
  return {
    date: [startColumn, startColumn],
    lunch: [startColumn + 1, startColumn + 1],
    dinner: [startColumn + 2, startColumn + 2],
    amount: [startColumn + 3, startColumn + 3],
    remarks: [startColumn + 4, endColumn]
  };
}

function unitPriceFormula(day: TransactionStatementDay, meal: "lunch" | "dinner", unitPriceCell: string) {
  const directPrice = meal === "lunch" ? day.lunchDirectUnitPrice : day.dinnerDirectUnitPrice;
  return directPrice === undefined ? unitPriceCell : String(directPrice);
}

function combinedRemarks(day: TransactionStatementDay) {
  return [day.priceNote, day.memo].filter(Boolean).join(" \u00B7 ");
}

function writeLocationBlock(
  worksheet: ExcelJS.Worksheet,
  location: TransactionStatementLocation,
  startRow: number,
  startColumn: number,
  endColumn: number,
  unitPrice: number,
  compact: boolean
): LocationBlock {
  const fields = fieldsFor(startColumn, endColumn);
  const halfWidth = endColumn - startColumn + 1 < TOTAL_COLUMNS;
  const titlePriceLabelColumn = halfWidth ? startColumn + 3 : startColumn + 8;
  const titlePriceStartColumn = titlePriceLabelColumn + 1;

  setMergedValue(
    worksheet,
    startRow,
    startColumn,
    titlePriceLabelColumn - 1,
    location.client.name,
    { bold: true, fontSize: 10, horizontal: "left" }
  );
  setMergedValue(
    worksheet,
    startRow,
    titlePriceLabelColumn,
    titlePriceLabelColumn,
    "\uB2E8\uAC00",
    { bold: true, fill: LIGHT_GRAY, fontSize: 8 }
  );
  const unitPriceCell = setMergedValue(
    worksheet,
    startRow,
    titlePriceStartColumn,
    endColumn,
    unitPrice,
    { bold: true, horizontal: "right", numberFormat: '#,##0"\uC6D0"' }
  );
  worksheet.getRow(startRow).height = compact ? 15 : 18;

  const headerRow = startRow + 1;
  const headerItems: Array<{ label: string; range: [number, number] }> = [
    { label: "\uC77C\uC790", range: fields.date },
    { label: "\uC911\uC2DD", range: fields.lunch },
    { label: "\uC11D\uC2DD", range: fields.dinner },
    { label: "\uAE08\uC561", range: fields.amount },
    { label: "\uBE44\uACE0", range: fields.remarks }
  ];
  for (const item of headerItems) {
    setMergedValue(worksheet, headerRow, item.range[0], item.range[1], item.label, {
      bold: true,
      fill: LIGHT_GRAY,
      fontSize: compact ? 8 : 9
    });
  }
  worksheet.getRow(headerRow).height = compact ? 14 : 17;

  const detailCount = Math.max(MIN_DETAIL_ROWS, location.days.length);
  const firstDetailRow = headerRow + 1;
  const amountCells: string[] = [];
  const lunchCells: string[] = [];
  const dinnerCells: string[] = [];
  const baseRowHeight = compact ? 11 : 15;

  for (let index = 0; index < detailCount; index += 1) {
    const rowNumber = firstDetailRow + index;
    const day = location.days[index];
    setMergedValue(worksheet, rowNumber, fields.date[0], fields.date[1], day?.date ?? "", {
      fontSize: compact ? 7 : 8
    });
    const lunchCell = setMergedValue(worksheet, rowNumber, fields.lunch[0], fields.lunch[1], day ? day.lunchQuantity : "", {
      fontSize: compact ? 8 : 9,
      numberFormat: "0;-0;;"
    });
    const dinnerCell = setMergedValue(worksheet, rowNumber, fields.dinner[0], fields.dinner[1], day ? day.dinnerQuantity : "", {
      fontSize: compact ? 8 : 9,
      numberFormat: "0;-0;;"
    });
    const amountCell = setMergedValue(worksheet, rowNumber, fields.amount[0], fields.amount[1], "", {
      fontSize: compact ? 7 : 8,
      horizontal: "right",
      numberFormat: '#,##0"\uC6D0"'
    });
    const remarks = day ? combinedRemarks(day) : "";
    setMergedValue(worksheet, rowNumber, fields.remarks[0], fields.remarks[1], remarks, {
      fontSize: compact ? 6.5 : 8,
      horizontal: "left",
      wrapText: true
    });

    if (day) {
      const lunchReference = worksheet.getCell(rowNumber, fields.lunch[0]).address;
      const dinnerReference = worksheet.getCell(rowNumber, fields.dinner[0]).address;
      const formula = `${lunchReference}*${unitPriceFormula(day, "lunch", unitPriceCell.address)}+${dinnerReference}*${unitPriceFormula(day, "dinner", unitPriceCell.address)}`;
      amountCell.value = { formula, result: day.totalAmount };
      amountCells.push(amountCell.address);
      lunchCells.push(lunchCell.address);
      dinnerCells.push(dinnerCell.address);
    }

    const estimatedLines = remarks
      ? Math.min(3, Math.max(1, Math.ceil([...remarks].length / (halfWidth ? 18 : 42))))
      : 1;
    worksheet.getRow(rowNumber).height = Math.max(
      Number(worksheet.getRow(rowNumber).height ?? 0),
      baseRowHeight * estimatedLines
    );
  }

  const subtotalRow = firstDetailRow + detailCount;
  setMergedValue(worksheet, subtotalRow, fields.date[0], fields.date[1], "\uC7A5\uC18C \uC18C\uACC4", {
    bold: true,
    fill: LIGHT_GRAY,
    fontSize: compact ? 7 : 8
  });
  const lunchSubtotal = setMergedValue(worksheet, subtotalRow, fields.lunch[0], fields.lunch[1], {
    formula: lunchCells.length ? `SUM(${lunchCells.join(",")})` : "0",
    result: location.lunchQuantity
  }, { bold: true, fill: LIGHT_GRAY, fontSize: compact ? 8 : 9, numberFormat: '0"\uC2DD"' });
  const dinnerSubtotal = setMergedValue(worksheet, subtotalRow, fields.dinner[0], fields.dinner[1], {
    formula: dinnerCells.length ? `SUM(${dinnerCells.join(",")})` : "0",
    result: location.dinnerQuantity
  }, { bold: true, fill: LIGHT_GRAY, fontSize: compact ? 8 : 9, numberFormat: '0"\uC2DD"' });
  const amountSubtotal = setMergedValue(worksheet, subtotalRow, fields.amount[0], fields.amount[1], {
    formula: amountCells.length ? `SUM(${amountCells.join(",")})` : "0",
    result: location.totalAmount
  }, { bold: true, fill: LIGHT_GRAY, fontSize: compact ? 7 : 8, horizontal: "right", numberFormat: '#,##0"\uC6D0"' });
  setMergedValue(worksheet, subtotalRow, fields.remarks[0], fields.remarks[1], "", { fill: LIGHT_GRAY });
  worksheet.getRow(subtotalRow).height = compact ? 14 : 17;

  return {
    endRow: subtotalRow,
    lunchSubtotalCell: lunchSubtotal.address,
    dinnerSubtotalCell: dinnerSubtotal.address,
    amountSubtotalCell: amountSubtotal.address
  };
}

function writeDocumentHeader(
  worksheet: ExcelJS.Worksheet,
  statement: TransactionStatement,
  supplier: SupplierProfile
) {
  setMergedValue(worksheet, 1, 1, TOTAL_COLUMNS, "\uAC70\uB798\uBA85\uC138\uC11C (\uAC70\uB798\uBA85\uC138\uD45C)", {
    bold: true,
    fontSize: 16
  });
  worksheet.getRow(1).height = 25;

  setMergedValue(worksheet, 2, 1, 6, "\uACF5\uAE09\uBC1B\uB294 \uC790", { bold: true, fill: LIGHT_GRAY, fontSize: 10 });
  setMergedValue(worksheet, 2, 8, 13, "\uACF5\uAE09\uC790", { bold: true, fill: LIGHT_GRAY, fontSize: 10 });

  const recipientFields = [
    ["\uAC70\uB798 \uAE30\uAC04", formatMonth(statement.month)],
    ["\uC0C1\uD638", statement.account.name],
    ["\uC8FC\uC18C", statement.account.billingAddress || "\uBBF8\uC785\uB825"]
  ];
  const supplierFields = [
    ["\uC0AC\uC5C5\uC790\uB4F1\uB85D\uBC88\uD638", supplier.businessRegistrationNumber || "\uBBF8\uC785\uB825"],
    ["\uC0C1\uD638", supplier.businessName || "\uBC25\uC2EC"],
    ["\uC0AC\uC5C5\uC7A5 \uC8FC\uC18C", supplier.address || "\uBBF8\uC785\uB825"],
    ["\uC804\uD654\uBC88\uD638", supplier.phone || "\uBBF8\uC785\uB825"],
    ["\uC774\uBA54\uC77C", supplier.email || "\uBBF8\uC785\uB825"]
  ];

  for (let index = 0; index < supplierFields.length; index += 1) {
    const row = index + 3;
    if (index < recipientFields.length) {
      setMergedValue(worksheet, row, 1, 2, recipientFields[index][0], { bold: true, fill: LIGHT_GRAY, fontSize: 8 });
      setMergedValue(worksheet, row, 3, 6, recipientFields[index][1], { horizontal: "left", wrapText: true, fontSize: 8 });
    } else {
      setMergedValue(worksheet, row, 1, 6, "", {});
    }
    setMergedValue(worksheet, row, 8, 9, supplierFields[index][0], { bold: true, fill: LIGHT_GRAY, fontSize: 8 });
    setMergedValue(worksheet, row, 10, 13, supplierFields[index][1], { horizontal: "left", wrapText: true, fontSize: 8 });
    worksheet.getRow(row).height = 18;
  }

  setMergedValue(worksheet, 8, 1, 3, "\uD569\uACC4\uAE08\uC561", { bold: true, fill: LIGHT_GRAY, fontSize: 10 });
  const totalCell = setMergedValue(worksheet, 8, 4, 7, statement.totalAmount, {
    bold: true,
    fontSize: 11,
    horizontal: "right",
    numberFormat: '#,##0"\uC6D0"'
  });
  setMergedValue(worksheet, 8, 8, 13, "(VAT \uD3EC\uD568)", { bold: true, horizontal: "left", fontSize: 8 });
  worksheet.getRow(8).height = 20;
  return totalCell;
}

function sumFormula(references: string[]) {
  return references.length ? `SUM(${references.join(",")})` : "0";
}

function writeMonthlyFooter(
  worksheet: ExcelJS.Worksheet,
  row: number,
  statement: TransactionStatement,
  supplier: SupplierProfile,
  blocks: LocationBlock[]
) {
  const lunchReferences = blocks.map((block) => block.lunchSubtotalCell);
  const dinnerReferences = blocks.map((block) => block.dinnerSubtotalCell);
  const amountReferences = blocks.map((block) => block.amountSubtotalCell);

  setMergedValue(worksheet, row, 1, 2, "\uC6D4 \uD569\uACC4", { bold: true, fill: LIGHT_GRAY, fontSize: 10 });
  setMergedValue(worksheet, row, 3, 4, {
    formula: sumFormula(lunchReferences),
    result: statement.lunchQuantity
  }, { bold: true, fill: LIGHT_GRAY, numberFormat: '0"\uC2DD"' });
  setMergedValue(worksheet, row, 5, 6, {
    formula: sumFormula(dinnerReferences),
    result: statement.dinnerQuantity
  }, { bold: true, fill: LIGHT_GRAY, numberFormat: '0"\uC2DD"' });
  setMergedValue(worksheet, row, 7, 9, {
    formula: sumFormula(amountReferences),
    result: statement.totalAmount
  }, { bold: true, fill: LIGHT_GRAY, horizontal: "right", numberFormat: '#,##0"\uC6D0"' });
  setMergedValue(worksheet, row, 10, 13, "VAT \uD3EC\uD568", { bold: true, fill: LIGHT_GRAY, horizontal: "left" });
  worksheet.getRow(row).height = 20;

  const accountText = [supplier.bankName, supplier.bankAccountNumber].filter(Boolean).join(" ");
  setMergedValue(worksheet, row + 1, 1, 2, "\uC785\uAE08 \uACC4\uC88C", { bold: true, fontSize: 8 });
  setMergedValue(worksheet, row + 1, 3, 8, accountText || "\uBBF8\uC785\uB825", { horizontal: "left", fontSize: 8 });
  setMergedValue(worksheet, row + 1, 9, 10, "\uC608\uAE08\uC8FC", { bold: true, fontSize: 8 });
  setMergedValue(worksheet, row + 1, 11, 13, supplier.accountHolder || "\uBBF8\uC785\uB825", { horizontal: "left", fontSize: 8 });
  worksheet.getRow(row + 1).height = 18;

  return { amountReferences, endRow: row + 1 };
}

function configureWorksheet(worksheet: ExcelJS.Worksheet, endRow: number) {
  const widths = [10, 7, 7, 11, 11, 11, 2.5, 10, 7, 7, 11, 11, 11];
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.getColumn(GUTTER_COLUMN).width = 2.5;
  worksheet.views = [{ showGridLines: false }];
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.28,
      right: 0.28,
      top: 0.28,
      bottom: 0.28,
      header: 0.1,
      footer: 0.1
    },
    printArea: `A1:M${endRow}`
  };
}

function writeLocations(
  worksheet: ExcelJS.Worksheet,
  statement: TransactionStatement,
  startRow: number
) {
  const locations = statement.locations.slice(0, 4);
  const blocks: LocationBlock[] = [];
  if (locations.length <= 2) {
    let row = startRow;
    for (const location of locations) {
      const block = writeLocationBlock(worksheet, location, row, 1, TOTAL_COLUMNS, statement.unitPrice, locations.length === 2);
      blocks.push(block);
      row = block.endRow + 2;
    }
    return { blocks, endRow: Math.max(startRow, row - 2) };
  }

  const topLocations = locations.slice(0, 2);
  const topBlocks = topLocations.map((location, index) => writeLocationBlock(
    worksheet,
    location,
    startRow,
    index === 0 ? 1 : 8,
    index === 0 ? 6 : 13,
    statement.unitPrice,
    true
  ));
  blocks.push(...topBlocks);
  const bottomStartRow = Math.max(...topBlocks.map((block) => block.endRow)) + 2;
  const bottomLocations = locations.slice(2, 4);
  const bottomBlocks = bottomLocations.map((location, index) => writeLocationBlock(
    worksheet,
    location,
    bottomStartRow,
    index === 0 ? 1 : 8,
    index === 0 ? 6 : 13,
    statement.unitPrice,
    true
  ));
  blocks.push(...bottomBlocks);
  return {
    blocks,
    endRow: Math.max(...blocks.map((block) => block.endRow))
  };
}

export async function buildTransactionStatementExcelBuffer(
  statement: TransactionStatement,
  supplier: SupplierProfile
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "\uBC25\uC2EC \uC2DD\uC0AC\uBC30\uB2EC\uAD00\uB9AC";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet("\uAC70\uB798\uBA85\uC138\uD45C");
  const headerTotalCell = writeDocumentHeader(worksheet, statement, supplier);
  const locationResult = writeLocations(worksheet, statement, 10);
  const footer = writeMonthlyFooter(
    worksheet,
    locationResult.endRow + 2,
    statement,
    supplier,
    locationResult.blocks
  );
  headerTotalCell.value = {
    formula: sumFormula(footer.amountReferences),
    result: statement.totalAmount
  };
  configureWorksheet(worksheet, footer.endRow);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function downloadTransactionStatementExcel(
  statement: TransactionStatement,
  supplier: SupplierProfile
) {
  const bytes = await buildTransactionStatementExcelBuffer(statement, supplier);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(`\uBC25\uC2EC-\uAC70\uB798\uBA85\uC138\uD45C-${statement.account.name}-${statement.month}.xlsx`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
