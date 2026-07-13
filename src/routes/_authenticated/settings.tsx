import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, role, clientId, loading } = useSession();
  if (loading) return null;
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Definições</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Perfil</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Email:</span> {user?.email}</div>
          <div><span className="text-muted-foreground">Perfil:</span> <Badge>{role === "admin" ? "Agência (Admin)" : "Cliente"}</Badge></div>
          {clientId && <div className="text-xs text-muted-foreground">Cliente associado: {clientId}</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Idioma e formato</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Idioma:</span> Português (Portugal)</div>
          <div><span className="text-muted-foreground">Moeda:</span> EUR (€)</div>
          <div><span className="text-muted-foreground">Formato de data:</span> dd/mm/aaaa</div>
        </CardContent>
      </Card>
    </div>
  );
}