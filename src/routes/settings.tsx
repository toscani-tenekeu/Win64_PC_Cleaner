import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Broomstick" },
      { name: "description", content: "Theme, units, protected folders and quarantine behavior." },
      { property: "og:title", content: "Settings — Broomstick" },
      { property: "og:description", content: "Theme, units, protected folders and quarantine behavior." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [protectedPaths, setProtectedPaths] = useState<string[]>([
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "%USERPROFILE%\\OneDrive",
  ]);
  const [newPath, setNewPath] = useState("");

  return (
    <PageShell
      eyebrow="Configure"
      title="Settings"
      description="Preferences are stored locally in SQLite via the Node service. No account, no sync, no telemetry."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <span className="label-eyebrow">Appearance</span>
          <div className="mt-4 space-y-4">
            <SettingRow label="Theme" hint="Dark is the default Supabase-inspired look.">
              <Select defaultValue="dark">
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Units" hint="Binary uses 1024 · decimal uses 1000.">
              <Select defaultValue="binary">
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="binary">Binary (GiB)</SelectItem>
                  <SelectItem value="decimal">Decimal (GB)</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </div>
        </Card>

        <Card className="p-5">
          <span className="label-eyebrow">Safety</span>
          <div className="mt-4 space-y-4">
            <SettingRow label="Move to Quarantine before delete" hint="Recommended. Auto-expires after retention period.">
              <Switch defaultChecked />
            </SettingRow>
            <SettingRow label="Confirm every destructive action" hint="Extra prompt before cleanup runs.">
              <Switch defaultChecked />
            </SettingRow>
            <SettingRow label="Quarantine retention" hint="Days before quarantined items are purged.">
              <Input type="number" defaultValue={30} className="w-24" />
            </SettingRow>
            <SettingRow label="Hash algorithm" hint="Used by the duplicate finder.">
              <Select defaultValue="sha256">
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xxh3">xxh3 (fast)</SelectItem>
                  <SelectItem value="blake3">BLAKE3</SelectItem>
                  <SelectItem value="sha256">SHA-256</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <span className="label-eyebrow">Protected folders</span>
          <p className="mt-1 text-xs text-muted-foreground">
            These paths are excluded from every scan and cleanup. Windows and Program Files are protected by default.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {protectedPaths.map((p) => (
              <Badge key={p} variant="secondary" className="gap-1.5 py-1 font-mono text-[11px]">
                {p}
                <button
                  onClick={() => setProtectedPaths((cur) => cur.filter((x) => x !== p))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="C:\path\to\protect"
              className="font-mono text-xs"
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (newPath.trim()) {
                  setProtectedPaths((cur) => [...cur, newPath.trim()]);
                  setNewPath("");
                }
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <span className="label-eyebrow">About</span>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow k="Version" v="0.1.0 (frontend preview)" />
            <InfoRow k="Backend" v="SQLite + Node.js (planned)" />
            <InfoRow k="Target" v="Windows 10/11 · x64" />
            <InfoRow k="Telemetry" v="Off — local-only" />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col">
        <Label className="text-sm">{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-xs tabular-nums">{v}</span>
    </div>
  );
}
