import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyWorkspaces } from "@/features/workspaces/hooks/use-workspaces";
import { type Workspace } from "@/features/workspaces/types";
import { useMyPermissions } from "@/features/roles/hooks/use-roles";
import type { Tables } from "@/integrations/supabase/types";

type Role = Tables<"workspace_members">["role"];

type WorkspaceContextValue = {
  user: User | null;
  workspaces: { role: Role; workspace: Workspace }[];
  workspace: Workspace | null;
  role: Role | null;
  loading: boolean;
  selectWorkspace: (id: string) => void;
  /** Permission keys granted to the signed-in user, resolved server-side. */
  permissions: string[];
  has: (permission: string) => boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = "overtrack.workspace";

export function WorkspaceProvider({ user, children }: { user: User; children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: workspaces = [], isLoading } = useMyWorkspaces(user.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setActiveId(localStorage.getItem(STORAGE_KEY));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("workspace-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Every user needs at least one workspace to record time against.
  useEffect(() => {
    if (isLoading || creating || workspaces.length > 0) return;
    setCreating(true);
    void (async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .insert({ name: "My Workspace", owner_id: user.id })
        .select()
        .single();
      if (!error && data) {
        await supabase
          .from("workspace_members")
          .insert({ workspace_id: data.id, user_id: user.id, role: "owner" });
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      }
      setCreating(false);
    })();
  }, [isLoading, workspaces.length, creating, user.id, queryClient]);

  const current = useMemo(() => {
    return workspaces.find((item) => item.workspace.id === activeId) ?? workspaces[0] ?? null;
  }, [workspaces, activeId]);

  const { data: permissions = [] } = useMyPermissions(current?.workspace.id);

  const value: WorkspaceContextValue = {
    user,
    workspaces,
    workspace: current?.workspace ?? null,
    role: current?.role ?? null,
    loading: isLoading || (workspaces.length === 0 && creating),
    permissions,
    has: (permission: string) => permissions.includes(permission),
    selectWorkspace: (id) => {
      localStorage.setItem(STORAGE_KEY, id);
      setActiveId(id);
    },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
