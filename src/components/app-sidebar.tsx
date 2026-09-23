import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Table2,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { can, useWorkspace } from "@/components/workspace-provider";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, show: () => true },
  { title: "Timesheet", url: "/timesheet", icon: Table2, show: () => true },
  { title: "Calendar", url: "/calendar", icon: CalendarDays, show: () => true },

  {
    title: "Members",
    url: "/members",
    icon: Users,
    show: (caps: ReturnType<typeof can>) => caps.manageMembers,
  },
  {
    title: "Roles",
    url: "/roles",
    icon: ShieldCheck,
    show: (caps: ReturnType<typeof can>) => caps.manageRoles,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    show: (caps: ReturnType<typeof can>) => caps.editSettings,
  },
] as const;

export function AppSidebar() {
  const router = useRouter();
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const { role, permissions, user } = useWorkspace();
  const capabilities = can(role, permissions);
  const visible = items.filter((item) => item.show(capabilities));
  async function signOut() {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CalendarClock className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            OverTrack
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <span
          className="truncate px-2 pt-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
          title={user?.email}
        >
          {user?.email}
        </span>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
