export const FEATURE_TOGGLES = [
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

export const OVERTIME_TOGGLES = [
  { key: "enable_overtime", label: "Overtime", hint: "Track overtime beyond standard hours" },
  {
    key: "allow_overtime_override",
    label: "Manual overtime override",
    hint: "Let users set overtime manually",
  },
] as const;

export const APPROVAL_TOGGLES = [
  { key: "require_approval", label: "Require approval", hint: "Entries must be submitted" },
  { key: "lock_after_approval", label: "Lock after approval", hint: "Approved entries read-only" },
  { key: "allow_reopen", label: "Allow reopen", hint: "Owners/admins can reopen approvals" },
  { key: "allow_reject", label: "Allow reject", hint: "Owners/admins can reject with a reason" },
] as const;

export const CURRENCY_OPTIONS = [
  { value: "USD", label: "US Dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "INR", label: "Indian Rupee (₹)" },
  { value: "AED", label: "UAE Dirham (AED)" },
  { value: "CAD", label: "Canadian Dollar (CA$)" },
  { value: "AUD", label: "Australian Dollar (A$)" },
  { value: "SGD", label: "Singapore Dollar (S$)" },
  { value: "JPY", label: "Japanese Yen (¥)" },
  { value: "CNY", label: "Chinese Yuan (¥)" },
] as const;
