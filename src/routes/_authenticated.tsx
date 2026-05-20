import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-background">
        {/* Logo + spinning ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute size-24 rounded-full border-2 border-muted/30 border-t-primary animate-spin" style={{ animationDuration: "1.2s" }} />
          <img
            src="https://onegrasp.com/wp-content/uploads/2026/05/logo.png"
            alt="OneGrasp"
            className="h-10 w-auto relative z-10"
          />
        </div>

        {/* Bouncing dots */}
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1.5 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: `${delay}ms`, animationDuration: "0.9s" }}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground tracking-wide">Loading your workspace…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
