import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, GraduationCap, LayoutDashboard, BookmarkCheck, Shield, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

function VipTicker() {
  const { data } = useQuery({
    queryKey: ["top-vip"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, total_score, is_vip, vip_tier")
        .order("total_score", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    refetchInterval: 60_000,
  });

  const label = data
    ? `👑 Current Top VIP: ${data.username} — ${data.total_score} marks`
    : "👑 Current Top VIP: be the first to claim the crown!";

  return (
    <div className="gold-gradient overflow-hidden">
      <div className="flex w-max ticker-scroll">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="px-6 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap sm:text-sm"
          >
            {label} • Complete 2 tests back-to-back to unlock your VIP badge •
          </span>
        ))}
      </div>
    </div>
  );
}

export function SiteHeader() {
  const { user, profile, isAdmin } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <VipTicker />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="hero-gradient grid h-9 w-9 shrink-0 place-items-center rounded-xl">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-bold sm:text-lg">
              Mayur Education
            </span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              Learn · Practice · Compete
            </span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/revision">
                  <BookmarkCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Revision</span>
                </Link>
              </Button>
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              )}
              {profile?.is_vip && (
                <span className="gold-gradient hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex">
                  <Crown className="h-3.5 w-3.5" /> VIP
                </span>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Login / Sign up</Link>
            </Button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
