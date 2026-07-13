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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { eur, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/costs")({ component: CostsPage });

const STATUS_LABEL: Record<string, string> = {
  internal: "Interno", pending_approval: "Aguarda aprovação", approved: "Aprovado", rejected: "Rejeitado",
};

function CostsPage() {
  const { role, loading } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [websiteId, setWebsiteId] = useState<string>("");
  const [type, setType] = useState<"internal" | "billable">("internal");

  const { data } = useQuery({
    queryKey: ["costs-admin"],
    queryFn: async () => {
      const [cs, cl, ws] = await Promise.all([
        supabase.from("maintenance_costs").select("*, clients(name), websites(name)").order("incurred_at", { ascending: false }),
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("websites").select("id,name,client_id"),
      ]);
      return { costs: cs.data ?? [], clients: cl.data ?? [], websites: ws.data ?? [] };
    },
  });

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/portal" />;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      description: String(fd.get("description")),
      amount: Number(fd.get("amount")),
      client_id: clientId, website_id: websiteId || null,
      cost_type: type,
      status: type === "internal" ? "internal" : "pending_approval",
      incurred_at: String(fd.get("incurred_at") || new Date().toISOString().slice(0, 10)),
    };
    const { error } = await supabase.from("maintenance_costs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(type === "billable" ? "Custo enviado para aprovação" : "Custo registado");
    setOpen(false); setClientId(""); setWebsiteId(""); setType("internal");
    qc.invalidateQueries({ queryKey: ["costs-admin"] });
  };

  const sendForApproval = async (id: string) => {
    const { error } = await supabase.from("maintenance_costs").update({ cost_type: "billable", status: "pending_approval" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Enviado para aprovação");
    qc.invalidateQueries({ queryKey: ["costs-admin"] });
  };

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("maintenance_costs").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["costs-admin"] });
  };

  const websitesForClient = (data?.websites ?? []).filter((w: any) => w.client_id === clientId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Custos de manutenção</h1><p className="text-sm text-muted-foreground">Internos e faturáveis a cliente</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Registar custo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo custo</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Descrição</Label><Textarea name="description" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor (€)</Label><Input name="amount" type="number" step="0.01" required /></div>
                <div><Label>Data</Label><Input name="incurred_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={clientId} onValueChange={(v) => { setClientId(v); setWebsiteId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>{data?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Website (opcional)</Label>
                <Select value={websiteId} onValueChange={setWebsiteId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{websitesForClient.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Interno (agência)</SelectItem>
                    <SelectItem value="billable">Faturável (envia para aprovação)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit" disabled={!clientId}>Registar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead>Site</TableHead><TableHead>Tipo</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data?.costs ?? []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.incurred_at)}</TableCell>
                  <TableCell className="max-w-xs truncate">{c.description}</TableCell>
                  <TableCell>{c.clients?.name}</TableCell>
                  <TableCell>{c.websites?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={c.cost_type === "billable" ? "default" : "secondary"}>{c.cost_type === "billable" ? "Faturável" : "Interno"}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : c.status === "pending_approval" ? "outline" : "secondary"}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{eur(c.amount)}</TableCell>
                  <TableCell className="text-right">
                    {c.cost_type === "internal" && (
                      <Button size="sm" variant="ghost" onClick={() => sendForApproval(c.id)}><Send className="h-3 w-3 mr-1" />Enviar</Button>
                    )}
                    {c.status === "pending_approval" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => decide(c.id, "approved")}>Aprovar</Button>
                        <Button size="sm" variant="ghost" onClick={() => decide(c.id, "rejected")}>Rejeitar</Button>
                      </>
                    )}
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