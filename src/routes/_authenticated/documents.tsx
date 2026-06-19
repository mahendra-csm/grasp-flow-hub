import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Eye, FileSpreadsheet, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SpreadsheetPreviewDialog } from "@/components/spreadsheet-preview-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isSpreadsheetDocument } from "@/lib/spreadsheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

type DocumentRow = Tables<"documents">;
type DocumentListItem = DocumentRow & {
  leads: {
    full_name: string;
    id: string;
  } | null;
};

function DocumentsPage() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<{ id: string; path: string } | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [] } = useQuery<DocumentListItem[]>({
    queryKey: ["all-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, leads(id, full_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DocumentListItem[];
    },
  });

  const upload = async (file: File) => {
    setUploading(true);
    const path = `general/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("lead-documents").upload(path, file);

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("documents").insert({
      name: file.name,
      file_type: file.type,
      storage_path: path,
      size_bytes: file.size,
      lead_id: null,
    });

    setUploading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Document uploaded.");
    await qc.invalidateQueries({ queryKey: ["all-documents"] });

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("lead-documents").createSignedUrl(path, 60);

    if (error) {
      toast.error(error.message);
      return;
    }

    const anchor = window.document.createElement("a");
    anchor.href = data.signedUrl;
    anchor.download = name;
    anchor.target = "_blank";
    anchor.click();
  };

  const openPreview = (documentRow: DocumentRow) => {
    setPreviewDocument(documentRow);
    setPreviewOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error: storageError } = await supabase.storage
      .from("lead-documents")
      .remove([deleteId.path]);

    if (storageError) {
      toast.error(storageError.message);
      return;
    }

    const { error } = await supabase.from("documents").delete().eq("id", deleteId.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Document deleted.");
    setDeleteId(null);
    await qc.invalidateQueries({ queryKey: ["all-documents"] });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Open Excel files inside the CRM, inspect what is inside, and still keep every original
            upload.
          </p>
        </div>

        <label className="cursor-pointer">
          <Button
            variant="outline"
            className="pointer-events-none gap-1.5"
            disabled={uploading}
            asChild
          >
            <span>
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploading ? "Uploading..." : "Upload document"}
            </span>
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void upload(file);
              }
            }}
          />
        </label>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-4">
          {documents.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((documentRow) => {
                const previewable = isSpreadsheetDocument(
                  documentRow.name,
                  documentRow.file_type ?? null,
                );

                return (
                  <div
                    key={documentRow.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition hover:shadow-soft"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      {previewable ? (
                        <FileSpreadsheet className="size-5" />
                      ) : (
                        <FileText className="size-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{documentRow.name}</p>
                        {previewable ? (
                          <Badge variant="secondary" className="rounded-full">
                            Excel preview
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {((documentRow.size_bytes ?? 0) / 1024).toFixed(1)} KB |{" "}
                        {format(new Date(documentRow.created_at), "MMM d, yyyy")}
                      </p>

                      {documentRow.leads ? (
                        <Link
                          to="/leads/$id"
                          params={{ id: documentRow.leads.id }}
                          className="text-xs text-primary hover:underline"
                        >
                          {documentRow.leads.full_name}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">General document</span>
                      )}

                      <p className="text-xs text-muted-foreground">
                        {previewable
                          ? "Open inside CRM to search rows, copy data, and export the current sheet view."
                          : documentRow.file_type || "Stored file"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      {previewable ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => openPreview(documentRow)}
                          title="Preview inside CRM"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      ) : null}

                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => void download(documentRow.storage_path, documentRow.name)}
                        title="Download"
                      >
                        <Download className="size-3.5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setDeleteId({ id: documentRow.id, path: documentRow.storage_path })
                        }
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 py-16 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto size-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium">No documents yet</p>
                <p>
                  Upload a file here, or go to a lead&apos;s detail page to attach files to a
                  specific lead.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SpreadsheetPreviewDialog
        documentRow={previewDocument}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewDocument(null);
          }
        }}
        onDownloadOriginal={download}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              The file will be permanently removed from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
