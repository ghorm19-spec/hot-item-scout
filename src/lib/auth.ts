import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInGoogle = useCallback(async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, loading, signInGoogle, signOut };
}

export function userDisplayName(u: User | null): string {
  if (!u) return "";
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  return (m.full_name as string) || (m.name as string) || u.email || "";
}

export function userAvatarUrl(u: User | null): string | null {
  if (!u) return null;
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  return (m.avatar_url as string) || (m.picture as string) || null;
}

export function userInitials(u: User | null): string {
  const name = userDisplayName(u);
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}