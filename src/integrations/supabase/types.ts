export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      entry_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entry_id: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entry_id: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entry_id?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_name: string | null
          attachment_path: string | null
          break_end: string | null
          break_minutes: number
          break_start: string | null
          category: string
          created_at: string
          end_time: string
          entry_date: string
          id: string
          locked: boolean
          notes: string | null
          overtime_override: number | null
          rejection_reason: string | null
          start_time: string
          status: Database["public"]["Enums"]["entry_status"]
          submitted_at: string | null
          tags: string[]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          break_end?: string | null
          break_minutes?: number
          break_start?: string | null
          category?: string
          created_at?: string
          end_time: string
          entry_date: string
          id?: string
          locked?: boolean
          notes?: string | null
          overtime_override?: number | null
          rejection_reason?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["entry_status"]
          submitted_at?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          break_end?: string | null
          break_minutes?: number
          break_start?: string | null
          category?: string
          created_at?: string
          end_time?: string
          entry_date?: string
          id?: string
          locked?: boolean
          notes?: string | null
          overtime_override?: number | null
          rejection_reason?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["entry_status"]
          submitted_at?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          default_break_minutes: number
          email: string | null
          full_name: string | null
          id: string
          standard_daily_hours: number
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          default_break_minutes?: number
          email?: string | null
          full_name?: string | null
          id: string
          standard_daily_hours?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          default_break_minutes?: number
          email?: string | null
          full_name?: string | null
          id?: string
          standard_daily_hours?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "workspace_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_calendar_days: {
        Row: {
          created_at: string
          created_by: string | null
          day_date: string
          day_type: string
          hours: number | null
          id: string
          label: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_date: string
          day_type?: string
          hours?: number | null
          id?: string
          label?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_date?: string
          day_type?: string
          hours?: number | null
          id?: string
          label?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_calendar_days_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "workspace_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          allow_future_dates: boolean
          allow_multiple_entries: boolean
          allow_overtime_override: boolean
          allow_reject: boolean
          allow_reopen: boolean
          created_at: string
          currency: string
          default_break_minutes: number
          enable_attachments: boolean
          enable_breaks: boolean
          enable_notes: boolean
          enable_overtime: boolean
          enable_standard_hours: boolean
          enable_tags: boolean
          hourly_rate: number
          id: string
          lock_after_approval: boolean
          name: string
          notes_max_length: number
          overtime_hourly_rate: number
          owner_id: string
          require_approval: boolean
          standard_daily_hours: number
          tags: string[]
          time_format: string
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_future_dates?: boolean
          allow_multiple_entries?: boolean
          allow_overtime_override?: boolean
          allow_reject?: boolean
          allow_reopen?: boolean
          created_at?: string
          currency?: string
          default_break_minutes?: number
          enable_attachments?: boolean
          enable_breaks?: boolean
          enable_notes?: boolean
          enable_overtime?: boolean
          enable_standard_hours?: boolean
          enable_tags?: boolean
          hourly_rate?: number
          id?: string
          lock_after_approval?: boolean
          name: string
          notes_max_length?: number
          overtime_hourly_rate?: number
          owner_id: string
          require_approval?: boolean
          standard_daily_hours?: number
          tags?: string[]
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_future_dates?: boolean
          allow_multiple_entries?: boolean
          allow_overtime_override?: boolean
          allow_reject?: boolean
          allow_reopen?: boolean
          created_at?: string
          currency?: string
          default_break_minutes?: number
          enable_attachments?: boolean
          enable_breaks?: boolean
          enable_notes?: boolean
          enable_overtime?: boolean
          enable_standard_hours?: boolean
          enable_tags?: boolean
          hourly_rate?: number
          id?: string
          lock_after_approval?: boolean
          name?: string
          notes_max_length?: number
          overtime_hourly_rate?: number
          owner_id?: string
          require_approval?: boolean
          standard_daily_hours?: number
          tags?: string[]
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      effective_permissions: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: string[]
      }
      entry_minutes_range: {
        Args: { _end: string; _start: string }
        Returns: unknown
      }
      has_permission: {
        Args: { _permission: string; _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      shares_workspace: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "viewer" | "manager"
      entry_status:
        | "pending"
        | "approved"
        | "rejected"
        | "draft"
        | "submitted"
        | "reopened"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "member", "viewer", "manager"],
      entry_status: [
        "pending",
        "approved",
        "rejected",
        "draft",
        "submitted",
        "reopened",
      ],
    },
  },
} as const
