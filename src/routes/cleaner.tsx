import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cleanupCategories, formatSize } from "@/lib/mock-data";
import { ShieldAlert, ShieldCheck, Shield, RotateCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cleaner")({
  head: () => ({
    meta: [
      { title: "Cleaner — Broomstick" },
      {
        name: "description",
        content: "Preview every category before cleanup. Nothing is deleted without confirmation.",
      },
      { property: "og:title", content: "Cleaner — Broomstick" },
      {
        property: "og:description",
        content: "Preview every category before cleanup. Nothing is deleted without confirmation.",
      },
    ],
  }),
  component: CleanerPage,
});

const riskMeta = {
  safe: { label: "Safe", icon: ShieldCheck, cls: "text-primary border-primary/30 bg-primary/10" },
  review: { label: "Review", icon: Shield, cls: "text-warning border-warning/30 bg-warning/10" },
  caution: { label: "Caution", icon: ShieldAlert, cls: "text-destructive border-destructive/30 bg-destructive/10" },
};

function CleanerPage() {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(cleanupCategories.filter((c) => c.risk === "safe").map((c) => [c.id, true])),
  );

  const totals = useMemo(() => {
    const chosen = cleanupCategories.filter((c) => selected[c.id]);
    return {
      mb: chosen.reduce((s, c) => s + c.sizeMB, 0),
      files: chosen.reduce((s, c) => s + c.files, 0),
      count: chosen.length,
    };
  }, [selected]);

  return (
    <PageShell
      eyebrow="Cleanup"
      title="Cleaner"
      description="Every category explains what it is, why it exists and whether it's safe to remove. Selected items go to Quarantine first — nothing is permanently deleted."
      actions={
        <>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" />
            Rescan
          </Button>
          <Button
            size="sm"
            disabled={totals.count === 0}
            onClick={() => toast.success(`Moved ${formatSize(totals.mb)} to Quarantine`, { description: `${totals.files.toLocaleString()} files across ${totals.count} categories` })}
          >
            Clean {totals.count > 0 ? `· ${formatSize(totals.mb)}` : ""}
          </Button>
        </>
      }
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Selected" value={`${totals.count} / ${cleanupCategories.length}`} />
        <Stat label="Reclaim" value={formatSize(totals.mb)} tone="success" />
        <Stat label="Files" value={totals.files.toLocaleString()} />
      </section>

      <Card className="p-0">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="w-4" />
          <span>Category</span>
          <span className="text-right">Files</span>
          <span className="text-right">Size</span>
          <span className="text-right">Risk</span>
        </div>
        <ul className="divide-y divide-border">
          {cleanupCategories.map((c) => {
            const meta = riskMeta[c.risk];
            const Icon = meta.icon;
            return (
              <li key={c.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-start gap-4 px-4 py-3.5">
                <Checkbox
                  checked={!!selected[c.id]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))}
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.requiresAdmin ? (
                      <Badge variant="outline" className="text-[10px]">admin</Badge>
                    ) : null}
                    {c.requiresRestart ? (
                      <Badge variant="outline" className="text-[10px]">restart</Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{c.description}</span>
                </div>
                <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {c.files.toLocaleString()}
                </span>
                <span className="text-right font-mono text-sm tabular-nums">
                  {formatSize(c.sizeMB)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}
                >
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </PageShell>
  );
}
