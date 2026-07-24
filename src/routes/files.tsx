import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api, formatBytes, type FileEntry } from "@/lib/api";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileCode,
  Search,
  ArrowUp,
  FolderPlus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "File Manager - Free Win64 PC Cleaner" },
      { name: "description", content: "Browse real local Windows folders and perform trash-first file operations." },
    ],
  }),
  component: FilesPage,
});

function iconFor(entry: FileEntry) {
  if (entry.isDirectory) return Folder;
  if (entry.kind === "image") return ImageIcon;
  if (entry.kind === "video") return Film;
  if (entry.kind === "audio") return Music;
  if (entry.kind === "archive") return Archive;
  if (entry.kind === "code") return FileCode;
  return FileText;
}

function FilesPage() {
  const client = useQueryClient();
  const hydrated = useHydrated();
  const [currentPath, setCurrentPath] = useState("");
  const [address, setAddress] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const listing = useQuery({
    queryKey: ["files", currentPath],
    queryFn: () => api.files(currentPath || undefined),
    enabled: hydrated,
  });

  useEffect(() => {
    if (listing.data?.path) setAddress(listing.data.path);
  }, [listing.data?.path]);

  const entries = useMemo(() => {
    const source = listing.data?.entries ?? [];
    const needle = filter.trim().toLowerCase();
    return source
      .filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
  }, [listing.data?.entries, filter]);

  const selectedEntries = useMemo(() => entries.filter((entry) => selected[entry.path]), [entries, selected]);
  const selectedCount = selectedEntries.length;
  const refresh = () => client.invalidateQueries({ queryKey: ["files", currentPath] });

  const createFolder = useMutation({
    mutationFn: ({ parentPath, name }: { parentPath: string; name: string }) => api.createFolder(parentPath, name),
    onSuccess: async () => {
      toast.success("Folder created");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const trash = useMutation({
    mutationFn: async (paths: string[]) => {
      const moved = [];
      for (const path of paths) moved.push(await api.trashFile(path));
      return moved;
    },
    onSuccess: async (items) => {
      toast.success(`Moved ${items.length} item${items.length === 1 ? "" : "s"} to Trash`);
      setSelected({});
      await Promise.all([
        refresh(),
        client.invalidateQueries({ queryKey: ["trash"] }),
        client.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const navigate = (path: string) => {
    setSelected({});
    setCurrentPath(path);
  };

  const toggleSelected = (path: string, value?: boolean) => {
    setSelected((current) => {
      const next = { ...current };
      const nextValue = value ?? !current[path];
      if (nextValue) next[path] = true;
      else delete next[path];
      return next;
    });
  };

  const toggleAllVisible = (value: boolean) => {
    setSelected((current) => {
      const next = { ...current };
      for (const entry of entries) {
        if (value) next[entry.path] = true;
        else delete next[entry.path];
      }
      return next;
    });
  };

  return (
    <PageShell
      eyebrow="Explorer"
      title="File Manager"
      description="Browse the real local filesystem. Delete actions move items to Trash instead of permanently removing them."
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={!listing.data || createFolder.isPending}
            onClick={() => {
              const name = window.prompt("New folder name");
              if (name?.trim() && listing.data) createFolder.mutate({ parentPath: listing.data.path, name: name.trim() });
            }}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New folder
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            disabled={!selectedCount || trash.isPending}
            onClick={() => trash.mutate(selectedEntries.map((entry) => entry.path))}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Trash selected
          </Button>
        </>
      }
    >
      {listing.isError ? (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">Unable to open folder: {listing.error.message}</Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={!listing.data || listing.data.parent === listing.data.path}
            onClick={() => listing.data && navigate(listing.data.parent)}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (address.trim()) navigate(address.trim());
            }}
          >
            <Input value={address} onChange={(event) => setAddress(event.target.value)} className="h-8 min-w-0 font-mono text-xs" placeholder="C:\\Users\\..." />
            <Button type="submit" size="sm" variant="secondary">
              Open
            </Button>
          </form>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => listing.refetch()} disabled={!hydrated || listing.isFetching}>
            <RefreshCw className={`h-4 w-4 ${listing.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} className="h-8 pl-8 text-xs" placeholder="Filter this folder" />
          </div>
        </div>

        <div className="grid gap-2 border-b border-border bg-background/60 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-3">
          <StatusPill label="Backend" value={hydrated ? "Loaded" : "Booting"} active={hydrated && !listing.isError} />
          <StatusPill label="Folder" value={listing.isPending ? "Loading" : listing.isError ? "Error" : "Ready"} active={listing.isSuccess} />
          <StatusPill label="Selection" value={selectedCount ? `${selectedCount} selected` : "None"} active={Boolean(selectedCount)} />
        </div>

        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Checkbox
            checked={entries.length > 0 && selectedCount === entries.length}
            onCheckedChange={(value) => toggleAllVisible(Boolean(value))}
            className="h-4 w-4"
          />
          <span>Name</span>
          <span className="text-right">Modified</span>
          <span className="w-24 text-right">Size</span>
        </div>
        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const Icon = iconFor(entry);
            const active = Boolean(selected[entry.path]);

            return (
              <li
                key={entry.path}
                onClick={() => toggleSelected(entry.path)}
                onDoubleClick={() => entry.isDirectory && navigate(entry.path)}
                className={`grid cursor-default grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-2.5 text-sm transition ${
                  active ? "bg-accent" : "hover:bg-accent/60"
                }`}
              >
                <Checkbox
                  checked={active}
                  onCheckedChange={(value) => toggleSelected(entry.path, Boolean(value))}
                  className="h-4 w-4"
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className={`h-4 w-4 ${entry.isDirectory ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="truncate">{entry.name}</span>
                  {entry.isDirectory ? <Badge variant="secondary" className="text-[10px]">folder</Badge> : null}
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">{new Date(entry.modified).toLocaleString()}</span>
                <span className="w-24 text-right font-mono text-[11px] text-muted-foreground">
                  {entry.isDirectory ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(entry.path);
                      }}
                    >
                      Open
                    </Button>
                  ) : entry.sizeBytes === null ? (
                    "..."
                  ) : (
                    formatBytes(entry.sizeBytes)
                  )}
                </span>
              </li>
            );
          })}
          {listing.isPending ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">Reading local directory...</li> : null}
          {!listing.isPending && entries.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">This folder is empty or no item matches the filter.</li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="truncate font-mono">{listing.data?.path ?? "Waiting for backend"}</span>
          <span>{entries.length} items</span>
        </div>
      </Card>
    </PageShell>
  );
}

function StatusPill({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}
