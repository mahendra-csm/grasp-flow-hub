import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askAI } from "@/lib/ai.functions";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "How should I prioritize my leads today?",
  "What's the best follow-up strategy for cold leads?",
  "Tips to improve my pipeline conversion rate?",
  "How to re-engage a lost lead?",
];

export function AIPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (message: string) => {
    const text = message.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await askAI({ data: { message: text } });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I ran into an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span className="hidden sm:inline">AI Assistant</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI Assistant
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                Powered by Groq
              </span>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="Clear conversation"
                onClick={() => setMessages([])}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="py-4">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-4">
                  Ask me anything about your leads, pipeline, or sales strategy.
                </p>
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="w-full text-left text-sm px-3 py-2.5 rounded-lg border hover:bg-muted/60 hover:border-primary/30 transition flex items-start gap-2"
                  >
                    <Zap className="size-3.5 text-primary shrink-0 mt-0.5" />
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-4 py-3 flex gap-2 items-end">
          <Textarea
            placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            rows={1}
            className="resize-none min-h-[40px] max-h-32 py-2 text-sm"
          />
          <Button
            size="icon"
            className="shrink-0"
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
