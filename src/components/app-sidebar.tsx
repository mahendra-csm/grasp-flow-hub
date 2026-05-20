import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, KanbanSquare, Briefcase, BarChart3,
  FileText, Settings, LogOut, LayoutTemplate,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Services", url: "/services", icon: Briefcase },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Templates", url: "/templates", icon: LayoutTemplate },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const isActive = (u: string) => path === u || path.startsWith(u + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <img
            src="https://onegrasp.com/wp-content/uploads/2026/05/logo.png"
            alt="OneGrasp"
            className="h-8 w-auto shrink-0 object-contain"
          />
          {!collapsed && (
            <span className="text-[10px] text-muted-foreground leading-tight">CRM Admin</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="size-8 shrink-0 rounded-full bg-secondary grid place-items-center text-xs font-semibold text-secondary-foreground">
            {user?.email?.[0]?.toUpperCase() ?? "A"}
          </div>
          {!collapsed && (
            <>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-medium truncate">{user?.email}</span>
                <span className="text-[10px] text-muted-foreground">Admin</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => signOut()} className="size-7">
                <LogOut className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
