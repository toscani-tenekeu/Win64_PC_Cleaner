import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { installedApps, formatSize } from "@/lib/mock-data";
import { differenceInDays } from "date-fns";

export const Route = createFileRoute("/applications")({
  head: () => ({
    meta: [
      { title: "Applications — Free Win64 PC Cleaner" },
      { name: "description", content: "Installed apps with size, publisher and last-used dates. Uninstalls always run the official uninstaller." },
      { property: "og:title", content: "Applications — Free Win64 PC Cleaner" },
      { property: "og:description", content: "Installed apps with size and last-used dates." },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const totalMB = installedApps.reduce((s, a) => s + a.sizeMB, 0);
  const now = new Date("2026-07-24");
  const stale = installedApps.filter((a) => a.lastUsed && differenceInDays(now, new Date(a.lastUsed)) > 90);

  return (
    <PageShell
      eyebrow="Manage"
      title="Applications"
      description="Uninstalls always invoke the app's own uninstaller. Deleting the install folder is never used as a substitute."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Installed" value={installedApps.length.toString()} />
        <Stat label="Total footprint" value={formatSize(totalMB)} />
        <Stat label="Rarely used (>90d)" value={stale.length.toString()} tone="warning" />
      </section>

      <Card className="p-0">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Application</span>
          <span>Source</span>
          <span className="text-right">Last used</span>
          <span className="text-right">Size</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {installedApps
            .slice()
            .sort((a, b) => b.sizeMB - a.sizeMB)
            .map((a) => {
              const daysSince = a.lastUsed ? differenceInDays(now, new Date(a.lastUsed)) : null;
              const isStale = daysSince !== null && daysSince > 90;
              return (
                <li key={a.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3">
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{a.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">v{a.version}</span>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {a.publisher} · installed {a.installed}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize">{a.source}</Badge>
                  <span className={`text-right font-mono text-xs tabular-nums ${isStale ? "text-warning" : "text-muted-foreground"}`}>
                    {daysSince !== null ? `${daysSince}d ago` : "—"}
                  </span>
                  <span className="w-20 text-right font-mono text-sm tabular-nums">{formatSize(a.sizeMB)}</span>
                  <Button size="sm" variant="ghost">Uninstall</Button>
                </li>
              );
            })}
        </ul>
      </Card>
    </PageShell>
  );
}
