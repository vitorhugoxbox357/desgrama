import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/websites")({ component: WebsitesPage });

function WebsitesPage() {
  const { role, loading } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [clientId, setClientId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [active, setActive] = useState(true);

  const { data } = useQuery({
    queryKey: ["websites-full"],
    queryFn: async () => {
      const [ws, cs, ps] = await Promise.all([
        supabase.from("websites").select("*, clients(name), maintenance_plans(name,monthly_fee)").order("name"),
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("maintenance_plans").select("id,name,monthly_fee").order("monthly_fee"),
      ]);
      return { websites: ws.data ?? [], clients: cs.data ?? [], plans: ps.data ?? [] };
    },
  });

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/portal" />;

  const openNew = () => { setEditing(null); setClientId(""); setPlanId(""); setActive(true); setOpen(true); };
  const openEdit = (w: any) => { setEditing(w); setClientId(w.client_id); setPlanId(w.plan_id ?? ""); setActive(w.active); setOpen(true); };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name")), url: String(fd.get("url") || "") || null,
      client_id: clientId, plan_id: planId || null, active,
      renewal_date: String(fd.get("renewal_date") || "") || null,
      notes: String(fd.get("notes") || "") || null,
    };
    const { error } = editing
      ? await supabase.from("websites").update(payload).eq("id", editing.id)
      : await supabase.from("websites").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Guardado"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["websites-full"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar website?")) return;
    const { error } = await supabase.from("websites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    qc.invalidateQueries({ queryKey: ["websites-full"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Websites</h1><p className="text-sm text-muted-foreground">Sites geridos e planos atribuídos</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo website</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} website</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Nome</Label><Input name="name" required defaultValue={editing?.name} /></div>
              <div><Label>URL</Label><Input name="url" defaultValue={editing?.url ?? ""} /></div>
              <div>
                <Label>Cliente</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente…" /></SelectTrigger>
                  <SelectContent>{data?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano de manutenção</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger><SelectValue placeholder="Sem plano" /></SelectTrigger>
                  <SelectContent>{data?.plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — €{p.monthly_fee}/mês</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data de renovação</Label><Input name="renewal_date" type="date" defaultValue={editing?.renewal_date ?? ""} /></div>
              <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><span className="text-sm">Ativo</span></div>
              <DialogFooter><Button type="submit" disabled={!clientId}>Guardar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Site</TableHead><TableHead>Cliente</TableHead><TableHead>Plano</TableHead><TableHead>Estado</TableHead><TableHead>Renovação</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data?.websites ?? []).map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.url}</div></TableCell>
                  <TableCell>{w.clients?.name}</TableCell>
                  <TableCell>{w.maintenance_plans?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={w.active ? "default" : "secondary"}>{w.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell>{fmtDate(w.renewal_date)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}