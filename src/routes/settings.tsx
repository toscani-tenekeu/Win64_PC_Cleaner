import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Plus, X, Save } from "lucide-react";
import { toast } from "sonner";

type LocalSettings = {
  theme: string;
  units: string;
  quarantineRetentionDays: number;
  confirmDestructiveActions: boolean;
  moveToQuarantine: boolean;
  duplicateHashAlgorithm: string;
  scanMaxFiles: number;
  protectedPaths: string[];
};

const defaults: LocalSettings = {
  theme: "dark",
  units: "binary",
  quarantineRetentionDays: 30,
  confirmDestructiveActions: true,
  moveToQuarantine: true,
  duplicateHashAlgorithm: "sha256",
  scanMaxFiles: 50000,
  protectedPaths: [],
};

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings — Free Win64 PC Cleaner" },
    { name: "description", content: "Local SQLite settings, protected folders and quarantine behavior." },
  ] }),
  component: SettingsPage,
});

function SettingsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: api.settings, enabled: typeof window !== "undefined" });
  const [settings, setSettings] = useState<LocalSettings>(defaults);
  const [newPath, setNewPath] = useState("");

  useEffect(() => {
    if (query.data) setSettings({ ...defaults, ...(query.data as Partial<LocalSettings>) });
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api.saveSettings(settings),
    onSuccess: async (saved) => {
      setSettings({ ...defaults, ...(saved as Partial<LocalSettings>) });
      toast.success("Settings saved to SQLite");
      await client.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <PageShell
      eyebrow="Configure"
      title="Settings"
      description="Preferences and protected paths are stored locally in SQLite. There is no account, cloud sync or password."
      actions={<Button size="sm" className="gap-1.5" disabled={save.isPending || query.isPending} onClick={() => save.mutate()}><Save className="h-3.5 w-3.5" />{save.isPending ? "Saving…" : "Save"}</Button>}
    >
      {query.isError ? <Card className="border-destructive/40 p-4 text-sm text-destructive">Unable to load settings: {query.error.message}</Card> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <span className="label-eyebrow">Appearance</span>
          <div className="mt-4 space-y-4">
            <SettingRow label="Theme" hint="Stored for the local application UI.">
              <Select value={settings.theme} onValueChange={(value) => setSettings((current) => ({ ...current, theme: value }))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dark">Dark</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="system">System</SelectItem></SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Units" hint="Binary uses 1024; decimal uses 1000.">
              <Select value={settings.units} onValueChange={(value) => setSettings((current) => ({ ...current, units: value }))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="binary">Binary (GiB)</SelectItem><SelectItem value="decimal">Decimal (GB)</SelectItem></SelectContent>
              </Select>
            </SettingRow>
          </div>
        </Card>

        <Card className="p-5">
          <span className="label-eyebrow">Safety</span>
          <div className="mt-4 space-y-4">
            <SettingRow label="Move to Quarantine before delete" hint="Recommended and used by the file manager and cleaner."><Switch checked={settings.moveToQuarantine} onCheckedChange={(value) => setSettings((current) => ({ ...current, moveToQuarantine: value }))} /></SettingRow>
            <SettingRow label="Confirm destructive actions" hint="Keep explicit confirmation in the UI."><Switch checked={settings.confirmDestructiveActions} onCheckedChange={(value) => setSettings((current) => ({ ...current, confirmDestructiveActions: value }))} /></SettingRow>
            <SettingRow label="Quarantine retention" hint="Days before an item becomes eligible for purge."><Input type="number" min={1} max={3650} value={settings.quarantineRetentionDays} onChange={(event) => setSettings((current) => ({ ...current, quarantineRetentionDays: Number(event.target.value || 30) }))} className="w-24" /></SettingRow>
            <SettingRow label="Scan file limit" hint="Upper bound used by large-file and duplicate scans."><Input type="number" min={1000} max={250000} step={1000} value={settings.scanMaxFiles} onChange={(event) => setSettings((current) => ({ ...current, scanMaxFiles: Number(event.target.value || 50000) }))} className="w-28" /></SettingRow>
            <SettingRow label="Duplicate hash" hint="Cryptographic verification after size grouping.">
              <Select value={settings.duplicateHashAlgorithm} onValueChange={(value) => setSettings((current) => ({ ...current, duplicateHashAlgorithm: value }))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sha256">SHA-256</SelectItem></SelectContent>
              </Select>
            </SettingRow>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <span className="label-eyebrow">Protected folders</span>
          <p className="mt-1 text-xs text-muted-foreground">Manual file operations are blocked inside these paths. Known cleanup categories use narrowly defined exceptions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {settings.protectedPaths.map((protectedPath) => <Badge key={protectedPath} variant="secondary" className="gap-1.5 py-1 font-mono text-[11px]">{protectedPath}<button onClick={() => setSettings((current) => ({ ...current, protectedPaths: current.protectedPaths.filter((value) => value !== protectedPath) }))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}
          </div>
          <div className="mt-4 flex gap-2">
            <Input value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder="C:\\path\\to\\protect" className="font-mono text-xs" />
            <Button variant="secondary" onClick={() => { const value = newPath.trim(); if (value && !settings.protectedPaths.includes(value)) { setSettings((current) => ({ ...current, protectedPaths: [...current.protectedPaths, value] })); setNewPath(""); } }}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <span className="label-eyebrow">About</span>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow k="Version" v="0.2.0" /><InfoRow k="Backend" v="Node.js + Express" /><InfoRow k="Database" v="better-sqlite3 · WAL" /><InfoRow k="Target" v="Windows 10/11 · x64" /><InfoRow k="Authentication" v="None · local only" /><InfoRow k="Telemetry" v="Off" />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><div className="flex flex-col"><Label className="text-sm">{label}</Label>{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</div>{children}</div>;
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b border-border py-2 last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-mono text-xs">{v}</span></div>;
}
