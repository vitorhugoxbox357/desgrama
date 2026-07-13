import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "client">("admin");
  const [clientId, setClientId] = useState<string>("");
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    // Publishable read of clients requires a session; keep list optional.
    supabase.from("clients").select("id,name").order("name").then(({ data }) => {
      if (data) setClientOptions(data);
    });
  }, []);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sessão iniciada");
    navigate({ to: "/dashboard" });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role, client_id: role === "client" ? clientId : null },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada. A entrar…");
    // With auto-confirm on, session is set immediately.
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">ClientCare Dashboard</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acesso privado</CardTitle>
            <CardDescription>Inicie sessão para gerir contratos de manutenção.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={onLogin} className="space-y-3 mt-4">
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "A entrar…" : "Entrar"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={onSignup} className="space-y-3 mt-4">
                  <div><Label>Nome</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <div>
                    <Label>Perfil</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as "admin" | "client")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Agência (Admin)</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {role === "client" && (
                    <div>
                      <Label>Empresa / Cliente</Label>
                      <Select value={clientId} onValueChange={setClientId}>
                        <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                        <SelectContent>
                          {clientOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={loading || (role === "client" && !clientId)}>
                    {loading ? "A criar…" : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Área reservada. Todos os acessos são registados.
        </p>
      </div>
    </div>
  );
}