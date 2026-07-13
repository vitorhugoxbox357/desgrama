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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Download, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { eur, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices")({ component: InvoicesPage });

const db = supabase as any;
const STATUS_LABEL: Record<string, string> = { draft: "Rascunho", sent: "Enviada", unpaid: "Em aberto", paid: "Paga", overdue: "Vencida" };

function nextStatusVariant(status: string) {
  if (status === "paid") return "default";
  if (status === "overdue") return "destructive";
  if (status === "draft") return "secondary";
  return "outline";
}

function InvoicesPage() {
  const { role, loading } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("draft");

  const { data } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const [invoices, clients] = await Promise.all([
        db.from("invoices").select("*, clients(name), invoice_items(*), payments(*)").order("issue_date", { ascending: false }),
        db.from("clients").select("id,name").order("name"),
      ]);
      return { invoices: invoices.data ?? [], clients: clients.data ?? [] };
    },
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const total = Number(fd.get("total"));
    const { data: invoice, error } = await db.from("invoices").insert({
      client_id: clientId,
      invoice_number: String(fd.get("invoice_number")),
      issue_date: String(fd.get("issue_date")),
      due_date: String(fd.get("due_date") || "") || null,
      total,
      status,
      notes: String(fd.get("notes") || "") || null,
    }).select().single();
    if (error || !invoice) return toast.error(error?.message ?? "Erro");
    await db.from("invoice_items").insert({ invoice_id: invoice.id, description: String(fd.get("description")), quantity: 1, unit_price: total });
    await db.from("activity_logs").insert({ action: "invoice_created", entity_type: "invoice", entity_id: invoice.id, metadata: { invoice_number: invoice.invoice_number, status } });
    toast.success("Fatura criada");
    setOpen(false);
    setClientId("");
    setStatus("draft");
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const updateStatus = async (invoice: any, nextStatus: string) => {
    const payload: any = { status: nextStatus };
    if (nextStatus === "paid") payload.paid_at = new Date().toISOString();
    const { error } = await db.from("invoices").update(payload).eq("id", invoice.id);
    if (error) return toast.error(error.message);
    if (nextStatus === "paid") {
      await db.from("payments").insert({
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        amount: invoice.total,
        status: "paid",
        method: "manual",
        reference: invoice.invoice_number,
        paid_at: new Date().toISOString(),
      });
    }
    await db.from("activity_logs").insert({ action: "invoice_status_changed", entity_type: "invoice", entity_id: invoice.id, metadata: { status: nextStatus } });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const exportCsv = () => {
    const rows = [["N", "Cliente", "Emissao", "Vencimento", "Estado", "Pago", "Total"]];
    (data?.invoices ?? []).forEach((i: any) => rows.push([i.invoice_number, i.clients?.name ?? "", i.issue_date, i.due_date ?? "", i.status, i.paid_at ?? "", String(i.total)]));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "faturas.csv";
    a.click();
  };

  if (loading) return null;

  const invoices = data?.invoices ?? [];
  const overdueClients = new Set(invoices.filter((i: any) => i.status === "overdue").map((i: any) => i.client_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faturas e pagamentos</h1>
          <p className="text-sm text-muted-foreground">Rascunho, enviada, paga, vencida e historico de pagamentos</p>
        </div>
        <div className="flex gap-2">
          {role === "admin" && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>}
          {role === "admin" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova fatura</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div><Label>N fatura</Label><Input name="invoice_number" required placeholder="FT 2026/001" /></div>
                  <div>
                    <Label>Cliente</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>{data?.clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Emissao</Label><Input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
                    <div><Label>Vencimento</Label><Input name="due_date" type="date" /></div>
                    <div>
                      <Label>Estado</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="sent">Enviada</SelectItem>
                          <SelectItem value="unpaid">Em aberto</SelectItem>
                          <SelectItem value="overdue">Vencida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Descricao</Label><Input name="description" required /></div>
                  <div><Label>Total EUR</Label><Input name="total" type="number" step="0.01" required /></div>
                  <div><Label>Notas</Label><Input name="notes" /></div>
                  <DialogFooter><Button type="submit" disabled={!clientId}>Criar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Clientes em atraso</div><div className="text-2xl font-semibold">{overdueClients.size}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Valor vencido</div><div className="text-2xl font-semibold">{eur(invoices.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + Number(i.total), 0))}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pagamentos registados</div><div className="text-2xl font-semibold">{invoices.reduce((s: number, i: any) => s + (i.payments?.length ?? 0), 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>N</TableHead>{role === "admin" && <TableHead>Cliente</TableHead>}<TableHead>Vencimento</TableHead><TableHead>Estado</TableHead><TableHead>Pagamentos</TableHead><TableHead className="text-right">Total</TableHead>{role === "admin" && <TableHead></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {invoices.map((invoice: any) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  {role === "admin" && <TableCell>{invoice.clients?.name}</TableCell>}
                  <TableCell>{fmtDate(invoice.due_date)}</TableCell>
                  <TableCell><Badge variant={nextStatusVariant(invoice.status)}>{STATUS_LABEL[invoice.status] ?? invoice.status}</Badge></TableCell>
                  <TableCell>{invoice.payments?.length ?? 0}</TableCell>
                  <TableCell className="text-right font-medium">{eur(invoice.total)}</TableCell>
                  {role === "admin" && (
                    <TableCell className="text-right space-x-1">
                      {invoice.status === "draft" && <Button size="sm" variant="ghost" onClick={() => updateStatus(invoice, "sent")}><Send className="h-3 w-3 mr-1" />Enviar</Button>}
                      {invoice.status !== "paid" && <Button size="sm" variant="ghost" onClick={() => updateStatus(invoice, "paid")}><Check className="h-3 w-3 mr-1" />Paga</Button>}
                      {invoice.status !== "overdue" && invoice.status !== "paid" && <Button size="sm" variant="ghost" onClick={() => updateStatus(invoice, "overdue")}>Vencida</Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {invoices.length === 0 && <TableRow><TableCell colSpan={role === "admin" ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">Sem faturas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
