import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth, userAvatarUrl, userDisplayName, userInitials } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/history", "/settings"];

interface Props { children: React.ReactNode; }

export function AppShell({ children }: Props) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const isProtected = PROTECTED_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!loading && isProtected && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, isProtected, user, navigate]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (isProtected && (loading || !user)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="size-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  const avatar = userAvatarUrl(user);
  const name = userDisplayName(user);
  const initials = userInitials(user);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto px-4 pt-[env(safe-area-inset-top)]">
      {user && (
        <div className="absolute top-[max(env(safe-area-inset-top),12px)] right-4 z-40" ref={dropdownRef}>
          <button
            type="button"
            aria-label="Account menu"
            onClick={() => setOpen((v) => !v)}
            className="size-8 rounded-full overflow-hidden border border-border bg-card grid place-items-center text-xs font-bold active:scale-95 transition"
          >
            {avatar ? (
              <img src={avatar} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-foreground">{initials}</span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold truncate">{name || "Account"}</p>
                {user.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              <div className="h-px bg-border" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-secondary transition"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
