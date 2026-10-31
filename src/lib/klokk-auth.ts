// Auth state store — single source of truth for the Supabase session.
// Initialised once in __root.tsx; components subscribe via useSession().

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let currentSession: Session | null = null;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function initAuth() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    emit();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    emit();
  });
}

export function getAuthSession(): Session | null {
  return currentSession;
}

export function subscribeAuth(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
