import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  Sparkles, Database, Shield, LogOut, Link2, Copy, Check,
  RefreshCw, Trash2, Globe, ChevronDown, ChevronRight,
  Sun, Moon, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { generateWebhookKey, getWebhookKey, revokeWebhookKey } from "@/lib/integrations.functions";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

function CopyButton({ value, size = "sm" }: { value: string; size?: "sm" | "icon" }) {
  const { copied, copy } = useCopy();
  return (
    <Button variant="outline" size={size} className="gap-1.5 shrink-0" onClick={() => copy(value)}>
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      {size === "sm" && (copied ? "Copied" : "Copy")}
    </Button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap break-all">
        {code}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={code} size="icon" />
      </div>
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
        onClick={() => setOpen(!open)}
      >
        {title}
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 text-xs text-muted-foreground border-t pt-3">{children}</div>}
    </div>
  );
}

function SettingsPage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const themeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-crm.vercel.app";

  const { data: keyData } = useQuery({
    queryKey: ["webhook-key", user?.id],
    queryFn: async () => {
      if (!user?.id) return { key: null };
      return getWebhookKey({ data: { userId: user.id } });
    },
    enabled: !!user?.id,
  });

  const apiKey = keyData?.key ?? null;

  const handleGenerate = async () => {
    if (!user?.id) return;
    setGenerating(true);
    try {
      await generateWebhookKey({ data: { userId: user.id } });
      qc.invalidateQueries({ queryKey: ["webhook-key"] });
      toast.success("API key generated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!user?.id) return;
    setRevoking(true);
    try {
      await revokeWebhookKey({ data: { userId: user.id } });
      qc.invalidateQueries({ queryKey: ["webhook-key"] });
      toast.success("API key revoked");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRevoking(false);
    }
  };

  const websiteSnippet = apiKey
    ? `<!-- OneGrasp CRM — Lead Capture -->
<script>
async function submitToOneGraspCRM(formData) {
  await fetch("${baseUrl}/api/webhook-leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer ${apiKey}"
    },
    body: JSON.stringify({
      full_name: formData.name,
      email: formData.email,
      phone: formData.phone,
      source: "Website",
      utm_source: new URLSearchParams(location.search).get("utm_source"),
      utm_medium: new URLSearchParams(location.search).get("utm_medium"),
      utm_campaign: new URLSearchParams(location.search).get("utm_campaign"),
      message: formData.message
    })
  });
}
</script>`
    : "Generate an API key first.";

  const curlSnippet = apiKey
    ? `curl -X POST ${baseUrl}/api/webhook-leads \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "full_name": "Ahmed Ali",
    "email": "ahmed@example.com",
    "phone": "+971501234567",
    "source": "Website",
    "utm_campaign": "summer-2026"
  }'`
    : "Generate an API key first.";

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace, account, and integrations.</p>
      </div>

      {/* Appearance */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="size-4 text-primary" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Choose how the CRM looks. "System" follows your operating system setting.
          </p>
          <div className="inline-flex rounded-md border bg-muted/40 p-1 gap-1">
            {themeOptions.map((opt) => {
              const active = theme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="size-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Email" value={user?.email ?? ""} />
          <Row label="User ID" value={user?.id ?? ""} mono />
          <div className="pt-3">
            <Button variant="outline" onClick={() => signOut()} className="gap-1.5">
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="size-4 text-primary" /> Integrations & Live Lead Capture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* API Key */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Webhook API Key</p>
            <p className="text-xs text-muted-foreground">
              Used to authenticate all webhook calls. Keep it secret — treat it like a password.
            </p>
            {apiKey ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-3 py-1.5 rounded-md flex-1 break-all font-mono">{apiKey}</code>
                  <CopyButton value={apiKey} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGenerate} disabled={generating}>
                    <RefreshCw className="size-3.5" /> Rotate key
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleRevoke} disabled={revoking}>
                    <Trash2 className="size-3.5" /> Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" onClick={handleGenerate} disabled={generating} className="gap-1.5">
                {generating ? <RefreshCw className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                Generate API Key
              </Button>
            )}
          </div>

          <hr />

          {/* Website Integration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <p className="text-sm font-medium">Website — onegrasp.com</p>
              <Badge variant="outline" className="text-xs">Ready</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Any contact form on your website can POST leads directly into this CRM.
              Full UTM attribution (campaign, source, medium) is captured automatically.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Webhook URL</span>
                <CopyButton value={`${baseUrl}/api/webhook-leads`} />
              </div>
              <code className="text-xs block bg-muted px-3 py-2 rounded-md font-mono break-all">
                {baseUrl}/api/webhook-leads
              </code>
            </div>
            <Collapsible title="JavaScript snippet (paste into your website)">
              <CodeBlock code={websiteSnippet} />
            </Collapsible>
            <Collapsible title="cURL test command">
              <CodeBlock code={curlSnippet} />
            </Collapsible>
          </div>

          <hr />

          {/* Google Ads */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🟢</span>
              <p className="text-sm font-medium">Google Ads — Lead Form Extensions</p>
              <Badge variant="outline" className="text-xs">Needs setup</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              When someone fills a Lead Form Ad on Google, the lead appears here automatically with campaign attribution.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Webhook URL</span>
                <CopyButton value={`${baseUrl}/api/webhook-google`} />
              </div>
              <code className="text-xs block bg-muted px-3 py-2 rounded-md font-mono break-all">
                {baseUrl}/api/webhook-google
              </code>
            </div>
            <Collapsible title="How to connect Google Ads">
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>In Google Ads, open a campaign → Assets → Lead forms</li>
                <li>Create or edit a Lead Form Asset</li>
                <li>Under <strong>Lead delivery</strong>, click <strong>Connect lead delivery</strong></li>
                <li>Paste the webhook URL above</li>
                <li>Set a <strong>Key</strong> (any secret string) and add it to Vercel as<br />
                  <code className="bg-muted px-1 py-0.5 rounded">GOOGLE_ADS_WEBHOOK_KEY=your-secret</code>
                </li>
                <li>Save. New leads will appear in the CRM with source = "Google Ads".</li>
              </ol>
            </Collapsible>
          </div>

          <hr />

          {/* Meta Ads */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔵</span>
              <p className="text-sm font-medium">Meta — Facebook & Instagram Lead Ads</p>
              <Badge variant="outline" className="text-xs">Needs setup</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              When someone submits a Meta Lead Ad (Facebook or Instagram), the lead is fetched and saved here automatically.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs font-medium block">Webhook URL</span>
                <div className="flex gap-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded-md font-mono flex-1 break-all">
                    {baseUrl}/api/webhook-meta
                  </code>
                  <CopyButton value={`${baseUrl}/api/webhook-meta`} size="icon" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium block">Verify Token</span>
                {apiKey ? (
                  <div className="flex gap-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded-md font-mono flex-1 break-all">
                      {apiKey.slice(0, 20)}…
                    </code>
                    <CopyButton value={apiKey} size="icon" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Generate API key first</span>
                )}
              </div>
            </div>
            <Collapsible title="How to connect Meta Lead Ads">
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>In Meta Business Suite → <strong>Events Manager</strong> → <strong>Webhooks</strong></li>
                <li>Click <strong>Add subscriptions</strong> → subscribe to <strong>Page → leadgen</strong></li>
                <li>Paste the Webhook URL and Verify Token above</li>
                <li>Add to Vercel environment variables:<br />
                  <code className="bg-muted px-1 py-0.5 rounded">META_VERIFY_TOKEN=</code> (your API key)<br />
                  <code className="bg-muted px-1 py-0.5 rounded">META_PAGE_ACCESS_TOKEN=</code> (from Meta Business)</li>
                <li>Test the connection in Meta's dashboard</li>
                <li>New leads from Facebook/Instagram ads will appear as source = "Meta Ads".</li>
              </ol>
            </Collapsible>
          </div>

        </CardContent>
      </Card>

      {/* Backend */}
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="size-4 text-primary" /> Backend</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="text-muted-foreground">Powered by Supabase (PostgreSQL + Storage + Auth).</p>
          <p className="text-muted-foreground">All tables are protected by row-level security.</p>
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-primary" /> AI Assistant</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Powered by Groq (llama-3.3-70b-versatile). Lead summaries, follow-up suggestions, chat assistant, and file-based lead import are all active.
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="size-4 text-primary" /> Security</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Self-signup is disabled. Webhook API keys are stored encrypted in user metadata. Rotate keys regularly.
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center border-b last:border-0 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
