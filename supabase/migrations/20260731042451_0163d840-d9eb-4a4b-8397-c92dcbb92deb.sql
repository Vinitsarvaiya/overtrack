-- 1. Manager role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- 2. Permission catalog
CREATE TABLE IF NOT EXISTS public.permissions (
  key text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);

INSERT INTO public.permissions (key, category, label, sort_order) VALUES
  ('dashboard.view','Dashboard','View Dashboard',10),
  ('dashboard.statistics','Dashboard','View Statistics',20),
  ('dashboard.analytics','Dashboard','View Analytics',30),
  ('employees.view','Employee Management','View Employees',10),
  ('employees.create','Employee Management','Create Employee',20),
  ('employees.edit','Employee Management','Edit Employee',30),
  ('employees.delete','Employee Management','Delete Employee',40),
  ('employees.suspend','Employee Management','Suspend Employee',50),
  ('employees.restore','Employee Management','Restore Employee',60),
  ('attendance.view','Attendance','View Attendance',10),
  ('attendance.add','Attendance','Add Attendance',20),
  ('attendance.edit','Attendance','Edit Attendance',30),
  ('attendance.delete','Attendance','Delete Attendance',40),
  ('attendance.approve','Attendance','Approve Attendance',50),
  ('attendance.reject','Attendance','Reject Attendance',60),
  ('overtime.view','Overtime','View Overtime',10),
  ('overtime.approve','Overtime','Approve Overtime',20),
  ('overtime.reject','Overtime','Reject Overtime',30),
  ('overtime.edit','Overtime','Edit Overtime',40),
  ('overtime.delete','Overtime','Delete Overtime',50),
  ('money.salary','Money / Payroll','View Salary',10),
  ('money.overtime_amount','Money / Payroll','View Overtime Amount',20),
  ('money.earnings','Money / Payroll','View Total Earnings',30),
  ('money.payout_history','Money / Payroll','View Payout History',40),
  ('money.export_payroll','Money / Payroll','Export Payroll',50),
  ('reports.view','Reports','View Reports',10),
  ('reports.export','Reports','Export Reports',20),
  ('reports.csv','Reports','Download CSV',30),
  ('reports.excel','Reports','Download Excel',40),
  ('reports.pdf','Reports','Download PDF',50),
  ('workplace.view','Workplace','View Workplace',10),
  ('workplace.create','Workplace','Create Workplace',20),
  ('workplace.edit','Workplace','Edit Workplace',30),
  ('workplace.delete','Workplace','Delete Workplace',40),
  ('settings.view','Settings','View Settings',10),
  ('settings.edit','Settings','Edit Settings',20),
  ('users.invite','User Management','Invite User',10),
  ('users.remove','User Management','Remove User',20),
  ('users.reset_password','User Management','Reset Password',30),
  ('users.change_role','User Management','Change User Role',40)
ON CONFLICT (key) DO NOTHING;

-- 3. Custom (manager) roles per workspace
CREATE TABLE IF NOT EXISTS public.workspace_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_roles TO authenticated;
GRANT ALL ON public.workspace_roles TO service_role;
ALTER TABLE public.workspace_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_roles_select ON public.workspace_roles FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY workspace_roles_insert ON public.workspace_roles FOR INSERT TO authenticated
  WITH CHECK (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE POLICY workspace_roles_update ON public.workspace_roles FOR UPDATE TO authenticated
  USING (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE POLICY workspace_roles_delete ON public.workspace_roles FOR DELETE TO authenticated
  USING (public.workspace_role(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE TRIGGER workspace_roles_updated_at BEFORE UPDATE ON public.workspace_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Role permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_roles r WHERE r.id = role_id AND public.is_workspace_member(r.workspace_id, auth.uid())));
CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_roles r WHERE r.id = role_id AND public.workspace_role(r.workspace_id, auth.uid()) IN ('owner','admin')));
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_roles r WHERE r.id = role_id AND public.workspace_role(r.workspace_id, auth.uid()) IN ('owner','admin')));

-- 5. Assign custom role to a member
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.workspace_roles(id) ON DELETE SET NULL;