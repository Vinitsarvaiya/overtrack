import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-pickers";
import { Input } from "@/components/ui/input";

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

import { useWorkspace } from "@/features/workspaces/context/workspace-provider";
import {
  useCalendarDays,
  useDeleteCalendarDay,
  useSaveCalendarDay,
} from "@/features/calendar/hooks/use-calendar-days";

import {
  DAY_TYPES,
  DAY_TYPE_DOT,
  DAY_TYPE_LABEL,
  type DayType,
} from "@/features/calendar/lib/working-calendar";
import { cn } from "@/lib/utils";

import { Field } from "@/features/settings/components/settings-fields";

/** Holidays, half days and per-date working hours overrides. */
export function WorkingCalendarCard({
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
              <DatePicker value={date} onChange={setDate} ariaLabel="Working calendar date" />
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
