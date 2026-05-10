import { type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AIPanel } from "@/components/ai-panel";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <img src="https://onegrasp.com/wp-content/uploads/2026/05/logo.png" alt="OneGrasp" className="h-6 w-auto object-contain hidden sm:block" />
            </div>
            <AIPanel />
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
