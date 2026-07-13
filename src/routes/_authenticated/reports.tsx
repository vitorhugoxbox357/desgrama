import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { eur, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

const db = supabase as any;

function monthRange(month: string) {
  const start = `${month}-01`;
  const date = new Date(start);
  date.setMonth(date.getMonth() + 1);
  const end = date.toISOString().slice(0, 10);
  return { start, end };
}

function ReportsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data } = useQuery({
    queryKey: ["monthly-reports"],
    queryFn: async () => {
      const [clients, reports] = await Promise.all([
        db.from("clients").select("id,name").order("name"),
        db.from("monthly_reports").select("*, clients(name)").order("period_month", { ascending: false }),
      ]);
      return { clients: clients.data ?? [], reports: reports.data ?? [] };
    },
  });

  const generate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { start, end } = monthRange(month);
    const [tasks, checks, costs, logs] = await Promise.all([
      db.from("tasks").select("id,spent_hours").eq("client_id", clientId).eq("status", "done").gte("created_at", start).lt("created_at", end),
      db.from("website_checks").select("uptime_percent,websites!inner(client_id)").eq("websites.client_id", clientId).gte("checked_at", start).lt("checked_at", end),
      db.from("maintenance_costs").select("amount").eq("client_id", clientId).gte("incurred_at", start).lt("incurred_at", end),
      db.from("activity_logs").select("id").gte("created_at", start).lt("created_at", end),
    ]);
    const taskRows = tasks.data ?? [];
    const checkRows = checks.data ?? [];
    const costRows = costs.data ?? [];
    const avgUptime = checkRows.length
      ? checkRows.reduce((sum: number, c: any) => sum + Number(c.uptime_percent ?? 0), 0) / checkRows.length
      : null;
    const payload = {
      client_id: clientId,
      period_month: start,
      status: "ready",
      tasks_done: taskRows.length,
      uptime_percent: avgUptime,
      changes_count: (logs.data ?? []).length,
      hours_spent: taskRows.reduce((sum: number, t: any) => sum + Number(t.spent_hours ?? 0), 0),
      costs_total: costRows.reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0),
      summary: String(fd.get("summary") || "") || null,
    };
    const { error } = await db.from("monthly_reports").upsert(payload, { onConflict: "client_id,period_month" });
    if (error) return toast.error(error.message);
    await db.from("activity_logs").insert({ action: "monthly_report_generated", entity_type: "client", entity_id: clientId, metadata: payload });
    toast.success("Relatorio gerado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["monthly-reports"] });
  };

  const markSent = async (id: string) => {
    const { error } = await db.from("monthly_reports").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["monthly-reports"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Relatorios mensais</h1>
          <p className="text-sm text-muted-foreground">Tarefas feitas, uptime, alteracoes, horas e custos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Gerar relatorio</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar relatorio mensal</DialogTitle></DialogHeader>
            <form onSubmit={generate} className="space-y-3">
              <div>
                <Label>Cliente</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{data?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Mes</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
              <div><Label>Resumo</Label><Textarea name="summary" placeholder="Resumo executivo para o cliente" /></div>
              <DialogFooter><Button type="submit" disabled={!clientId || !month}>Gerar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3"><FileText className="h-4 w-4" />Historico</div>
          <Table>
            <TableHeader><TableRow><TableHead>Mes</TableHead><TableHead>Cliente</TableHead><TableHead>Estado</TableHead><TableHead>Tarefas</TableHead><TableHead>Uptime</TableHead><TableHead>Horas</TableHead><TableHead>Custos</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.reports ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{fmtDate(r.period_month)}</TableCell>
                  <TableCell className="font-medium">{r.clients?.name}</TableCell>
                  <TableCell><Badge variant={r.status === "sent" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell>{r.tasks_done}</TableCell>
                  <TableCell>{r.uptime_percent ? `${Number(r.uptime_percent).toFixed(2)}%` : "-"}</TableCell>
                  <TableCell>{r.hours_spent}h</TableCell>
                  <TableCell>{eur(r.costs_total)}</TableCell>
                  <TableCell className="text-right">{r.status !== "sent" && <Button size="sm" variant="ghost" onClick={() => markSent(r.id)}>Marcar enviado</Button>}</TableCell>
                </TableRow>
              ))}
              {(data?.reports ?? []).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sem relatorios.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
