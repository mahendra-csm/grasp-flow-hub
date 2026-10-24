import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { redeemInvitation } from "@/lib/invitations.functions";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const redeem = useServerFn(redeemInvitation);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  const handleSignup = async () => {
    if (!token) return toast.error("Invalid invitation link");
    if (!email.trim()) return toast.error("Email is required");
    if (password.length < 12) return toast.error("Password must be at least 12 characters");

    setLoading(true);
    try {
      await redeem({
        data: {
          token,
          email: email.trim().toLowerCase(),
          password,
        },
      });
      toast.success("Account created successfully. You can now sign in.");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to redeem invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardHeader><CardTitle>Complete signup</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Invitation email</label>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className="pt-2">
            <Button onClick={handleSignup} disabled={loading || !token}>Redeem invitation</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
