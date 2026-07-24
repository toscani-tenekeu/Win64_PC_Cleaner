import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  drives,
  cleanupCategories,
  duplicateGroups,
  activity,
  formatGB,
  formatSize,
} from "@/lib/mock-data";
import { ArrowRight, Sparkles, Copy, FileBox } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Broomstick" },
      {
        name: "description",
        content: "At-a-glance view of storage, recoverable space and recent cleanup activity.",
      },
      { property: "og:title", content: "Overview — Broomstick" },
      {
        property: "og:description",
        content: "At-a-glance view of storage, recoverable space and recent activity.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const totalGB = drives.reduce((s, d) => s + d.totalGB, 0);
  const usedGB = drives.reduce((s, d) => s + d.usedGB, 0);
  const freeGB = totalGB - usedGB;
  const recoverableMB = cleanupCategories.reduce((s, c) => s + c.sizeMB, 0);
  const dupMB = duplicateGroups.reduce(
    (s, g) => s + g.sizeMB * Math.max(0, g.copies.length - 1),
    0,
  );

  return (
    <PageShell
      eyebrow="Dashboard"
      title="Overview"
      description="A snapshot of what's on this PC and what can be safely recovered. Nothing is deleted without your explicit confirmation."
      actions={
        <Link
          to="/cleaner"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Run cleanup <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total capacity" value={formatGB(totalGB)} hint={`${drives.length} drives`} />
        <Stat label="Used" value={formatGB(usedGB)} hint={`${((usedGB / totalGB) * 100).toFixed(1)}%`} />
        <Stat label="Free" value={formatGB(freeGB)} tone="success" />
        <Stat label="Recoverable" value={formatSize(recoverableMB)} tone="warning" hint="safe + reviewable" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="label-eyebrow">Drives</span>
              <h2 className="mt-1 text-base font-semibold">Storage by volume</h2>
            </div>
            <Link to="/storage" className="text-xs text-muted-foreground hover:text-foreground">
              Analyze →
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {drives.map((d) => {
              const pct = (d.usedGB / d.totalGB) * 100;
              return (
                <div key={d.id} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{d.mount}</span>
                      <span className="font-medium">{d.label}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">{d.fs}</Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {formatGB(d.usedGB)} / {formatGB(d.totalGB)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <span className="label-eyebrow">Quick actions</span>
          <div className="mt-3 flex flex-col gap-2">
            <QuickAction to="/cleaner" icon={Sparkles} title="Clean temp files" value={formatSize(recoverableMB)} />
            <QuickAction to="/duplicates" icon={Copy} title="Review duplicates" value={formatSize(dupMB)} />
            <QuickAction to="/large-files" icon={FileBox} title="Find large files" value="Top 5 shown" />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <span className="label-eyebrow">Recent activity</span>
          <ul className="mt-3 divide-y divide-border">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-xs text-muted-foreground">{a.detail}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-muted-foreground tabular-nums">{a.when}</div>
                  {a.freedMB ? (
                    <div className="font-mono text-xs text-primary tabular-nums">
                      −{formatSize(a.freedMB)}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <span className="label-eyebrow">Health</span>
          <ul className="mt-3 space-y-3 text-sm">
            <HealthRow label="SMART status" value="OK" tone="success" />
            <HealthRow label="Recycle Bin" value="4.2 GB" tone="warning" />
            <HealthRow label="Windows Update cache" value="6.4 GB" tone="warning" />
            <HealthRow label="Old Windows install" value="24.4 GB" tone="destructive" />
            <HealthRow label="Startup impact" value="High" tone="warning" />
          </ul>
        </Card>
      </section>
    </PageShell>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  value,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md border border-border bg-background/50 p-3 text-sm transition hover:border-primary/40 hover:bg-accent"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col leading-tight">
        <span className="font-medium">{title}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{value}</span>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

function HealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "destructive";
}) {
  const dot =
    tone === "success" ? "bg-primary" : tone === "warning" ? "bg-warning" : "bg-destructive";
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums">{value}</span>
    </li>
  );
}
