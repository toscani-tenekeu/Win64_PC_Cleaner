import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, formatBytes } from "@/lib/api";
import { toast } from "sonner";
import { Undo2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/quarantine")({
  head: () => ({
    meta: [
      { title: "Quarantine - Free Win64 PC Cleaner" },
      { name: "description", content: "Restore or permanently purge files held in the local database-backed quarantine." },
    ],
  }),
  component: QuarantinePage,
});

function QuarantinePage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["quarantine"], queryFn: api.quarantine, enabled: typeof window !== "undefined" });
  const items = query.data ?? [];
  const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["quarantine"] }),
      client.invalidateQueries({ queryKey: ["overview"] }),
    ]);
  };
  const restore = useMutation({ mutationFn: api.restore, onSuccess: async () => { toast.success("Restored to the original location"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const purge = useMutation({ mutationFn: api.purge, onSuccess: async () => { toast.success("Permanently removed from quarantine"); await refresh(); }, onError: (error) => toast.error(error.message) });

  return (
    <PageShell eyebrow="Safety" title="Quarantine" description="Cleanup and manual delete operations are stored here first. Restore an item or purge it permanently after review.">
      {query.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Unable to read quarantine: {query.error.message}</Card> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Items" value={query.isPending ? "..." : items.length.toString()} />
        <Stat label="Reserved" value={formatBytes(totalBytes)} />
        <Stat label="Storage" value="Local" hint="Database metadata + files" />
      </section>

      <Card className="p-0">
        {query.isPending ? <div className="p-10 text-center text-sm text-muted-foreground">Loading local quarantine...</div> : items.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">Quarantine is empty.</div> : <ul className="divide-y divide-border">
          {items.map((item) => <li key={item.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-mono text-xs">{item.originalPath}</span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Badge variant="secondary" className="text-[10px]">{item.category}</Badge><span>moved {new Date(item.deletedAt).toLocaleString()}</span><span>· expires {new Date(item.expiresAt).toLocaleDateString()}</span></div>
            </div>
            <span className="w-20 text-right font-mono text-sm">{formatBytes(item.sizeBytes)}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="gap-1.5" disabled={restore.isPending || purge.isPending} onClick={() => restore.mutate(item.id)}><Undo2 className="h-3.5 w-3.5" />Restore</Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" disabled={restore.isPending || purge.isPending} onClick={() => purge.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" />Purge</Button>
            </div>
          </li>)}
        </ul>}
      </Card>
    </PageShell>
  );
}
