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
  Hash,
  CalendarClock,
  PlayCircle,
  CheckCircle2,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

// ── Persistence ───────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const phaseConfig: Record<Phase, { label: string; icon: React.ElementType; color: string; dot: string }> = {
  pre:    { label: "Pre-Event",    icon: CalendarClock,  color: "text-blue-600",   dot: "bg-blue-500" },
  during: { label: "During Event", icon: PlayCircle,     color: "text-emerald-600", dot: "bg-emerald-500" },
  post:   { label: "Post-Event",   icon: CheckCircle2,   color: "text-violet-600", dot: "bg-violet-500" },
};

const channelConfig: Record<Channel, { label: string; icon: React.ElementType }> = {
  email:    { label: "Email",        icon: Mail },
  whatsapp: { label: "WhatsApp",     icon: MessageCircle },
  social:   { label: "Social Media", icon: Share2 },
};

// ── BodyWithVars ──────────────────────────────────────────────────────────────

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

// ── PreviewModal ──────────────────────────────────────────────────────────────

function PreviewModal({ tpl, onClose }: { tpl: ConferenceTemplate | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!tpl) return null;

  const fullText = tpl.subject ? `Subject: ${tpl.subject}\n\n${tpl.body}` : tpl.body;
  const phase = phaseConfig[tpl.phase];
  const PhaseIcon = phase.icon;

  const copy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!tpl} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Modal header */}
        <div className="px-6 py-4 border-b shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${phase.color}`}>
                <PhaseIcon className="size-3.5" />
                {phase.label}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">{tpl.activity}</span>
            </div>
            <DialogTitle className="text-base mt-1">{tpl.title}</DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {tpl.subject && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Subject</p>
              <p className="text-sm font-medium rounded-md bg-muted/50 border px-3 py-2">{tpl.subject}</p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Message</p>
            <div className="rounded-md border bg-muted/20 px-4 py-3">
              <BodyWithVars text={tpl.body} />
            </div>
          </div>

          {tpl.variables.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Fill in these variables
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tpl.variables.map((v) => (
                  <code
                    key={v}
                    className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          {tpl.channel === "whatsapp" && (
            <p className="text-xs text-muted-foreground">
              {tpl.body.length} characters
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center gap-2">
          <Button
            className={`flex-1 gap-2 ${copied ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}`}
            variant={copied ? "default" : "default"}
            onClick={copy}
          >
            {copied ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied!" : "Copy Template"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => window.open(`mailto:?subject=${encodeURIComponent(tpl.subject ?? tpl.title)}&body=${encodeURIComponent(tpl.body)}`, "_blank")}>
            <Mail className="size-4" />
            Email
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, "_blank")}
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── TemplateCard ──────────────────────────────────────────────────────────────

function TemplateCard({
  tpl,
  isFav,
  onToggleFav,
  onPreview,
}: {
  tpl: ConferenceTemplate;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onPreview: (tpl: ConferenceTemplate) => void;
}) {
  const [copied, setCopied] = useState(false);

  const fullText = tpl.subject ? `Subject: ${tpl.subject}\n\n${tpl.body}` : tpl.body;

  const copy = useCallback(() => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [fullText]);

  const shareEmail = useCallback(() => {
    window.open(`mailto:?subject=${encodeURIComponent(tpl.subject ?? tpl.title)}&body=${encodeURIComponent(tpl.body)}`, "_blank");
  }, [tpl]);

  const shareWA = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, "_blank");
  }, [fullText]);

  return (
    <div className="group flex flex-col rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-150">
      {/* Card top */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug">{tpl.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.activity}</p>
        </div>
        <button
          onClick={() => onToggleFav(tpl.id)}
          className="shrink-0 size-7 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        >
          <Star className={`size-3.5 transition-colors ${isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 group-hover:text-muted-foreground"}`} />
        </button>
      </div>

      {/* Subject pill for email */}
      {tpl.subject && (
        <div className="mx-4 mb-2 rounded-md bg-muted/50 px-2.5 py-1.5">
          <p className="text-[11px] text-muted-foreground truncate">
            <span className="font-semibold">Subj: </span>{tpl.subject}
          </p>
        </div>
      )}

      {/* Body preview */}
      <div className="flex-1 px-4 pb-3">
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {tpl.body.replace(/{{[^}]+}}/g, "…")}
        </p>
      </div>

      {/* Divider + actions */}
      <div className="border-t px-4 py-2.5 flex items-center gap-1.5">
        <button
          onClick={() => onPreview(tpl)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Eye className="size-3.5" />
          View
        </button>

        <button
          onClick={copy}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            copied
              ? "bg-emerald-100 text-emerald-700"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {copied ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={shareEmail}
            title="Share via Email"
            className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Mail className="size-3.5" />
          </button>
          <button
            onClick={shareWA}
            title="Share via WhatsApp"
            className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
          >
            <MessageCircle className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TemplatesPage ─────────────────────────────────────────────────────────────

function TemplatesPage() {
  const [search, setSearch]           = useState("");
  const [channel, setChannel]         = useState<Channel>("email");
  const [phase, setPhase]             = useState<Phase>("pre");
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [favorites, setFavorites]     = useState<Set<string>>(getFavorites);
  const [previewTpl, setPreviewTpl]   = useState<ConferenceTemplate | null>(null);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return conferenceTemplates.filter((t) => {
      if (t.channel !== channel) return false;
      if (showFavsOnly) {
        if (!favorites.has(t.id)) return false;
      } else {
        if (t.phase !== phase) return false;
      }
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.activity.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        (t.subject?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [channel, phase, search, showFavsOnly, favorites]);

  const count = (ch: Channel, ph?: Phase) =>
    conferenceTemplates.filter((t) => t.channel === ch && (!ph || t.phase === ph)).length;

  const favCount = conferenceTemplates.filter((t) => t.channel === channel && favorites.has(t.id)).length;

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto gap-0">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ready-to-use messages for every stage of your conference.
          </p>
        </div>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9 w-56 text-sm"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex gap-5 min-h-0">
        {/* Left nav */}
        <aside className="w-52 shrink-0 space-y-1">
          {/* Category label */}
          <div className="flex items-center gap-2 px-2 py-1 mb-2">
            <LayoutTemplate className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conferences</span>
          </div>

          {/* Phase items */}
          {PHASES.map((ph) => {
            const cfg = phaseConfig[ph.value];
            const Icon = cfg.icon;
            const isActive = !showFavsOnly && phase === ph.value;
            const cnt = count(channel, ph.value);
            return (
              <button
                key={ph.value}
                onClick={() => { setPhase(ph.value); setShowFavsOnly(false); }}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? "text-primary-foreground" : cfg.color}`} />
                <span className="flex-1 truncate">{cfg.label}</span>
                <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-semibold ${
                  isActive ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {cnt}
                </span>
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-3 border-t" />

          {/* Favourites */}
          <button
            onClick={() => setShowFavsOnly((v) => !v)}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left ${
              showFavsOnly
                ? "bg-amber-50 text-amber-700 font-medium border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Star className={`size-4 shrink-0 ${showFavsOnly ? "fill-amber-500 text-amber-500" : "text-amber-400"}`} />
            <span className="flex-1">Favourites</span>
            {favorites.size > 0 && (
              <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-semibold ${
                showFavsOnly ? "bg-amber-200 text-amber-700" : "bg-muted text-muted-foreground"
              }`}>
                {favorites.size}
              </span>
            )}
          </button>
        </aside>

        {/* Right content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Channel selector */}
          <div className="flex items-center gap-1 border-b pb-3">
            {CHANNELS.map((ch) => {
              const Icon = channelConfig[ch.value].icon;
              const isActive = channel === ch.value;
              return (
                <button
                  key={ch.value}
                  onClick={() => { setChannel(ch.value as Channel); setPhase("pre"); }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {ch.label}
                  <span className="text-[10px] text-muted-foreground">
                    {count(ch.value)}
                  </span>
                </button>
              );
            })}

            {/* Fav count badge in channel row */}
            {favCount > 0 && showFavsOnly && (
              <span className="ml-auto text-xs text-muted-foreground">
                {favCount} favourite{favCount !== 1 ? "s" : ""} in {channelConfig[channel].label}
              </span>
            )}
          </div>

          {/* Section heading */}
          {!showFavsOnly && (
            <div className="flex items-center gap-2">
              {(() => {
                const cfg = phaseConfig[phase];
                const Icon = cfg.icon;
                return (
                  <>
                    <span className={`size-2 rounded-full ${cfg.dot}`} />
                    <Icon className={`size-4 ${cfg.color}`} />
                    <h2 className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</h2>
                    <span className="text-xs text-muted-foreground">— {channelConfig[channel].label} templates</span>
                  </>
                );
              })()}
            </div>
          )}

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Star className="size-8 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">
                {search
                  ? `No templates match "${search}"`
                  : showFavsOnly
                  ? "No favourites yet"
                  : "No templates here yet"}
              </p>
              {(search || showFavsOnly) && (
                <button
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => { setSearch(""); setShowFavsOnly(false); }}
                >
                  {search ? "Clear search" : "Browse all templates"}
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
          )}
        </div>
      </div>

      <PreviewModal tpl={previewTpl} onClose={() => setPreviewTpl(null)} />
    </div>
  );
}
