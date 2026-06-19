import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isBefore, startOfDay, subDays } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  Pencil,
  Plus,
  Rows3,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type OneGraspWorkItem = Tables<"onegrasp_work_items">;
type OneGraspWorkItemInsert = TablesInsert<"onegrasp_work_items">;
type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type ViewMode = "board" | "list";

type TaskFormState = {
  title: string;
  description: string;
  assigneeName: string;
  assigneeEmail: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
};

const STATUS_OPTIONS: Array<{
  value: TaskStatus;
  label: string;
  hint: string;
  boardDescription: string;
  icon: LucideIcon;
  laneClass: string;
  laneHeaderClass: string;
}> = [
  {
    value: "todo",
    label: "To do",
    hint: "Planned work waiting to start",
    boardDescription: "Ready to pick up",
    icon: Target,
    laneClass: "border-slate-200/70 bg-gradient-to-b from-slate-50/80 via-background to-background",
    laneHeaderClass: "from-slate-100/90 to-transparent",
  },
  {
    value: "in_progress",
    label: "In progress",
    hint: "Actively being worked on",
    boardDescription: "Current execution",
    icon: Clock3,
    laneClass: "border-info/20 bg-gradient-to-b from-info/8 via-background to-background",
    laneHeaderClass: "from-info/12 to-transparent",
  },
  {
    value: "review",
    label: "Review",
    hint: "Needs checking or confirmation",
    boardDescription: "Awaiting sign-off",
    icon: Sparkles,
    laneClass:
      "border-warning/25 bg-gradient-to-b from-warning/10 via-background to-background",
    laneHeaderClass: "from-warning/15 to-transparent",
  },
  {
    value: "done",
    label: "Done",
    hint: "Finished items",
    boardDescription: "Wrapped and delivered",
    icon: CheckCircle2,
    laneClass:
      "border-success/25 bg-gradient-to-b from-success/10 via-background to-background",
    laneHeaderClass: "from-success/15 to-transparent",
  },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-info/20 bg-info/10 text-info",
  high: "border-warning/20 bg-warning/10 text-warning-foreground",
  urgent: "border-destructive/20 bg-destructive/10 text-destructive",
};

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  todo: "border-border bg-muted text-muted-foreground",
  in_progress: "border-info/20 bg-info/10 text-info",
  review: "border-warning/20 bg-warning/10 text-warning-foreground",
  done: "border-success/20 bg-success/10 text-success",
};

function createEmptyTaskFormState(): TaskFormState {
  return {
    title: "",
    description: "",
    assigneeName: "",
    assigneeEmail: "",
    status: "todo",
    priority: "medium",
    dueDate: "",
  };
}

function buildTaskFormState(item: OneGraspWorkItem | null): TaskFormState {
  if (!item) return createEmptyTaskFormState();

  return {
    title: item.title,
    description: item.description ?? "",
    assigneeName: item.assignee_name,
    assigneeEmail: item.assignee_email ?? "",
    status: item.status as TaskStatus,
    priority: item.priority as TaskPriority,
    dueDate: item.due_date ?? "",
  };
}

function getStatusMeta(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
}

function getStatusLabel(status: string) {
  return getStatusMeta(status).label;
}

function getPriorityLabel(priority: string) {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority;
}

function isTaskOverdue(item: OneGraspWorkItem) {
  if (!item.due_date || item.status === "done") return false;
  return isBefore(startOfDay(new Date(item.due_date)), startOfDay(new Date()));
}

