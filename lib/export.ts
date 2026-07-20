import type { AppState, DailyMealOrder } from "@/lib/types";
import { todayKey } from "@/lib/date";
import { getMonthlySettlementDailyQuantitiesByLocation, getMonthlySettlementForSettlementAccount, mealSupplyTypeLabel } from "@/lib/schedule";

type SpreadsheetValue = string | number | undefined;

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function spreadsheetTextLength(value: SpreadsheetValue) {
  return [...String(value ?? "")].reduce((length, character) => length + (character.charCodeAt(0) > 255 ? 2 : 1), 0);
}

function escapeXml(value: SpreadsheetValue) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    '"': "&quot;"
  })[character] ?? character);
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function crc32(data: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createStoredZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    writeUint32(local, 0, 0x04034b50);
    writeUint16(local, 4, 20);
    writeUint16(local, 6, 0x0800);
    writeUint16(local, 8, 0);
    writeUint16(local, 10, 0);
    writeUint16(local, 12, 0);
    writeUint32(local, 14, checksum);
    writeUint32(local, 18, entry.data.length);
    writeUint32(local, 22, entry.data.length);
    writeUint16(local, 26, name.length);
    writeUint16(local, 28, 0);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    writeUint32(central, 0, 0x02014b50);
    writeUint16(central, 4, 20);
    writeUint16(central, 6, 20);
    writeUint16(central, 8, 0x0800);
    writeUint16(central, 10, 0);
    writeUint16(central, 12, 0);
    writeUint16(central, 14, 0);
    writeUint32(central, 16, checksum);
    writeUint32(central, 20, entry.data.length);
    writeUint32(central, 24, entry.data.length);
    writeUint16(central, 28, name.length);
    writeUint16(central, 30, 0);
    writeUint16(central, 32, 0);
    writeUint16(central, 34, 0);
    writeUint16(central, 36, 0);
    writeUint32(central, 38, 0);
    writeUint32(central, 42, offset);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 4, 0);
  writeUint16(end, 6, 0);
  writeUint16(end, 8, entries.length);
  writeUint16(end, 10, entries.length);
  writeUint32(end, 12, centralDirectory.length);
  writeUint32(end, 16, offset);
  writeUint16(end, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

function columnLabel(columnNumber: number) {
  let value = columnNumber;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function createWorksheetXml(rows: SpreadsheetValue[][]) {
  const columnCount = Math.max(...rows.map((row) => row.length), 0);
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const width = Math.min(48, Math.max(10, ...rows.map((row) => spreadsheetTextLength(row[index]) + 2)));
    const column = index + 1;
    return `<col min="${column}" max="${column}" width="${width}" customWidth="1"/>`;
  }).join("");
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const cellReference = `${columnLabel(columnIndex + 1)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? ' s="1"' : "";
      if (typeof value === "number" && Number.isFinite(value)) {
        return `<c r="${cellReference}"${style}><v>${value}</v></c>`;
      }
      return `<c r="${cellReference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const lastCell = `${columnLabel(Math.max(columnCount, 1))}${Math.max(rows.length, 1)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${columns}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;
}

function createXlsx(rows: SpreadsheetValue[][]) {
  const encoder = new TextEncoder();
  const files: Array<[string, string]> = [
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="식사배달" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ["xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC8191F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ["xl/worksheets/sheet1.xml", createWorksheetXml(rows)]
  ];

  return createStoredZip(files.map(([name, content]) => ({ name, data: encoder.encode(content) })));
}

export function downloadExcel(filename: string, rows: SpreadsheetValue[][]) {
  const blob = new Blob([createXlsx(rows)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildDeliveryRows(state: AppState, orders: DailyMealOrder[]) {
  return [
    ["순서", "업체명", "유형", "식사", "수량", "주소", "상세주소", "배달 메모", "상태"],
    ...orders.map((order, index) => {
      const client = state.clients.find((item) => item.id === order.clientId);
      const mealType = state.mealTypes.find((item) => item.id === order.mealTypeId);
      return [
        index + 1,
        client?.name,
        mealSupplyTypeLabel(client?.mealSupplyType),
        mealType?.name,
        order.finalQuantity,
        client?.address,
        client?.addressDetail,
        client?.deliveryMemo,
        order.status
      ];
    })
  ];
}

export function buildMonthlyRows(state: AppState, month = todayKey().slice(0, 7)) {
  return [
    ["구분", "정산 업체", "배달 장소", "일자", "일반 식수", "개인도시락", "일일 합계", "월 최종 식수", "단가", "금액", "정산 메모"],
    ...state.settlementAccounts.flatMap((account) => {
      const settlement = getMonthlySettlementForSettlementAccount(state, account.id, month);
      const locationDailyQuantities = getMonthlySettlementDailyQuantitiesByLocation(state, account.id, month);
      const locationSubtotals = settlement.clients.map((client, index) => ({
        client,
        quantity: settlement.clientSettlements[index]?.settlementFinalQuantity ?? 0
      }));
      const totalAmount = settlement.settlementFinalQuantity * settlement.unitPrice;

      return [
        ...locationDailyQuantities.map((daily) => [
          "일별",
          account.name,
          daily.clientName,
          daily.date,
          daily.regularQuantity,
          daily.lunchboxQuantity,
          daily.finalQuantity,
          "",
          "",
          "",
          ""
        ]),
        ...locationSubtotals.map((item) => [
          "장소 소계",
          account.name,
          item.client.name,
          "",
          "",
          "",
          "",
          item.quantity,
          "",
          "",
          ""
        ]),
        [
          "월 최종",
          account.name,
          "",
          "",
          "",
          "",
          "",
          settlement.settlementFinalQuantity,
          settlement.unitPrice,
          totalAmount,
          settlement.adjustment?.memo
        ]
      ];
    })
  ];
}
