import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api, formatBytes } from "@/lib/api";
import { useHydrated } from "@/hooks/use-hydrated";
import { toast } from "sonner";

export const Route = createFileRoute("/applications")({
  head: () => ({
    meta: [
      { title: "Applications - Free Win64 PC Cleaner" },
      { name: "description", content: "Installed Windows applications read from the local uninstall registry." },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const client = useQueryClient();
  const hydrated = useHydrated();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const query = useQuery({ queryKey: ["applications"], queryFn: api.applications, enabled: hydrated });
  const applications = query.data ?? [];

  const filteredApplications = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return applications.filter((app) => {
      if (!needle) return true;
      return [app.name, app.publisher, app.version, app.source].some((value) => value.toLowerCase().includes(needle));
    });
  }, [applications, filter]);

  const selectedIds = useMemo(
    () => filteredApplications.filter((app) => selected[app.id]).map((app) => app.id),
    [filteredApplications, selected],
  );

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalBytes = applications.reduce((sum, app) => sum + app.sizeMB * 1024 * 1024, 0);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["applications"] });
    await client.invalidateQueries({ queryKey: ["overview"] });
  };

  const uninstall = useMutation({
    mutationFn: api.uninstall,
    onSuccess: (result) => toast.success(`Opened the official uninstaller for ${result.name}`),
    onError: (error) => toast.error(error.message),
  });

  const uninstallSelected = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = [];
      for (const id of ids) {
        results.push(await api.uninstall(id));
      }
      return results;
    },
    onSuccess: async (results) => {
      toast.success(`Opened ${results.length} uninstaller${results.length === 1 ? "" : "s"}`);
      setSelected({});
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleAllVisible = (value: boolean) => {
    setSelected((current) => {
      const next = { ...current };
      for (const app of filteredApplications) next[app.id] = value;
      return next;
    });
  };

  return (
    <PageShell
      eyebrow="Manage"
      title="Applications"
      description="The list is read from the Windows uninstall registry. Removal always launches the registered official uninstaller."
    >
      {query.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Unable to read installed applications: {query.error.message}</Card> : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <span className="label-eyebrow">Filter</span>
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="mt-2 font-mono text-xs"
              placeholder="Search name, publisher, version, source"
            />
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!selectedIds.length || uninstallSelected.isPending}
            onClick={() => uninstallSelected.mutate(selectedIds)}
          >
            Uninstall selected
          </Button>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Installed" value={query.isPending ? "..." : applications.length.toString()} />
        <Stat label="Known footprint" value={formatBytes(totalBytes)} />
        <Stat label="Selected" value={`${selectedCount} / ${filteredApplications.length}`} tone="success" />
      </section>

      <Card className="p-0">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Checkbox
            checked={filteredApplications.length > 0 && selectedIds.length === filteredApplications.length}
            onCheckedChange={(value) => toggleAllVisible(Boolean(value))}
            className="h-4 w-4"
          />
          <span>Application</span>
          <span>Source</span>
          <span className="text-right">Size</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {filteredApplications.slice().sort((a, b) => b.sizeMB - a.sizeMB).map((app) => {
            const checked = Boolean(selected[app.id]);
            return (
              <li key={app.id} className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 ${checked ? "bg-accent/40" : ""}`}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => setSelected((current) => ({ ...current, [app.id]: Boolean(value) }))}
                  className="h-4 w-4"
                />
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{app.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">v{app.version}</span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {app.publisher} - installed {app.installed}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {app.source}
                </Badge>
                <span className="w-20 text-right font-mono text-sm">{formatBytes(app.sizeMB * 1024 * 1024)}</span>
                <Button size="sm" variant="ghost" disabled={!app.canUninstall || uninstall.isPending} onClick={() => uninstall.mutate(app.id)}>
                  Uninstall
                </Button>
              </li>
            );
          })}
          {query.isPending ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">Reading the Windows application registry...</li> : null}
          {!query.isPending && filteredApplications.length === 0 ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">No application matches the filter.</li> : null}
        </ul>
      </Card>
    </PageShell>
  );
}
