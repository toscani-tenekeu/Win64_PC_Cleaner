import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Stat } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { startupEntries as initial } from "@/lib/mock-data";

export const Route = createFileRoute("/startup")({
  head: () => ({
    meta: [
      { title: "Startup — Broomstick" },
      { name: "description", content: "Manage what runs at Windows login. Toggle without deleting entries." },
      { property: "og:title", content: "Startup — Broomstick" },
      { property: "og:description", content: "Manage what runs at Windows login." },
    ],
  }),
  component: StartupPage,
});

const impactStyle = {
  low: "text-muted-foreground",
  medium: "text-warning",
  high: "text-destructive",
};

function StartupPage() {
  const [entries, setEntries] = useState(initial);
  const enabled = entries.filter((e) => e.enabled).length;
  const highImpact = entries.filter((e) => e.enabled && e.impact === "high").length;

  return (
    <PageShell
      eyebrow="Boot"
      title="Startup Manager"
      description="Toggle programs that launch with Windows. Disabling never deletes the entry — it can be restored later."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Enabled" value={`${enabled} / ${entries.length}`} />
        <Stat label="High impact enabled" value={highImpact.toString()} tone={highImpact > 0 ? "warning" : "success"} />
        <Stat label="Registered sources" value="3" hint="registry · folder · task" />
      </section>

      <Card className="p-0">
        <ul className="divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-4 px-4 py-3">
              <Switch
                checked={e.enabled}
                onCheckedChange={(v) =>
                  setEntries((cur) => cur.map((x) => (x.id === e.id ? { ...x, enabled: v } : x)))
                }
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{e.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{e.source}</Badge>
                </div>
                <span className="truncate font-mono text-[11px] text-muted-foreground">{e.path}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-xs font-medium capitalize ${impactStyle[e.impact]}`}>{e.impact} impact</span>
                <span className="text-[11px] text-muted-foreground">{e.publisher}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </PageShell>
  );
}
