import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { largeFiles, formatSize } from "@/lib/mock-data";

export const Route = createFileRoute("/large-files")({
  head: () => ({
    meta: [
      { title: "Large Files — Broomstick" },
      { name: "description", content: "Find oversized files by size, age and type. Move to Quarantine, don't nuke." },
      { property: "og:title", content: "Large Files — Broomstick" },
      { property: "og:description", content: "Find oversized files by size, age and type." },
    ],
  }),
  component: LargeFilesPage,
});

function LargeFilesPage() {
  const [minMB, setMinMB] = useState(1000);
  const filtered = largeFiles.filter((f) => f.sizeMB >= minMB);

  return (
    <PageShell
      eyebrow="Filter"
      title="Large & Old Files"
      description="Isolate space hogs by size and age. ISOs, VM disks, archives and long-forgotten downloads usually top the list."
      actions={
        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5">
          <span className="label-eyebrow">Min size</span>
          <Slider
            className="w-40"
            value={[minMB]}
            min={100}
            max={10000}
            step={100}
            onValueChange={(v) => setMinMB(v[0])}
          />
          <span className="w-16 text-right font-mono text-xs tabular-nums">{formatSize(minMB)}</span>
        </div>
      }
    >
      <Card className="p-0">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>File</span>
          <span className="text-right">Kind</span>
          <span className="text-right">Modified</span>
          <span className="text-right">Size</span>
        </div>
        <ul className="divide-y divide-border">
          {filtered.map((f) => (
            <li key={f.path + f.name} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{f.name}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">{f.path}</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">{f.kind}</Badge>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{f.modified}</span>
              <span className="w-20 text-right font-mono text-sm tabular-nums">{formatSize(f.sizeMB)}</span>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              No files above {formatSize(minMB)} in the last scan.
            </li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {largeFiles.length} shown
          </span>
          <Button size="sm" variant="secondary" disabled={filtered.length === 0}>
            Move selection to Quarantine
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
