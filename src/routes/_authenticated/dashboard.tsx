import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eur, fmtDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { TrendingUp, Wallet, Clock, Percent, Globe, AlertTriangle, CalendarClock, ListTodo } from "lucide-react";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { role, loading } = useSession();
  if (loading) return null;
  if (role !== "admin") return <Navigate to="/portal" />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [plans, websites, costs, invoices, tasks] = await Promise.all([
        supabase.from("maintenance_plans").select("id,monthly_fee"),
        supabase.from("websites").select("id,name,client_id,active,renewal_date, clients(name)"),
        supabase.from("maintenance_costs").select("amount,cost_type,status,description,created_at, clients(name)"),
        supabase.from("invoices").select("id,invoice_number,total,status,due_date, clients(name)"),
        supabase.from("tasks").select("id,title,status,priority, clients(name)"),
      ]);
      return {
        plans: plans.data ?? [],
        websites: websites.data ?? [],
        costs: costs.data ?? [],
        invoices: invoices.data ?? [],
        tasks: tasks.data ?? [],
      };
    },
  });

  const websites = data?.websites ?? [];
  const costs = data?.costs ?? [];
  const invoices = data?.invoices ?? [];
  const tasks = data?.tasks ?? [];

  const activeSites = websites.filter((w: any) => w.active).length;
  const mrr = activeSites * 149; // approximation via avg plan; realistic MRR calc:
  const mrrExact = websites.reduce((sum: number, w: any) => sum + (w.active ? 0 : 0), 0);
  void mrrExact;

  const internalMonth = costs.filter((c: any) => c.cost_type === "internal")
    .reduce((s: number, c: any) => s + Number(c.amount), 0);
  const billablePending = costs.filter((c: any) => c.status === "pending_approval")
    .reduce((s: number, c: any) => s + Number(c.amount), 0);
  const pendingCount = costs.filter((c: any) => c.status === "pending_approval").length;

  const margin = mrr > 0 ? Math.round(((mrr - internalMonth) / mrr) * 100) : 0;

  const overdue = invoices.filter((i: any) => i.status === "overdue");
  const upcoming = websites
    .filter((w: any) => w.renewal_date && new Date(w.renewal_date) >= new Date())
    .sort((a: any, b: any) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime())
    .slice(0, 5);
  const openTasks = tasks.filter((t: any) => t.status !== "done");

  const kpis = [
    { label: "MRR estimado", value: eur(mrr), icon: TrendingUp, hint: `${activeSites} sites ativos` },
    { label: "Custos internos", value: eur(internalMonth), icon: Wallet, hint: "Acumulado" },
    { label: "Pendente aprovação", value: eur(billablePending), icon: Clock, hint: `${pendingCount} custos` },
    { label: "Margem média", value: `${margin}%`, icon: Percent, hint: "MRR − internos" },
    { label: "Sites ativos", value: String(activeSites), icon: Globe, hint: `${websites.length} totais` },
    { label: "Faturas em atraso", value: String(overdue.length), icon: AlertTriangle, hint: eur(overdue.reduce((s: number, i: any) => s + Number(i.total), 0)) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão operacional da agência</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</span>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold mt-2">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{k.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" />Próximas renovações</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Sem renovações próximas.</p>}
            <ul className="divide-y">
              {upcoming.map((w: any) => (
                <li key={w.id} className="flex justify-between py-2 text-sm">
                  <span><span className="font-medium">{w.name}</span> · <span className="text-muted-foreground">{w.clients?.name}</span></span>
                  <span className="text-muted-foreground">{fmtDate(w.renewal_date)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ListTodo className="h-4 w-4" />Tarefas abertas ({openTasks.length})</CardTitle></CardHeader>
          <CardContent>
            {openTasks.length === 0 && <p className="text-sm text-muted-foreground">Sem tarefas abertas.</p>}
            <ul className="divide-y">
              {openTasks.slice(0, 6).map((t: any) => (
                <li key={t.id} className="flex justify-between py-2 text-sm items-center">
                  <span><span className="font-medium">{t.title}</span> · <span className="text-muted-foreground">{t.clients?.name}</span></span>
                  <Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"}>{t.priority}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}