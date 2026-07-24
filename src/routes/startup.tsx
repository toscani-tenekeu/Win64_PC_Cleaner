import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useHydrated } from "@/hooks/use-hydrated";
import { toast } from "sonner";

export const Route = createFileRoute("/startup")({
  head: () => ({
    meta: [
      { title: "Startup - Free Win64 PC Cleaner" },
      { name: "description", content: "Manage real Windows Run registry entries without permanently deleting their commands." },
    ],
  }),
  component: StartupPage,
});

function StartupPage() {
  const client = useQueryClient();
  const hydrated = useHydrated();
  const query = useQuery({ queryKey: ["startup"], queryFn: api.startup, enabled: hydrated });
  const entries = query.data ?? [];
  const enabled = entries.filter((entry) => entry.enabled).length;
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.toggleStartup(id, enabled),
    onSuccess: async (result) => {
      toast.success(result.enabled ? "Startup entry enabled" : "Startup entry disabled");
      await Promise.all([client.invalidateQueries({ queryKey: ["startup"] }), client.invalidateQueries({ queryKey: ["overview"] })]);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <PageShell eyebrow="Boot" title="Startup Manager" description="Registry startup entries are read from Windows. Disabled commands are preserved in the local database so they can be restored later.">
      {query.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Unable to read startup registry: {query.error.message}</Card> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Enabled" value={query.isPending ? "..." : `${enabled} / ${entries.length}`} />
        <Stat label="Disabled by cleaner" value={entries.filter((entry) => !entry.enabled).length.toString()} tone="warning" />
        <Stat label="Source" value="Registry" hint="current user + all users" />
      </section>

      <Card className="p-0">
        <ul className="divide-y divide-border">
          {entries.map((entry) => <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
            <Switch checked={entry.enabled} disabled={toggle.isPending} onCheckedChange={(value) => toggle.mutate({ id: entry.id, enabled: value })} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2"><span className="text-sm font-medium">{entry.name}</span><Badge variant="outline" className="text-[10px] capitalize">{entry.source}</Badge>{!entry.enabled ? <Badge variant="secondary" className="text-[10px]">stored locally</Badge> : null}</div>
              <span className="truncate font-mono text-[11px] text-muted-foreground">{entry.path}</span>
            </div>
            <div className="flex flex-col items-end"><span className="text-xs font-medium">{entry.enabled ? "Enabled" : "Disabled"}</span><span className="text-[11px] text-muted-foreground">{entry.publisher}</span></div>
          </li>)}
          {query.isPending ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">Reading Windows startup registry...</li> : null}
          {!query.isPending && entries.length === 0 ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">No Run registry startup entry was found.</li> : null}
        </ul>
      </Card>
    </PageShell>
  );
}
