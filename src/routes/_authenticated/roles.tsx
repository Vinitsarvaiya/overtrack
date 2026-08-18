import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { can, useWorkspace } from "@/components/workspace-provider";
import { groupPermissions } from "@/lib/permissions";
import {
  usePermissionCatalog,
  useRoleMutations,
  useRolePermissions,
  useWorkspaceRoles,
} from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "Role Management — OverTrack" },
      {
        name: "description",
        content: "Create manager roles and switch individual permissions on or off.",
      },
      { property: "og:title", content: "Role Management — OverTrack" },
      {
        property: "og:description",
        content: "Create manager roles and switch individual permissions on or off.",
      },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const { workspace, role, permissions } = useWorkspace();
  const capabilities = can(role, permissions);
  const { data: catalog = [], isLoading: catalogLoading } = usePermissionCatalog();
  const { data: roles = [], isLoading: rolesLoading } = useWorkspaceRoles(workspace?.id);
  const { data: grants = {} } = useRolePermissions(workspace?.id);
  const mutations = useRoleMutations(workspace?.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const selected = roles.find((item) => item.id === selectedId) ?? roles[0] ?? null;

  useEffect(() => {
    if (selected) setRenameValue(selected.name);
  }, [selected?.id, selected?.name]);

  if (!capabilities.manageRoles) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role management is restricted</CardTitle>
            <CardDescription>
              Only workspace owners and admins can create roles and change permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const granted = selected ? (grants[selected.id] ?? []) : [];
  const groups = groupPermissions(catalog);

  async function handleCreate() {
    const name = newName.trim();
    if (name.length < 2) return;
    try {
      const created = await mutations.create.mutateAsync({ name });
      setSelectedId(created.id);
      setNewName("");
      toast.success("Role created");
    } catch {
      toast.error("Could not create that role");
    }
  }

  async function handleToggle(permissionKey: string, enabled: boolean) {
    if (!selected) return;
    try {
      await mutations.toggle.mutateAsync({ roleId: selected.id, permissionKey, enabled });
    } catch {
      toast.error("You do not have permission to change this");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Role management</h1>
        <p className="text-sm text-muted-foreground">
          Managers start with no access. Switch on exactly what each role may do — the server
          enforces every rule, not just the interface.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Manager roles</CardTitle>
            <CardDescription>Roles you can assign on the Members page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                aria-label="New role name"
                placeholder="Shift Manager"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreate();
                }}
              />
              <Button
                size="icon"
                aria-label="Create role"
                onClick={() => void handleCreate()}
                disabled={mutations.create.isPending || newName.trim().length < 2}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {rolesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : roles.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No manager roles yet. Create one to start granting permissions.
              </p>
            ) : (
              <nav className="space-y-1" aria-label="Manager roles">
                {roles.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-current={selected?.id === item.id}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selected?.id === item.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <Badge variant="secondary">{(grants[item.id] ?? []).length}</Badge>
                  </button>
                ))}
              </nav>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <Input
                  aria-label="Role name"
                  className="max-w-xs"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={() => {
                    const name = renameValue.trim();
                    if (name.length < 2 || name === selected.name) return;
                    mutations.rename.mutate(
                      { roleId: selected.id, name },
                      {
                        onSuccess: () => toast.success("Role renamed"),
                        onError: () => toast.error("Rename failed"),
                      },
                    );
                  }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        mutations.duplicate.mutate(
                          { roleId: selected.id, name: `${selected.name} copy` },
                          {
                            onSuccess: () => toast.success("Role duplicated"),
                            onError: () => toast.error("Duplicate failed"),
                          },
                        )
                      }
                    >
                      <Copy className="mr-1.5 size-3.5" /> Duplicate
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy this role and its permissions</TooltipContent>
                </Tooltip>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="mr-1.5 size-3.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{selected.name}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Members using this role lose all granted access immediately.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          mutations.remove.mutate(selected.id, {
                            onSuccess: () => {
                              setSelectedId(null);
                              toast.success("Role deleted");
                            },
                            onError: () => toast.error("Delete failed"),
                          });
                        }}
                      >
                        Delete role
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <CardDescription>
                {granted.length} of {catalog.length} permissions enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {catalogLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                groups.map((group) => (
                  <section key={group.category} className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.category}
                    </h2>
                    <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {group.items.map((permission) => {
                        const enabled = granted.includes(permission.key);
                        return (
                          <div
                            key={permission.key}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40"
                          >
                            <Label
                              htmlFor={`perm-${permission.key}`}
                              className="cursor-pointer text-sm font-normal"
                            >
                              {permission.label}
                            </Label>
                            <Switch
                              id={`perm-${permission.key}`}
                              checked={enabled}
                              onCheckedChange={(next) => void handleToggle(permission.key, next)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select a role</CardTitle>
              <CardDescription>
                Create a manager role on the left, then switch permissions on here.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
