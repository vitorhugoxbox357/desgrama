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
import { toast } from "sonner";
import { Activity, Plus } from "lucide-react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/monitoring")({ component: MonitoringPage });

const db = supabase as any;
const statusLabel: Record<string, string> = { up: "Online", down: "Offline", warning: "Atencao", unknown: "Sem dados" };

function MonitoringPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [websiteId, setWebsiteId] = useState("");
  const [status, setStatus] = useState("up");

  const { data } = useQuery({
    queryKey: ["monitoring"],
    queryFn: async () => {
      const [websites, checks] = await Promise.all([
        db.from("websites").select("id,name,url,domain_expires_at,hosting_expires_at,ssl_expires_at,maintenance_renewal_date,clients(name)").order("name"),
        db.from("website_checks").select("*, websites(name,url,clients(name))").order("checked_at", { ascending: false }),
      ]);
      return { websites: websites.data ?? [], checks: checks.data ?? [] };
    },
  });

  const latestBySite = new Map<string, any>();
  (data?.checks ?? []).forEach((check: any) => {
    if (!latestBySite.has(check.website_id)) latestBySite.set(check.website_id, check);
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      website_id: websiteId,
      status,
      uptime_percent: Number(fd.get("uptime_percent") || 0),
      response_time_ms: Number(fd.get("response_time_ms") || 0),
      status_code: Number(fd.get("status_code") || 0),
      ssl_valid: fd.get("ssl_valid") === "true",
      ssl_expires_at: String(fd.get("ssl_expires_at") || "") || null,
      error_message: String(fd.get("error_message") || "") || null,
    };
    const { error } = await db.from("website_checks").insert(payload);
    if (error) return toast.error(error.message);
    await db.from("activity_logs").insert({ action: "monitoring_check_created", entity_type: "website", entity_id: websiteId, metadata: payload });
    toast.success("Check registado");
    setOpen(false);
    setWebsiteId("");
    qc.invalidateQueries({ queryKey: ["monitoring"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Monitorizacao</h1>
          <p className="text-sm text-muted-foreground">Uptime, SSL, velocidade, erros 500 e expiracoes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Registar check</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo check manual</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Website</Label>
                <Select value={websiteId} onValueChange={setWebsiteId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{data?.websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">Online</SelectItem>
                    <SelectItem value="warning">Atencao</SelectItem>
                    <SelectItem value="down">Offline</SelectItem>
                    <SelectItem value="unknown">Sem dados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Uptime %</Label><Input name="uptime_percent" type="number" step="0.01" defaultValue="99.9" /></div>
                <div><Label>Resposta ms</Label><Input name="response_time_ms" type="number" defaultValue="220" /></div>
                <div><Label>Status HTTP</Label><Input name="status_code" type="number" defaultValue="200" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SSL valido</Label><Select name="ssl_valid" defaultValue="true"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Sim</SelectItem><SelectItem value="false">Nao</SelectItem></SelectContent></Select></div>
                <div><Label>SSL expira</Label><Input name="ssl_expires_at" type="date" /></div>
              </div>
              <div><Label>Erro</Label><Input name="error_message" placeholder="Ex: HTTP 500 no checkout" /></div>
              <DialogFooter><Button type="submit" disabled={!websiteId}>Guardar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Website</TableHead><TableHead>Estado</TableHead><TableHead>Uptime</TableHead><TableHead>Resposta</TableHead><TableHead>HTTP</TableHead><TableHead>SSL</TableHead><TableHead>Renovacoes</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.websites ?? []).map((w: any) => {
                const check = latestBySite.get(w.id);
                return (
                  <TableRow key={w.id}>
                    <TableCell><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.url}</div></TableCell>
                    <TableCell><Badge variant={check?.status === "down" ? "destructive" : check?.status === "warning" ? "outline" : "default"}>{statusLabel[check?.status ?? "unknown"]}</Badge></TableCell>
                    <TableCell>{check?.uptime_percent ? `${check.uptime_percent}%` : "-"}</TableCell>
                    <TableCell>{check?.response_time_ms ? `${check.response_time_ms}ms` : "-"}</TableCell>
                    <TableCell>{check?.status_code ?? "-"}</TableCell>
                    <TableCell>{check?.ssl_valid === false ? <Badge variant="destructive">Invalido</Badge> : fmtDate(check?.ssl_expires_at ?? w.ssl_expires_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      Dominio {fmtDate(w.domain_expires_at)}<br />
                      Hosting {fmtDate(w.hosting_expires_at)}<br />
                      Manut. {fmtDate(w.maintenance_renewal_date)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data?.websites ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sem websites.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3"><Activity className="h-4 w-4" />Historico recente</div>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Website</TableHead><TableHead>Estado</TableHead><TableHead>Detalhe</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.checks ?? []).slice(0, 8).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.checked_at)}</TableCell>
                  <TableCell>{c.websites?.name}</TableCell>
                  <TableCell><Badge variant={c.status === "down" ? "destructive" : c.status === "warning" ? "outline" : "default"}>{statusLabel[c.status]}</Badge></TableCell>
                  <TableCell>{c.error_message ?? `${c.status_code ?? "-"} / ${c.response_time_ms ?? "-"}ms`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
