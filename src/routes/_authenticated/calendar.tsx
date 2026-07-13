import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eur, fmtDate } from "@/lib/format";
import { CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

const db = supabase as any;

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function CalendarPage() {
  const { data } = useQuery({
    queryKey: ["ops-calendar"],
    queryFn: async () => {
      const [tasks, invoices, websites, alerts] = await Promise.all([
        db.from("tasks").select("id,title,due_date,priority,status,clients(name),websites(name)").not("due_date", "is", null),
        db.from("invoices").select("id,invoice_number,due_date,total,status,clients(name)").not("due_date", "is", null),
        db.from("websites").select("id,name,renewal_date,domain_expires_at,hosting_expires_at,ssl_expires_at,maintenance_renewal_date,clients(name)"),
        db.from("renewal_alerts").select("id,title,due_date,status,alert_type,clients(name),websites(name)").eq("status", "open"),
      ]);
      return { tasks: tasks.data ?? [], invoices: invoices.data ?? [], websites: websites.data ?? [], alerts: alerts.data ?? [] };
    },
  });

  const events = [
    ...(data?.tasks ?? []).map((t: any) => ({ id: `task-${t.id}`, date: t.due_date, type: "Tarefa", title: t.title, client: t.clients?.name, detail: t.websites?.name ?? t.priority, status: t.status })),
    ...(data?.invoices ?? []).map((i: any) => ({ id: `invoice-${i.id}`, date: i.due_date, type: "Cobranca", title: i.invoice_number, client: i.clients?.name, detail: eur(i.total), status: i.status })),
    ...(data?.alerts ?? []).map((a: any) => ({ id: `alert-${a.id}`, date: a.due_date, type: "Alerta", title: a.title, client: a.clients?.name, detail: a.websites?.name ?? a.alert_type, status: a.status })),
    ...(data?.websites ?? []).flatMap((w: any) => [
      w.renewal_date && { id: `site-renew-${w.id}`, date: w.renewal_date, type: "Renovacao site", title: w.name, client: w.clients?.name, detail: "Contrato", status: "open" },
      w.domain_expires_at && { id: `domain-${w.id}`, date: w.domain_expires_at, type: "Dominio", title: w.name, client: w.clients?.name, detail: "Expiracao", status: "open" },
      w.hosting_expires_at && { id: `hosting-${w.id}`, date: w.hosting_expires_at, type: "Hosting", title: w.name, client: w.clients?.name, detail: "Expiracao", status: "open" },
      w.ssl_expires_at && { id: `ssl-${w.id}`, date: w.ssl_expires_at, type: "SSL", title: w.name, client: w.clients?.name, detail: "Expiracao", status: "open" },
      w.maintenance_renewal_date && { id: `maintenance-${w.id}`, date: w.maintenance_renewal_date, type: "Manutencao", title: w.name, client: w.clients?.name, detail: "Mensal", status: "open" },
    ].filter(Boolean)),
  ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const overdue = events.filter((e: any) => daysUntil(e.date) < 0 && e.status !== "paid" && e.status !== "done");
  const nextSeven = events.filter((e: any) => daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7);
  const nextThirty = events.filter((e: any) => daysUntil(e.date) >= 0 && daysUntil(e.date) <= 30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendario operacional</h1>
        <p className="text-sm text-muted-foreground">Tarefas, renovacoes e cobrancas numa unica linha temporal</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Em atraso</div><div className="text-2xl font-semibold">{overdue.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Proximos 7 dias</div><div className="text-2xl font-semibold">{nextSeven.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Proximos 30 dias</div><div className="text-2xl font-semibold">{nextThirty.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3"><CalendarClock className="h-4 w-4" />Agenda</div>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Item</TableHead><TableHead>Cliente</TableHead><TableHead>Detalhe</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader>
            <TableBody>
              {events.map((event: any) => {
                const delta = daysUntil(event.date);
                return (
                  <TableRow key={event.id}>
                    <TableCell>{fmtDate(event.date)}</TableCell>
                    <TableCell><Badge variant={delta < 0 ? "destructive" : delta <= 7 ? "default" : "secondary"}>{event.type}</Badge></TableCell>
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell>{event.client ?? "-"}</TableCell>
                    <TableCell>{event.detail}</TableCell>
                    <TableCell>{delta < 0 ? `${Math.abs(delta)} dias atras` : delta === 0 ? "Hoje" : `${delta} dias`}</TableCell>
                  </TableRow>
                );
              })}
              {events.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem eventos calendarizados.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
