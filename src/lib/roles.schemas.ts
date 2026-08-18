import { z } from "zod";

export const roleIdSchema = z.object({ roleId: z.string().uuid() });

export const createRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().nullable(),
});

export const renameRoleSchema = z.object({
  roleId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().nullable(),
});

export const duplicateRoleSchema = z.object({
  roleId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
});

export const togglePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionKey: z.string().min(1).max(64),
  enabled: z.boolean(),
});

export const assignMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["owner", "admin", "manager", "member", "viewer"]),
  customRoleId: z.string().uuid().nullable().optional(),
});
