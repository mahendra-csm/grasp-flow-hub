import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { LEAD_SOURCES, PIPELINE_STAGES, PRIORITIES } from "@/lib/constants";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  service_id: z.string().optional(),
  source: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  stage: z.enum(["new","contacted","interested","follow_up","documents_pending","payment_pending","converted","closed","lost"]),
  notes: z.string().max(2000).optional(),
  follow_up_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LeadFormSheet({
  open, onOpenChange, lead,
}: { open: boolean; onOpenChange: (v: boolean) => void; lead?: Lead | null }) {
  const qc = useQueryClient();
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const { data: services } = useQuery({
    queryKey: ["services-active"],
    queryFn: async () => (await supabase.from("services").select("*").eq("active", true).order("sort_order")).data ?? [],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "", email: "", phone: "", whatsapp: "", country: "", city: "",
      service_id: undefined, source: undefined, priority: "medium", stage: "new",
      notes: "", follow_up_date: "",
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        full_name: lead.full_name,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        whatsapp: lead.whatsapp ?? "",
        country: lead.country ?? "",
        city: lead.city ?? "",
        service_id: lead.service_id ?? undefined,
        source: lead.source ?? undefined,
        priority: lead.priority,
        stage: lead.stage,
        notes: lead.notes ?? "",
        follow_up_date: lead.follow_up_date ? lead.follow_up_date.slice(0, 16) : "",
      });
      setCustomData((lead.custom_data as Record<string, any>) ?? {});
    } else {
      form.reset();
      setCustomData({});
    }
  }, [lead, form]);

  const serviceId = form.watch("service_id");
  const { data: dynamicFields } = useQuery({
    queryKey: ["dynamic-fields", serviceId],
    enabled: !!serviceId,
    queryFn: async () => (await supabase.from("dynamic_form_fields").select("*").eq("service_id", serviceId!).order("sort_order")).data ?? [],
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null,
      whatsapp: values.whatsapp || null,
      country: values.country || null,
      city: values.city || null,
      service_id: values.service_id || null,
      source: values.source || null,
      priority: values.priority,
      stage: values.stage,
      notes: values.notes || null,
      follow_up_date: values.follow_up_date ? new Date(values.follow_up_date).toISOString() : null,
      custom_data: customData,
    };
    if (lead) {
      const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
      if (error) return toast.error(error.message);
      await supabase.from("activities").insert({ lead_id: lead.id, type: "update", description: "Lead updated" });
      toast.success("Lead updated");
    } else {
      const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      if (data) await supabase.from("activities").insert({ lead_id: data.id, type: "created", description: "Lead created" });
      toast.success("Lead created");
    }
    qc.invalidateQueries();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead ? "Edit lead" : "New lead"}</SheetTitle>
          <SheetDescription>{lead ? "Update lead details." : "Add a new lead to your pipeline."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" error={form.formState.errors.full_name?.message}>
              <Input {...form.register("full_name")} />
            </Field>
            <Field label="Email"><Input type="email" {...form.register("email")} /></Field>
            <Field label="Phone"><Input {...form.register("phone")} /></Field>
            <Field label="WhatsApp"><Input {...form.register("whatsapp")} /></Field>
            <Field label="Country"><Input {...form.register("country")} /></Field>
            <Field label="City"><Input {...form.register("city")} /></Field>

            <Field label="Service">
              <Controller control={form.control} name="service_id" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>{services?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Source">
              <Controller control={form.control} name="source" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Priority">
              <Controller control={form.control} name="priority" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Stage">
              <Controller control={form.control} name="stage" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PIPELINE_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Follow-up date" className="col-span-2">
              <Input type="datetime-local" {...form.register("follow_up_date")} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <Textarea rows={3} {...form.register("notes")} />
            </Field>
          </div>

          {dynamicFields && dynamicFields.length > 0 && (
            <div className="space-y-3 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Service-specific fields</p>
              <div className="grid grid-cols-2 gap-3">
                {dynamicFields.map((f) => (
                  <Field key={f.id} label={f.label + (f.required ? " *" : "")} className={f.field_type === "textarea" ? "col-span-2" : ""}>
                    {f.field_type === "select" ? (
                      <Select value={customData[f.field_key] ?? ""} onValueChange={(v) => setCustomData({ ...customData, [f.field_key]: v })}>
                        <SelectTrigger><SelectValue placeholder={f.placeholder ?? "Select"} /></SelectTrigger>
                        <SelectContent>
                          {((f.options as string[]) ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : f.field_type === "textarea" ? (
                      <Textarea rows={2} value={customData[f.field_key] ?? ""} onChange={(e) => setCustomData({ ...customData, [f.field_key]: e.target.value })} placeholder={f.placeholder ?? ""} />
                    ) : (
                      <Input
                        type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                        value={customData[f.field_key] ?? ""}
                        onChange={(e) => setCustomData({ ...customData, [f.field_key]: e.target.value })}
                        placeholder={f.placeholder ?? ""}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{lead ? "Update" : "Create lead"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
