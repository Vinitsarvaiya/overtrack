import { supabase } from "@/integrations/supabase/client";

export const ATTACHMENT_BUCKET = "entry-attachments";

/** Uploads to `{workspace}/{user}/{uuid}-{filename}` so storage policies can scope access. */
export async function uploadAttachment(
  file: File,
  workspaceId: string,
  userId: string,
): Promise<{ path: string; name: string }> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${workspaceId}/${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file);
  if (error) throw error;
  return { path, name: file.name };
}

/** Short-lived signed URL for a private attachment. */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
