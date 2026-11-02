// React hooks over the real Cloud backend.
// Auth session via subscribeAuth; data via useQuery + useServerFn.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAuthSession, initAuth, subscribeAuth } from "./klokk-auth";
import {
  getMyProfile,
  updateMyProfile,
  getMyEvents,
  getMyEvent,
  createMyEvent,
  updateMyEvent,
  deleteMyEvent,
  addChatMessageFn,
  togglePinFn,
  deleteMyAccount,
  updateNotificationPrefs,
  updateEmbedSettings,
  listEmbeds,
  createEmbed,
  revokeEmbed,
  sendReminderFn,
  sendInvitationsFn,
} from "./klokk-organiser.functions";
import { getEditToken } from "./klokk-edit-token";
import { claimOrder, getMyBilling } from "./klokk-billing.functions";
import { getPublicEvent, lookupMyResponse, submitResponse } from "./klokk-public.functions";
import type { KlokkAccount, KlokkEvent } from "./klokk-types";

export function useEnsureSeeded() {
  useEffect(() => {
    initAuth();
  }, []);
}

export function useSession() {
  const session = useSyncExternalStore(
    subscribeAuth,
    () => getAuthSession(),
    () => null,
  );
  return session;
}

export function useCurrentAccount(): KlokkAccount | undefined {
  const session = useSession();
  const fn = useServerFn(getMyProfile);
  const { data } = useQuery({
    queryKey: ["klokk-profile", session?.user.id],
    queryFn: fn,
    enabled: !!session,
  });
  return data;
}

export function useOwnedEvents(): KlokkEvent[] {
  const session = useSession();
  const fn = useServerFn(getMyEvents);
  const { data } = useQuery({
    queryKey: ["klokk-events", session?.user.id],
    queryFn: fn,
    enabled: !!session,
  });
  return data ?? [];
}

export function useEventById(id: string | undefined): KlokkEvent | undefined {
  const session = useSession();
  const fn = useServerFn(getMyEvent);
  const { data } = useQuery({
    queryKey: ["klokk-event", id],
    queryFn: () => fn({ data: { id: id! } }),
    enabled: !!session && !!id,
  });
  return data ?? undefined;
}

export function useEventByToken(token: string | undefined): KlokkEvent | undefined {
  const fn = useServerFn(getPublicEvent);
  const { data } = useQuery({
    queryKey: ["klokk-public-event", token],
    queryFn: () => fn({ data: { token: token! } }),
    enabled: !!token,
  });
  return data ?? undefined;
}

/** F4: the participant's own earlier answer, looked up by token + email. */
export function useMyResponse(token: string | undefined, email: string) {
  const fn = useServerFn(lookupMyResponse);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const editToken = token && valid ? getEditToken(token, email) : undefined;
  const { data } = useQuery({
    queryKey: ["klokk-my-response", token, email.trim().toLowerCase(), !!editToken],
    queryFn: () => fn({ data: { token: token!, email: email.trim(), editToken: editToken! } }),
    enabled: !!token && valid && !!editToken,
    staleTime: 30_000,
  });
  return data ?? undefined;
}

// Mutations — unwrap { data } so call sites pass the raw payload.
export function useCreateEvent() {
  const qc = useQueryClient();
  const fn = useServerFn(createMyEvent);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-events"] }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  const fn = useServerFn(updateMyEvent);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["klokk-events"] });
      qc.invalidateQueries({ queryKey: ["klokk-event"] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteMyEvent);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-events"] }),
  });
}

export function useAddChatMessage() {
  const qc = useQueryClient();
  const fn = useServerFn(addChatMessageFn);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-event"] }),
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  const fn = useServerFn(togglePinFn);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-event"] }),
  });
}

export function useSubmitResponse() {
  const fn = useServerFn(submitResponse);
  return useMutation({ mutationFn: (input: any) => fn({ data: input }) });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const fn = useServerFn(updateMyProfile);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-profile"] }),
  });
}

export function useDeleteAccount() {
  const fn = useServerFn(deleteMyAccount);
  return useMutation({ mutationFn: async () => (fn as () => Promise<any>)() });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  const fn = useServerFn(updateNotificationPrefs);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-profile"] }),
  });
}

export function useUpdateEmbedSettings() {
  const qc = useQueryClient();
  const fn = useServerFn(updateEmbedSettings);
  return useMutation({
    mutationFn: (input: any) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-profile"] }),
  });
}

export function useBilling() {
  const fn = useServerFn(getMyBilling);
  const session = useSession();
  const { data } = useQuery({
    queryKey: ["klokk-billing"],
    queryFn: () => fn(),
    enabled: !!session,
  });
  return data ?? undefined;
}

export function useClaimOrder() {
  const qc = useQueryClient();
  const fn = useServerFn(claimOrder);
  return useMutation({
    mutationFn: (input: { orderId: string }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["klokk-billing"] });
      qc.invalidateQueries({ queryKey: ["klokk-profile"] });
    },
  });
}

export function useEmbeds(eventId: string | undefined) {
  const fn = useServerFn(listEmbeds);
  const { data } = useQuery({
    queryKey: ["klokk-embeds", eventId],
    queryFn: () => fn({ data: { eventId: eventId! } }),
    enabled: !!eventId,
  });
  return data ?? [];
}

export function useCreateEmbed() {
  const qc = useQueryClient();
  const fn = useServerFn(createEmbed);
  return useMutation({
    mutationFn: (input: { eventId: string; expiresInDays?: number }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-embeds"] }),
  });
}

export function useRevokeEmbed() {
  const qc = useQueryClient();
  const fn = useServerFn(revokeEmbed);
  return useMutation({
    mutationFn: (input: { id: string }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klokk-embeds"] }),
  });
}

export function useSendReminder() {
  const fn = useServerFn(sendReminderFn);
  return useMutation({
    mutationFn: (input: { eventId: string }) => fn({ data: input }),
  });
}

export function useSendInvitations() {
  const fn = useServerFn(sendInvitationsFn);
  return useMutation({
    mutationFn: (input: { eventId: string }) => fn({ data: input }),
  });
}

// ---------- auth helpers (used by routes) ----------

export function useAuthActions() {
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);
  return { signOut };
}

// ---------- theme (unchanged, localStorage) ----------

type Theme = "light" | "dark";
const THEME_KEY = "klokk.theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let initial: Theme = "light";
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
      if (stored === "light" || stored === "dark") {
        initial = stored;
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        initial = "dark";
      }
    }
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
