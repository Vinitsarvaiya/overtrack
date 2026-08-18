import { z } from "zod";

export const memberIdSchema = z.object({ memberId: z.string().uuid() });

export const addMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().email().max(200),
  role: z.enum(["admin", "manager", "member", "viewer"]),
  customRoleId: z.string().uuid().nullable().optional(),
});

export const createWorkplaceSchema = z.object({
  fromWorkspaceId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
});
