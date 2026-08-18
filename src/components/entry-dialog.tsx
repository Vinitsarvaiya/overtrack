import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CATEGORIES,
  DEFAULT_TAGS,
  breakHours,
  formatHours,
  minuteRange,
  overtimeHours,
  rangesOverlap,
  totalHours,
  workedHours,
} from "@/lib/overtime";
import {
  uploadAttachment,
  useCalendarDays,
  useEntries,
  useSaveEntry,
  type Entry,
} from "@/lib/data";
import {
  baseStandardHours,
  showsBreaks,
  showsOvertime,
  standardHoursFor,
} from "@/lib/working-calendar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";



// Shared client + server shape: the same schema validates the form and the payload.
const entrySchema = z.object({
  entry_date: z.string().min(1, "Pick a date"),
  start_time: z.string().min(1, "Required"),
  end_time: z.string().min(1, "Required"),
  break_minutes: z.coerce.number().int().min(0).max(720),
  break_start: z.string().optional(),
  break_end: z.string().optional(),
  category: z.string().min(1),
  notes: z.string().optional(),
  overtime_override: z.string().optional(),
});

type EntryFormValues = z.input<typeof entrySchema>;

function emptyValues(defaultBreak: number): EntryFormValues {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "18:00",
    break_minutes: defaultBreak,
    break_start: "",
    break_end: "",
    category: "Development",
    notes: "",
    overtime_override: "",
  };
}

