import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  MAX_SPREADSHEET_PREVIEW_BYTES,
  parseSpreadsheetPreview,
} from "@/lib/spreadsheet";

describe("parseSpreadsheetPreview", () => {
  it("parses a simple workbook", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Email"],
      ["Asha", "asha@example.com"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const result = parseSpreadsheetPreview(buffer);
    expect(result.sheetCount).toBe(1);
    expect(result.sheets[0].rows[1][0]).toBe("Asha");
  });

  it("rejects oversized files", () => {
    const huge = new Uint8Array(MAX_SPREADSHEET_PREVIEW_BYTES + 1).buffer;
    expect(() => parseSpreadsheetPreview(huge)).toThrow("Spreadsheet is too large");
  });
});
