import type { Member, Profile } from "@/features/members/types";

export type WorkspaceRole = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type WorkspaceMemberWithProfile = Member & { profile: Profile | null };
