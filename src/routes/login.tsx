import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ensureAdmin } from "@/lib/admin-setup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const setupAdmin = useServerFn(ensureAdmin);
  const [email, setEmail] = useState("support@onegrasp.com");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setupAdmin().catch(() => {});
  }, [setupAdmin]);

  if (!loading && user) return <Navigate to="/dashboard" />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) { toast.error(error); return; }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-secondary-foreground to-[oklch(0.22_0.04_250)] text-white">
        <div className="flex items-center gap-2">
          <img
            src="https://onegrasp.com/wp-content/uploads/2026/05/logo.png"
            alt="OneGrasp"
            className="h-9 w-auto object-contain brightness-0 invert"
          />
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">Lead management, built for action.</h1>
          <p className="text-white/70">
            Track every lead, run service-wise pipelines, schedule follow-ups, and convert faster — all from one premium admin workspace.
          </p>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} OneGrasp. Internal admin tool.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Admin access only.</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Default admin: <span className="font-mono">support@onegrasp.com</span>
          </p>
        </form>
      </div>
    </div>
  );
}
