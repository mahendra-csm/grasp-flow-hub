import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, Upload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<{ id: string; path: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: documents } = useQuery({
    queryKey: ["all-documents"],
    queryFn: async () =>
      (await supabase.from("documents").select("*, leads(id, full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const upload = async (file: File) => {
    setUploading(true);
    const path = `general/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("lead-documents").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error } = await supabase.from("documents").insert({
      name: file.name,
      file_type: file.type,
      storage_path: path,
      size_bytes: file.size,
      lead_id: null,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    qc.invalidateQueries({ queryKey: ["all-documents"] });
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("lead-documents").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.click();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.storage.from("lead-documents").remove([deleteId.path]);
    const { error } = await supabase.from("documents").delete().eq("id", deleteId.id);
    if (error) toast.error(error.message);
    else toast.success("Document deleted");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["all-documents"] });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">All uploaded files across leads.</p>
        </div>
        <label className="cursor-pointer">
          <Button
            variant="outline"
            className="gap-1.5 pointer-events-none"
            disabled={uploading}
            asChild
          >
            <span>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Uploading…" : "Upload Document"}
            </span>
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-4">
          {documents?.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((d: any) => (
                <div key={d.id} className="border rounded-lg p-3 hover:shadow-soft transition flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                    <FileText className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {((d.size_bytes ?? 0) / 1024).toFixed(1)} KB • {format(new Date(d.created_at), "MMM d, yyyy")}
                    </p>
                    {d.leads ? (
                      <Link to="/leads/$id" params={{ id: d.leads.id }} className="text-xs text-primary hover:underline">
                        {d.leads.full_name}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">General</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => download(d.storage_path, d.name)}>
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId({ id: d.id, path: d.storage_path })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-sm text-muted-foreground space-y-3">
              <FileText className="size-10 mx-auto text-muted-foreground/40" />
              <div>
                <p className="font-medium">No documents yet</p>
                <p>Upload a file using the button above, or go to a lead's detail page to attach files to a specific lead.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>The file will be permanently removed from storage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
