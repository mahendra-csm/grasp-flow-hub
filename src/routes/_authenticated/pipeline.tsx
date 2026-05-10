import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

function PipelinePage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: leads } = useQuery({
    queryKey: ["pipeline-leads"],
    queryFn: async () => (await supabase.from("leads").select("id, full_name, stage, priority, services(name)").order("updated_at", { ascending: false })).data ?? [],
  });

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const leadId = e.active.id as string;
    const newStage = e.over?.id as PipelineStageValue | undefined;
    if (!newStage) return;
    const lead = leads?.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;
    const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);
    if (error) return toast.error(error.message);
    await supabase.from("activities").insert({
      lead_id: leadId, type: "stage", description: `Moved to ${PIPELINE_STAGES.find(s => s.value === newStage)?.label}`,
    });
    qc.invalidateQueries();
  };

  const activeLead = leads?.find((l) => l.id === activeId);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Drag leads between stages.</p>
      </div>
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {PIPELINE_STAGES.map((stage) => {
            const items = leads?.filter((l) => l.stage === stage.value) ?? [];
            return <Column key={stage.value} stage={stage} items={items} />;
          })}
        </div>
        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead as any} dragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ stage, items }: { stage: typeof PIPELINE_STAGES[number]; items: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  return (
    <div ref={setNodeRef} className={`shrink-0 w-72 rounded-lg bg-muted/50 border ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="px-3 py-2 flex items-center justify-between border-b sticky top-0 bg-muted/80 backdrop-blur rounded-t-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={stage.color}>{stage.label}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[200px]">
        {items.map((l) => <LeadCard key={l.id} lead={l} />)}
        {!items.length && <p className="text-xs text-muted-foreground text-center py-4">Drop leads here</p>}
      </div>
    </div>
  );
}

function LeadCard({ lead, dragging }: { lead: any; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <Card ref={setNodeRef} {...attributes} {...listeners} style={style}
      className={`p-3 cursor-grab active:cursor-grabbing shadow-soft hover:shadow-card transition ${isDragging || dragging ? "opacity-60" : ""}`}>
      <Link to="/leads/$id" params={{ id: lead.id }} onClick={(e) => isDragging && e.preventDefault()} className="block">
        <p className="text-sm font-medium truncate">{lead.full_name}</p>
        {lead.services?.name && <p className="text-xs text-muted-foreground truncate">{lead.services.name}</p>}
      </Link>
    </Card>
  );
}
