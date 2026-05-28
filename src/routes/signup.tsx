import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
    (async () => {
      if (!t) return;
      const { data, error } = await supabase.from('invitations').select('email, role, used, expires_at').eq('token', t).single();
      if (error || !data) return toast.error('Invalid or expired invitation token');
      if (data.used) return toast.error('Invitation already used');
      setEmail(data.email);
    })();
  }, []);

  const handleSignup = async () => {
    if (!token || !email) return toast.error('Invalid invitation');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // After successful sign up, the DB trigger will create a profile based on invitation
      toast.success('Account created — check your email for confirmation (if required)');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create account');
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
            <label className="text-xs text-muted-foreground">Email</label>
            <Input value={email ?? ''} disabled />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="pt-2">
            <Button onClick={handleSignup} disabled={loading || !token}>Create account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
