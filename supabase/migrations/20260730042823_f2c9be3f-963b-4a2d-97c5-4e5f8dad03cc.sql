DROP POLICY IF EXISTS "Members read entry attachments" ON storage.objects;
CREATE POLICY "Members read entry attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'entry-attachments'
    AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Members upload entry attachments" ON storage.objects;
CREATE POLICY "Members upload entry attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'entry-attachments'
    AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Uploaders and admins delete entry attachments" ON storage.objects;
CREATE POLICY "Uploaders and admins delete entry attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'entry-attachments'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.workspace_role((storage.foldername(name))[1]::uuid, auth.uid()) IN ('owner','admin')
    )
  );