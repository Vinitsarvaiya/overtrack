import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemberRateHistory, type Member } from "@/lib/data";
import { formatRate } from "@/lib/calendar";

const FIELD_LABELS: Record<string, string> = {
  hourly_rate: "Normal hourly rate",
  overtime_hourly_rate: "Overtime hourly rate",
};

export function MemberRateHistoryDrawer({
  member,
  currency,
  onOpenChange,
  nameFor,
}: {
  member: (Member & { profile: { full_name: string | null; email: string | null } | null }) | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
  nameFor: (userId: string) => string;
}) {
  const { data: history = [], isLoading } = useMemberRateHistory(member?.id);

  return (
    <Sheet open={Boolean(member)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Rate history</SheetTitle>
          <SheetDescription>
            {member?.profile?.full_name || member?.profile?.email || "Member"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rate history recorded yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {history.map((record) => (
                <li key={record.id} className="relative space-y-1">
                  <span className="absolute -left-[5px] mt-1.5 size-2 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Rate updated</Badge>
                    <span className="text-sm font-medium">
                      {FIELD_LABELS[record.field] ?? record.field}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="line-through">
                      {record.old_value === null ? "Default" : formatRate(Number(record.old_value), currency)}
                    </span>
                    {" -> "}
                    <span className="text-foreground">
                      {record.new_value === null ? "Default" : formatRate(Number(record.new_value), currency)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.actor_id ? nameFor(record.actor_id) : "System"} ·{" "}
                    {new Date(record.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
