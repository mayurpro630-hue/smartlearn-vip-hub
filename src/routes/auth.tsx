import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login or Sign up — Mayur Education" },
      {
        name: "description",
        content:
          "Create your Mayur Education account with a username, mobile number and password to start practising tests.",
      },
      { property: "og:title", content: "Login or Sign up — Mayur Education" },
      {
        property: "og:description",
        content: "Simple username and password login for students. No OTP needed.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", mobile: "", password: "" });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(withMobile: boolean) {
    const username = form.username.trim();
    if (username.length < 3 || username.length > 30) {
      toast.error("Username must be 3-30 characters");
      return null;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(username)) {
      toast.error("Username can use letters, numbers, dot, dash and underscore only");
      return null;
    }
    if (form.password.length < 6 || form.password.length > 72) {
      toast.error("Password must be at least 6 characters");
      return null;
    }
    const mobile = form.mobile.replace(/\s/g, "");
    if (withMobile && !/^[0-9+]{8,15}$/.test(mobile)) {
      toast.error("Enter a valid mobile number");
      return null;
    }
    return { username, mobile, password: form.password };
  }

  async function handleSignup() {
    const v = validate(true);
    if (!v) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(v.username),
      password: v.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: v.username, mobile: v.mobile },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already") ? "Username already taken" : error.message);
      return;
    }
    toast.success("Account created. Welcome to Mayur Education!");
    navigate({ to: "/dashboard" });
  }

  async function handleLogin() {
    const v = validate(false);
    if (!v) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(v.username),
      password: v.password,
    });
    setBusy(false);
    if (error) {
      toast.error("Wrong username or password");
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-10">
      <div className="text-center">
        <span className="hero-gradient mx-auto grid h-12 w-12 place-items-center rounded-2xl">
          <GraduationCap className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Student access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Username, mobile number and password. No OTP required.
        </p>
      </div>

      <Tabs defaultValue="login" className="surface-card mt-6 p-5">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="l-user">Username</Label>
            <Input
              id="l-user"
              value={form.username}
              maxLength={30}
              onChange={(e) => set("username", e.target.value)}
              placeholder="mayur_student"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-pass">Password</Label>
            <Input
              id="l-pass"
              type="password"
              value={form.password}
              maxLength={72}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={busy} onClick={handleLogin}>
            {busy ? "Signing in…" : "Login"}
          </Button>
        </TabsContent>

        <TabsContent value="signup" className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-user">Username</Label>
            <Input
              id="s-user"
              value={form.username}
              maxLength={30}
              onChange={(e) => set("username", e.target.value)}
              placeholder="mayur_student"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-mobile">Mobile number</Label>
            <Input
              id="s-mobile"
              inputMode="tel"
              value={form.mobile}
              maxLength={15}
              onChange={(e) => set("mobile", e.target.value)}
              placeholder="9876543210"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-pass">Password</Label>
            <Input
              id="s-pass"
              type="password"
              value={form.password}
              maxLength={72}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={busy} onClick={handleSignup}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Password reset by email is not available for username accounts.
          </p>
        </TabsContent>
      </Tabs>

      <Link to="/" className="mt-6 text-center text-sm text-primary hover:underline">
        ← Back to home
      </Link>
    </main>
  );
}
