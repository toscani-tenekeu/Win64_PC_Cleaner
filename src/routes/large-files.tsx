import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { api, formatBytes } from "@/lib/api";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/large-files")({
  head: () => ({ meta: [
    { title: "Large Files — Free Win64 PC Cleaner" },
    { name: "description", content: "Scan a real local folder for oversized files and move selected results to quarantine." },
  ] }),
  component: LargeFilesPage,
});

function LargeFilesPage() {
  const client = useQueryClient();
  const [root, setRoot] = useState("");
  const [minMB, setMinMB] = useState(1000);
  const scan = useMutation({ mutationFn: () => api.largeFiles(root, minMB), onError: (error) => toast.error(error.message) });
  const quarantine = useMutation({
    mutationFn: api.quarantineFile,
    onSuccess: async () => {
      toast.success("Moved to Quarantine");
      await Promise.all([client.invalidateQueries({ queryKey: ["quarantine"] }), client.invalidateQueries({ queryKey: ["overview"] })]);
      scan.mutate();
    },
    onError: (error) => toast.error(error.message),
  });
  const files = scan.data?.files ?? [];
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  return (
    <PageShell
      eyebrow="Scan"
      title="Large Files"
      description="Choose a local folder or leave it blank to scan the current Windows user profile. The scan respects the configured file limit."
      actions={<Button size="sm" className="gap-1.5" disabled={scan.isPending} onClick={() => scan.mutate()}><Search className="h-3.5 w-3.5" />{scan.isPending ? "Scanning…" : "Start scan"}</Button>}
    >
      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div><span className="label-eyebrow">Root folder</span><Input value={root} onChange={(event) => setRoot(event.target.value)} className="mt-2 font-mono text-xs" placeholder="Leave blank for the current Windows user profile" /></div>
          <div><div className="flex items-center justify-between"><span className="label-eyebrow">Minimum size</span><span className="font-mono text-xs">{formatBytes(minMB * 1024 * 1024)}</span></div><Slider className="mt-4" value={[minMB]} min={10} max={10000} step={10} onValueChange={(value) => setMinMB(value[0])} /></div>
        </div>
      </Card>
      {scan.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Scan failed: {scan.error.message}</Card> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Matches" value={scan.isPending ? "…" : files.length.toString()} />
        <Stat label="Combined size" value={formatBytes(totalBytes)} tone="warning" />
        <Stat label="Scanned root" value={scan.data ? "Ready" : "Not scanned"} hint={scan.data?.root || "choose a folder"} />
      </section>

      <Card className="p-0">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground"><span>File</span><span>Kind</span><span className="text-right">Modified</span><span className="w-28 text-right">Size</span></div>
        <ul className="divide-y divide-border">
          {files.map((file) => <li key={file.path} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-col"><span className="truncate text-sm font-medium">{file.name}</span><span className="truncate font-mono text-[11px] text-muted-foreground">{file.directory}</span></div>
            <Badge variant="secondary" className="text-[10px]">{file.kind}</Badge>
            <span className="font-mono text-xs text-muted-foreground">{new Date(file.modified).toLocaleDateString()}</span>
            <div className="flex w-28 items-center justify-end gap-2"><span className="font-mono text-sm">{formatBytes(file.sizeBytes)}</span><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" disabled={quarantine.isPending} onClick={() => quarantine.mutate(file.path)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
          </li>)}
          {scan.isPending ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">Scanning files recursively…</li> : null}
          {scan.isSuccess && files.length === 0 ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">No file meets the selected threshold.</li> : null}
          {!scan.isPending && !scan.data ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">Start a scan to display real local files.</li> : null}
        </ul>
      </Card>
    </PageShell>
  );
}
