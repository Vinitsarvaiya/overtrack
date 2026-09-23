import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
  compact = false,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex items-start justify-between gap-3"
          : "flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
      }
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
