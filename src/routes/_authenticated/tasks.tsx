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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

const db = supabase as any;
const STATUS_LABEL: Record<string, string> = { open: "Aberto", in_progress: "Em curso", done: "Concluido" };

function TasksPage() {
  const { role, clientId, user, loading } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selClient, setSelClient] = useState("");
  const [selWebsite, setSelWebsite] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const { data } = useQuery({
    queryKey: ["tasks", role, clientId],
    queryFn: async () => {
      const [tasks, clients, websites] = await Promise.all([
        db.from("tasks").select("*, clients(name), websites(name), task_comments(id,body,created_at), task_attachments(id,file_name,file_url)").order("created_at", { ascending: false }),
        db.from("clients").select("id,name").order("name"),
        db.from("websites").select("id,name,client_id"),
      ]);
      return { tasks: tasks.data ?? [], clients: clients.data ?? [], websites: websites.data ?? [] };
    },
    enabled: !loading,
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetClient = role === "admin" ? selClient : clientId;
    if (!targetClient) return toast.error("Cliente necessario");
    const { data: task, error } = await db.from("tasks").insert({
      title: String(fd.get("title")),
      description: String(fd.get("description") || "") || null,
      client_id: targetClient,
      website_id: selWebsite || null,
      priority,
      status: "open",
      opened_by: user?.id === "local-admin" ? null : user?.id,
      due_date: String(fd.get("due_date") || "") || null,
      estimated_hours: Number(fd.get("estimated_hours") || 0),
      spent_hours: Number(fd.get("spent_hours") || 0),
    }).select().single();
    if (error || !task) return toast.error(error?.message ?? "Erro");
    const comment = String(fd.get("comment") || "");
    const fileName = String(fd.get("file_name") || "");
    const fileUrl = String(fd.get("file_url") || "");
    if (comment) await db.from("task_comments").insert({ task_id: task.id, body: comment });
    if (fileName && fileUrl) await db.from("task_attachments").insert({ task_id: task.id, file_name: fileName, file_url: fileUrl });
    await db.from("activity_logs").insert({ action: "task_created", entity_type: "task", entity_id: task.id, metadata: { title: task.title, client_id: targetClient } });
    toast.success("Pedido criado");
    setOpen(false);
    setSelClient("");
    setSelWebsite("");
    setPriority("medium");
    qc.invalidateQueries({ queryKey: ["tasks", role, clientId] });
  };

  const setStatus = async (id: string, status: "open" | "in_progress" | "done") => {
    const { error } = await db.from("tasks").update({ status, closed_at: status === "done" ? new Date().toISOString() : null }).eq("id", id);
    if (error) return toast.error(error.message);
    await db.from("activity_logs").insert({ action: status === "done" ? "task_closed" : "task_status_changed", entity_type: "task", entity_id: id, metadata: { status } });
    qc.invalidateQueries({ queryKey: ["tasks", role, clientId] });
  };

  const websitesForClient = (data?.websites ?? []).filter((w: any) =>
    role === "admin" ? w.client_id === selClient : w.client_id === clientId
  );

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tarefas e pedidos</h1>
          <p className="text-sm text-muted-foreground">Prioridades, responsaveis, prazos, comentarios e anexos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo pedido</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo pedido</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Titulo</Label><Input name="title" required /></div>
              <div><Label>Descricao</Label><Textarea name="description" /></div>
              {role === "admin" && (
                <div>
                  <Label>Cliente</Label>
                  <Select value={selClient} onValueChange={(v) => { setSelClient(v); setSelWebsite(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{data?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Website</Label>
                <Select value={selWebsite} onValueChange={setSelWebsite}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>{websitesForClient.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Prazo</Label><Input name="due_date" type="date" /></div>
                <div><Label>Horas prev.</Label><Input name="estimated_hours" type="number" step="0.25" defaultValue="0" /></div>
                <div><Label>Horas gastas</Label><Input name="spent_hours" type="number" step="0.25" defaultValue="0" /></div>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Comentario inicial</Label><Textarea name="comment" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Anexo</Label><Input name="file_name" placeholder="brief.pdf" /></div>
                <div><Label>URL do anexo</Label><Input name="file_url" placeholder="https://..." /></div>
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
              <TableHead>Titulo</TableHead>
              {role === "admin" && <TableHead>Cliente</TableHead>}
              <TableHead>Site</TableHead><TableHead>Prioridade</TableHead><TableHead>Estado</TableHead><TableHead>Prazo</TableHead><TableHead>Horas</TableHead><TableHead>Notas</TableHead>
              {role === "admin" && <TableHead></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {(data?.tasks ?? []).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell><div className="font-medium">{t.title}</div>{t.description && <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>}</TableCell>
                  {role === "admin" && <TableCell>{t.clients?.name}</TableCell>}
                  <TableCell>{t.websites?.name ?? "-"}</TableCell>
                  <TableCell><Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"}>{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant={t.status === "done" ? "secondary" : "outline"}>{STATUS_LABEL[t.status]}</Badge></TableCell>
                  <TableCell>{fmtDate(t.due_date)}</TableCell>
                  <TableCell>{Number(t.spent_hours ?? 0)}h / {Number(t.estimated_hours ?? 0)}h</TableCell>
                  <TableCell>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.task_comments?.length ?? 0}</span>
                      <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{t.task_attachments?.length ?? 0}</span>
                    </div>
                  </TableCell>
                  {role === "admin" && (
                    <TableCell className="text-right">
                      <Select value={t.status} onValueChange={(v) => setStatus(t.id, v as any)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="in_progress">Em curso</SelectItem>
                          <SelectItem value="done">Concluido</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(data?.tasks ?? []).length === 0 && <TableRow><TableCell colSpan={role === "admin" ? 9 : 8} className="text-center text-sm text-muted-foreground py-8">Sem tarefas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
