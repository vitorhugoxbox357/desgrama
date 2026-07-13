import { createFileRoute, Navigate } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/clients")({ component: ClientsPage });

type Client = { id: string; name: string; email: string | null; phone: string | null; address: string | null; notes: string | null; created_at: string };

function ClientsPage() {
  const { role, loading } = useSession();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data as Client[] | null,
  });

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/portal" />;

  const filtered = (clients ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name")), email: String(fd.get("email") || "") || null,
      phone: String(fd.get("phone") || "") || null, address: String(fd.get("address") || "") || null,
      notes: String(fd.get("notes") || "") || null,
    };
    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cliente atualizado" : "Cliente criado");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar cliente e todos os dados associados?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente eliminado");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Clientes</h1><p className="text-sm text-muted-foreground">Gestão de contas de cliente</p></div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Nome</Label><Input name="name" required defaultValue={editing?.name} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
                <div><Label>Telefone</Label><Input name="phone" defaultValue={editing?.phone ?? ""} /></div>
              </div>
              <div><Label>Morada</Label><Input name="address" defaultValue={editing?.address ?? ""} /></div>
              <div><Label>Notas</Label><Textarea name="notes" defaultValue={editing?.notes ?? ""} /></div>
              <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <Input placeholder="Pesquisar por nome…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-3" />
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead><TableHead>Desde</TableHead><TableHead className="w-24"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{fmtDate(c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sem clientes.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}