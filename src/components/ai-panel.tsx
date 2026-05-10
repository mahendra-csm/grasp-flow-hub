import { useState } from "react";
import { Sparkles, Send, Wand2, Search, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

export function AIPanel() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span className="hidden sm:inline">AI Assistant</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI Assistant
            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {[
            { icon: Wand2, title: "Summarize this lead", desc: "Get a 3-line snapshot of any lead." },
            { icon: ListChecks, title: "Suggest next follow-up", desc: "AI recommends the best next action." },
            { icon: Search, title: "Smart search", desc: 'Ask "show me all hot study-abroad leads from India".' },
          ].map((s) => (
            <div key={s.title} className="rounded-lg border p-3 hover:bg-muted/50 transition cursor-pointer">
              <div className="flex items-start gap-2">
                <s.icon className="size-4 text-primary mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 flex gap-2">
          <Input placeholder="Ask anything…" disabled />
          <Button size="icon" disabled><Send className="size-4" /></Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
