import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { drives, usageByType, largestFolders, formatGB } from "@/lib/mock-data";

export const Route = createFileRoute("/storage")({
  head: () => ({
    meta: [
      { title: "Storage Analyzer — Free Win64 PC Cleaner" },
      { name: "description", content: "Where the space actually goes — by drive, type and folder." },
      { property: "og:title", content: "Storage Analyzer — Free Win64 PC Cleaner" },
      { property: "og:description", content: "Where the space actually goes — by drive, type and folder." },
    ],
  }),
  component: StoragePage,
});

const palette = ["#3ecf8e", "#5eb8ff", "#f2c94c", "#c084fc", "#f87171", "#94a3b8", "#38bdf8"];

function StoragePage() {
  const totalGB = drives.reduce((s, d) => s + d.totalGB, 0);
  const usedGB = drives.reduce((s, d) => s + d.usedGB, 0);
  const typeTotal = usageByType.reduce((s, t) => s + t.gb, 0);

  return (
    <PageShell
      eyebrow="Analyze"
      title="Storage Analyzer"
      description="Understand what's using space before removing anything. Rescan after any big change."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Physical capacity" value={formatGB(totalGB)} />
        <Stat label="Used" value={formatGB(usedGB)} hint={`${((usedGB / totalGB) * 100).toFixed(1)}%`} />
        <Stat label="Free" value={formatGB(totalGB - usedGB)} tone="success" />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <span className="label-eyebrow">By file type</span>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {usageByType.map((t, i) => (
              <div
                key={t.type}
                style={{ width: `${(t.gb / typeTotal) * 100}%`, background: palette[i % palette.length] }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {usageByType.map((t, i) => (
              <li key={t.type} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: palette[i % palette.length] }} />
                  {t.type}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {t.gb} GB · {((t.gb / typeTotal) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <span className="label-eyebrow">Treemap</span>
          <div className="mt-4 grid h-64 grid-cols-6 grid-rows-4 gap-1">
            {[
              { label: "Video", gb: 148, col: "col-span-3 row-span-3", color: palette[0] },
              { label: "Games", gb: 96, col: "col-span-3 row-span-2", color: palette[1] },
              { label: "Apps", gb: 54, col: "col-span-2 row-span-2", color: palette[2] },
              { label: "Docs", gb: 32, col: "col-span-1 row-span-1", color: palette[3] },
              { label: "Images", gb: 28, col: "col-span-2 row-span-1", color: palette[4] },
              { label: "System", gb: 41, col: "col-span-2 row-span-1", color: palette[5] },
              { label: "Other", gb: 19, col: "col-span-1 row-span-1", color: palette[6] },
            ].map((b) => (
              <div
                key={b.label}
                className={`${b.col} flex flex-col justify-between rounded-md p-3 text-primary-foreground/90`}
                style={{ background: `${b.color}25`, border: `1px solid ${b.color}55` }}
              >
                <span className="text-xs font-medium text-foreground">{b.label}</span>
                <span className="font-mono text-xs tabular-nums text-foreground/70">{b.gb} GB</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <span className="label-eyebrow">Largest folders</span>
            <h3 className="mt-0.5 text-sm font-medium">Top space consumers</h3>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">scan 08:12</Badge>
        </div>
        <ul className="divide-y divide-border">
          {largestFolders.map((f) => (
            <li key={f.path} className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-accent/60">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-xs text-muted-foreground">{f.path}</span>
                <span className="text-xs text-muted-foreground/70">{f.items.toLocaleString()} items</span>
              </div>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (f.sizeGB / 100) * 100)}%` }} />
              </div>
              <span className="w-20 text-right font-mono text-sm tabular-nums">{f.sizeGB} GB</span>
            </li>
          ))}
        </ul>
      </Card>
    </PageShell>
  );
}
