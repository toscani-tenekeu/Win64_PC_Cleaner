import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, formatBytes } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/applications")({
  head: () => ({ meta: [
    { title: "Applications — Free Win64 PC Cleaner" },
    { name: "description", content: "Installed Windows applications read from the local uninstall registry." },
  ] }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const query = useQuery({ queryKey: ["applications"], queryFn: api.applications, enabled: typeof window !== "undefined" });
  const applications = query.data ?? [];
  const totalBytes = applications.reduce((sum, app) => sum + app.sizeMB * 1024 * 1024, 0);
  const uninstall = useMutation({
    mutationFn: api.uninstall,
    onSuccess: (result) => toast.success(`Opened the official uninstaller for ${result.name}`),
    onError: (error) => toast.error(error.message),
  });

  return (
    <PageShell eyebrow="Manage" title="Applications" description="The list is read from the Windows uninstall registry. Removal always launches the registered official uninstaller.">
      {query.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Unable to read installed applications: {query.error.message}</Card> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Installed" value={query.isPending ? "…" : applications.length.toString()} />
        <Stat label="Known footprint" value={formatBytes(totalBytes)} />
        <Stat label="Uninstallable" value={applications.filter((app) => app.canUninstall).length.toString()} tone="success" />
      </section>

      <Card className="p-0">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Application</span><span>Source</span><span className="text-right">Size</span><span />
        </div>
        <ul className="divide-y divide-border">
          {applications.slice().sort((a, b) => b.sizeMB - a.sizeMB).map((app) => <li key={app.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{app.name}</span><span className="font-mono text-[10px] text-muted-foreground">v{app.version}</span></div>
              <span className="truncate text-xs text-muted-foreground">{app.publisher} · installed {app.installed}</span>
            </div>
            <Badge variant="secondary" className="text-[10px] capitalize">{app.source}</Badge>
            <span className="w-20 text-right font-mono text-sm">{formatBytes(app.sizeMB * 1024 * 1024)}</span>
            <Button size="sm" variant="ghost" disabled={!app.canUninstall || uninstall.isPending} onClick={() => uninstall.mutate(app.id)}>Uninstall</Button>
          </li>)}
          {query.isPending ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">Reading the Windows application registry…</li> : null}
        </ul>
      </Card>
    </PageShell>
  );
}
