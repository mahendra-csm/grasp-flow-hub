import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as Icons from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/services")({
  component: ServicesPage,
});

const FIELD_TYPES = ["text", "textarea", "number", "email", "phone", "date", "select"];

function ServicesPage() {
  const qc = useQueryClient();
  const { data: services } = useQuery({
    queryKey: ["services-all"],
    queryFn: async () => (await supabase.from("services").select("*").order("sort_order")).data ?? [],
  });
  const [editServiceId, setEditServiceId] = useState<string | null>(null);

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("services").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["services-all"] });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="text-sm text-muted-foreground">Manage service categories and per-service form fields.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services?.map((s) => {
          const Icon = (Icons as any)[s.icon ?? "Briefcase"] ?? Icons.Briefcase;
          return (
            <Card key={s.id} className="shadow-soft">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="size-10 rounded-lg grid place-items-center" style={{ background: `${s.color}20`, color: s.color }}>
                    <Icon className="size-5" />
                  </div>
                  <Switch checked={s.active} onCheckedChange={(v) => toggleActive(s.id, v)} />
                </div>
                <h3 className="font-semibold mt-3">{s.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2.5em]">{s.description}</p>
                <div className="flex justify-between items-center mt-4">
                  <Badge variant={s.active ? "default" : "secondary"} className={s.active ? "bg-success/10 text-success hover:bg-success/15 border-success/20" : ""}>
                    {s.active ? "Active" : "Inactive"}
                  </Badge>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditServiceId(s.id)}>
                    <Settings2 className="size-3.5" /> Form
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editServiceId && (
        <FieldsDialog serviceId={editServiceId} open onClose={() => setEditServiceId(null)} />
      )}
    </div>
  );
}

function FieldsDialog({ serviceId, open, onClose }: { serviceId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: fields } = useQuery({
    queryKey: ["fields", serviceId],
    queryFn: async () => (await supabase.from("dynamic_form_fields").select("*").eq("service_id", serviceId).order("sort_order")).data ?? [],
  });

  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [required, setRequired] = useState(false);
  const [optionsStr, setOptionsStr] = useState("");

  const addField = async () => {
    if (!label.trim()) return toast.error("Label required");
    const field_key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const opts = type === "select" ? optionsStr.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const sort_order = (fields?.length ?? 0) + 1;
    const { error } = await supabase.from("dynamic_form_fields").insert({
      service_id: serviceId, label, field_key, field_type: type as any, required, options: opts, sort_order,
    });
    if (error) return toast.error(error.message);
    setLabel(""); setOptionsStr(""); setRequired(false); setType("text");
    qc.invalidateQueries({ queryKey: ["fields", serviceId] });
  };

  const removeField = async (id: string) => {
    await supabase.from("dynamic_form_fields").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["fields", serviceId] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Custom form fields</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {fields?.length ? fields.map((f) => (
              <div key={f.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                <div>
                  <span className="font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">({f.field_type}{f.required ? ", required" : ""})</span>
                </div>
                <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeField(f.id)}><Trash2 className="size-3.5" /></Button>
              </div>
            )) : <p className="text-sm text-muted-foreground text-center py-4">No custom fields yet.</p>}
          </div>
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium">Add new field</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {type === "select" && (
                <div className="col-span-2"><Label className="text-xs">Options (comma-separated)</Label><Input value={optionsStr} onChange={(e) => setOptionsStr(e.target.value)} className="mt-1" placeholder="Option A, Option B" /></div>
              )}
              <div className="flex items-center gap-2 col-span-2"><Switch checked={required} onCheckedChange={setRequired} /><Label className="text-xs">Required</Label></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={addField}><Plus className="size-3.5 mr-1" /> Add field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
