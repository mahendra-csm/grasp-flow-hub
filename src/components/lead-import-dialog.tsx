import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseLeadsFromText } from "@/lib/ai.functions";

const LEAD_FIELDS = [
  { value: "full_name", label: "Full Name *" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "city", label: "City" },
  { value: "country", label: "Country" },
  { value: "source", label: "Source" },
  { value: "notes", label: "Notes" },
  { value: "_skip", label: "— Skip this column —" },
];

function autoMap(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const m: Record<string, string> = {
    name: "full_name", fullname: "full_name", contactname: "full_name",
    leadname: "full_name", clientname: "full_name", customername: "full_name",
    email: "email", emailaddress: "email", mail: "email",
    phone: "phone", mobile: "phone", phonenumber: "phone",
    mobilenumber: "phone", tel: "phone", telephone: "phone", contact: "phone",
    whatsapp: "whatsapp", wa: "whatsapp", wanumber: "whatsapp",
    city: "city", town: "city", location: "city",
    country: "country", nation: "country",
    source: "source", leadsource: "source", origin: "source", channel: "source",
    notes: "notes", note: "notes", remarks: "notes", comments: "notes",
    description: "notes", info: "notes",
  };
  return m[h] ?? "_skip";
}

type ParsedLead = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  country?: string | null;
  source?: string | null;
  notes?: string | null;
};

type Props = { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void };

export function LeadImportDialog({ open, onOpenChange, onDone }: Props) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "done">("upload");
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [fileMode, setFileMode] = useState<"excel" | "txt">("excel");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setRawRows([]);
    setHeaders([]);
    setMapping({});
    setParsedLeads([]);
    setResultCount(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (ext === "txt") {
      setFileMode("txt");
      const text = await file.text();
      if (!text.trim()) return toast.error("File is empty");
      setAiLoading(true);
      try {
        const leads = await parseLeadsFromText({ data: { text } });
        if (!leads.length) return toast.error("No leads found in the file");
        setParsedLeads(leads as ParsedLead[]);
        setStep("preview");
      } catch (e: any) {
        toast.error("AI parsing failed: " + e.message);
      } finally {
        setAiLoading(false);
      }
      return;
    }

    if (["xlsx", "xls", "csv"].includes(ext)) {
      setFileMode("excel");
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) return toast.error("No data found in the file");
        const hdrs = Object.keys(rows[0]);
        setHeaders(hdrs);
        setRawRows(rows);
        const init: Record<string, string> = {};
        hdrs.forEach((h) => { init[h] = autoMap(h); });
        setMapping(init);
        setStep("mapping");
      } catch {
        toast.error("Could not read the file. Make sure it is a valid Excel or CSV file.");
      }
      return;
    }

    toast.error("Unsupported format. Use .xlsx, .xls, .csv, or .txt");
  };

  const applyMapping = () => {
    const hasName = Object.values(mapping).includes("full_name");
    if (!hasName) return toast.error("Map at least one column to Full Name");

    const leads: ParsedLead[] = rawRows
      .map((row) => {
        const lead: any = {};
        for (const [col, field] of Object.entries(mapping)) {
          if (field === "_skip") continue;
          const val = row[col]?.toString().trim() || null;
          if (val) lead[field] = val;
        }
        return lead as ParsedLead;
      })
      .filter((l) => l.full_name?.trim());

    if (!leads.length) return toast.error("No rows with a valid name found after mapping");
    setParsedLeads(leads);
    setStep("preview");
  };

  const doImport = async () => {
    setImporting(true);
    let count = 0;
    for (const lead of parsedLeads) {
      const { error } = await supabase.from("leads").insert({
        full_name: lead.full_name,
        email: lead.email || null,
        phone: lead.phone || null,
        whatsapp: lead.whatsapp || null,
        city: lead.city || null,
        country: lead.country || null,
        source: lead.source || null,
        notes: lead.notes || null,
        stage: "new",
        priority: "medium",
        custom_data: {},
      });
      if (!error) count++;
    }
    setImporting(false);
    setResultCount(count);
    setStep("done");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Upload Excel (.xlsx, .xls), CSV, or TXT — leads are mapped to existing fields automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <>
              <label
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-12 cursor-pointer hover:border-primary hover:bg-muted/30 transition"
                onClick={() => inputRef.current?.click()}
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">AI is reading your file…</p>
                  </>
                ) : (
                  <>
                    <Upload className="size-9 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to select a file</p>
                      <p className="text-xs text-muted-foreground mt-1">.xlsx · .xls · .csv · .txt</p>
                    </div>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv,.txt"
                  disabled={aiLoading}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-foreground">Excel / CSV</p>
                  <p>First row = column headers. You'll map each column to a lead field (Name, Email, Phone, etc.) before importing.</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-foreground">TXT</p>
                  <p>Any format — AI reads the file and extracts contacts automatically. Works with lists, paragraphs, or tables.</p>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: Column mapping (Excel/CSV only) */}
          {step === "mapping" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{rawRows.length}</span> rows found.
                  Map each column to a lead field.
                </p>
                <Badge variant="outline">Excel / CSV</Badge>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2 min-w-0">
                    <span className="text-sm w-[45%] truncate font-medium" title={h}>{h}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping[h]}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={reset}>Back</Button>
                <Button onClick={applyMapping}>Preview leads →</Button>
              </div>
            </>
          )}

          {/* STEP 3: Preview */}
          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{parsedLeads.length}</span> leads ready.
                  Review before importing.
                </p>
                <Badge variant="outline">{fileMode === "txt" ? "AI Parsed" : "Excel / CSV"}</Badge>
              </div>

              <div className="rounded-md border overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Country</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedLeads.slice(0, 100).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{l.full_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.email ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.phone ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.city ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.country ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedLeads.length > 100 && (
                <p className="text-xs text-muted-foreground">Showing first 100 of {parsedLeads.length} — all will be imported.</p>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(fileMode === "excel" ? "mapping" : "upload")}>
                  Back
                </Button>
                <Button onClick={doImport} disabled={importing}>
                  {importing ? (
                    <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Importing…</>
                  ) : (
                    `Import ${parsedLeads.length} lead${parsedLeads.length !== 1 ? "s" : ""}`
                  )}
                </Button>
              </div>
            </>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 className="size-14 text-green-500 mx-auto" />
              <div>
                <p className="text-xl font-semibold">{resultCount} lead{resultCount !== 1 ? "s" : ""} imported!</p>
                <p className="text-sm text-muted-foreground mt-1">They are now visible in your Leads list.</p>
              </div>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
