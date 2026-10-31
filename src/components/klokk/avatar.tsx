import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { isAllowedAvatarFile } from "@/lib/klokk-avatars";

/**
 * Avatar display — shows the uploaded image or initials fallback.
 */
export function Avatar({
  url,
  firstName,
  lastName,
  size = 64,
  className,
}: {
  url?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  size?: number;
  className?: string;
}) {
  const initials =
    `${(firstName ?? "").charAt(0)}${(lastName ?? "").charAt(0)}`.toUpperCase() || "?";
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img
          src={url}
          alt={`${firstName ?? ""} ${lastName ?? ""}`.trim() || "Profile photo"}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <span
          className="font-display font-semibold text-muted-foreground"
          style={{ fontSize: Math.round(size * 0.36) }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

/**
 * Avatar uploader — handles file selection, upload, and remove.
 * Pass an `upload(file) => Promise<url>` callback; the parent persists the URL.
 * Pass `currentUrl` to show the existing photo and `onRemove` to clear it.
 */
export function AvatarUpload({
  currentUrl,
  firstName,
  lastName,
  upload,
  onUploaded,
  onRemove,
  size = 80,
  label = "Profile photo",
  disabled,
}: {
  currentUrl?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  upload: (file: File) => Promise<string>;
  onUploaded: (url: string) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  size?: number;
  label?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(currentUrl);

  const pick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedAvatarFile(file)) {
      toast.error("Please choose an image (5 MB or smaller)");
      return;
    }
    try {
      setBusy(true);
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      const url = await upload(file);
      setPreview(url);
      await onUploaded(url);
      toast.success("Photo updated");
    } catch (err) {
      setPreview(currentUrl);
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    try {
      setBusy(true);
      setPreview(undefined);
      await onRemove?.();
      toast.success("Photo removed");
    } catch (err) {
      setPreview(currentUrl);
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className={cn(
            "group relative size-full overflow-hidden rounded-full border border-border bg-card",
            disabled && "opacity-60",
          )}
        >
          {preview ? (
            <img
              src={preview}
              alt={`${firstName ?? ""} ${lastName ?? ""}`.trim() || "Profile photo"}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-surface-muted">
              <span
                className="font-display font-semibold text-muted-foreground"
                style={{ fontSize: Math.round(size * 0.36) }}
              >
                {`${(firstName ?? "").charAt(0)}${(lastName ?? "").charAt(0)}`.toUpperCase() || "?"}
              </span>
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-5 animate-spin text-foreground" />
            </div>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="absolute -bottom-1 -right-1 inline-flex size-7 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-premium transition-colors hover:bg-surface disabled:opacity-50"
            aria-label="Change profile photo"
          >
            <Camera className="size-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={busy || disabled}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {preview ? "Change photo" : "Upload photo"}
          </button>
          {preview && !disabled && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3" />
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, or GIF · 5 MB max</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
