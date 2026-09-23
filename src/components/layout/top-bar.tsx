import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EntryDialog } from "@/features/entries/components/entry-dialog";
import { useWorkspace } from "@/features/workspaces/context/workspace-provider";
import { can } from "@/features/roles/lib/capabilities";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCreateWorkplace } from "@/features/workspaces/hooks/use-create-workplace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TopBar() {
  const { workspaces, workspace, role, selectWorkspace, permissions } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [workplaceOpen, setWorkplaceOpen] = useState(false);
  const [workplaceName, setWorkplaceName] = useState("");
  const createWorkplace = useCreateWorkplace(workspace?.id);
  const capabilities = can(role, permissions);

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
