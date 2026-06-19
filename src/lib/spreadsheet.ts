import * as XLSX from "xlsx";

export type SpreadsheetPreviewSheet = {
  columnCount: number;
  name: string;
  rowCount: number;
  rows: string[][];
};

export type SpreadsheetPreviewWorkbook = {
  sheetCount: number;
  sheets: SpreadsheetPreviewSheet[];
};

const SPREADSHEET_NAME_PATTERN = /\.(xlsx|xlsm|xlsb|xls|csv)$/i;
const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/plain",
]);

export function isSpreadsheetDocument(name: string, fileType: string | null) {
  return (
    SPREADSHEET_NAME_PATTERN.test(name) || (!!fileType && SPREADSHEET_MIME_TYPES.has(fileType))
  );
}

export function parseSpreadsheetPreview(buffer: ArrayBuffer): SpreadsheetPreviewWorkbook {
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const rows = matrix.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

    return {
      name: sheetName,
      rows,
      rowCount: rows.length,
      columnCount,
    };
  });

  return {
    sheets,
    sheetCount: sheets.length,
  };
}
