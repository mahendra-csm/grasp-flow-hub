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

export const MAX_SPREADSHEET_PREVIEW_BYTES = 6 * 1024 * 1024;
export const MAX_SPREADSHEET_PREVIEW_ROWS_PER_SHEET = 5000;
export const MAX_SPREADSHEET_PREVIEW_COLUMNS = 200;

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
  if (buffer.byteLength > MAX_SPREADSHEET_PREVIEW_BYTES) {
    throw new Error("Spreadsheet is too large to preview safely.");
  }

  const workbook = XLSX.read(buffer, { type: "array" });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const rows = matrix
      .slice(0, MAX_SPREADSHEET_PREVIEW_ROWS_PER_SHEET)
      .map((row) =>
        row
          .slice(0, MAX_SPREADSHEET_PREVIEW_COLUMNS)
          .map((cell) => (cell == null ? "" : String(cell))),
      );
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
