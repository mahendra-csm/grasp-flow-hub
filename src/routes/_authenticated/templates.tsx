import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import {
  conferenceTemplates,
  PHASES,
  CHANNELS,
  type Channel,
  type Phase,
  type ConferenceTemplate,
} from "@/lib/conference-templates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Copy,
  Mail,
  MessageCircle,
  Star,
  Eye,
  Share2,
  CheckCheck,
  FileText,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "crm_template_favorites";

function getFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]));
}

/** Highlight {{variable}} placeholders in template body */
function BodyWithVars({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <span className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {parts.map((part, i) =>
        /^{{.+}}$/.test(part) ? (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          >
            <Hash className="size-2.5 shrink-0" />
            {part.slice(2, -2)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ── Phase badge colours ────────────────────────────────────────────────────

const phaseBadgeClass: Record<Phase, string> = {
  pre: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  during: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  post: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
};

const phaseLabel: Record<Phase, string> = {
  pre: "Pre-Event",
  during: "During",
  post: "Post-Event",
};

// ── TemplateCard ─────────────────────────────────────────────────────────────

interface TemplateCardProps {
  tpl: ConferenceTemplate;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onPreview: (tpl: ConferenceTemplate) => void;
}

function TemplateCard({ tpl, isFav, onToggleFav, onPreview }: TemplateCardProps) {
  const [copied, setCopied] = useState(false);

  const fullText = tpl.subject ? `Subject: ${tpl.subject}\n\n${tpl.body}` : tpl.body;

  const copy = useCallback(() => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Template copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [fullText]);

  const shareEmail = useCallback(() => {
    const subject = tpl.subject ?? tpl.title;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(tpl.body)}`;
    window.open(url, "_blank");
  }, [tpl]);

  const shareWhatsApp = useCallback(() => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(url, "_blank");
  }, [fullText]);

  const isEmail = tpl.channel === "email";
  const isWA = tpl.channel === "whatsapp";
  const isSocial = tpl.channel === "social";

  return (
    <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">{tpl.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.activity}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${phaseBadgeClass[tpl.phase]}`}
            >
              {phaseLabel[tpl.phase]}
            </Badge>
            <button
              onClick={() => onToggleFav(tpl.id)}
              className="size-7 inline-flex items-center justify-center rounded hover:bg-muted transition-colors"
              title={isFav ? "Remove from favourites" : "Add to favourites"}
            >
              <Star
                className={`size-3.5 ${isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </button>
          </div>
        </div>

        {/* Subject line for email */}
        {tpl.subject && (
          <div className="rounded bg-muted/60 px-2 py-1.5 text-xs">
            <span className="font-medium text-muted-foreground mr-1">Subject:</span>
            <span className="text-foreground">{tpl.subject}</span>
          </div>
        )}

        {/* Body preview */}
        <div className="rounded-md border bg-muted/30 p-3 max-h-36 overflow-hidden relative">
          <div className="line-clamp-5 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {tpl.body.slice(0, 280)}
            {tpl.body.length > 280 && "…"}
          </div>
          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-muted/60 to-transparent pointer-events-none" />
        </div>

        {/* Variable chips */}
        {tpl.variables.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tpl.variables.slice(0, 5).map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
              >
                <Hash className="size-2" />{v}
              </span>
            ))}
            {tpl.variables.length > 5 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{tpl.variables.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Char count for WhatsApp */}
        {isWA && (
          <p className="text-[10px] text-muted-foreground">
            {tpl.body.length} characters
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 mt-auto pt-1 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 h-8 text-xs"
            onClick={() => onPreview(tpl)}
          >
            <Eye className="size-3.5" />
            Preview
          </Button>
          <Button
            size="sm"
            variant={copied ? "default" : "outline"}
            className={`flex-1 gap-1.5 h-8 text-xs ${copied ? "bg-green-600 hover:bg-green-600 text-white border-green-600" : ""}`}
            onClick={copy}
          >
            {copied ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          {(isEmail || isSocial) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 shrink-0"
              title="Share via Email"
              onClick={shareEmail}
            >
              <Mail className="size-3.5" />
            </Button>
          )}
          {(isWA || isSocial) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 shrink-0 text-green-600 border-green-300 hover:bg-green-50"
              title="Share via WhatsApp"
              onClick={shareWhatsApp}
            >
              <MessageCircle className="size-3.5" />
            </Button>
          )}
          {isEmail && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 shrink-0 text-green-600 border-green-300 hover:bg-green-50"
              title="Share via WhatsApp"
              onClick={shareWhatsApp}
            >
              <MessageCircle className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── PreviewModal ──────────────────────────────────────────────────────────────

function PreviewModal({
  tpl,
  onClose,
}: {
  tpl: ConferenceTemplate | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!tpl) return null;

  const fullText = tpl.subject ? `Subject: ${tpl.subject}\n\n${tpl.body}` : tpl.body;

  const copy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Template copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareEmail = () => {
    const subject = tpl.subject ?? tpl.title;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(tpl.body)}`, "_blank");
  };

  const shareWA = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, "_blank");
  };

  return (
    <Dialog open={!!tpl} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{tpl.title}</span>
            <Badge variant="outline" className={`text-[10px] ${phaseBadgeClass[tpl.phase]}`}>
              {phaseLabel[tpl.phase]}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {tpl.channel === "email" ? "Email" : tpl.channel === "whatsapp" ? "WhatsApp" : "Social Media"}
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{tpl.activity}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {tpl.subject && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Subject Line</p>
              <p className="text-sm font-medium">{tpl.subject}</p>
            </div>
          )}

          <div className="rounded-md border bg-muted/20 p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Message Body</p>
            <BodyWithVars text={tpl.body} />
          </div>

          {tpl.variables.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                <Hash className="size-3" />
                Variables to Replace ({tpl.variables.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tpl.variables.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-mono text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tpl.channel === "whatsapp" && (
            <p className="text-xs text-muted-foreground">
              Character count: <strong>{tpl.body.length}</strong>
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 pt-3 border-t mt-2">
          <Button
            variant={copied ? "default" : "outline"}
            className={`flex-1 gap-2 ${copied ? "bg-green-600 hover:bg-green-600 text-white" : ""}`}
            onClick={copy}
          >
            {copied ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied!" : "Copy Template"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={shareEmail} title="Share via Email">
            <Mail className="size-4" />
            Email
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
            onClick={shareWA}
            title="Share via WhatsApp"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── TemplatesPage ─────────────────────────────────────────────────────────────

function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [phase, setPhase] = useState<Phase>("pre");
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(getFavorites);
  const [previewTpl, setPreviewTpl] = useState<ConferenceTemplate | null>(null);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return conferenceTemplates.filter((t) => {
      if (t.channel !== channel) return false;
      if (!showFavsOnly && t.phase !== phase) return false;
      if (showFavsOnly && !favorites.has(t.id)) return false;
      if (q) {
        return (
          t.title.toLowerCase().includes(q) ||
          t.activity.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          (t.subject?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [channel, phase, search, showFavsOnly, favorites]);

  const totalByChannel = (ch: Channel) =>
    conferenceTemplates.filter((t) => t.channel === ch).length;

  const countByPhase = (ch: Channel, ph: Phase) =>
    conferenceTemplates.filter((t) => t.channel === ch && t.phase === ph).length;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Ready-to-use communication templates for every stage of your conference.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 w-64 text-sm"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant={showFavsOnly ? "default" : "outline"}
            className={`gap-1.5 h-9 ${showFavsOnly ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : ""}`}
            onClick={() => setShowFavsOnly((v) => !v)}
          >
            <Star className={`size-3.5 ${showFavsOnly ? "fill-white" : ""}`} />
            Favourites
            {favorites.size > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${showFavsOnly ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                {favorites.size}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Category: Conferences */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <FileText className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Conferences</span>
          <Badge variant="secondary" className="text-[10px]">
            {conferenceTemplates.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">More categories coming soon</span>
      </div>

      {/* Channel Tabs */}
      <Tabs value={channel} onValueChange={(v) => { setChannel(v as Channel); setPhase("pre"); }}>
        <TabsList className="h-10">
          {CHANNELS.map((ch) => (
            <TabsTrigger key={ch.value} value={ch.value} className="gap-1.5 text-xs">
              {ch.value === "email" && <Mail className="size-3.5" />}
              {ch.value === "whatsapp" && <MessageCircle className="size-3.5" />}
              {ch.value === "social" && <Share2 className="size-3.5" />}
              {ch.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                {totalByChannel(ch.value)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CHANNELS.map((ch) => (
          <TabsContent key={ch.value} value={ch.value} className="space-y-4 mt-4">
            {!showFavsOnly && (
              /* Phase sub-tabs */
              <div className="flex gap-2 flex-wrap">
                {PHASES.map((ph) => {
                  const cnt = countByPhase(ch.value, ph.value);
                  const active = phase === ph.value;
                  return (
                    <button
                      key={ph.value}
                      onClick={() => setPhase(ph.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? ph.value === "pre"
                            ? "bg-blue-600 text-white border-blue-600"
                            : ph.value === "during"
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-purple-600 text-white border-purple-600"
                          : "bg-card hover:bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      {ph.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          active ? "bg-white/20 text-inherit" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Results */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <FileText className="size-10 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="font-medium text-sm">No templates found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {search ? `No results for "${search}"` : showFavsOnly ? "No favourites yet — star some templates!" : "No templates in this section yet."}
                  </p>
                </div>
                {search && (
                  <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {filtered.length} template{filtered.length !== 1 ? "s" : ""}
                  {search ? ` matching "${search}"` : ""}
                  {showFavsOnly ? " in favourites" : ""}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((t) => (
                    <TemplateCard
                      key={t.id}
                      tpl={t}
                      isFav={favorites.has(t.id)}
                      onToggleFav={toggleFav}
                      onPreview={setPreviewTpl}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <PreviewModal tpl={previewTpl} onClose={() => setPreviewTpl(null)} />
    </div>
  );
}