export function EntryDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: Entry | null;
}) {
  const { workspace, user } = useWorkspace();
  const save = useSaveEntry(workspace?.id);
  const { data: allEntries = [] } = useEntries(workspace?.id);

  const [breakMode, setBreakMode] = useState<"duration" | "range">("duration");
  const [tags, setTags] = useState<string[]>([]);
  const [attachment, setAttachment] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const workspaceTags = useMemo(
    () => (workspace?.tags?.length ? workspace.tags : [...DEFAULT_TAGS]),
    [workspace?.tags],
  );
  const notesMax = workspace?.notes_max_length ?? 500;

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: emptyValues(workspace?.default_break_minutes ?? 60),
  });

  useEffect(() => {
    if (!open) return;
    if (entry) {
      form.reset({
        entry_date: entry.entry_date,
        start_time: entry.start_time.slice(0, 5),
        end_time: entry.end_time.slice(0, 5),
        break_minutes: entry.break_minutes,
        break_start: entry.break_start?.slice(0, 5) ?? "",
        break_end: entry.break_end?.slice(0, 5) ?? "",
        category: entry.category,
        notes: entry.notes ?? "",
        overtime_override:
          entry.overtime_override === null ? "" : String(entry.overtime_override),
      });
      setBreakMode(entry.break_start && entry.break_end ? "range" : "duration");
      setTags(entry.tags ?? []);
      setAttachment(
        entry.attachment_path
          ? { path: entry.attachment_path, name: entry.attachment_name ?? "Attachment" }
          : null,
      );
    } else {
      form.reset(emptyValues(workspace?.default_break_minutes ?? 60));
      setBreakMode("duration");
      setTags([]);
      setAttachment(null);
    }
  }, [open, entry, workspace?.default_break_minutes, form]);

  const values = form.watch();
  const preview = {
    entry_date: values.entry_date,
    start_time: values.start_time || "00:00",
    end_time: values.end_time || "00:00",
    break_minutes: workspace?.enable_breaks === false ? 0 : Number(values.break_minutes) || 0,
    break_start: breakMode === "range" ? values.break_start || null : null,
    break_end: breakMode === "range" ? values.break_end || null : null,
    overtime_override:
      workspace?.allow_overtime_override && values.overtime_override !== ""
        ? Number(values.overtime_override)
        : null,
  };
  const { data: calendarDays = [] } = useCalendarDays(workspace?.id);
  const dayOverride = calendarDays.find((day) => day.day_date === values.entry_date);
  const standard = standardHoursFor(baseStandardHours(workspace), dayOverride);
  const breaksOn = showsBreaks(workspace);
  const overtimeOn = showsOvertime(workspace);
  const summaryColumns = 2 + (breaksOn ? 1 : 0) + (overtimeOn ? 1 : 0);



  async function handleFile(file: File | undefined) {
    if (!file || !workspace || !user) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Attachments must be under 10 MB");
    setUploading(true);
    try {
      setAttachment(await uploadAttachment(file, workspace.id, user.id));
      toast.success("Attachment uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submitEntry(raw: EntryFormValues, mode: "draft" | "submit") {
    if (!workspace || !user) return;
    const parsed = entrySchema.parse(raw);
    const breaksOn = workspace.enable_breaks !== false;
    const useRange = breaksOn && breakMode === "range" && parsed.break_start && parsed.break_end;
    const breakStart = useRange ? parsed.break_start! : null;
    const breakEnd = useRange ? parsed.break_end! : null;
    const breakMins = breaksOn && !useRange ? parsed.break_minutes : 0;

    // Validation the database also enforces, surfaced early for a better UX.
    if (!workspace.allow_future_dates && parsed.entry_date > new Date().toISOString().slice(0, 10)) {
      return toast.error("Future dates are not allowed in this workspace");
    }
    if (parsed.notes && parsed.notes.length > notesMax) {
      return toast.error(`Notes must be ${notesMax} characters or fewer`);
    }
    const candidate = {
      entry_date: parsed.entry_date,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      break_minutes: breakMins,
      break_start: breakStart,
      break_end: breakEnd,
    };
    if (breakHours(candidate) * 60 >= totalHours(candidate) * 60) {
      return toast.error("Break must be shorter than the total duration");
    }
    const range = minuteRange(parsed.start_time, parsed.end_time);
    const sameDay = allEntries.filter(
      (item) =>
        item.id !== entry?.id &&
        item.user_id === (entry?.user_id ?? user.id) &&
        item.entry_date === parsed.entry_date,
    );
    if (!workspace.allow_multiple_entries && sameDay.length > 0) {
      return toast.error("This workspace allows only one entry per day");
    }
    const clash = sameDay.find((item) =>
      rangesOverlap(range, minuteRange(item.start_time, item.end_time)),
    );
    if (clash) {
      return toast.error(
        `Overlaps an existing entry (${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)})`,
      );
    }

    try {
      await save.mutateAsync({
        id: entry?.id,
        workspace_id: workspace.id,
        user_id: entry?.user_id ?? user.id,
        entry_date: parsed.entry_date,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        break_minutes: breakMins,
        break_start: breakStart,
        break_end: breakEnd,
        category: parsed.category,
        tags: workspace.enable_tags === false ? [] : tags,
        notes:
          workspace.enable_notes === false || !parsed.notes?.trim() ? null : parsed.notes.trim(),
        overtime_override:
          workspace.allow_overtime_override && parsed.overtime_override !== ""
            ? Number(parsed.overtime_override)
            : null,
        attachment_path: workspace.enable_attachments === false ? null : (attachment?.path ?? null),
        attachment_name: workspace.enable_attachments === false ? null : (attachment?.name ?? null),
        status:
          mode === "submit"
            ? "submitted"
            : workspace.require_approval === false
              ? "approved"
              : (entry?.status ?? "draft"),
      });
      toast.success(mode === "submit" ? "Entry submitted for approval" : "Entry saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save entry");
    }
  }

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "Log work time"}</DialogTitle>
          <DialogDescription>
            Duration, working time and overtime are calculated automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((raw) => submitEntry(raw, "draft"))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="entry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End (may cross midnight)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {breaksOn ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Break (optional)</Label>
                  <Tabs value={breakMode} onValueChange={(value) => setBreakMode(value as never)}>
                    <TabsList>
                      <TabsTrigger value="duration">Duration</TabsTrigger>
                      <TabsTrigger value="range">Start / end</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {breakMode === "duration" ? (
                  <FormField
                    control={form.control}
                    name="break_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" min={0} placeholder="Minutes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="break_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="break_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* Only summarise what the workspace actually tracks. */}
            <div
              className={cn(
                "grid gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm",
                summaryColumns === 4
                  ? "sm:grid-cols-4"
                  : summaryColumns === 3
                    ? "sm:grid-cols-3"
                    : "sm:grid-cols-2",
              )}
            >
              <Calc label="Total" value={formatHours(totalHours(preview))} />
              {breaksOn ? <Calc label="Break" value={formatHours(breakHours(preview))} /> : null}
              <Calc label="Working" value={formatHours(workedHours(preview))} />
              {overtimeOn ? (
                <Calc
                  label="Overtime"
                  value={formatHours(overtimeHours(preview, standard))}
                  accent
                />
              ) : null}
            </div>

            {overtimeOn && workspace?.allow_overtime_override ? (

              <FormField
                control={form.control}
                name="overtime_override"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manual overtime override (hours)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.25" min={0} placeholder="Auto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {workspace?.enable_tags !== false ? (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {workspaceTags.map((tag) => {
                    const active = tags.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() =>
                          setTags(active ? tags.filter((item) => item !== tag) : [...tags, tag])
                        }
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {workspace?.enable_notes !== false ? (
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Notes ({(field.value ?? "").length}/{notesMax})
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        maxLength={notesMax}
                        placeholder="What did you work on?"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {workspace?.enable_attachments !== false ? (
              <div className="space-y-2">
                <Label>Attachment (image or PDF)</Label>
                {attachment ? (
                  <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <Paperclip className="size-4 text-muted-foreground" />
                    <span className="truncate">{attachment.name}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="ml-auto"
                      aria-label="Remove attachment"
                      onClick={() => setAttachment(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(event) => handleFile(event.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Paperclip className="size-4" />
                      {uploading ? "Uploading…" : "Attach file"}
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save draft"}
              </Button>
              {workspace?.require_approval !== false ? (
                <Button
                  type="button"
                  disabled={save.isPending}
                  onClick={form.handleSubmit((raw) => submitEntry(raw, "submit"))}
                >
                  Submit for approval
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function Calc({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={accent ? "text-primary" : undefined}>{value}</span>
    </div>
  );
}
