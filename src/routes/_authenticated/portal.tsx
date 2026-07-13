import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eur, fmtDate } from "@/lib/format";
import { Globe, FileText, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({ component: PortalPage });

function PortalPage() {
  const { role, clientId, loading } = useSession();

  const { data } = useQuery({
    queryKey: ["portal", clientId],
    queryFn: async () => {
      const [client, websites, costs, invoices] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId!).maybeSingle(),
        supabase.from("websites").select("*, maintenance_plans(name, monthly_fee, plan_services(service_name))"),
        supabase.from("maintenance_costs").select("*, websites(name)").eq("cost_type", "billable").order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
      ]);
      return { client: client.data, websites: websites.data ?? [], costs: costs.data ?? [], invoices: invoices.data ?? [] };
    },
    enabled: !!clientId,
  });

  if (loading) return null;
  if (role === "admin") return <Navigate to="/dashboard" />;
  if (!clientId) return <div className="text-sm text-muted-foreground">A sua conta não está associada a nenhum cliente.</div>;

  const pending = (data?.costs ?? []).filter((c: any) => c.status === "pending_approval");
  const unpaid = (data?.invoices ?? []).filter((i: any) => i.status !== "paid");
  const monthlyTotal = (data?.websites ?? []).reduce((s: number, w: any) => s + Number(w.maintenance_plans?.monthly_fee ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data?.client?.name ?? "Portal"}</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua conta</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Websites", value: String((data?.websites ?? []).length), icon: Globe },
          { label: "Mensalidade", value: eur(monthlyTotal), icon: CheckCircle2 },
          { label: "Aprovações pendentes", value: String(pending.length), icon: Clock },
          { label: "Faturas em aberto", value: String(unpaid.length), icon: FileText },
        ].map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="flex items-center justify-between"><span className="text-xs uppercase text-muted-foreground">{k.label}</span><k.icon className="h-4 w-4 text-muted-foreground" /></div>
            <div className="text-2xl font-semibold mt-2">{k.value}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Os meus websites</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(data?.websites ?? []).map((w: any) => (
            <div key={w.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{w.name}</div>
                  <a href={w.url} target="_blank" rel="noreferrer" className="text-xs text-primary">{w.url}</a>
                </div>
                <Badge variant={w.active ? "default" : "secondary"}>{w.active ? "Ativo" : "Inativo"}</Badge>
              </div>
              {w.maintenance_plans && (
                <div className="mt-3">
                  <div className="text-sm"><span className="font-medium">Plano:</span> {w.maintenance_plans.name} — {eur(w.maintenance_plans.monthly_fee)}/mês</div>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {w.maintenance_plans.plan_services?.map((s: any, i: number) => (
                      <li key={i}><Badge variant="outline">{s.service_name}</Badge></li>
                    ))}
                  </ul>
                </div>
              )}
              {w.renewal_date && <div className="text-xs text-muted-foreground mt-2">Renovação: {fmtDate(w.renewal_date)}</div>}
            </div>
          ))}
          {(data?.websites ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem websites atribuídos.</p>}
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Aguarda a sua aprovação</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pending.map((c: any) => (
                <li key={c.id} className="py-2 flex justify-between text-sm">
                  <span><span className="font-medium">{c.description}</span> · <span className="text-muted-foreground">{c.websites?.name}</span></span>
                  <span className="font-medium">{eur(c.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">Aceda a Aprovações para decidir.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}