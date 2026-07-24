import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { quarantine as initial, formatSize } from "@/lib/mock-data";
import { toast } from "sonner";
import { Undo2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/quarantine")({
  head: () => ({
    meta: [
      { title: "Quarantine — Free Win64 PC Cleaner" },
      { name: "description", content: "Every deletion goes here first. Restore or permanently remove after review." },
      { property: "og:title", content: "Quarantine — Free Win64 PC Cleaner" },
      { property: "og:description", content: "Every deletion goes here first — restore or purge after review." },
    ],
  }),
  component: QuarantinePage,
});

function QuarantinePage() {
  const [items, setItems] = useState(initial);
  const total = items.reduce((s, i) => s + i.sizeMB, 0);

  return (
    <PageShell
      eyebrow="Safety"
      title="Quarantine"
      description="Files removed by the cleaner and duplicate finder live here until you restore or purge them. Auto-expires after 30 days."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Items" value={items.length.toString()} />
        <Stat label="Reserved" value={formatSize(total)} />
        <Stat label="Auto-expire" value="30 days" hint="configurable" />
      </section>

      <Card className="p-0">
        {items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Quarantine is empty.</div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-xs">{i.originalPath}</span>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{i.category}</Badge>
                    <span>deleted {i.deletedAt}</span>
                    <span>· expires {i.expiresAt}</span>
                  </div>
                </div>
                <span className="w-20 text-right font-mono text-sm tabular-nums">{formatSize(i.sizeMB)}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => {
                      setItems((cur) => cur.filter((x) => x.id !== i.id));
                      toast.success("Restored to original location");
                    }}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => {
                      setItems((cur) => cur.filter((x) => x.id !== i.id));
                      toast("Permanently deleted");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Purge
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
