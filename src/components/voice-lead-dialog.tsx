import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseLeadsFromText } from "@/lib/ai.functions";

type ParsedLead = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  country?: string | null;
  source?: string | null;
  notes?: string | null;
};

type Props = { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void };

const hasSpeechAPI = typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export function VoiceLeadDialog({ open, onOpenChange, onDone }: Props) {
  const [step, setStep] = useState<"record" | "parsing" | "review" | "saving" | "done">("record");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [lead, setLead] = useState<ParsedLead | null>(null);
  const recognitionRef = useRef<any>(null);

  const reset = () => {
    setStep("record");
    setRecording(false);
    setTranscript("");
    setInterimText("");
    setLead(null);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported in this browser"); return; }

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    let final = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { final += t + " "; }
        else { interim = t; }
      }
      setTranscript(final);
      setInterimText(interim);
    };

    r.onerror = (e: any) => {
      if (e.error !== "no-speech") toast.error("Microphone error: " + e.error);
    };

    r.onend = () => {
      setRecording(false);
      setInterimText("");
    };

    r.start();
    recognitionRef.current = r;
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const parseTranscript = async () => {
    const text = transcript.trim();
    if (!text) { toast.error("No speech detected — try again"); return; }

    setStep("parsing");
    try {
      const results = await parseLeadsFromText({ data: { text } });
      if (!results.length) throw new Error("Could not extract lead details");
      setLead(results[0] as ParsedLead);
      setStep("review");
    } catch (e: any) {
      toast.error("Parse failed: " + e.message);
      setStep("record");
    }
  };

  const saveLead = async () => {
    if (!lead) return;
    setStep("saving");
    const { error } = await supabase.from("leads").insert({
      full_name: lead.full_name,
      email: lead.email || null,
      phone: lead.phone || null,
      whatsapp: lead.whatsapp || null,
      city: lead.city || null,
      country: lead.country || null,
      source: lead.source || "Voice",
      notes: lead.notes ? `${lead.notes}\n\n[Created via voice note]` : "[Created via voice note]",
      stage: "new",
      priority: "medium",
      custom_data: { webhook_source: "voice" },
    });
    if (error) { toast.error(error.message); setStep("review"); return; }
    toast.success("Lead created!");
    setStep("done");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="size-4 text-primary" /> Voice to Lead
          </DialogTitle>
          <DialogDescription>
            Speak naturally — AI extracts the lead details for you.
          </DialogDescription>
        </DialogHeader>

        {/* STEP: Record */}
        {step === "record" && (
          <div className="space-y-4">
            {hasSpeechAPI ? (
              <>
                <div className="flex flex-col items-center gap-4 py-4">
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`size-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      recording
                        ? "bg-red-500 hover:bg-red-600 animate-pulse scale-110"
                        : "bg-primary hover:bg-primary/90"
                    }`}
                  >
                    {recording
                      ? <MicOff className="size-8 text-white" />
                      : <Mic className="size-8 text-white" />
                    }
                  </button>
                  <p className="text-sm text-muted-foreground text-center">
                    {recording
                      ? "Listening… tap to stop"
                      : "Tap the mic and say something like:\n\"New lead, Ahmed Ali, +971 50 123 4567, interested in visa service\""
                    }
                  </p>
                  {recording && (
                    <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                      <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                      Recording
                    </div>
                  )}
                </div>

                {(transcript || interimText) && (
                  <div className="bg-muted/40 rounded-lg p-3 text-sm leading-relaxed min-h-[60px]">
                    <span>{transcript}</span>
                    <span className="text-muted-foreground italic">{interimText}</span>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  {transcript && (
                    <Button variant="outline" size="sm" onClick={() => { setTranscript(""); setInterimText(""); }}>
                      <RotateCcw className="size-3.5 mr-1" /> Clear
                    </Button>
                  )}
                  <Button
                    onClick={parseTranscript}
                    disabled={recording || !transcript.trim()}
                  >
                    Extract lead details →
                  </Button>
                </div>
              </>
            ) : (
              /* Fallback for browsers without Speech API */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your browser doesn't support voice input. Type the lead info below and AI will extract the details.
                </p>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="e.g. Ahmed Ali, ahmed@example.com, +971501234567, interested in visa service, from Dubai"
                  className="min-h-[100px]"
                />
                <div className="flex justify-end">
                  <Button onClick={parseTranscript} disabled={!transcript.trim()}>
                    Extract lead details →
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: Parsing */}
        {step === "parsing" && (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm">AI is extracting lead details…</p>
          </div>
        )}

        {/* STEP: Review */}
        {step === "review" && lead && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Review and edit before saving.</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name *" value={lead.full_name} onChange={(v) => setLead({ ...lead, full_name: v })} />
              <Field label="Email" value={lead.email ?? ""} onChange={(v) => setLead({ ...lead, email: v || null })} />
              <Field label="Phone" value={lead.phone ?? ""} onChange={(v) => setLead({ ...lead, phone: v || null })} />
              <Field label="WhatsApp" value={lead.whatsapp ?? ""} onChange={(v) => setLead({ ...lead, whatsapp: v || null })} />
              <Field label="City" value={lead.city ?? ""} onChange={(v) => setLead({ ...lead, city: v || null })} />
              <Field label="Country" value={lead.country ?? ""} onChange={(v) => setLead({ ...lead, country: v || null })} />
            </div>
            <Field label="Notes" value={lead.notes ?? ""} onChange={(v) => setLead({ ...lead, notes: v || null })} />
            <div className="flex gap-2 justify-between pt-1">
              <Button variant="outline" onClick={() => setStep("record")} className="gap-1.5">
                <RotateCcw className="size-3.5" /> Re-record
              </Button>
              <Button onClick={saveLead} disabled={!lead.full_name}>
                Create lead
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Saving */}
        {step === "saving" && (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm">Saving lead…</p>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="size-12 text-green-500" />
            <p className="font-semibold">Lead created!</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Add another</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}
