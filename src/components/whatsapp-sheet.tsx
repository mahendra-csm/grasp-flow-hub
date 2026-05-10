import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, ExternalLink, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { draftWhatsAppMessage } from "@/lib/ai.functions";

type Lead = {
  full_name: string;
  phone?: string | null;
  whatsapp?: string | null;
  stage: string;
  service?: string | null;
  lastActivity?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: Lead;
  onSent: () => void;
};

function toWaNum(raw: string) {
  return raw.replace(/\D/g, "");
}

export function WhatsAppSheet({ open, onOpenChange, lead, onSent }: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const number = lead.whatsapp || lead.phone || "";
  const waNum = toWaNum(number);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await draftWhatsAppMessage({
        data: {
          name: lead.full_name,
          stage: lead.stage,
          service: lead.service,
          lastActivity: lead.lastActivity,
        },
      });
      setMessage(result);
    } catch (e: any) {
      toast.error("Could not draft message: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setMessage(""); generate(); }
  }, [open]);

  const openWhatsApp = () => {
    const url = `https://wa.me/${waNum}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    onSent();
  };

  const copyMsg = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Message copied");
    onSent();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <span className="text-green-500">●</span> WhatsApp Message
          </SheetTitle>
          <SheetDescription>
            Sending to <strong>{lead.full_name}</strong> · {number}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-4 mt-4 overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-green-500" />
              <span className="text-sm">AI is drafting your message…</span>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" /> AI Draft — edit freely
                </span>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type or generate a message…"
                  className="min-h-[160px] text-sm leading-relaxed resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length} chars
                </p>
              </div>

              {/* WhatsApp preview bubble */}
              {message && (
                <div className="bg-[#dcf8c6] dark:bg-green-900/40 rounded-2xl rounded-tl-none px-4 py-3 text-sm max-w-[85%] shadow-sm">
                  <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
                </div>
              )}

              <div className="space-y-2 mt-auto">
                <Button
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={openWhatsApp}
                  disabled={!message.trim() || !waNum}
                >
                  <ExternalLink className="size-4" /> Open in WhatsApp
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={copyMsg} disabled={!message.trim()} className="gap-1.5">
                    {copied ? <><Check className="size-3.5 text-green-500" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
                  </Button>
                  <Button variant="outline" onClick={generate} className="gap-1.5">
                    <RefreshCw className="size-3.5" /> Regenerate
                  </Button>
                </div>
                {!waNum && (
                  <p className="text-xs text-destructive text-center">
                    No phone number on this lead — add one to enable WhatsApp.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
