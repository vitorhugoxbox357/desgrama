import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

const STATUS_LABEL: Record<string, string> = { open: "Aberto", in_progress: "Em curso", done: "Concluído" };

function TasksPage() {
  const { role, clientId, user, loading } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selClient, setSelClient] = useState("");
  const [selWebsite, setSelWebsite] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const { data } = useQuery({
    queryKey: ["tasks", role, clientId],
    queryFn: async () => {
      const [ts, cs, ws] = await Promise.all([
        supabase.from("tasks").select("*, clients(name), websites(name)").order("created_at", { ascending: false }),
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("websites").select("id,name,client_id"),
      ]);
      return { tasks: ts.data ?? [], clients: cs.data ?? [], websites: ws.data ?? [] };
    },
    enabled: !loading,
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetClient = role === "admin" ? selClient : clientId;
    if (!targetClient) return toast.error("Cliente necessário");
    const { error } = await supabase.from("tasks").insert({
      title: String(fd.get("title")),
      description: String(fd.get("description") || "") || null,
      client_id: targetClient,
      website_id: selWebsite || null,
      priority,
      status: "open",
      opened_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Pedido criado"); setOpen(false); setSelClient(""); setSelWebsite(""); setPriority("medium");
    qc.invalidateQueries({ queryKey: ["tasks", role, clientId] });
  };

  const setStatus = async (id: string, status: "open" | "in_progress" | "done") => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks", role, clientId] });
  };

  const websitesForClient = (data?.websites ?? []).filter((w: any) =>
    role === "admin" ? w.client_id === selClient : w.client_id === clientId
  );

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Tarefas e pedidos</h1><p className="text-sm text-muted-foreground">Suporte e manutenção</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo pedido</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo pedido</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Título</Label><Input name="title" required /></div>
              <div><Label>Descrição</Label><Textarea name="description" /></div>
              {role === "admin" && (
                <div><Label>Cliente</Label>
                  <Select value={selClient} onValueChange={(v) => { setSelClient(v); setSelWebsite(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                    <SelectContent>{data?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Website (opcional)</Label>
                <Select value={selWebsite} onValueChange={setSelWebsite}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{websitesForClient.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit">Criar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Título</TableHead>
              {role === "admin" && <TableHead>Cliente</TableHead>}
              <TableHead>Site</TableHead><TableHead>Prioridade</TableHead><TableHead>Estado</TableHead><TableHead>Data</TableHead>
              {role === "admin" && <TableHead></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {(data?.tasks ?? []).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell><div className="font-medium">{t.title}</div>{t.description && <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>}</TableCell>
                  {role === "admin" && <TableCell>{t.clients?.name}</TableCell>}
                  <TableCell>{t.websites?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"}>{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant={t.status === "done" ? "secondary" : "outline"}>{STATUS_LABEL[t.status]}</Badge></TableCell>
                  <TableCell>{fmtDate(t.created_at)}</TableCell>
                  {role === "admin" && (
                    <TableCell className="text-right">
                      <Select value={t.status} onValueChange={(v) => setStatus(t.id, v as any)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="in_progress">Em curso</SelectItem>
                          <SelectItem value="done">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}