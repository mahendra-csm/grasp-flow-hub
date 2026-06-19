import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isBefore, startOfDay, subDays } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  Save,
  Search,
  Target,
  Trash2,
  UserSquare2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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

type OneGraspWorkItem = Tables<"onegrasp_work_items">;
type OneGraspWorkItemInsert = TablesInsert<"onegrasp_work_items">;
type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

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
}> = [
  {
    value: "todo",
    label: "To do",
    hint: "Planned work waiting to start",
    boardDescription: "Tasks ready for pickup",
  },
  {
    value: "in_progress",
    label: "In progress",
    hint: "Actively being worked on",
    boardDescription: "Current execution",
  },
  {
    value: "review",
    label: "Review",
    hint: "Needs checking or confirmation",
    boardDescription: "Waiting for sign-off",
  },
  {
    value: "done",
    label: "Done",
    hint: "Finished items",
    boardDescription: "Completed work",
  },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/10 text-info border-info/20",
  high: "bg-warning/10 text-warning-foreground border-warning/20",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  review: "bg-warning/10 text-warning-foreground border-warning/20",
  done: "bg-success/10 text-success border-success/20",
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

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function getPriorityLabel(priority: string) {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority;
}

function isTaskOverdue(item: OneGraspWorkItem) {
  if (!item.due_date || item.status === "done") return false;
  return isBefore(startOfDay(new Date(item.due_date)), startOfDay(new Date()));
}

function BoardSummaryCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: typeof CalendarDays;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1.5 text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskLane({
  status,
  items,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  status: TaskStatus;
  items: OneGraspWorkItem[];
  onEdit: (item: OneGraspWorkItem) => void;
  onDelete: (itemId: string) => void;
  onStatusChange: (item: OneGraspWorkItem, nextStatus: TaskStatus) => void;
}) {
  const statusMeta = STATUS_OPTIONS.find((option) => option.value === status)!;

  return (
    <Card className="overflow-hidden shadow-soft">
      <CardHeader className="border-b bg-muted/20 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{statusMeta.label}</CardTitle>
            <p className="text-xs text-muted-foreground">{statusMeta.boardDescription}</p>
          </div>
          <Badge variant="outline">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "space-y-3 rounded-xl border bg-card p-4 transition",
                isTaskOverdue(item) && "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.description?.trim() ? item.description : "No extra details added yet."}
                  </p>
                </div>
                <Badge className={PRIORITY_BADGE_CLASS[item.priority as TaskPriority]}>
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
                      "gap-1.5 rounded-full",
                      isTaskOverdue(item) &&
                        "border-destructive/30 text-destructive bg-destructive/5",
                    )}
                  >
                    <CalendarDays className="size-3.5" />
                    Due {format(new Date(item.due_date), "MMM d")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full">
                    No due date
                  </Badge>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Select
                  value={item.status}
                  onValueChange={(value) => onStatusChange(item, value as TaskStatus)}
                >
                  <SelectTrigger className="h-9">
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
                    className="size-8"
                    onClick={() => onEdit(item)}
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
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
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No tasks in {statusMeta.label.toLowerCase()}.
          </div>
        )}
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

  const filteredTasks = tasks.filter((task) => {
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
  };

  const startEditing = (task: OneGraspWorkItem) => {
    setEditingId(task.id);
    setForm(buildTaskFormState(task));
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    resetForm();
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BoardSummaryCard
          title="All tasks"
          value={summary.total}
          hint="Everything currently tracked in OneGrasp Work"
          icon={Target}
        />
        <BoardSummaryCard
          title="In progress"
          value={summary.inProgress}
          hint="Active work being moved right now"
          icon={Clock3}
        />
        <BoardSummaryCard
          title="Overdue"
          value={summary.overdue}
          hint="Tasks whose due date has already passed"
          icon={CalendarDays}
        />
        <BoardSummaryCard
          title="Done this week"
          value={summary.doneThisWeek}
          hint="Completed in the last 7 days"
          icon={CheckCircle2}
        />
      </div>

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {editingId ? "Update task" : "Create task"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Track what needs doing, who owns it, and how far it has moved.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={editingId ? "secondary" : "outline"}>
                {editingId ? "Editing existing task" : "New task"}
              </Badge>
              <Badge variant="outline">{user?.email ?? "Authenticated user"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <SelectTrigger>
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
                {STATUS_OPTIONS.find((option) => option.value === form.status)?.hint}
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
                <SelectTrigger>
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
              className="min-h-28"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Tasks are shared across the CRM team so everyone can see ownership and progress.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetForm}>
                {editingId ? "Cancel edit" : "Reset"}
              </Button>
              <Button onClick={saveTask} className="gap-1.5">
                {editingId ? <Save className="size-4" /> : <Plus className="size-4" />}
                {editingId ? "Save changes" : "Create task"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Team board</CardTitle>
              <p className="text-xs text-muted-foreground">
                Search, filter, and move tasks between To do, In progress, Review, and Done.
              </p>
            </div>
            <Badge variant="outline">{filteredTasks.length} matching tasks</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_220px]">
            <div className="space-y-2">
              <Label htmlFor="ogw-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ogw-search"
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by task, assignee, creator, priority, or status"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}
              >
                <SelectTrigger>
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
                <SelectTrigger>
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
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {STATUS_OPTIONS.map((option) => (
              <TaskLane
                key={option.value}
                status={option.value}
                items={filteredTasks.filter((task) => task.status === option.value)}
                onEdit={startEditing}
                onDelete={setDeleteId}
                onStatusChange={updateTaskStatus}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Task register</CardTitle>
            <p className="text-xs text-muted-foreground">
              Spreadsheet-like list for quick scanning, sorting mentally, and editing tasks.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Task</TableHead>
                  <TableHead className="min-w-[160px]">Assigned to</TableHead>
                  <TableHead className="min-w-[110px]">Status</TableHead>
                  <TableHead className="min-w-[110px]">Priority</TableHead>
                  <TableHead className="min-w-[120px]">Due</TableHead>
                  <TableHead className="min-w-[160px]">Created by</TableHead>
                  <TableHead className="min-w-[120px]">Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      Loading OneGrasp Work tasks...
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length ? (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id} className="align-top">
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.description?.trim() ? task.description : "No extra details"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{task.assignee_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.assignee_email ?? "No email added"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE_CLASS[task.status as TaskStatus]}>
                          {getStatusLabel(task.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_BADGE_CLASS[task.priority as TaskPriority]}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <div className="space-y-1">
                            <p
                              className={cn(
                                "text-sm",
                                isTaskOverdue(task) && "font-medium text-destructive",
                              )}
                            >
                              {format(new Date(task.due_date), "MMM d, yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isTaskOverdue(task) ? "Overdue" : "On track"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.created_by_email ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => startEditing(task)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            onClick={() => setDeleteId(task.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      No tasks match the current filters yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
