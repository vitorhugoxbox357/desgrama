import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMissingSupabaseConfig, isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const missingConfig = getMissingSupabaseConfig();
  const configured = missingConfig.length === 0;

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [configured, navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error("Supabase nao esta configurado neste ambiente.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Acesso invalido. Confirme o email e a password.");
      return;
    }
    toast.success("Sessao iniciada");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src="/clientcare-logo.svg" alt="ClientCare" className="h-16 w-16 rounded-2xl" />
          <span className="font-semibold text-lg">ClientCare Dashboard</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acesso privado</CardTitle>
            <CardDescription>Entrada reservada aos utilizadores autorizados.</CardDescription>
          </CardHeader>
          <CardContent>
            {!configured ? (
              <Alert className="mb-4">
                <AlertTitle>Supabase por configurar</AlertTitle>
                <AlertDescription>
                  Falta configurar {missingConfig.join(" e ")} neste ambiente.
                </AlertDescription>
              </Alert>
            ) : null}
            <form onSubmit={onLogin} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !configured}>
                {loading ? "A entrar..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
