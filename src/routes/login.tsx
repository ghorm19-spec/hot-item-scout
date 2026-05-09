import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { lovable } from "@/integrations/lovable";
import { Loader2 } from "lucide-react";

type Mode = "photo" | "barcode" | "qr";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>): { redirect?: string; mode?: Mode } => {
    const redirect = typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined;
    const mode = s.mode === "barcode" || s.mode === "qr" || s.mode === "photo" ? (s.mode as Mode) : undefined;
    return { redirect, mode };
  },
  head: () => ({ meta: [{ title: "Sign in — Flip it" }] }),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect, mode } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (redirect === "/scan") {
      navigate({ to: "/scan", search: { mode: mode ?? "photo" } });
    } else {
      navigate({ to: redirect ?? "/" } as any);
    }
  }, [user, loading, navigate, redirect, mode]);

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      // Send the user back to this same /login URL (with redirect/mode preserved)
      // so the post-login effect above can forward them to their original destination.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.href,
      });
      if (result.error) {
        setError("Login failed — please try again");
        setBusy(false);
        return;
      }
    } catch {
      setError("Login failed — please try again");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="size-20 rounded-3xl bg-gradient-to-br from-primary to-accent grid place-items-center text-4xl mb-6 glow-primary">
          🔥
        </div>
        <h1 className="font-display font-black text-5xl tracking-tight">Flip it</h1>
        <p className="mt-2 text-muted-foreground text-sm uppercase tracking-[0.25em]">
          Scan. Value. Sell.
        </p>

        <div className="mt-12 w-full flex flex-col gap-3">
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full h-12 rounded-2xl bg-white text-[#1f1f1f] font-semibold flex items-center justify-center gap-3 active:scale-[0.99] transition disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <GoogleG />
            )}
            <span>Continue with Google</span>
          </button>

          {error && (
            <p className="text-xs text-cold mt-1" role="alert">{error}</p>
          )}
        </div>

        <p className="mt-10 text-[11px] text-muted-foreground leading-relaxed">
          By continuing you agree to our Terms of Service.
        </p>
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.094 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}