function HeroMetric({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-white/50 bg-background/85 p-4 shadow-soft backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function TaskLane({
  compactCards,
  items,
  onDelete,
  onEdit,
  onStatusChange,
  status,
}: {
  compactCards: boolean;
  items: OneGraspWorkItem[];
  onDelete: (itemId: string) => void;
  onEdit: (item: OneGraspWorkItem) => void;
  onStatusChange: (item: OneGraspWorkItem, nextStatus: TaskStatus) => void;
  status: TaskStatus;
}) {
  const statusMeta = getStatusMeta(status);
  const StatusIcon = statusMeta.icon;

  return (
    <Card className={cn("overflow-hidden shadow-card", statusMeta.laneClass)}>
      <CardHeader className={cn("border-b bg-gradient-to-r pb-4", statusMeta.laneHeaderClass)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-background/85 text-foreground shadow-soft">
              <StatusIcon className="size-4" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">{statusMeta.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{statusMeta.boardDescription}</p>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full bg-background/80">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl border bg-background/90 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card",
                compactCards ? "space-y-2 p-3" : "space-y-3 p-4",
                isTaskOverdue(item) && "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("font-semibold leading-tight", compactCards && "text-sm")}>
                    {item.title}
                  </p>
                  {!compactCards ? (
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {item.description?.trim() ? item.description : "No extra details yet."}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full font-medium",
                    PRIORITY_BADGE_CLASS[item.priority as TaskPriority],
                  )}
                >
                  {getPriorityLabel(item.priority)}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5 rounded-full">
                  <UserSquare2 className="size-3.5" />
                  {item.assignee_name}
                </Badge>
                {item.due_date ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5 rounded-full bg-background/80",
                      isTaskOverdue(item) &&
                        "border-destructive/30 bg-destructive/5 text-destructive",
                    )}
                  >
                    <CalendarDays className="size-3.5" />
                    Due {format(new Date(item.due_date), "MMM d")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full bg-background/80">
                    No due date
                  </Badge>
                )}
              </div>

              {!compactCards && item.assignee_email ? (
                <p className="text-[11px] text-muted-foreground">{item.assignee_email}</p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Select
                  value={item.status}
                  onValueChange={(value) => onStatusChange(item, value as TaskStatus)}
                >
                  <SelectTrigger className="h-9 rounded-xl bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-xl"
                    onClick={() => onEdit(item)}
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-xl text-destructive"
                    onClick={() => onDelete(item.id)}
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Updated {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed bg-background/70 px-4 py-10 text-center text-sm text-muted-foreground">
            No tasks in {statusMeta.label.toLowerCase()} right now.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskListItem({
  item,
  onDelete,
  onEdit,
  onStatusChange,
}: {
  item: OneGraspWorkItem;
  onDelete: (itemId: string) => void;
  onEdit: (item: OneGraspWorkItem) => void;
  onStatusChange: (item: OneGraspWorkItem, nextStatus: TaskStatus) => void;
}) {
  const statusMeta = getStatusMeta(item.status);
  const StatusIcon = statusMeta.icon;

  return (
    <Card className="overflow-hidden border-primary/10 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("gap-1.5 rounded-full font-medium", STATUS_BADGE_CLASS[item.status])}
              >
                <StatusIcon className="size-3.5" />
                {statusMeta.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full font-medium",
                  PRIORITY_BADGE_CLASS[item.priority as TaskPriority],
                )}
              >
                {getPriorityLabel(item.priority)}
              </Badge>
              {item.due_date ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full",
                    isTaskOverdue(item) &&
                      "border-destructive/30 bg-destructive/5 text-destructive",
                  )}
                >
                  Due {format(new Date(item.due_date), "MMM d, yyyy")}
                </Badge>
              ) : null}
            </div>

            <div>
              <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {item.description?.trim() ? item.description : "No extra details added yet."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => onEdit(item)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="ghost"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_220px]">
          <div className="rounded-2xl border bg-muted/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Assignee
            </p>
            <p className="mt-2 text-sm font-medium">{item.assignee_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.assignee_email ?? "No assignee email added"}
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Activity
            </p>
            <p className="mt-2 text-sm font-medium">
              Updated {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Created by {item.created_by_email ?? "Unknown"}
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Move task
            </p>
            <Select
              value={item.status}
              onValueChange={(value) => onStatusChange(item, value as TaskStatus)}
            >
              <SelectTrigger className="mt-2 rounded-xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OneGraspWorkBoard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<TaskFormState>(() => createEmptyTaskFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [showCompleted, setShowCompleted] = useState(true);
  const [compactCards, setCompactCards] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);

  const { data: tasks = [], isLoading } = useQuery<OneGraspWorkItem[]>({
    queryKey: ["onegrasp-work-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onegrasp_work_items")
        .select("*")
        .order("status", { ascending: true })
        .order("due_date", { ascending: true })
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const editingTask = editingId ? (tasks.find((task) => task.id === editingId) ?? null) : null;
  const trimmedSearch = search.trim().toLowerCase();
  const showComposerPanel = composerOpen || editingId !== null || tasks.length === 0;

  const filteredTasks = tasks.filter((task) => {
    if (!showCompleted && task.status === "done") return false;
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (assigneeFilter !== "all" && task.assignee_name !== assigneeFilter) return false;
    if (!trimmedSearch) return true;

    const haystack = [
      task.title,
      task.description ?? "",
      task.assignee_name,
      task.assignee_email ?? "",
      task.created_by_email ?? "",
      task.priority,
      task.status,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(trimmedSearch);
  });

  const assigneeOptions = Array.from(
    new Set(tasks.map((task) => task.assignee_name.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  const summary = {
    total: tasks.length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    overdue: tasks.filter((task) => isTaskOverdue(task)).length,
    doneThisWeek: tasks.filter(
      (task) =>
        !!task.completed_at &&
        new Date(task.completed_at).getTime() >= subDays(new Date(), 7).getTime(),
    ).length,
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(createEmptyTaskFormState());
    setComposerOpen(false);
  };

  const startEditing = (task: OneGraspWorkItem) => {
    setEditingId(task.id);
    setForm(buildTaskFormState(task));
    setComposerOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setAssigneeFilter("all");
    setShowCompleted(true);
  };

  const saveTask = async () => {
    const title = form.title.trim();
    const assigneeName = form.assigneeName.trim();

    if (!title) {
      toast.error("Task title is required.");
      return;
    }

    if (!assigneeName) {
      toast.error("Add the assignee name so the team knows who owns this.");
      return;
    }

    const payload = {
      title,
      description: form.description.trim() || null,
      assignee_name: assigneeName,
      assignee_email: form.assigneeEmail.trim() || null,
      status: form.status,
      priority: form.priority,
      due_date: form.dueDate || null,
      completed_at:
        form.status === "done" ? (editingTask?.completed_at ?? new Date().toISOString()) : null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("onegrasp_work_items")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Task updated.");
    } else {
      const insertPayload: OneGraspWorkItemInsert = {
        ...payload,
        created_by_id: user?.id ?? null,
        created_by_email: user?.email ?? null,
      };

      const { error } = await supabase.from("onegrasp_work_items").insert(insertPayload);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Task created.");
    }

    setComposerOpen(false);
    setForm(createEmptyTaskFormState());
    setEditingId(null);
    await qc.invalidateQueries({ queryKey: ["onegrasp-work-items"] });
  };

  const updateTaskStatus = async (task: OneGraspWorkItem, nextStatus: TaskStatus) => {
    const payload = {
      status: nextStatus,
      completed_at: nextStatus === "done" ? (task.completed_at ?? new Date().toISOString()) : null,
    };

    const { error } = await supabase.from("onegrasp_work_items").update(payload).eq("id", task.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (editingId === task.id) {
      setForm((current) => ({
        ...current,
        status: nextStatus,
      }));
    }

    toast.success(`Moved to ${getStatusLabel(nextStatus)}.`);
    await qc.invalidateQueries({ queryKey: ["onegrasp-work-items"] });
  };

  const deleteTask = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from("onegrasp_work_items").delete().eq("id", deleteId);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (editingId === deleteId) {
      resetForm();
    }

    setDeleteId(null);
    toast.success("Task deleted.");
    await qc.invalidateQueries({ queryKey: ["onegrasp-work-items"] });
  };

  return (
    <section className="space-y-6">
      <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-background to-info/10 shadow-card">
        <div className="pointer-events-none absolute -right-10 top-0 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-8 top-1/2 size-32 rounded-full bg-info/10 blur-3xl" />
        <CardContent className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary">
                OneGrasp Work Space
              </Badge>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Plan, assign, move.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  A cleaner task space for the CRM team. Keep the board focused, switch views when
                  needed, and use the workspace settings to match how your team likes to work.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="gap-1.5 rounded-xl shadow-soft"
                onClick={() => {
                  setComposerOpen(true);
                  setEditingId(null);
                }}
              >
                <Plus className="size-4" />
                New task
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 rounded-xl bg-background/80"
                onClick={() => setViewMode(viewMode === "board" ? "list" : "board")}
              >
                {viewMode === "board" ? <Rows3 className="size-4" /> : <LayoutGrid className="size-4" />}
                {viewMode === "board" ? "Open agenda view" : "Open board view"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                Shared with the CRM team
              </span>
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                Status flow: To do &rarr; In progress &rarr; Review &rarr; Done
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroMetric
              title="All tasks"
              value={summary.total}
              hint="Everything currently tracked"
              icon={Target}
            />
            <HeroMetric
              title="Active now"
              value={summary.inProgress}
              hint="Tasks moving right now"
              icon={Clock3}
            />
            <HeroMetric
              title="Overdue"
              value={summary.overdue}
              hint="Needs attention today"
              icon={CalendarDays}
            />
            <HeroMetric
              title="Done this week"
              value={summary.doneThisWeek}
              hint="Recently completed work"
              icon={CheckCircle2}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/10 shadow-soft">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {editingId ? "Edit task" : "Task composer"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Keep the creation flow simple: title, owner, priority, due date, then details.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {editingId ? (
                <Badge variant="secondary" className="rounded-full">
                  Editing existing task
                </Badge>
              ) : null}
              <Button
                variant={showComposerPanel ? "secondary" : "outline"}
                className="rounded-xl"
                onClick={() => setComposerOpen((current) => !current)}
              >
                {showComposerPanel ? "Hide composer" : "Open composer"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {showComposerPanel ? (
            <div className="space-y-4 rounded-3xl border bg-gradient-to-br from-muted/40 via-background to-background p-5">
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
                <div className="space-y-2">
                  <Label htmlFor="ogw-title">Task title</Label>
                  <Input
                    id="ogw-title"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Example: Prepare conference outreach list"
                    className="rounded-xl bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ogw-assignee-name">Assigned to</Label>
                  <Input
                    id="ogw-assignee-name"
                    value={form.assigneeName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, assigneeName: event.target.value }))
                    }
                    placeholder="Team member name"
                    className="rounded-xl bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ogw-assignee-email">Assignee email</Label>
                  <Input
                    id="ogw-assignee-email"
                    type="email"
                    value={form.assigneeEmail}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, assigneeEmail: event.target.value }))
                    }
                    placeholder="Optional"
                    className="rounded-xl bg-background"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, status: value as TaskStatus }))
                    }
                  >
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getStatusMeta(form.status).hint}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, priority: value as TaskPriority }))
                    }
                  >
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ogw-due-date">Due date</Label>
                  <Input
                    id="ogw-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                    className="rounded-xl bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ogw-description">Task details</Label>
                <Textarea
                  id="ogw-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Add notes, links, expected output, blockers, or the next action needed."
                  className="min-h-28 rounded-2xl bg-background"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Tasks stay visible to everyone so ownership and movement remain clear.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={resetForm}>
                    {editingId ? "Cancel edit" : "Reset"}
                  </Button>
                  <Button className="gap-1.5 rounded-xl" onClick={saveTask}>
                    {editingId ? <Save className="size-4" /> : <Plus className="size-4" />}
                    {editingId ? "Save changes" : "Create task"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed bg-muted/20 px-5 py-10 text-center">
              <p className="text-sm font-medium">The composer is tucked away for a cleaner board.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open it whenever you want to add or update a task.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs
        value={viewMode}
        onValueChange={(value) => setViewMode(value as ViewMode)}
        className="space-y-4"
      >
        <Card className="overflow-hidden border-primary/10 shadow-soft">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Workspace settings</p>
                <p className="text-xs text-muted-foreground">
                  Simplify the view, narrow the board, and make the task space feel like your team.
                </p>
              </div>
              <TabsList className="h-10 rounded-xl border bg-background/80 p-1">
                <TabsTrigger value="board" className="gap-1.5 rounded-lg">
                  <LayoutGrid className="size-4" />
                  Board
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5 rounded-lg">
                  <Rows3 className="size-4" />
                  Agenda
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_190px_220px_auto_auto_auto]">
              <div className="space-y-2">
                <Label htmlFor="ogw-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ogw-search"
                    className="rounded-xl bg-background pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tasks, assignees, notes, creator"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}
                >
                  <SelectTrigger className="rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assignees</SelectItem>
                    {assigneeOptions.map((assignee) => (
                      <SelectItem key={assignee} value={assignee}>
                        {assignee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3">
                  <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
                  <Label className="text-sm">Show done</Label>
                </div>
              </div>

              <div className="flex items-end">
                <div className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3">
                  <Switch checked={compactCards} onCheckedChange={setCompactCards} />
                  <Label className="text-sm">Compact board</Label>
                </div>
              </div>

              <div className="flex items-end justify-end">
                <Button variant="outline" className="gap-1.5 rounded-xl" onClick={clearFilters}>
                  <SlidersHorizontal className="size-4" />
                  Reset filters
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full bg-background/80">
                {filteredTasks.length} matching tasks
              </Badge>
              <Badge variant="outline" className="rounded-full bg-background/80">
                {viewMode === "board" ? "Board view active" : "Agenda view active"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="board" className="mt-0">
          {isLoading ? (
            <Card className="shadow-soft">
              <CardContent className="py-16 text-center text-muted-foreground">
                Loading OneGrasp Work tasks...
              </CardContent>
            </Card>
          ) : filteredTasks.length ? (
            <div className="grid gap-4 xl:grid-cols-4">
              {STATUS_OPTIONS.map((option) => (
                <TaskLane
                  key={option.value}
                  compactCards={compactCards}
                  items={filteredTasks.filter((task) => task.status === option.value)}
                  onDelete={setDeleteId}
                  onEdit={startEditing}
                  onStatusChange={updateTaskStatus}
                  status={option.value}
                />
              ))}
            </div>
          ) : (
            <Card className="border-primary/10 bg-gradient-to-br from-primary/6 via-background to-info/6 shadow-soft">
              <CardContent className="py-16 text-center">
                <div className="mx-auto max-w-lg space-y-3">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="size-6" />
                  </div>
                  <h3 className="text-lg font-semibold">No tasks match this setup</h3>
                  <p className="text-sm text-muted-foreground">
                    Try resetting the workspace settings or create a fresh task to get the board
                    moving again.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button
                      className="gap-1.5 rounded-xl"
                      onClick={() => {
                        clearFilters();
                        setComposerOpen(true);
                      }}
                    >
                      <Plus className="size-4" />
                      Create task
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
                      Reset filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          {isLoading ? (
            <Card className="shadow-soft">
              <CardContent className="py-16 text-center text-muted-foreground">
                Loading OneGrasp Work tasks...
              </CardContent>
            </Card>
          ) : filteredTasks.length ? (
            <div className="space-y-3">
              {filteredTasks.map((item) => (
                <TaskListItem
                  key={item.id}
                  item={item}
                  onDelete={setDeleteId}
                  onEdit={startEditing}
                  onStatusChange={updateTaskStatus}
                />
              ))}
            </div>
          ) : (
            <Card className="border-primary/10 shadow-soft">
              <CardContent className="py-16 text-center text-muted-foreground">
                No tasks match the current filters yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected task from OneGrasp Work for everyone on the CRM team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
