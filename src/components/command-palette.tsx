import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Briefcase,
  BarChart3,
  FileText,
  Settings,
  LayoutTemplate,
  CalendarDays,
  ClipboardList,
  Plus,
  Upload,
  Mic,
  Moon,
  Sun,
  Monitor,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";

type LeadOption = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
};

const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { label: "Leads", to: "/leads", icon: Users, keywords: "contacts customers" },
  { label: "Conferences", to: "/conferences", icon: CalendarDays, keywords: "events" },
  {
    label: "Work Tracker",
    to: "/work-tracker",
    icon: ClipboardList,
    keywords: "daily work excel tracker productivity",
  },
  { label: "Pipeline", to: "/pipeline", icon: KanbanSquare, keywords: "kanban board stages" },
  { label: "Services", to: "/services", icon: Briefcase, keywords: "offerings products" },
  { label: "Analytics", to: "/analytics", icon: BarChart3, keywords: "reports stats" },
  { label: "Documents", to: "/documents", icon: FileText, keywords: "files" },
  { label: "Templates", to: "/templates", icon: LayoutTemplate, keywords: "email whatsapp" },
  {
    label: "Settings",
    to: "/settings",
    icon: Settings,
    keywords: "preferences config integrations",
  },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: leads } = useQuery<LeadOption[]>({
    queryKey: ["palette-leads"],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, full_name, email, phone, stage")
        .order("updated_at", { ascending: false })
        .limit(50);
      return (data ?? []) as LeadOption[];
    },
  });

  const run = (fn: () => void) => {
    setOpen(false);
    setSearch("");
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search leads, jump to pages, run actions…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.to}
              value={`${item.label} ${item.keywords}`}
              onSelect={() => run(() => navigate({ to: item.to }))}
            >
              <item.icon />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="new lead create add"
            onSelect={() =>
              run(() => {
                navigate({ to: "/leads" });
                window.dispatchEvent(new CustomEvent("crm:new-lead"));
              })
            }
          >
            <Plus />
            <span>New lead</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="import leads upload csv xlsx"
            onSelect={() =>
              run(() => {
                navigate({ to: "/leads" });
                window.dispatchEvent(new CustomEvent("crm:import-leads"));
              })
            }
          >
            <Upload />
            <span>Import leads</span>
          </CommandItem>
          <CommandItem
            value="voice lead dictate"
            onSelect={() =>
              run(() => {
                navigate({ to: "/leads" });
                window.dispatchEvent(new CustomEvent("crm:voice-lead"));
              })
            }
          >
            <Mic />
            <span>Voice lead</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem value="theme light mode" onSelect={() => run(() => setTheme("light"))}>
            <Sun />
            <span>Switch to light mode</span>
          </CommandItem>
          <CommandItem value="theme dark mode" onSelect={() => run(() => setTheme("dark"))}>
            <Moon />
            <span>Switch to dark mode</span>
          </CommandItem>
          <CommandItem value="theme system auto" onSelect={() => run(() => setTheme("system"))}>
            <Monitor />
            <span>Use system theme</span>
          </CommandItem>
        </CommandGroup>

        {leads && leads.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Leads">
              {leads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={`${lead.full_name} ${lead.email ?? ""} ${lead.phone ?? ""}`}
                  onSelect={() =>
                    run(() => navigate({ to: "/leads/$id", params: { id: lead.id } }))
                  }
                >
                  <UserIcon />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{lead.full_name}</span>
                    {(lead.email || lead.phone) && (
                      <span className="text-xs text-muted-foreground truncate">
                        {lead.email ?? lead.phone}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
