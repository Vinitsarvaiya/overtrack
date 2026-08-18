import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { Building2, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { EntryDialog } from "@/components/entry-dialog";
import { WorkspaceProvider, useWorkspace, can } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useCreateWorkplace } from "@/lib/rbac";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <WorkspaceProvider user={user}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <TopBar />
            <main className="flex-1 px-4 py-6 sm:px-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}

function TopBar() {
  const router = useRouter();
  const { workspaces, workspace, role, selectWorkspace, user, permissions } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [workplaceOpen, setWorkplaceOpen] = useState(false);
  const [workplaceName, setWorkplaceName] = useState("");
  const createWorkplace = useCreateWorkplace(workspace?.id);
  const capabilities = can(role, permissions);

  async function signOut() {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  }

  function submitWorkplace() {
    const name = workplaceName.trim();
    if (name.length < 2) return;
    createWorkplace.mutate(name, {
      onSuccess: (created) => {
        setWorkplaceName("");
        setWorkplaceOpen(false);
        toast.success("Workplace created");
        if (created?.id) selectWorkspace(created.id);
      },
      onError: () => toast.error("You do not have permission to create workplaces"),
    });
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      {workspace ? (
        <Select value={workspace.id} onValueChange={selectWorkspace}>
          <SelectTrigger className="h-8 w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map(({ workspace: item }) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {capabilities.createWorkplace ? (
        <Button
          size="sm"
          variant="outline"
          className="hidden sm:inline-flex"
          onClick={() => setWorkplaceOpen(true)}
        >
          <Building2 className="size-4" /> New workplace
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {capabilities.edit ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Log time
          </Button>
        ) : null}
        <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
        <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </div>
      <EntryDialog open={open} onOpenChange={setOpen} />
      <Dialog open={workplaceOpen} onOpenChange={setWorkplaceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create workplace</DialogTitle>
            <DialogDescription>
              Workplaces keep separate teams and timesheets apart.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Workplace name"
            placeholder="Head Office"
            value={workplaceName}
            onChange={(event) => setWorkplaceName(event.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={submitWorkplace}
              disabled={createWorkplace.isPending || workplaceName.trim().length < 2}
            >
              {createWorkplace.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
