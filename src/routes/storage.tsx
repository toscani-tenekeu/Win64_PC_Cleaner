import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api, formatBytes } from "@/lib/api";
import { Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/storage")({
  head: () => ({ meta: [
    { title: "Storage Analyzer — Free Win64 PC Cleaner" },
    { name: "description", content: "Analyze real Windows drives and folder usage by file type." },
  ] }),
  component: StoragePage,
});

function StoragePage() {
  const [root, setRoot] = useState("");
  const drivesQuery = useQuery({ queryKey: ["drives"], queryFn: api.drives, enabled: typeof window !== "undefined" });
  const scan = useMutation({ mutationFn: () => api.storage(root), onError: (error) => toast.error(error.message) });
  const drives = drivesQuery.data ?? [];
  const totalGB = drives.reduce((sum, drive) => sum + drive.totalGB, 0);
  const usedGB = drives.reduce((sum, drive) => sum + drive.usedGB, 0);
  const freeGB = drives.reduce((sum, drive) => sum + drive.freeGB, 0);
  const usageByType = scan.data?.usageByType ?? [];
  const largestFolders = scan.data?.largestFolders ?? [];
  const scannedBytes = usageByType.reduce((sum, item) => sum + item.sizeBytes, 0);

  return (
    <PageShell
      eyebrow="Analyze"
      title="Storage Analyzer"
      description="Drive capacity comes directly from Windows. Folder analysis recursively scans a selected local path and groups files by type."
      actions={<Button size="sm" className="gap-1.5" disabled={scan.isPending} onClick={() => scan.mutate()}><Search className="h-3.5 w-3.5" />{scan.isPending ? "Scanning…" : "Analyze folder"}</Button>}
    >
      <Card className="p-4">
        <span className="label-eyebrow">Folder to analyze</span>
        <Input value={root} onChange={(event) => setRoot(event.target.value)} className="mt-2 font-mono text-xs" placeholder="Leave blank for the current Windows user profile" />
      </Card>
      {drivesQuery.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Unable to read Windows drives: {drivesQuery.error.message}</Card> : null}
      {scan.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Folder analysis failed: {scan.error.message}</Card> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Physical capacity" value={totalGB ? `${totalGB.toFixed(1)} GB` : "—"} hint={`${drives.length} fixed drives`} />
        <Stat label="Used" value={usedGB ? `${usedGB.toFixed(1)} GB` : "—"} hint={totalGB ? `${((usedGB / totalGB) * 100).toFixed(1)}%` : "waiting for Windows"} />
        <Stat label="Free" value={freeGB ? `${freeGB.toFixed(1)} GB` : "—"} tone="success" />
      </section>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between"><div><span className="label-eyebrow">Drives</span><h2 className="mt-1 text-base font-semibold">Live capacity by volume</h2></div><Badge variant="secondary" className="font-mono text-[10px]">Windows CIM</Badge></div>
        <div className="flex flex-col gap-4">
          {drives.map((drive) => {
            const percent = drive.totalGB ? (drive.usedGB / drive.totalGB) * 100 : 0;
            return <div key={drive.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <div className="flex items-center gap-2"><span className="font-mono text-muted-foreground">{drive.mount}</span><span className="font-medium">{drive.label}</span><Badge variant="outline" className="font-mono text-[10px]">{drive.fs}</Badge></div>
                <span className="font-mono text-xs text-muted-foreground">{drive.usedGB.toFixed(1)} GB used · {drive.freeGB.toFixed(1)} GB free</span>
              </div>
              <Progress value={percent} className="h-1.5" />
            </div>;
          })}
          {drivesQuery.isPending ? <span className="py-6 text-center text-sm text-muted-foreground">Reading local Windows volumes…</span> : null}
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between"><div><span className="label-eyebrow">By file type</span><h2 className="mt-1 text-base font-semibold">Scanned usage</h2></div>{scan.data ? <Badge variant="secondary" className="font-mono text-[10px]">{scan.data.scannedFiles.toLocaleString()} files</Badge> : null}</div>
          <ul className="mt-4 space-y-3">
            {usageByType.slice().sort((a, b) => b.sizeBytes - a.sizeBytes).map((item) => {
              const percent = scannedBytes ? (item.sizeBytes / scannedBytes) * 100 : 0;
              return <li key={item.type} className="space-y-1.5"><div className="flex items-center justify-between text-sm"><span>{item.type}</span><span className="font-mono text-xs text-muted-foreground">{formatBytes(item.sizeBytes)} · {percent.toFixed(1)}%</span></div><Progress value={percent} className="h-1.5" /></li>;
            })}
            {scan.isPending ? <li className="py-10 text-center text-sm text-muted-foreground">Scanning files recursively…</li> : null}
            {scan.isSuccess && usageByType.length === 0 ? <li className="py-10 text-center text-sm text-muted-foreground">No readable file was found in this path.</li> : null}
            {!scan.isPending && !scan.data ? <li className="py-10 text-center text-sm text-muted-foreground">Analyze a folder to calculate file-type usage.</li> : null}
          </ul>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border p-4"><div><span className="label-eyebrow">Largest folders</span><h2 className="mt-1 text-base font-semibold">Top direct subfolders</h2></div>{scan.data ? <Badge variant="secondary" className="max-w-48 truncate font-mono text-[10px]">{scan.data.root}</Badge> : null}</div>
          <ul className="divide-y divide-border">
            {largestFolders.map((folder) => <li key={folder.path} className="flex items-center gap-4 px-4 py-3 text-sm">
              <div className="flex min-w-0 flex-1 flex-col"><span className="truncate font-mono text-xs">{folder.path}</span><span className="text-[11px] text-muted-foreground">{folder.items.toLocaleString()} files counted</span></div>
              <span className="w-24 text-right font-mono text-sm">{formatBytes(folder.sizeBytes)}</span>
            </li>)}
            {scan.isSuccess && largestFolders.length === 0 ? <li className="p-10 text-center text-sm text-muted-foreground">No readable direct subfolder was found.</li> : null}
            {!scan.data && !scan.isPending ? <li className="p-10 text-center text-sm text-muted-foreground">Folder results will appear after analysis.</li> : null}
          </ul>
        </Card>
      </section>
    </PageShell>
  );
}
