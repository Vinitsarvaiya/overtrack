/**
 * Permission catalog helpers.
 * Keys mirror rows in the `permissions` table; the database is the source of truth.
 */

export type PermissionRow = {
  key: string;
  category: string;
  label: string;
  sort_order: number;
};

/** Display order for permission categories on the role management screen. */
export const CATEGORY_ORDER = [
  "Dashboard",
  "Employee Management",
  "Attendance",
  "Overtime",
  "Money / Payroll",
  "Reports",
  "Workplace",
  "Settings",
  "User Management",
] as const;

/** Group a flat permission list into ordered category buckets. */
export function groupPermissions(rows: PermissionRow[]): { category: string; items: PermissionRow[] }[] {
  const map = new Map<string, PermissionRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.category) ?? [];
    bucket.push(row);
    map.set(row.category, bucket);
  }
  const known = CATEGORY_ORDER.filter((category) => map.has(category));
  const extra = [...map.keys()].filter((category) => !CATEGORY_ORDER.includes(category as never));
  return [...known, ...extra].map((category) => ({
    category,
    items: (map.get(category) ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

/** Money permissions gate every currency value, chart and payroll export. */
export const MONEY_PERMISSIONS = [
  "money.salary",
  "money.overtime_amount",
  "money.earnings",
  "money.view_member_rates",
  "money.edit_member_rates",
  "money.payout_history",
  "money.export_payroll",
] as const;

export function canSeeMoney(permissions: string[]): boolean {
  return MONEY_PERMISSIONS.some((key) => permissions.includes(key));
}
