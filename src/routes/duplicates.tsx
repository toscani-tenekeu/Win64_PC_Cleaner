import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatBytes } from "@/lib/api";
import { Copy, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/duplicates")({
  head: () => ({ meta: [
    { title: "Duplicates — Free Win64 PC Cleaner" },
    { name: "description", content: "Find real duplicate files with SHA-256 verification and trash extra copies." },
  ] }),
  component: DuplicatesPage,
});

function DuplicatesPage() {
  const client = useQueryClient();
  const [root, setRoot] = useState("");
  const [minMB, setMinMB] = useState(1);
  const scan = useMutation({
    mutationFn: () => api.duplicates(root, minMB),
    onError: (error) => toast.error(error.message),
  });
  const trashGroup = useMutation({
    mutationFn: async (paths: string[]) => {
      const results = [];
      for (const filePath of paths) results.push(await api.trashFile(filePath));
      return results;
    },
    onSuccess: async (items) => {
      toast.success(`Moved ${items.length} duplicate ${items.length === 1 ? "copy" : "copies"} to Trash`);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["trash"] }),
        client.invalidateQueries({ queryKey: ["overview"] }),
      ]);
      scan.mutate();
    },
    onError: (error) => toast.error(error.message),
  });

  const groups = scan.data?.groups ?? [];
  const copies = groups.reduce((sum, group) => sum + group.copies.length, 0);
  const reclaimable = groups.reduce((sum, group) => sum + group.sizeBytes * Math.max(0, group.copies.length - 1), 0);

  return (
    <PageShell
      eyebrow="Scan"
      title="Duplicate Files"
      description="Files are grouped by exact size, then verified with SHA-256. Trash extras keeps the first listed copy and moves the others to Trash."
      actions={<Button size="sm" className="gap-1.5" disabled={scan.isPending} onClick={() => scan.mutate()}><Search className="h-3.5 w-3.5" />{scan.isPending ? "Scanning…" : "Start scan"}</Button>}
    >
      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div><span className="label-eyebrow">Root folder</span><Input value={root} onChange={(event) => setRoot(event.target.value)} className="mt-2 font-mono text-xs" placeholder="Leave blank for the current Windows user profile" /></div>
          <div><span className="label-eyebrow">Minimum file size (MB)</span><Input type="number" min={1} max={102400} value={minMB} onChange={(event) => setMinMB(Math.max(1, Number(event.target.value || 1)))} className="mt-2 font-mono text-xs" /></div>
        </div>
      </Card>
      {scan.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Scan failed: {scan.error.message}</Card> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Groups" value={scan.isPending ? "…" : groups.length.toString()} />
        <Stat label="Copies" value={copies.toString()} />
        <Stat label="Reclaimable" value={formatBytes(reclaimable)} tone="success" />
      </section>

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <Card key={group.hash} className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Copy className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-mono text-xs text-muted-foreground">sha256:{group.hash}</span>
                <Badge variant="secondary" className="font-mono text-[10px]">{group.copies.length} copies</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{formatBytes(group.sizeBytes)} each · save {formatBytes(group.sizeBytes * (group.copies.length - 1))}</span>
                <Button size="sm" variant="secondary" className="gap-1.5" disabled={trashGroup.isPending} onClick={() => trashGroup.mutate(group.copies.slice(1).map((copy) => copy.path))}><Trash2 className="h-3.5 w-3.5" />Trash extras</Button>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {group.copies.map((copy, index) => (
                <li key={copy.path} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Badge variant={index === 0 ? "outline" : "secondary"} className="w-14 justify-center text-[10px]">{index === 0 ? "keep" : "extra"}</Badge>
                  <span className="flex-1 truncate font-mono text-xs">{copy.path}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{new Date(copy.modified).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {scan.isPending ? <Card className="p-10 text-center text-sm text-muted-foreground">Scanning and hashing candidate files…</Card> : null}
        {scan.isSuccess && groups.length === 0 ? <Card className="p-10 text-center text-sm text-muted-foreground">No verified duplicate group was found.</Card> : null}
        {!scan.isPending && !scan.data ? <Card className="p-10 text-center text-sm text-muted-foreground">Start a scan to inspect real local files.</Card> : null}
      </div>
    </PageShell>
  );
}
