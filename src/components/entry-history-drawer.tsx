import { useEffect, useState } from "react";
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
  status_changed: "Status changed",
  deleted: "Deleted",
};

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
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history recorded yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {history.map((record) => (
                <li key={record.id} className="space-y-1">
                  <span className="absolute -left-[5px] mt-1.5 size-2 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {ACTION_LABELS[record.action] ?? record.action}
                    </Badge>
                    {record.field ? (
                      <span className="text-sm font-medium">{record.field}</span>
                    ) : null}
                  </div>
                  {record.old_value || record.new_value ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="line-through">{record.old_value ?? "—"}</span>
                      {" → "}
                      <span className="text-foreground">{record.new_value ?? "—"}</span>
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
