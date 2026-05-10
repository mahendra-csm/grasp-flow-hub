import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Pencil, Eye } from "lucide-react";
import { LeadFormSheet } from "@/components/lead-form-sheet";
import { PIPELINE_STAGES, PRIORITIES } from "@/lib/constants";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const PAGE_SIZE = 20;

function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: services } = useQuery({
    queryKey: ["services-active"],
    queryFn: async () => (await supabase.from("services").select("*").eq("active", true).order("sort_order")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", { search, stageFilter, serviceFilter, page }],
    queryFn: async () => {
      let q = supabase.from("leads").select("*, services(name, color)", { count: "exact" });
      if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      if (stageFilter !== "all") q = q.eq("stage", stageFilter as any);
      if (serviceFilter !== "all") q = q.eq("service_id", serviceFilter);
      q = q.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE)), [data]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("leads").delete().eq("id", deleteId);
    if (error) toast.error(error.message); else toast.success("Lead deleted");
    setDeleteId(null);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">{data?.count ?? 0} total</p>
        </div>
        <Button onClick={() => { setEditing(null); setSheetOpen(true); }} className="gap-1.5">
          <Plus className="size-4" /> New lead
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, phone…" className="pl-8" />
            </div>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {PIPELINE_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : data?.rows.length ? data.rows.map((l: any) => {
                  const stage = PIPELINE_STAGES.find((s) => s.value === l.stage);
                  const prio = PRIORITIES.find((p) => p.value === l.priority);
                  return (
                    <TableRow key={l.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link to="/leads/$id" params={{ id: l.id }} className="hover:text-primary">{l.full_name}</Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.email && <div>{l.email}</div>}
                        {l.phone && <div>{l.phone}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{l.services?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant="outline" className={stage?.color}>{stage?.label}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className={prio?.color}>{prio?.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" className="size-8"><Link to="/leads/$id" params={{ id: l.id }}><Eye className="size-3.5" /></Link></Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(l); setSheetOpen(true); }}><Pencil className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteId(l.id)}><Trash2 className="size-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No leads yet. <button className="text-primary hover:underline" onClick={() => { setEditing(null); setSheetOpen(true); }}>Add the first one</button>.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LeadFormSheet open={sheetOpen} onOpenChange={setSheetOpen} lead={editing} />
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All related activities, follow-ups and documents will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
