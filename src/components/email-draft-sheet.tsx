import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Copy, RefreshCw, Loader2, Check, ExternalLink, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { draftFollowUpEmail } from "@/lib/ai.functions";

type Lead = {
  id: string;
  full_name: string;
  email: string;
  stage: string;
  service?: string | null;
  notes?: string | null;
  lastActivity?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: Lead;
  onSent: () => void;
};

function useCopy(ms = 2000) {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), ms);
  };
  return { copied, copy };
}

export function EmailDraftSheet({ open, onOpenChange, lead, onSent }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { copied, copy } = useCopy();

  const generate = async () => {
    setLoading(true);
    setReady(false);
    try {
      const result = await draftFollowUpEmail({
        data: {
          name: lead.full_name,
          email: lead.email,
          stage: lead.stage,
          service: lead.service,
          notes: lead.notes,
          lastActivity: lead.lastActivity,
        },
      });
      setSubject(result.subject);
      setBody(result.body);
      setReady(true);
    } catch (e: any) {
      toast.error("Could not generate draft: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) generate();
    else { setReady(false); setSubject(""); setBody(""); }
  }, [open]);

  const openGmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
    onSent();
  };

  const openEmailApp = () => {
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onSent();
  };

  const copyAll = () => {
    copy(`To: ${lead.email}\nSubject: ${subject}\n\n${body}`);
    toast.success("Email copied to clipboard");
    onSent();
  };

  const firstName = lead.full_name.split(" ")[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI Follow-up Email
          </SheetTitle>
          <SheetDescription>
            Drafted for <strong>{firstName}</strong> — edit before sending.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm">Writing a personalised email…</p>
          </div>
        )}

        {ready && !loading && (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
            {/* To */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">To</span>
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/40 text-sm">
                <Mail className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{lead.full_name}</span>
                <Badge variant="outline" className="text-xs font-normal">{lead.email}</Badge>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Subject</span>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Message</span>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[220px] text-sm leading-relaxed resize-none"
              />
            </div>

            {/* Word count */}
            <p className="text-xs text-muted-foreground text-right">
              {body.split(/\s+/).filter(Boolean).length} words
            </p>

            {/* Send actions */}
            <div className="space-y-2 pt-1">
              <Button onClick={openGmail} className="w-full gap-2">
                <Mail className="size-3.5" /> Open in Gmail
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={openEmailApp} className="gap-1.5">
                  <ExternalLink className="size-3.5" /> Email app
                </Button>
                <Button variant="outline" onClick={copyAll} className="gap-1.5">
                  {copied
                    ? <><Check className="size-3.5 text-green-500" /> Copied!</>
                    : <><Copy className="size-3.5" /> Copy all</>
                  }
                </Button>
              </div>
            </div>

            {/* Regenerate */}
            <Button
              variant="ghost"
              size="sm"
              onClick={generate}
              className="w-full gap-1.5 text-muted-foreground"
            >
              <RefreshCw className="size-3.5" /> Regenerate draft
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
