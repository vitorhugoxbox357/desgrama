import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "client";

export interface SessionInfo {
  user: User | null;
  role: Role | null;
  clientId: string | null;
  loading: boolean;
}

export function useSession(): SessionInfo {
  const [state, setState] = useState<SessionInfo>({ user: null, role: null, clientId: null, loading: true });

  useEffect(() => {
    let mounted = true;

    async function load(user: User | null) {
      if (!user) {
        if (mounted) setState({ user: null, role: null, clientId: null, loading: false });
        return;
      }

      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("client_id").eq("id", user.id).maybeSingle(),
      ]);
      const role: Role = roles?.some((r) => r.role === "admin") ? "admin" : "client";
      if (mounted) setState({ user, role, clientId: profile?.client_id ?? null, loading: false });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => load(session?.user ?? null));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
