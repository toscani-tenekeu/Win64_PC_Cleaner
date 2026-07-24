import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Folder,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileCode,
  Search,
  ArrowUp,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "File Manager — Broomstick" },
      { name: "description", content: "Browse drives and folders with dual-pane, breadcrumb navigation." },
      { property: "og:title", content: "File Manager — Broomstick" },
      { property: "og:description", content: "Browse drives and folders with dual-pane navigation." },
    ],
  }),
  component: FilesPage,
});

type Entry = { name: string; kind: "folder" | "file"; size?: string; ext?: string; modified: string };

const sample: Entry[] = [
  { name: "Documents", kind: "folder", modified: "2026-07-20" },
  { name: "Downloads", kind: "folder", modified: "2026-07-24" },
  { name: "Videos", kind: "folder", modified: "2026-07-18" },
  { name: "Pictures", kind: "folder", modified: "2026-07-10" },
  { name: "Projects", kind: "folder", modified: "2026-07-23" },
  { name: "notes.md", kind: "file", ext: "md", size: "12 KB", modified: "2026-07-24" },
  { name: "budget-2026.xlsx", kind: "file", ext: "xlsx", size: "184 KB", modified: "2026-07-22" },
  { name: "vacation.mp4", kind: "file", ext: "mp4", size: "1.2 GB", modified: "2026-06-11" },
  { name: "screenshot.png", kind: "file", ext: "png", size: "842 KB", modified: "2026-07-24" },
  { name: "archive.zip", kind: "file", ext: "zip", size: "412 MB", modified: "2026-05-02" },
  { name: "song.mp3", kind: "file", ext: "mp3", size: "6.4 MB", modified: "2026-04-14" },
  { name: "index.ts", kind: "file", ext: "ts", size: "3 KB", modified: "2026-07-23" },
];

function iconFor(e: Entry) {
  if (e.kind === "folder") return Folder;
  const ext = e.ext ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return ImageIcon;
  if (["mp4", "mkv", "mov", "avi"].includes(ext)) return Film;
  if (["mp3", "flac", "wav"].includes(ext)) return Music;
  if (["zip", "7z", "tar", "gz"].includes(ext)) return Archive;
  if (["ts", "tsx", "js", "py", "rs", "go"].includes(ext)) return FileCode;
  return FileText;
}

function FilesPage() {
  const [view, setView] = useState<"list" | "grid">("list");
  return (
    <PageShell
      eyebrow="Explorer"
      title="File Manager"
      description="Dual-pane navigation with breadcrumbs, previews and safe operations. Read-only preview — wire to the SQLite/Node backend to enable writes."
    >
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono">
            <span className="text-muted-foreground">C:</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-muted-foreground">Users</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-muted-foreground">alex</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-foreground">Home</span>
          </div>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8 text-xs" placeholder="Filter in this folder" />
          </div>
          <div className="flex rounded-md border border-border p-0.5">
            <Button
              size="icon"
              variant={view === "list" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setView("list")}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={view === "grid" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <Pane title="C:\Users\alex" entries={sample} view={view} />
          <Pane title="D:\Projects" entries={sample.slice(0, 6)} view={view} />
        </div>
      </Card>

      <div className="text-xs text-muted-foreground">
        Tip: dual-pane makes copy/move a one-drag operation. Backend hookup replaces this mock listing with a live directory read.
      </div>
    </PageShell>
  );
}

function Pane({ title, entries, view }: { title: string; entries: Entry[]; view: "list" | "grid" }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between border-b border-border bg-surface/60 px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{title}</span>
        <Badge variant="secondary" className="font-mono text-[10px]">{entries.length} items</Badge>
      </div>
      {view === "list" ? (
        <ul className="divide-y divide-border">
          {entries.map((e) => {
            const Icon = iconFor(e);
            return (
              <li key={e.name} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/60">
                <Icon className={`h-4 w-4 ${e.kind === "folder" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="flex-1 truncate">{e.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{e.size ?? "—"}</span>
                <span className="hidden font-mono text-[11px] text-muted-foreground tabular-nums sm:inline">{e.modified}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          {entries.map((e) => {
            const Icon = iconFor(e);
            return (
              <div key={e.name} className="flex flex-col items-center gap-2 rounded-md border border-border p-3 text-center hover:border-primary/40">
                <Icon className={`h-8 w-8 ${e.kind === "folder" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="truncate text-xs">{e.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{e.size ?? ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
