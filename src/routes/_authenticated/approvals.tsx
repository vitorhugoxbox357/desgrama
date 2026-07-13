import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { eur, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const { role, user, loading } = useSession();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["approvals", role],
    queryFn: async () => {
      const q = supabase.from("maintenance_costs")
        .select("*, clients(name), websites(name)")
        .eq("cost_type", "billable")
        .order("created_at", { ascending: false });
      return (await q).data ?? [];
    },
    enabled: !loading,
  });

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("maintenance_costs")
      .update({ status, decided_at: new Date().toISOString(), decided_by: user?.id })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Aprovado" : "Rejeitado");
    qc.invalidateQueries({ queryKey: ["approvals", role] });
  };

  const list = data ?? [];
  const pending = list.filter((c: any) => c.status === "pending_approval");
  const history = list.filter((c: any) => c.status !== "pending_approval");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aprovações</h1>
        <p className="text-sm text-muted-foreground">
          {role === "admin" ? "Custos faturáveis submetidos aos clientes" : "Custos que aguardam a sua decisão"}
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">A aguardar ({pending.length})</h2>
        <Card><CardContent className="p-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Descrição</TableHead>
              {role === "admin" && <TableHead>Cliente</TableHead>}
              <TableHead>Site</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pending.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.incurred_at)}</TableCell>
                  <TableCell className="max-w-md">{c.description}</TableCell>
                  {role === "admin" && <TableCell>{c.clients?.name}</TableCell>}
                  <TableCell>{c.websites?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{eur(c.amount)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" onClick={() => decide(c.id, "approved")}>Aprovar</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(c.id, "rejected")}>Rejeitar</Button>
                  </TableCell>
                </TableRow>
              ))}
              {pending.length === 0 && <TableRow><TableCell colSpan={role === "admin" ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">Nada pendente.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Histórico</h2>
        <Card><CardContent className="p-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Descrição</TableHead>
              {role === "admin" && <TableHead>Cliente</TableHead>}
              <TableHead>Estado</TableHead><TableHead className="text-right">Valor</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {history.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.decided_at ?? c.incurred_at)}</TableCell>
                  <TableCell className="max-w-md">{c.description}</TableCell>
                  {role === "admin" && <TableCell>{c.clients?.name}</TableCell>}
                  <TableCell><Badge variant={c.status === "approved" ? "default" : "destructive"}>{c.status === "approved" ? "Aprovado" : "Rejeitado"}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{eur(c.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>
  );
}