import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/activity")({ component: ActivityPage });

const db = supabase as any;

function actionLabel(action: string) {
  return action.replaceAll("_", " ");
}

function ActivityPage() {
  const { data } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data } = await db.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Logs de atividade</h1>
        <p className="text-sm text-muted-foreground">Quem criou, alterou, aprovou ou fechou algo</p>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Acao</TableHead><TableHead>Entidade</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>{fmtDate(log.created_at)}</TableCell>
                  <TableCell><Badge variant="outline">{actionLabel(log.action)}</Badge></TableCell>
                  <TableCell>{log.entity_type ?? "-"} {log.entity_id ? <span className="text-xs text-muted-foreground">/{String(log.entity_id).slice(0, 8)}</span> : null}</TableCell>
                  <TableCell className="max-w-xl truncate text-xs text-muted-foreground">{log.metadata ? JSON.stringify(log.metadata) : "-"}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sem atividade registada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
