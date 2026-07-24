import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, formatBytes } from "@/lib/api";
import { useHydrated } from "@/hooks/use-hydrated";
import { ShieldAlert, ShieldCheck, Shield, RotateCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cleaner")({
  head: () => ({
    meta: [
      { title: "Cleaner - Free Win64 PC Cleaner" },
      { name: "description", content: "Scan real Windows cleanup locations and move selected data to Trash." },
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
  const client = useQueryClient();
  const hydrated = useHydrated();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const scan = useQuery({ queryKey: ["cleaner-scan"], queryFn: api.cleanerScan, enabled: hydrated });
  const categories = scan.data ?? [];

  useEffect(() => {
    if (categories.length && Object.keys(selected).length === 0) {
      setSelected(
        Object.fromEntries(
          categories.filter((category) => category.risk === "safe" && category.available).map((category) => [category.id, true]),
        ),
      );
    }
  }, [categories, selected]);

  const totals = useMemo(() => {
    const chosen = categories.filter((category) => selected[category.id]);
    return {
      bytes: chosen.reduce((sum, category) => sum + category.sizeBytes, 0),
      files: chosen.reduce((sum, category) => sum + category.files, 0),
      count: chosen.length,
    };
  }, [categories, selected]);

  const clean = useMutation({
    mutationFn: () => api.clean(Object.entries(selected).filter(([, value]) => value).map(([id]) => id)),
    onSuccess: async (result) => {
      toast.success(`Moved ${formatBytes(result.sizeBytes)} to Trash`);
      setSelected({});
      await Promise.all([
        client.invalidateQueries({ queryKey: ["cleaner-scan"] }),
        client.invalidateQueries({ queryKey: ["overview"] }),
        client.invalidateQueries({ queryKey: ["trash"] }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <PageShell
      eyebrow="Cleanup"
      title="Cleaner"
      description="These values come from real Windows folders. Selected items are moved to the local Trash and can be restored."
      actions={
        <>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => scan.refetch()} disabled={scan.isFetching}>
            <RotateCw className={`h-3.5 w-3.5 ${scan.isFetching ? "animate-spin" : ""}`} /> Rescan
          </Button>
          <Button size="sm" disabled={totals.count === 0 || clean.isPending} onClick={() => clean.mutate()}>
            {clean.isPending ? "Cleaning..." : `Clean${totals.count ? ` - ${formatBytes(totals.bytes)}` : ""}`}
          </Button>
        </>
      }
    >
      {scan.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Scan failed: {scan.error.message}</Card> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Selected" value={`${totals.count} / ${categories.length}`} />
        <Stat label="Reclaim" value={formatBytes(totals.bytes)} tone="success" />
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
          {categories.map((category) => {
            const meta = riskMeta[category.risk];
            const Icon = meta.icon;
            return (
              <li key={category.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-start gap-4 px-4 py-3.5">
                <Checkbox
                  checked={Boolean(selected[category.id])}
                  disabled={!category.available || clean.isPending}
                  onCheckedChange={(value) => setSelected((current) => ({ ...current, [category.id]: Boolean(value) }))}
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{category.name}</span>
                    {category.requiresAdmin ? <Badge variant="outline" className="text-[10px]">admin</Badge> : null}
                    {!category.available ? <Badge variant="secondary" className="text-[10px]">not found</Badge> : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{category.description}</span>
                </div>
                <span className="text-right font-mono text-xs text-muted-foreground">{category.files.toLocaleString()}</span>
                <span className="text-right font-mono text-sm">{formatBytes(category.sizeBytes)}</span>
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              </li>
            );
          })}
          {scan.isPending ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">Scanning Windows cleanup locations...</li> : null}
        </ul>
      </Card>
    </PageShell>
  );
}
