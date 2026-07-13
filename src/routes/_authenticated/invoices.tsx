import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Check, X, Download } from "lucide-react";
import { toast } from "sonner";
import { eur, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices")({ component: InvoicesPage });

const STATUS_LABEL: Record<string, string> = { paid: "Paga", unpaid: "Em aberto", overdue: "Em atraso" };

function InvoicesPage() {
  const { role, loading } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");

  const { data } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const [inv, cs] = await Promise.all([
        supabase.from("invoices").select("*, clients(name), invoice_items(*)").order("issue_date", { ascending: false }),
        supabase.from("clients").select("id,name").order("name"),
      ]);
      return { invoices: inv.data ?? [], clients: cs.data ?? [] };
    },
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const total = Number(fd.get("total"));
    const { data: inv, error } = await supabase.from("invoices").insert({
      client_id: clientId,
      invoice_number: String(fd.get("invoice_number")),
      issue_date: String(fd.get("issue_date")),
      due_date: String(fd.get("due_date") || "") || null,
      total,
      status: "unpaid",
    }).select().single();
    if (error || !inv) return toast.error(error?.message ?? "Erro");
    await supabase.from("invoice_items").insert({ invoice_id: inv.id, description: String(fd.get("description")), quantity: 1, unit_price: total });
    toast.success("Fatura criada"); setOpen(false); setClientId("");
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const setStatus = async (id: string, status: "paid" | "unpaid") => {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const exportCsv = () => {
    const rows = [["Nº", "Cliente", "Emissão", "Vencimento", "Estado", "Total"]];
    (data?.invoices ?? []).forEach((i: any) => rows.push([i.invoice_number, i.clients?.name ?? "", i.issue_date, i.due_date ?? "", i.status, String(i.total)]));
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "faturas.csv"; a.click();
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Faturas</h1><p className="text-sm text-muted-foreground">Emissão e pagamento</p></div>
        <div className="flex gap-2">
          {role === "admin" && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>}
          {role === "admin" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova fatura</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div><Label>Nº fatura</Label><Input name="invoice_number" required placeholder="FT 2026/..." /></div>
                  <div>
                    <Label>Cliente</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                      <SelectContent>{data?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Emissão</Label><Input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
                    <div><Label>Vencimento</Label><Input name="due_date" type="date" /></div>
                  </div>
                  <div><Label>Descrição</Label><Input name="description" required /></div>
                  <div><Label>Total (€)</Label><Input name="total" type="number" step="0.01" required /></div>
                  <DialogFooter><Button type="submit" disabled={!clientId}>Criar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nº</TableHead>
              {role === "admin" && <TableHead>Cliente</TableHead>}
              <TableHead>Emissão</TableHead><TableHead>Vencimento</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead>
              {role === "admin" && <TableHead></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {(data?.invoices ?? []).map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.invoice_number}</TableCell>
                  {role === "admin" && <TableCell>{i.clients?.name}</TableCell>}
                  <TableCell>{fmtDate(i.issue_date)}</TableCell>
                  <TableCell>{fmtDate(i.due_date)}</TableCell>
                  <TableCell><Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "outline"}>{STATUS_LABEL[i.status]}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{eur(i.total)}</TableCell>
                  {role === "admin" && (
                    <TableCell className="text-right">
                      {i.status !== "paid"
                        ? <Button size="sm" variant="ghost" onClick={() => setStatus(i.id, "paid")}><Check className="h-3 w-3 mr-1" />Marcar paga</Button>
                        : <Button size="sm" variant="ghost" onClick={() => setStatus(i.id, "unpaid")}><X className="h-3 w-3 mr-1" />Reabrir</Button>}
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