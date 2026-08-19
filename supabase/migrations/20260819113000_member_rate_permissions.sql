INSERT INTO public.permissions (key, category, label, sort_order) VALUES
  ('money.view_member_rates','Money / Payroll','View Member Rates',35),
  ('money.edit_member_rates','Money / Payroll','Edit Member Rates',36)
ON CONFLICT (key) DO NOTHING;
