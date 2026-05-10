import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const { data: documents } = useQuery({
    queryKey: ["all-documents"],
    queryFn: async () => (await supabase.from("documents").select("*, leads(id, full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("lead-documents").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">All uploaded files across leads.</p>
      </div>
      <Card className="shadow-soft"><CardContent className="pt-4">
        {documents?.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((d: any) => (
              <div key={d.id} className="border rounded-lg p-3 hover:shadow-soft transition flex items-start gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{((d.size_bytes ?? 0) / 1024).toFixed(1)} KB • {format(new Date(d.created_at), "MMM d, yyyy")}</p>
                  {d.leads && <Link to="/leads/$id" params={{ id: d.leads.id }} className="text-xs text-primary hover:underline">{d.leads.full_name}</Link>}
                </div>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => download(d.storage_path, d.name)}><Download className="size-3.5" /></Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No documents yet. Upload files from any lead's detail page.
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
