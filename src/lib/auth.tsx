import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  is_vip: boolean;
  vip_tier: string | null;
  streak: number;
  total_score: number;
  tests_taken: number;
  vip_since: string | null;
};

export function usernameToEmail(username: string) {
  const slug = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return `${slug}@mayur-education.app`;
}

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  roles: string[];
  isAdmin: boolean;
  /** Super admin — full control over everything. */
  isSuperAdmin: boolean;
  /** teacher_admin / popular_student_admin — may only add draft content. */
  isSubAdmin: boolean;
  /** Anyone allowed into the admin panel (super admin or sub-admin). */
  isContributor: boolean;
  refreshProfile: () => void;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  user: null,
  loading: true,
  profile: null,
  roles: [],
  isAdmin: false,
  isSuperAdmin: false,
  isSubAdmin: false,
  isContributor: false,
  refreshProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["role"] });
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_vip, vip_tier, streak, total_score, tests_taken, vip_since")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
  });

  const roleQuery = useQuery({
    queryKey: ["role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const roles = roleQuery.data ?? [];
  const isSuperAdmin = roles.includes("admin");
  const isSubAdmin =
    !isSuperAdmin &&
    (roles.includes("teacher_admin") || roles.includes("popular_student_admin"));

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profile: profileQuery.data ?? null,
        roles,
        isAdmin: isSuperAdmin,
        isSuperAdmin,
        isSubAdmin,
        isContributor: isSuperAdmin || isSubAdmin,
        refreshProfile: () => {
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["role"] });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
