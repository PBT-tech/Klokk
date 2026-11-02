// Avatar upload helpers — uploads profile images to the Cloud Storage
// `avatars` bucket and returns a public URL. Used by organisers (signed-in)
// and participants (anon, on the public response path).

import { supabase } from "@/integrations/supabase/client";
import { uploadParticipantAvatarFn } from "./klokk-public.functions";

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
 * Upload an avatar for a participant responding to an event. Goes through a
 * server function (no anonymous storage access), which verifies the event link,
 * file type and size.
 */
export async function uploadParticipantAvatar(token: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
    throw new Error("Image must be 2 MB or smaller");
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  const { url } = await uploadParticipantAvatarFn({
    data: { token, contentType: file.type, dataBase64: btoa(bin) },
  });
  return url;
}
