import { type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AIPanel } from "@/components/ai-panel";
import { CommandPalette } from "@/components/command-palette";
import { Search } from "lucide-react";

function CommandHint() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
        );
      }}
      className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-md border bg-muted/30 hover:bg-muted text-xs text-muted-foreground transition"
      aria-label="Open command palette"
    >
      <Search className="size-3.5" />
      <span>Search…</span>
      <kbd className="ml-2 hidden md:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">
        Ctrl K
      </kbd>
    </button>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <CommandPalette />
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <img src="https://onegrasp.com/wp-content/uploads/2026/05/logo.png" alt="OneGrasp" className="h-6 w-auto object-contain hidden sm:block" />
            </div>
            <div className="flex items-center gap-2">
              <CommandHint />
              <AIPanel />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
