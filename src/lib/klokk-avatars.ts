// Avatar upload helpers — uploads profile images to the Cloud Storage
// `avatars` bucket and returns a public URL. Used by organisers (signed-in)
// and participants (anon, on the public response path).

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function isAllowedAvatarFile(file: File): boolean {
  return file.type.startsWith("image/") && file.size <= AVATAR_MAX_BYTES;
}

/**
 * Upload an avatar for a signed-in organiser. The path is namespaced under
 * the organiser's user id so RLS can scope it. Returns the public URL.
 */
export async function uploadOrganiserAvatar(userId: string, file: File): Promise<string> {
  if (!isAllowedAvatarFile(file)) {
    throw new Error("Image must be 5 MB or smaller");
  }
  const ext = file.name.split(".").pop() ?? "png";
  const path = `organisers/${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload an avatar for an anonymous participant responding to an event.
 * Uses a random id so each submission is unique; the public `avatars`
 * bucket allows anon inserts via the storage.objects policy.
 */
export async function uploadParticipantAvatar(token: string, file: File): Promise<string> {
  if (!isAllowedAvatarFile(file)) {
    throw new Error("Image must be 5 MB or smaller");
  }
  const ext = file.name.split(".").pop() ?? "png";
  const path = `participants/${token}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
