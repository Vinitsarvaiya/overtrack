import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Trash2, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can, useWorkspace } from "@/components/workspace-provider";
import {
  useCalendarDays,
  useDeleteCalendarDay,
  useProfile,
  useSaveCalendarDay,
  useUpdateWorkspace,
} from "@/lib/data";
import { DEFAULT_TAGS } from "@/lib/overtime";
import { DAY_TYPES, DAY_TYPE_DOT, DAY_TYPE_LABEL, type DayType } from "@/lib/working-calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — OverTrack" },
      {
        name: "description",
        content:
          "Configure standard working hours, breaks, approvals, holidays and custom working days for your workspace.",
      },
      { property: "og:title", content: "Settings — OverTrack" },
      {
        property: "og:description",
        content:
          "Configure standard working hours, breaks, approvals, holidays and custom working days for your workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const FEATURE_TOGGLES = [
  { key: "enable_breaks", label: "Break tracking", hint: "Show break fields and break totals" },
  { key: "enable_notes", label: "Notes", hint: "Allow free-text notes on entries" },
  { key: "enable_attachments", label: "Attachments", hint: "Allow image / PDF evidence" },
  { key: "enable_tags", label: "Tags", hint: "Allow tagging entries" },
  {
    key: "allow_multiple_entries",
    label: "Multiple entries per day",
    hint: "Unlimited sessions per date",
  },
  { key: "allow_future_dates", label: "Future dates", hint: "Allow logging time ahead of today" },
] as const;

const OVERTIME_TOGGLES = [
  { key: "enable_overtime", label: "Overtime", hint: "Track overtime beyond standard hours" },
  {
    key: "allow_overtime_override",
    label: "Manual overtime override",
    hint: "Let users set overtime manually",
  },
] as const;

const APPROVAL_TOGGLES = [
  { key: "require_approval", label: "Require approval", hint: "Entries must be submitted" },
  { key: "lock_after_approval", label: "Lock after approval", hint: "Approved entries read-only" },
  { key: "allow_reopen", label: "Allow reopen", hint: "Owners/admins can reopen approvals" },
  { key: "allow_reject", label: "Allow reject", hint: "Owners/admins can reject with a reason" },
] as const;

type Draft = {
  name: string;
  currency: string;
  timezone: string;
  standard_daily_hours: number;
  default_break_minutes: number;
  time_format: string;
  notes_max_length: number;
  hourly_rate: number;
  overtime_hourly_rate: number;
  tags: string[];
  enable_standard_hours: boolean;
  enable_breaks: boolean;
  enable_notes: boolean;
  enable_attachments: boolean;
  enable_tags: boolean;
  allow_multiple_entries: boolean;
  allow_future_dates: boolean;
  enable_overtime: boolean;
  allow_overtime_override: boolean;
  require_approval: boolean;
  lock_after_approval: boolean;
  allow_reopen: boolean;
  allow_reject: boolean;
};

type ProfileDraft = { full_name: string; company: string };

function SettingsPage() {
  const queryClient = useQueryClient();
  const { workspace, role, user, permissions: myPermissions } = useWorkspace();
  const { data: profile } = useProfile(user?.id);
  const updateWorkspace = useUpdateWorkspace(workspace?.id);
  const permissions = can(role, myPermissions);

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
      hourly_rate: Number(workspace.hourly_rate ?? 0),
      overtime_hourly_rate: Number(workspace.overtime_hourly_rate ?? 0),
      tags: workspace.tags?.length ? workspace.tags : [...DEFAULT_TAGS],
      enable_standard_hours: workspace.enable_standard_hours !== false,
      enable_breaks: workspace.enable_breaks !== false,
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
        // One request for every changed workspace setting.
        await updateWorkspace.mutateAsync(draft);
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

  const editable = permissions.manageAll;
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
            <Input
              value={draft.currency}
              disabled={!editable}
              onChange={(event) => set("currency", event.target.value)}
            />
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
          <Field label="Hourly rate (normal hours)">
            <Input
              type="number"
              min={0}
              step="0.01"
              disabled={!editable}
              value={draft.hourly_rate}
              onChange={(event) => set("hourly_rate", Number(event.target.value))}
            />
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
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ToggleRow
            label="Enable standard working hours"
            hint="Calculate overtime automatically"
            checked={standardOn}
            disabled={!editable}
            onChange={(value) => set("enable_standard_hours", value)}
          />
          {standardOn ? (
            <>
              <Field label="Standard working hours per day">
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
              <Field label="Hourly rate (overtime)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!editable}
                  value={draft.overtime_hourly_rate}
                  onChange={(event) => set("overtime_hourly_rate", Number(event.target.value))}
                />
              </Field>
              {OVERTIME_TOGGLES.map((item) => (
                <ToggleRow
                  key={item.key}
                  label={item.label}
                  hint={item.hint}
                  checked={draft[item.key]}
                  disabled={!editable}
                  onChange={(value) => set(item.key, value)}
                />
              ))}
            </>
          ) : null}
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

/** Holidays, half days and per-date working hours overrides. */
function WorkingCalendarCard({
  editable,
  standardHours,
}: {
  editable: boolean;
  standardHours: number;
}) {
  const { workspace } = useWorkspace();
  const { data: days = [], isLoading } = useCalendarDays(workspace?.id);
  const saveDay = useSaveCalendarDay(workspace?.id);
  const removeDay = useDeleteCalendarDay(workspace?.id);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayType, setDayType] = useState<DayType>("holiday");
  const [hours, setHours] = useState(String(standardHours));
  const [label, setLabel] = useState("");

  async function addDay() {
    if (!workspace) return;
    if (!date) return toast.error("Pick a date");
    try {
      await saveDay.mutateAsync({
        workspace_id: workspace.id,
        day_date: date,
        day_type: dayType,
        hours: dayType === "custom" ? Number(hours) : null,
        label: label.trim() || null,
      });
      setLabel("");
      toast.success("Working calendar updated");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the date");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Working calendar</CardTitle>
        <CardDescription>
          Mark holidays, half days or custom working hours for specific dates. These dates are
          colour coded in the calendar and override the standard hours used for overtime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {editable ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={dayType} onValueChange={(value) => setDayType(value as DayType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {dayType === "custom" ? (
              <Field label="Working hours">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step="0.5"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Label (optional)">
              <Input
                value={label}
                placeholder="New Year's Day"
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button variant="outline" onClick={addDay} disabled={saveDay.isPending}>
                {saveDay.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}
                Add date
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Label</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <TableRow key={day.id}>
                  <TableCell className="font-medium">{day.day_date}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("size-2 rounded-full", DAY_TYPE_DOT[day.day_type])}
                        aria-hidden
                      />
                      {DAY_TYPE_LABEL[day.day_type] ?? day.day_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    {day.day_type === "holiday"
                      ? "0"
                      : day.day_type === "half_day"
                        ? (standardHours / 2).toFixed(2)
                        : day.hours === null
                          ? "—"
                          : Number(day.hours).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{day.label ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {editable ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${day.day_date}`}
                        onClick={() =>
                          removeDay.mutate(day.id, {
                            onSuccess: () => toast.success("Date removed"),
                            onError: (caught) =>
                              toast.error(
                                caught instanceof Error ? caught.message : "Could not remove",
                              ),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && days.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No holidays or custom days yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
