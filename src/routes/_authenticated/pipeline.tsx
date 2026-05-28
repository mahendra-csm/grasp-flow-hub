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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { Keyboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

type LeadRow = {
  id: string;
  full_name: string;
  stage: PipelineStageValue;
  priority: string;
  services?: { name: string } | null;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function PipelinePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: leads } = useQuery({
    queryKey: ["pipeline-leads"],
    queryFn: async () =>
      ((await supabase
        .from("leads")
        .select("id, full_name, stage, priority, services(name)")
        .order("updated_at", { ascending: false })).data ?? []) as LeadRow[],
  });

  const columns = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      items: (leads ?? []).filter((l) => l.stage === stage.value),
    }));
  }, [leads]);

  const flatOrder = useMemo(() => columns.flatMap((c) => c.items.map((l) => l.id)), [columns]);

  useEffect(() => {
    if (!focusedId && flatOrder.length) setFocusedId(flatOrder[0]);
    else if (focusedId && !flatOrder.includes(focusedId)) setFocusedId(flatOrder[0] ?? null);
  }, [flatOrder, focusedId]);

  const moveStage = async (leadId: string, newStage: PipelineStageValue) => {
    const lead = leads?.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;
    const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);
    if (error) return toast.error(error.message);
    await supabase.from("activities").insert({
      lead_id: leadId,
      type: "stage",
      description: `Moved to ${PIPELINE_STAGES.find((s) => s.value === newStage)?.label}`,
    });
    qc.invalidateQueries();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const leadId = e.active.id as string;
    const newStage = e.over?.id as PipelineStageValue | undefined;
    if (!newStage) return;
    await moveStage(leadId, newStage);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const focused = focusedId;
      const lead = focused ? leads?.find((l) => l.id === focused) : null;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!flatOrder.length) return;
        const idx = focused ? flatOrder.indexOf(focused) : -1;
        const next = flatOrder[Math.min(flatOrder.length - 1, idx + 1)] ?? flatOrder[0];
        setFocusedId(next);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!flatOrder.length) return;
        const idx = focused ? flatOrder.indexOf(focused) : 0;
        const prev = flatOrder[Math.max(0, idx - 1)] ?? flatOrder[0];
        setFocusedId(prev);
        return;
      }
      if (e.key === "h" || e.key === "ArrowLeft" || e.key === "l" || e.key === "ArrowRight") {
        e.preventDefault();
        if (!lead) return;
        const colIdx = PIPELINE_STAGES.findIndex((s) => s.value === lead.stage);
        const dir = e.key === "h" || e.key === "ArrowLeft" ? -1 : 1;
        const next = PIPELINE_STAGES[colIdx + dir];
        if (next) moveStage(lead.id, next.value);
        return;
      }
      if (e.key === "Enter" && lead) {
        e.preventDefault();
        navigate({ to: "/leads/$id", params: { id: lead.id } });
        return;
      }
      if (/^[1-9]$/.test(e.key) && lead) {
        const idx = Number(e.key) - 1;
        const stage = PIPELINE_STAGES[idx];
        if (stage) {
          e.preventDefault();
          moveStage(lead.id, stage.value);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedId, flatOrder, leads, navigate]);

  const activeLead = leads?.find((l) => l.id === activeId);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag leads between stages, or use the keyboard.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keyboard className="size-3.5" />
          <Kbd>j</Kbd>/<Kbd>k</Kbd> select
          <span className="mx-1">·</span>
          <Kbd>h</Kbd>/<Kbd>l</Kbd> move stage
          <span className="mx-1">·</span>
          <Kbd>1</Kbd>–<Kbd>9</Kbd> set stage
          <span className="mx-1">·</span>
          <Kbd>Enter</Kbd> open
        </div>
      </div>
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {columns.map(({ stage, items }, colIdx) => (
            <Column
              key={stage.value}
              stage={stage}
              items={items}
              colIdx={colIdx}
              focusedId={focusedId}
              onFocus={setFocusedId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} dragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

function Column({
  stage, items, colIdx, focusedId, onFocus,
}: {
  stage: typeof PIPELINE_STAGES[number];
  items: LeadRow[];
  colIdx: number;
  focusedId: string | null;
  onFocus: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  return (
    <div ref={setNodeRef} className={`shrink-0 w-72 rounded-lg bg-muted/50 border ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="px-3 py-2 flex items-center justify-between border-b sticky top-0 bg-muted/80 backdrop-blur rounded-t-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={stage.color}>{stage.label}</Badge>
          {colIdx < 9 && (
            <kbd className="hidden sm:inline-flex items-center rounded border bg-background px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
              {colIdx + 1}
            </kbd>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[200px]">
        {items.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            focused={focusedId === l.id}
            onFocus={() => onFocus(l.id)}
          />
        ))}
        {!items.length && <p className="text-xs text-muted-foreground text-center py-4">Drop leads here</p>}
      </div>
    </div>
  );
}

function LeadCard({
  lead, dragging, focused, onFocus,
}: {
  lead: LeadRow;
  dragging?: boolean;
  focused?: boolean;
  onFocus?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      onClick={onFocus}
      className={`p-3 cursor-grab active:cursor-grabbing shadow-soft hover:shadow-card transition ${
        isDragging || dragging ? "opacity-60" : ""
      } ${focused ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      <Link to="/leads/$id" params={{ id: lead.id }} onClick={(e) => isDragging && e.preventDefault()} className="block">
        <p className="text-sm font-medium truncate">{lead.full_name}</p>
        {lead.services?.name && <p className="text-xs text-muted-foreground truncate">{lead.services.name}</p>}
      </Link>
    </Card>
  );
}
