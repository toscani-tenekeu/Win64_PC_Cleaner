import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api, formatBytes } from "@/lib/api";
import { ArrowRight, Trash2, Copy, FileBox } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Overview — Free Win64 PC Cleaner" },
    { name: "description", content: "At-a-glance view of real storage, recoverable space and recent cleanup activity." },
  ] }),
  component: OverviewPage,
});

function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview, enabled: typeof window !== "undefined" });
  const drives = overview.data?.drives ?? [];
  const categories = overview.data?.cleanupCategories ?? [];
  const activity = overview.data?.activity ?? [];
  const trash = overview.data?.trash ?? [];
  const totalGB = drives.reduce((sum, drive) => sum + drive.totalGB, 0);
  const usedGB = drives.reduce((sum, drive) => sum + drive.usedGB, 0);
  const freeGB = drives.reduce((sum, drive) => sum + drive.freeGB, 0);
  const recoverableBytes = categories.reduce((sum, category) => sum + category.sizeBytes, 0);

  return (
    <PageShell
      eyebrow="Dashboard"
      title="Overview"
      description="Live data from this Windows PC. Cleanup operations move selected items to the local trash first."
      actions={<Link to="/cleaner" className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">Run cleanup <ArrowRight className="h-3.5 w-3.5" /></Link>}
    >
      {overview.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Backend unavailable: {overview.error.message}</Card> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total capacity" value={totalGB ? `${totalGB.toFixed(1)} GB` : "—"} hint={`${drives.length} drives`} />
        <Stat label="Used" value={usedGB ? `${usedGB.toFixed(1)} GB` : "—"} hint={totalGB ? `${((usedGB / totalGB) * 100).toFixed(1)}%` : "waiting for backend"} />
        <Stat label="Free" value={freeGB ? `${freeGB.toFixed(1)} GB` : "—"} tone="success" />
        <Stat label="Recoverable" value={formatBytes(recoverableBytes)} tone="warning" hint="moves to trash" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div><span className="label-eyebrow">Drives</span><h2 className="mt-1 text-base font-semibold">Storage by volume</h2></div>
            <Link to="/storage" className="text-xs text-muted-foreground hover:text-foreground">Analyze →</Link>
          </div>
          <div className="flex flex-col gap-4">
            {drives.map((drive) => {
              const percent = drive.totalGB ? (drive.usedGB / drive.totalGB) * 100 : 0;
              return <div key={drive.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between text-sm">
                  <div className="flex items-center gap-2"><span className="font-mono text-muted-foreground">{drive.mount}</span><span className="font-medium">{drive.label}</span><Badge variant="secondary" className="font-mono text-[10px]">{drive.fs}</Badge></div>
                  <span className="font-mono text-xs text-muted-foreground">{drive.usedGB.toFixed(1)} / {drive.totalGB.toFixed(1)} GB</span>
                </div>
                <Progress value={percent} className="h-1.5" />
              </div>;
            })}
            {!overview.isPending && drives.length === 0 ? <span className="text-sm text-muted-foreground">No fixed Windows drive was detected.</span> : null}
          </div>
        </Card>

        <Card className="p-5">
          <span className="label-eyebrow">Quick actions</span>
          <div className="mt-3 flex flex-col gap-2">
            <QuickAction to="/cleaner" icon={Trash2} title="Clean temporary files" value={formatBytes(recoverableBytes)} />
            <QuickAction to="/duplicates" icon={Copy} title="Scan duplicate files" value="SHA-256 scan" />
            <QuickAction to="/large-files" icon={FileBox} title="Find large files" value="Choose a folder" />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <span className="label-eyebrow">Recent activity</span>
          <ul className="mt-3 divide-y divide-border">
            {activity.map((item) => <li key={item.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <div className="flex flex-col"><span className="font-medium">{item.action}</span><span className="text-xs text-muted-foreground">{item.detail}</span></div>
              <div className="text-right"><div className="font-mono text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</div>{item.freedBytes ? <div className="font-mono text-xs text-primary">−{formatBytes(item.freedBytes)}</div> : null}</div>
            </li>)}
            {!activity.length ? <li className="py-6 text-sm text-muted-foreground">No local activity recorded yet.</li> : null}
          </ul>
        </Card>
        <Card className="p-5">
          <span className="label-eyebrow">Safety</span>
          <ul className="mt-3 space-y-3 text-sm">
            <HealthRow label="Backend" value={overview.isSuccess ? "Connected" : overview.isPending ? "Connecting" : "Offline"} tone={overview.isSuccess ? "success" : "destructive"} />
            <HealthRow label="Trash" value={`${trash.length} items`} tone={trash.length ? "warning" : "success"} />
            <HealthRow label="Authentication" value="None · local only" tone="success" />
            <HealthRow label="Cleanup mode" value="Trash first" tone="success" />
          </ul>
        </Card>
      </section>
    </PageShell>
  );
}

function QuickAction({ to, icon: Icon, title, value }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
  return <Link to={to} className="flex items-center gap-3 rounded-md border border-border bg-background/50 p-3 text-sm transition hover:border-primary/40 hover:bg-accent">
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
    <div className="flex flex-1 flex-col leading-tight"><span className="font-medium">{title}</span><span className="font-mono text-[11px] text-muted-foreground">{value}</span></div>
    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
  </Link>;
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "destructive" }) {
  const dot = tone === "success" ? "bg-primary" : tone === "warning" ? "bg-warning" : "bg-destructive";
  return <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</span><span className="font-mono text-xs">{value}</span></li>;
}
