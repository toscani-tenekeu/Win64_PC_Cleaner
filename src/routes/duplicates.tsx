import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { duplicateGroups, formatSize } from "@/lib/mock-data";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/duplicates")({
  head: () => ({
    meta: [
      { title: "Duplicates — Free Win64 PC Cleaner" },
      { name: "description", content: "Byte-verified duplicate groups. Keep the copy you want; the rest go to Quarantine." },
      { property: "og:title", content: "Duplicates — Free Win64 PC Cleaner" },
      { property: "og:description", content: "Byte-verified duplicate groups with safe removal." },
    ],
  }),
  component: DuplicatesPage,
});

function DuplicatesPage() {
  const totalGroups = duplicateGroups.length;
  const reclaim = duplicateGroups.reduce(
    (s, g) => s + g.sizeMB * Math.max(0, g.copies.length - 1),
    0,
  );
  const totalCopies = duplicateGroups.reduce((s, g) => s + g.copies.length, 0);

  return (
    <PageShell
      eyebrow="Find"
      title="Duplicate Files"
      description="Groups are matched by SHA-256 with optional byte-by-byte verification. Removing duplicates moves them to Quarantine — the kept copy is left untouched."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Groups" value={totalGroups.toString()} />
        <Stat label="Copies" value={totalCopies.toString()} />
        <Stat label="Reclaimable" value={formatSize(reclaim)} tone="success" />
      </section>

      <div className="flex flex-col gap-3">
        {duplicateGroups.map((g) => (
          <Card key={g.hash} className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Copy className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs text-muted-foreground">sha256:{g.hash}…</span>
                <Badge variant="secondary" className="font-mono text-[10px]">{g.copies.length} copies</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatSize(g.sizeMB)} each · save {formatSize(g.sizeMB * (g.copies.length - 1))}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => toast.success("Duplicates queued for quarantine")}
                >
                  Keep oldest
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {g.copies.map((c, i) => (
                <li key={c.path} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <input
                    type="radio"
                    name={`keep-${g.hash}`}
                    defaultChecked={i === 0}
                    className="h-3.5 w-3.5 accent-[color:var(--color-primary)]"
                  />
                  <span className="flex-1 truncate font-mono text-xs">{c.path}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{c.modified}</span>
                  {i === 0 ? <Badge variant="outline" className="text-[10px]">keep</Badge> : <Badge variant="secondary" className="text-[10px]">remove</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
