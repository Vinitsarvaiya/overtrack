import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { can } from "@/features/roles/lib/capabilities";
import { useWorkspace } from "@/features/workspaces/context/workspace-provider";

import { useProfile } from "@/features/auth/hooks/use-profile";
import { useUpdateWorkspace } from "@/features/workspaces/hooks/use-workspaces";
import { DEFAULT_TAGS } from "@/features/entries/lib/overtime";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { WorkingCalendarCard } from "@/features/settings/components/working-calendar-card";
import { Field } from "@/features/settings/components/settings-fields";
import { ToggleRow } from "@/features/settings/components/settings-fields";
import { FEATURE_TOGGLES } from "@/features/settings/constants";
import { OVERTIME_TOGGLES } from "@/features/settings/constants";
import { APPROVAL_TOGGLES } from "@/features/settings/constants";
import { CURRENCY_OPTIONS } from "@/features/settings/constants";
import { Draft } from "@/features/settings/types";
import { ProfileDraft } from "@/features/settings/types";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { workspace, role, user, permissions: myPermissions } = useWorkspace();
  const { data: profile } = useProfile(user?.id);
  const updateWorkspace = useUpdateWorkspace(workspace?.id);
  const permissions = can(role, myPermissions, workspace);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ full_name: "", company: "" });
  const [savedProfile, setSavedProfile] = useState<ProfileDraft>({ full_name: "", company: "" });
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the draft from the workspace record; edits stay local until saved.
  useEffect(() => {
    if (!workspace) return;
    const next: Draft = {
      name: workspace.name,
      currency: workspace.currency,
      timezone: workspace.timezone,
      standard_daily_hours: Number(workspace.standard_daily_hours),
      default_break_minutes: workspace.default_break_minutes,
      time_format: workspace.time_format ?? "24h",
      notes_max_length: workspace.notes_max_length ?? 500,
      tags: workspace.tags?.length ? workspace.tags : [...DEFAULT_TAGS],
      enable_standard_hours: workspace.enable_standard_hours !== false,
      enable_breaks: workspace.enable_breaks !== false,
      enable_member_rates: workspace.enable_member_rates !== false,
      allow_manager_rate_permissions: Boolean(workspace.allow_manager_rate_permissions),
      enable_notes: workspace.enable_notes !== false,
      enable_attachments: workspace.enable_attachments !== false,
      enable_tags: workspace.enable_tags !== false,
      allow_multiple_entries: workspace.allow_multiple_entries !== false,
      allow_future_dates: Boolean(workspace.allow_future_dates),
      enable_overtime: workspace.enable_overtime !== false,
      allow_overtime_override: Boolean(workspace.allow_overtime_override),
      require_approval: workspace.require_approval !== false,
      lock_after_approval: workspace.lock_after_approval !== false,
      allow_reopen: workspace.allow_reopen !== false,
      allow_reject: workspace.allow_reject !== false,
    };
    setDraft(next);
    setSaved(next);
  }, [workspace]);

  useEffect(() => {
    const next = { full_name: profile?.full_name ?? "", company: profile?.company ?? "" };
    setProfileDraft(next);
    setSavedProfile(next);
  }, [profile]);

  const workspaceDirty = useMemo(
    () => Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved)),
    [draft, saved],
  );
  const profileDirty = useMemo(
    () => JSON.stringify(profileDraft) !== JSON.stringify(savedProfile),
    [profileDraft, savedProfile],
  );
  const dirty = workspaceDirty || profileDirty;

  // Warn on hard navigation (reload / close tab).
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Warn on in-app navigation.
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: false,
    withResolver: true,
  });

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((current) => (current ? { ...current, [key]: value } : current)),
    [],
  );

  async function saveAll() {
    if (!draft || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      if (workspaceDirty) {
        const workspaceUpdate = {
          name: draft.name,
          currency: draft.currency,
          timezone: draft.timezone,
          standard_daily_hours: draft.standard_daily_hours,
          default_break_minutes: draft.default_break_minutes,
          time_format: draft.time_format === "12h" ? "12h" : "24h",
          notes_max_length: draft.notes_max_length,
          tags: draft.tags,
          enable_standard_hours: draft.enable_standard_hours,
          enable_breaks: draft.enable_breaks,
          enable_member_rates: draft.enable_member_rates,
          allow_manager_rate_permissions: draft.allow_manager_rate_permissions,
          enable_notes: draft.enable_notes,
          enable_attachments: draft.enable_attachments,
          enable_tags: draft.enable_tags,
          allow_multiple_entries: draft.allow_multiple_entries,
          allow_future_dates: draft.allow_future_dates,
          enable_overtime: draft.enable_overtime,
          allow_overtime_override: draft.allow_overtime_override,
          require_approval: draft.require_approval,
          lock_after_approval: draft.lock_after_approval,
          allow_reopen: draft.allow_reopen,
          allow_reject: draft.allow_reject,
        };
        await updateWorkspace.mutateAsync(workspaceUpdate);
        setSaved(draft);
      }
      if (profileDirty && user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: profileDraft.full_name, company: profileDraft.company })
          .eq("id", user.id);
        if (profileError) throw profileError;
        setSavedProfile(profileDraft);
        await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      }
      toast.success("Settings saved");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save settings";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (saved) setDraft(saved);
    setProfileDraft(savedProfile);
    setError(null);
  }

  if (!draft) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  }

  const editable = permissions.editSettings;
  const standardOn = draft.enable_standard_hours;

  const saveBar = (
    <div className="flex flex-wrap items-center gap-2">
      {dirty ? (
        <span className="text-xs text-warning">Unsaved changes</span>
      ) : (
        <span className="text-xs text-muted-foreground">All changes saved</span>
      )}
      {dirty ? (
        <Button variant="ghost" size="sm" onClick={discard} disabled={saving}>
          Discard
        </Button>
      ) : null}
      <Button size="sm" onClick={saveAll} disabled={!dirty || saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Workspace defaults, working calendar and your profile. Changes apply when you save.
          </p>
        </div>
        {saveBar}
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>Company details, currency and formatting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company / workspace name">
            <Input
              value={draft.name}
              disabled={!editable}
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>
          <Field label="Default break (minutes)">
            <Input
              type="number"
              min={0}
              disabled={!editable || !draft.enable_breaks}
              value={draft.default_break_minutes}
              onChange={(event) => set("default_break_minutes", Number(event.target.value))}
            />
          </Field>
          <Field label="Currency">
            <Select
              value={draft.currency}
              disabled={!editable}
              onValueChange={(value) => set("currency", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Timezone">
            <Input
              value={draft.timezone}
              disabled={!editable}
              onChange={(event) => set("timezone", event.target.value)}
            />
          </Field>
          <Field label="Time format">
            <Select
              value={draft.time_format}
              disabled={!editable}
              onValueChange={(value) => set("time_format", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 hour</SelectItem>
                <SelectItem value="12h">12 hour (AM/PM)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Max notes length">
            <Input
              type="number"
              min={50}
              max={5000}
              disabled={!editable || !draft.enable_notes}
              value={draft.notes_max_length}
              onChange={(event) => set("notes_max_length", Number(event.target.value))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overtime calculation</CardTitle>
          <CardDescription>
            With standard working hours on, overtime is working time minus the standard hours for
            that date. With it off, working time is simply the logged time and overtime stays at
            zero.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Enable standard working hours</p>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Turn this on to calculate overtime from each day&apos;s worked hours minus the
                  standard daily target.
                </p>
              </div>
              <Switch
                checked={standardOn}
                disabled={!editable}
                onCheckedChange={(value) => set("enable_standard_hours", value)}
              />
            </div>

            {standardOn ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr]">
                <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <Field label="Standard hours per day">
                    <Input
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      disabled={!editable}
                      value={draft.standard_daily_hours}
                      onChange={(event) => set("standard_daily_hours", Number(event.target.value))}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {OVERTIME_TOGGLES.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-border/60 bg-background/70 p-3"
                    >
                      <ToggleRow
                        label={item.label}
                        hint={item.hint}
                        checked={draft[item.key]}
                        disabled={!editable}
                        onChange={(value) => set(item.key, value)}
                        compact
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                Overtime automation is off. Logged working time will still be tracked, but overtime
                stays at zero unless you turn standard working hours back on.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
          <CardDescription>Turn optional entry fields on or off for everyone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FEATURE_TOGGLES.map((item) => (
            <ToggleRow
              key={item.key}
              label={item.label}
              hint={item.hint}
              checked={draft[item.key]}
              disabled={!editable}
              onChange={(value) => set(item.key, value)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member rates</CardTitle>
          <CardDescription>
            Control whether per-member hourly and overtime rates are available and whether manager
            role permissions can use them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ToggleRow
            label="Enable member rates"
            hint="Show custom hourly and overtime rates on the Members page."
            checked={draft.enable_member_rates}
            disabled={!editable}
            onChange={(value) => set("enable_member_rates", value)}
          />
          <ToggleRow
            label="Allow manager rate permissions"
            hint="Managers can view or edit rates only if their role also has the right money permissions."
            checked={draft.allow_manager_rate_permissions}
            disabled={!editable || !draft.enable_member_rates}
            onChange={(value) => set("allow_manager_rate_permissions", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval workflow</CardTitle>
          <CardDescription>Control how entries move from draft to approved.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {APPROVAL_TOGGLES.map((item) => (
            <ToggleRow
              key={item.key}
              label={item.label}
              hint={item.hint}
              checked={draft[item.key]}
              disabled={!editable}
              onChange={(value) => set(item.key, value)}
            />
          ))}
        </CardContent>
      </Card>

      {draft.enable_tags ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
            <CardDescription>Tags available when logging time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {draft.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="gap-1">
                  {tag}
                  {editable ? (
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() =>
                        set(
                          "tags",
                          draft.tags.filter((item) => item !== tag),
                        )
                      }
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </Badge>
              ))}
              {draft.tags.length === 0 ? (
                <span className="text-sm text-muted-foreground">No tags yet.</span>
              ) : null}
            </div>
            {editable ? (
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  placeholder="Add a tag"
                  onChange={(event) => setNewTag(event.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const value = newTag.trim();
                    if (!value || draft.tags.includes(value)) return;
                    setNewTag("");
                    set("tags", [...draft.tags, value]);
                  }}
                >
                  Add
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <WorkingCalendarCard editable={editable} standardHours={draft.standard_daily_hours} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              value={profileDraft.full_name}
              onChange={(event) =>
                setProfileDraft({ ...profileDraft, full_name: event.target.value })
              }
            />
          </Field>
          <Field label="Company">
            <Input
              value={profileDraft.company}
              onChange={(event) =>
                setProfileDraft({ ...profileDraft, company: event.target.value })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">{saveBar}</div>

      <AlertDialog open={status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave with unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your settings changes have not been saved yet. If you leave now they will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => reset?.()}>Stay on page</AlertDialogCancel>
            <AlertDialogAction onClick={() => proceed?.()}>Discard and leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
