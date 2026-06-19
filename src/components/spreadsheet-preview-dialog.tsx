import { useEffect, useState } from "react";
import { Copy, Download, FileSpreadsheet, Loader2, Search, TableProperties } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { parseSpreadsheetPreview, type SpreadsheetPreviewWorkbook } from "@/lib/spreadsheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type DocumentRow = Tables<"documents">;

type SpreadsheetPreviewDialogProps = {
  documentRow: DocumentRow | null;
  onDownloadOriginal: (path: string, name: string) => Promise<void> | void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function SpreadsheetPreviewDialog({
  documentRow,
  onDownloadOriginal,
  open,
  onOpenChange,
}: SpreadsheetPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<SpreadsheetPreviewWorkbook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [search, setSearch] = useState("");
  const [useHeaderRow, setUseHeaderRow] = useState(true);

  useEffect(() => {
    if (!open || !documentRow) return;

    let ignore = false;

    const loadWorkbook = async () => {
      setLoading(true);
      setError(null);
      setWorkbook(null);
      setSelectedSheet("");
      setSearch("");

      const { data, error: signedUrlError } = await supabase.storage
        .from("lead-documents")
        .createSignedUrl(documentRow.storage_path, 60);

      if (ignore) return;

      if (signedUrlError) {
        setError(signedUrlError.message);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(data.signedUrl);

        if (!response.ok) {
          throw new Error(`Preview download failed with ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const parsed = parseSpreadsheetPreview(buffer);

        if (ignore) return;

        setWorkbook(parsed);
        setSelectedSheet(parsed.sheets[0]?.name ?? "");
      } catch (previewError) {
        if (ignore) return;

        const message =
          previewError instanceof Error ? previewError.message : "Unable to open this spreadsheet.";
        setError(message);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadWorkbook();

    return () => {
      ignore = true;
    };
  }, [documentRow, open]);

  const currentSheet =
    workbook?.sheets.find((sheet) => sheet.name === selectedSheet) ?? workbook?.sheets[0] ?? null;

  const sourceRows = currentSheet?.rows ?? [];
  const columnCount = currentSheet?.columnCount ?? 0;
  const baseHeaders = Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  const headers =
    useHeaderRow && sourceRows.length
      ? baseHeaders.map((_, index) => sourceRows[0]?.[index]?.trim() || `Column ${index + 1}`)
      : baseHeaders;
  const bodyRows = useHeaderRow ? sourceRows.slice(1) : sourceRows;
  const normalizedRows = bodyRows.map((row) =>
    Array.from({ length: headers.length }, (_, index) => row[index] ?? ""),
  );
  const loweredSearch = search.trim().toLowerCase();
  const visibleRows = normalizedRows.filter((row) => {
    if (!loweredSearch) return true;
    return row.some((cell) => cell.toLowerCase().includes(loweredSearch));
  });

  const copyVisibleRows = async () => {
    const lines = [headers.join("\t"), ...visibleRows.map((row) => row.join("\t"))].join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      toast.success(`Copied ${visibleRows.length} visible rows.`);
    } catch {
      toast.error("Copy failed in this browser.");
    }
  };

  const exportVisibleRows = () => {
    if (!documentRow || !currentSheet) return;

    const csv = [headers, ...visibleRows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");

    const safeName = documentRow.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName || "spreadsheet"}-${currentSheet.name}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visibleRows.length} rows from ${currentSheet.name}.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-7xl flex-col overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-left">
                  <FileSpreadsheet className="size-4 text-primary" />
                  {documentRow?.name ?? "Spreadsheet preview"}
                </DialogTitle>
                <DialogDescription className="text-left">
                  Open Excel or CSV content inside the CRM, then search, copy, or export what you
                  need.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {workbook ? <Badge variant="outline">{workbook.sheetCount} sheets</Badge> : null}
                {currentSheet ? (
                  <Badge variant="outline">
                    {visibleRows.length}/{normalizedRows.length} rows visible
                  </Badge>
                ) : null}
                {currentSheet ? <Badge variant="outline">{headers.length} columns</Badge> : null}
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
            {loading ? (
              <div className="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading spreadsheet preview...
                </div>
              </div>
            ) : error ? (
              <div className="grid min-h-0 flex-1 place-items-center">
                <div className="max-w-md space-y-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center">
                  <p className="font-medium text-destructive">Preview unavailable</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  {documentRow ? (
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => onDownloadOriginal(documentRow.storage_path, documentRow.name)}
                    >
                      <Download className="size-4" />
                      Download original file
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : currentSheet ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="grid gap-3 xl:grid-cols-[220px_1fr_auto_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="spreadsheet-sheet">Sheet</Label>
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                      <SelectTrigger id="spreadsheet-sheet">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {workbook?.sheets.map((sheet) => (
                          <SelectItem key={sheet.name} value={sheet.name}>
                            {sheet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="spreadsheet-search">Search inside sheet</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="spreadsheet-search"
                        className="pl-9"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search any visible cell value"
                      />
                    </div>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <Switch checked={useHeaderRow} onCheckedChange={setUseHeaderRow} />
                      <Label className="text-sm">Use first row as headers</Label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end justify-end gap-2">
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={copyVisibleRows}
                      disabled={!visibleRows.length}
                    >
                      <Copy className="size-4" />
                      Copy visible rows
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={exportVisibleRows}
                      disabled={!visibleRows.length}
                    >
                      <TableProperties className="size-4" />
                      Export current view
                    </Button>
                    {documentRow ? (
                      <Button
                        variant="outline"
                        className="gap-1.5"
                        onClick={() =>
                          onDownloadOriginal(documentRow.storage_path, documentRow.name)
                        }
                      >
                        <Download className="size-4" />
                        Download original
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                  <table className="w-full min-w-max border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background shadow-sm">
                      <tr className="border-b">
                        <th className="w-14 min-w-14 border-r bg-muted/50 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          #
                        </th>
                        {headers.map((header, index) => (
                          <th
                            key={`${header}-${index}`}
                            className="min-w-[180px] border-r bg-muted/50 px-3 py-2 text-left text-xs font-semibold text-muted-foreground last:border-r-0"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.length ? (
                        visibleRows.map((row, rowIndex) => (
                          <tr
                            key={`${currentSheet.name}-${rowIndex}`}
                            className="border-b align-top transition-colors hover:bg-muted/30"
                          >
                            <td className="border-r bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                              {useHeaderRow ? rowIndex + 2 : rowIndex + 1}
                            </td>
                            {headers.map((_, columnIndex) => (
                              <td
                                key={`${currentSheet.name}-${rowIndex}-${columnIndex}`}
                                className="max-w-[28rem] border-r px-3 py-2 align-top text-xs leading-5 whitespace-pre-wrap break-words last:border-r-0"
                              >
                                {row[columnIndex] || (
                                  <span className="text-muted-foreground/50">-</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={Math.max(headers.length + 1, 1)}
                            className="py-12 text-center text-muted-foreground"
                          >
                            No sheet rows match the current search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
                This workbook has no readable rows yet.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
