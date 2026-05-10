import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Database, Shield, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace and account.</p>
      </div>
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Email" value={user?.email ?? ""} />
          <Row label="Role" value="Admin" />
          <Row label="User ID" value={user?.id ?? ""} mono />
          <div className="pt-3"><Button variant="outline" onClick={() => signOut()} className="gap-1.5"><LogOut className="size-3.5" /> Sign out</Button></div>
        </CardContent>
      </Card>
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="size-4 text-primary" /> Backend</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="text-muted-foreground">Powered by Supabase (PostgreSQL + Storage + Auth).</p>
          <p className="text-muted-foreground">All tables are protected by row-level security.</p>
        </CardContent>
      </Card>
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-primary" /> AI Assistant</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          AI-ready architecture. Lead summaries, follow-up suggestions and smart search are available when connected to an AI provider.
        </CardContent>
      </Card>
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="size-4 text-primary" /> Security</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Self-signup is disabled. Only the seeded admin can access this CRM.
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
