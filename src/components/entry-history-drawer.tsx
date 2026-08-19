import { useEffect, useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { attachmentUrl, useEntryHistory, type Entry } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/overtime";

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  edited: "Edited",
  status_changed: "Status changed",
  rejected: "Rejected",
  deleted: "Deleted",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  start_time: "Start time",
  end_time: "End time",
  break_minutes: "Break minutes",
  entry_date: "Date",
  notes: "Notes",
  tags: "Tags",
  reason: "Reason",
};

function historyActionLabel(action: string, field: string | null, nextValue: string | null) {
  if (action === "status_changed" && field === "status") {
    if (nextValue === "approved") return "Approved";
    if (nextValue === "rejected") return "Rejected";
    if (nextValue === "submitted") return "Submitted";
    if (nextValue === "reopened") return "Reopened";
  }

  if (action === "rejected" && field === "reason") {
    return "Rejection reason";
  }

  return ACTION_LABELS[action] ?? action;
}

function displayValue(field: string | null, value: string | null) {
  if (!value) return "-";
  if (field === "status") return STATUS_LABELS[value] ?? value;
  return value;
}

function syntheticHistory(entry: Entry, fallbackActorId: string | null) {
  const items: Array<{
    id: string;
    action: string;
    field: string | null;
    old_value: string | null;
    new_value: string | null;
    actor_id: string | null;
    created_at: string;
  }> = [];

  items.push({
    id: `${entry.id}-created`,
    action: "created",
    field: "status",
    old_value: null,
    new_value: entry.status,
    actor_id: fallbackActorId,
    created_at: entry.created_at,
  });

  if (entry.submitted_at) {
    items.push({
      id: `${entry.id}-submitted`,
      action: "status_changed",
      field: "status",
      old_value: "draft",
      new_value: "submitted",
      actor_id: fallbackActorId,
      created_at: entry.submitted_at,
    });
  }

  if (entry.approved_at) {
    items.push({
      id: `${entry.id}-approved`,
      action: "status_changed",
      field: "status",
      old_value: entry.submitted_at ? "submitted" : "draft",
      new_value: "approved",
      actor_id: entry.approved_by,
      created_at: entry.approved_at,
    });
  }

  if (entry.status === "rejected") {
    items.push({
      id: `${entry.id}-rejected`,
      action: "status_changed",
      field: "status",
      old_value: entry.approved_at ? "approved" : entry.submitted_at ? "submitted" : "draft",
      new_value: "rejected",
      actor_id: fallbackActorId,
      created_at: entry.updated_at,
    });

    if (entry.rejection_reason) {
      items.push({
        id: `${entry.id}-rejection-reason`,
        action: "rejected",
        field: "reason",
        old_value: null,
        new_value: entry.rejection_reason,
        actor_id: fallbackActorId,
        created_at: entry.updated_at,
      });
    }
  }

  if (entry.status === "reopened") {
    items.push({
      id: `${entry.id}-reopened`,
      action: "status_changed",
      field: "status",
      old_value: entry.approved_at ? "approved" : "rejected",
      new_value: "reopened",
      actor_id: fallbackActorId,
      created_at: entry.updated_at,
    });
  }

  return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Full audit timeline for an entry. Rendered only for owners/admins. */
export function EntryHistoryDrawer({
  entry,
  onOpenChange,
  nameFor,
}: {
  entry: Entry | null;
  onOpenChange: (open: boolean) => void;
  nameFor: (userId: string) => string;
}) {
  const { data: history = [], isLoading } = useEntryHistory(entry?.id);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const resolvedHistory = useMemo(() => {
    if (!entry) return [];
    if (history.length > 0) return history;
    return syntheticHistory(entry, entry.approved_by ?? entry.user_id);
  }, [entry, history]);

  useEffect(() => {
    let active = true;
    setFileUrl(null);

    if (entry?.attachment_path) {
      void attachmentUrl(entry.attachment_path).then((url) => {
        if (active) setFileUrl(url);
      });
    }

    return () => {
      active = false;
    };
  }, [entry?.attachment_path]);

  return (
    <Sheet open={Boolean(entry)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Entry history</SheetTitle>
          <SheetDescription>
            {entry ? `${entry.entry_date} · ${STATUS_LABELS[entry.status] ?? entry.status}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {entry?.rejection_reason ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              Rejection reason: {entry.rejection_reason}
            </p>
          ) : null}

          {entry?.attachment_path ? (
            <Button asChild variant="outline" size="sm" disabled={!fileUrl}>
              <a href={fileUrl ?? "#"} target="_blank" rel="noreferrer">
                <Paperclip className="size-4" />
                {entry.attachment_name ?? "Attachment"}
              </a>
            </Button>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : resolvedHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history recorded yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {resolvedHistory.map((record) => (
                <li key={record.id} className="relative space-y-1">
                  <span className="absolute -left-[5px] mt-1.5 size-2 rounded-full bg-primary" />

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {historyActionLabel(record.action, record.field, record.new_value)}
                    </Badge>
                    {record.field ? (
                      <span className="text-sm font-medium">
                        {FIELD_LABELS[record.field] ?? record.field}
                      </span>
                    ) : null}
                  </div>

                  {record.old_value || record.new_value ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="line-through">
                        {displayValue(record.field, record.old_value)}
                      </span>
                      {" -> "}
                      <span className="text-foreground">
                        {displayValue(record.field, record.new_value)}
                      </span>
                    </p>
                  ) : null}

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
