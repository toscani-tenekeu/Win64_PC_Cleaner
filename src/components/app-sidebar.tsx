import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderTree,
  PieChart,
  Sparkles,
  Trash2,
  Copy,
  FileBox,
  Package,
  Rocket,
  Settings as SettingsIcon,
  HardDrive,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const overview = [{ title: "Overview", url: "/", icon: LayoutDashboard }];

const manage = [
  { title: "File Manager", url: "/files", icon: FolderTree },
  { title: "Storage Analyzer", url: "/storage", icon: PieChart },
  { title: "Cleaner", url: "/cleaner", icon: Sparkles },
  { title: "Duplicates", url: "/duplicates", icon: Copy },
  { title: "Large Files", url: "/large-files", icon: FileBox },
];

const system = [
  { title: "Applications", url: "/applications", icon: Package },
  { title: "Startup", url: "/startup", icon: Rocket },
  { title: "Trash", url: "/trash", icon: Trash2 },
];

const bottom = [{ title: "Settings", url: "/settings", icon: SettingsIcon }];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) => (path === "/" ? currentPath === "/" : currentPath.startsWith(path));

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[],
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel className="label-eyebrow px-2">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HardDrive className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Free Win64 PC Cleaner</span>
            <span className="font-mono text-[10px] text-muted-foreground">v0.1 - win64</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Overview", overview)}
        {renderGroup("Manage", manage)}
        {renderGroup("System", system)}
      </SidebarContent>
      <SidebarFooter>{renderGroup("", bottom)}</SidebarFooter>
    </Sidebar>
  );
}
