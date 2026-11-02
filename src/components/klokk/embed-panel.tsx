import { useState } from "react";
import { Ban, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCreateEmbed, useEmbeds, useRevokeEmbed } from "@/lib/klokk-hooks";
import type { KlokkAccount, KlokkEvent } from "@/lib/klokk-types";

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://klokk.com";
}

function snippet(token: string): string {
  return `<div data-klokk-embed="${token}"></div>\n<script async src="${origin()}/embed.js"></script>`;
}

function iframeCode(token: string): string {
  return `<iframe src="${origin()}/embed/${token}" title="Klokk scheduling" style="width:100%;height:640px;border:0" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`;
}

function copy(text: string, label: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Couldn't copy"),
    );
  }
}

export function EmbedPanel({ event, account }: { event: KlokkEvent; account: KlokkAccount }) {
  const embeds = useEmbeds(event.id);
  const create = useCreateEmbed();
  const revoke = useRevokeEmbed();
  const [days, setDays] = useState("");
  const noDomains = (account.embedSettings?.domainAllowlist ?? []).length === 0;

  const make = () => {
    const n = days.trim() ? Number(days) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 730)) {
      toast.error("Expiry must be a whole number of days (1–730), or blank for no expiry");
      return;
    }
    create.mutate(
      n === undefined ? { eventId: event.id } : { eventId: event.id, expiresInDays: n },
      {
        onSuccess: () => toast.success("Embed link created"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create embed"),
      },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-3 text-xs text-muted-foreground">
        Put this event on your own website. The widget only loads on the domains you allow in{" "}
        <a href="/settings" className="underline underline-offset-4">
          Settings → Embed
        </a>
        . You can revoke a link at any time without touching your site.
      </p>
      {noDomains && (
        <p className="mb-3 rounded-lg border border-border bg-surface/60 p-2 text-xs text-foreground">
          No domains are allowed yet, so embeds will be blocked everywhere. Add your website in
          Settings → Embed first.
        </p>
      )}
      <div className="mb-3 flex gap-2">
        <input
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Expires in days (optional)"
          aria-label="Days until the embed link expires"
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-xs"
        />
        <Button size="sm" onClick={make} disabled={create.isPending}>
          <Plus className="size-3.5" />
          New link
        </Button>
      </div>
      {embeds.length === 0 && <p className="text-xs text-muted-foreground">No embed links yet.</p>}
      <ul className="space-y-3">
        {embeds.map((e) => {
          const dead =
            !!e.revokedAt || (e.expiresAt !== null && new Date(e.expiresAt).getTime() < Date.now());
          return (
            <li key={e.id} className="rounded-lg border border-border p-2">
              <div className="flex items-center justify-between text-xs">
                <span className={dead ? "text-muted-foreground line-through" : "font-medium"}>
                  {e.revokedAt
                    ? "Revoked"
                    : dead
                      ? "Expired"
                      : e.expiresAt
                        ? `Active until ${new Date(e.expiresAt).toLocaleDateString()}`
                        : "Active"}
                </span>
                <span className="text-muted-foreground">
                  {e.views} views · {e.interactions} interactions · {e.submissions} submissions
                </span>
              </div>
              {!dead && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(snippet(e.token), "Script embed")}
                  >
                    <Copy className="size-3.5" />
                    Script
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(iframeCode(e.token), "iframe embed")}
                  >
                    <Copy className="size-3.5" />
                    iframe
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      revoke.mutate(
                        { id: e.id },
                        { onSuccess: () => toast.message("Embed link revoked") },
                      )
                    }
                  >
                    <Ban className="size-3.5" />
                    Revoke
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
