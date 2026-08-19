import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Paperclip, X } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  buildMonthGrid,
  formatDateLong,
  todayKey,
} from "@/lib/calendar";
import {
  CATEGORIES,
  DEFAULT_TAGS,
  breakHours,
  formatHours,
  formatTime,
  minuteRange,
  overtimeHours,
  rangesOverlap,
  totalHours,
  type TimeFormat,
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

const HOUR_24_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const HOUR_12_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

function parseTimeForStorage(value: string, format: TimeFormat): string | null {
  const raw = value.trim();
  if (!raw) return null;

  if (format === "24h") {
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3].toUpperCase();
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
  const hour24 = suffix === "AM" ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function decomposeTimeValue(value: string, format: TimeFormat) {
  const parsed = parseTimeForStorage(value, format) ?? (format === "12h" ? "09:00" : "09:00");
  const [rawHour = "09", rawMinute = "00"] = parsed.split(":");
  const hour24 = Number(rawHour);

  if (format === "24h") {
    return {
      hour: rawHour,
      minute: rawMinute,
      period: "AM" as const,
    };
  }

  return {
    hour: String(hour24 % 12 === 0 ? 12 : hour24 % 12),
    minute: rawMinute,
    period: (hour24 < 12 ? "AM" : "PM") as "AM" | "PM",
  };
}

function composeTimeValue(
  hour: string,
  minute: string,
  period: "AM" | "PM",
  format: TimeFormat,
) {
  return format === "12h" ? `${hour}:${minute} ${period}` : `${hour}:${minute}`;
}

function emptyValues(defaultBreak: number, format: TimeFormat): EntryFormValues {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    start_time: format === "12h" ? "9:00 AM" : "09:00",
    end_time: format === "12h" ? "6:00 PM" : "18:00",
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
  const timeFormat = (workspace?.time_format as TimeFormat) ?? "24h";

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
    defaultValues: emptyValues(workspace?.default_break_minutes ?? 60, timeFormat),
  });

  useEffect(() => {
    if (!open) return;
    if (entry) {
      form.reset({
        entry_date: entry.entry_date,
        start_time: formatTime(entry.start_time, timeFormat),
        end_time: formatTime(entry.end_time, timeFormat),
        break_minutes: entry.break_minutes,
        break_start: entry.break_start ? formatTime(entry.break_start, timeFormat) : "",
        break_end: entry.break_end ? formatTime(entry.break_end, timeFormat) : "",
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
      form.reset(emptyValues(workspace?.default_break_minutes ?? 60, timeFormat));
      setBreakMode("duration");
      setTags([]);
      setAttachment(null);
    }
  }, [open, entry, workspace?.default_break_minutes, timeFormat, form]);

  const values = form.watch();
  const normalizedStart = parseTimeForStorage(values.start_time || "", timeFormat) ?? "00:00";
  const normalizedEnd = parseTimeForStorage(values.end_time || "", timeFormat) ?? "00:00";
  const normalizedBreakStart =
    breakMode === "range"
      ? (parseTimeForStorage(values.break_start || "", timeFormat) ?? null)
      : null;
  const normalizedBreakEnd =
    breakMode === "range"
      ? (parseTimeForStorage(values.break_end || "", timeFormat) ?? null)
      : null;
  const preview = {
    entry_date: values.entry_date,
    start_time: normalizedStart,
    end_time: normalizedEnd,
    break_minutes: workspace?.enable_breaks === false ? 0 : Number(values.break_minutes) || 0,
    break_start: normalizedBreakStart,
    break_end: normalizedBreakEnd,
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
    const startTime = parseTimeForStorage(parsed.start_time, timeFormat);
    const endTime = parseTimeForStorage(parsed.end_time, timeFormat);
    const parsedBreakStart = parsed.break_start
      ? parseTimeForStorage(parsed.break_start, timeFormat)
      : null;
    const parsedBreakEnd = parsed.break_end
      ? parseTimeForStorage(parsed.break_end, timeFormat)
      : null;
    if (!startTime || !endTime) {
      return toast.error(
        timeFormat === "12h"
          ? "Use times like 9:00 AM or 6:30 PM"
          : "Use times like 09:00 or 18:30",
      );
    }
    if ((parsed.break_start && !parsedBreakStart) || (parsed.break_end && !parsedBreakEnd)) {
      return toast.error(
        timeFormat === "12h"
          ? "Break times must look like 1:15 PM"
          : "Break times must look like 13:15",
      );
    }
    const breaksOn = workspace.enable_breaks !== false;
    const useRange = breaksOn && breakMode === "range" && parsedBreakStart && parsedBreakEnd;
    const breakStart = useRange ? parsedBreakStart : null;
    const breakEnd = useRange ? parsedBreakEnd : null;
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
      start_time: startTime,
      end_time: endTime,
      break_minutes: breakMins,
      break_start: breakStart,
      break_end: breakEnd,
    };
    if (breakHours(candidate) * 60 >= totalHours(candidate) * 60) {
      return toast.error("Break must be shorter than the total duration");
    }
    const range = minuteRange(startTime, endTime);
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
        start_time: startTime,
        end_time: endTime,
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
                      <DateSelectField value={field.value} onChange={field.onChange} />
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
                      <TimeSelectField
                        value={field.value}
                        onChange={field.onChange}
                        format={timeFormat}
                        ariaLabel="Start time"
                      />
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
                      <TimeSelectField
                        value={field.value}
                        onChange={field.onChange}
                        format={timeFormat}
                        ariaLabel="End time"
                      />
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
                            <TimeSelectField
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              format={timeFormat}
                              ariaLabel="Break start time"
                            />
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
                            <TimeSelectField
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              format={timeFormat}
                              ariaLabel="Break end time"
                            />
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

function DateSelectField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(activeDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(activeDate.getMonth());
  const cells = buildMonthGrid(viewYear, viewMonth);
  const today = todayKey();

  useEffect(() => {
    if (!open || !value) return;
    const next = new Date(`${value}T00:00:00`);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }, [open, value]);

  function stepMonth(direction: -1 | 1) {
    const next = new Date(viewYear, viewMonth + direction, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Entry date"
          className="flex h-10 w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className="truncate font-medium">{formatDateLong(value)}</span>
          <CalendarDays className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[308px] rounded-xl border-border/70 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => stepMonth(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => stepMonth(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="pb-1 text-center text-[10px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
            {cells.map((cell, index) =>
              cell ? (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    onChange(cell.dateKey);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex aspect-square w-full items-center justify-center rounded-md text-[11px] font-medium tabular-nums transition-colors",
                    cell.dateKey === value
                      ? "bg-primary text-primary-foreground"
                      : cell.dateKey === today
                        ? "bg-accent text-accent-foreground ring-1 ring-primary"
                        : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {cell.day}
                </button>
              ) : (
                <span key={`date-pad-${index}`} className="aspect-square" aria-hidden />
              ),
            )}
          </div>

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const current = todayKey();
                onChange(current);
                const next = new Date(`${current}T00:00:00`);
                setViewYear(next.getFullYear());
                setViewMonth(next.getMonth());
              }}
            >
              Today
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TimeSelectField({
  value,
  onChange,
  format,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  format: TimeFormat;
  ariaLabel: string;
}) {
  const parts = decomposeTimeValue(value, format);
  const hourOptions = format === "12h" ? HOUR_12_OPTIONS : HOUR_24_OPTIONS;
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className="font-medium tabular-nums">{value}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] rounded-xl border-border/70 p-3" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{ariaLabel}</p>
            <p className="text-xs text-muted-foreground">Choose the full time in one place.</p>
          </div>

          <div className={`grid gap-3 ${format === "12h" ? "grid-cols-3" : "grid-cols-2"}`}>
            <PickerColumn
              label="Hour"
              options={hourOptions}
              selected={parts.hour}
              onSelect={(hour) =>
                onChange(composeTimeValue(hour, parts.minute, parts.period, format))
              }
            />
            <PickerColumn
              label="Minute"
              options={MINUTE_OPTIONS}
              selected={parts.minute}
              onSelect={(minute) =>
                onChange(composeTimeValue(parts.hour, minute, parts.period, format))
              }
            />
            {format === "12h" ? (
              <PickerColumn
                label="Period"
                options={["AM", "PM"]}
                selected={parts.period}
                onSelect={(period) =>
                  onChange(
                    composeTimeValue(parts.hour, parts.minute, period as "AM" | "PM", format),
                  )
                }
              />
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PickerColumn({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="time-picker-scroll max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-background/70 p-1">
        {options.map((option) => {
          const active = option === selected;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={cn(
                "flex w-full items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
