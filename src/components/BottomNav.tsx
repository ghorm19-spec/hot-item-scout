import { Link, useLocation } from "@tanstack/react-router";
import { Home, ScanLine, History, Trophy } from "lucide-react";

const items = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/scan", label: "Scan", Icon: ScanLine },
  { to: "/history", label: "History", Icon: History },
  { to: "/badges", label: "Badges", Icon: Trophy },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[130] border-t border-border bg-background/85 backdrop-blur-xl pointer-events-auto"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, label, Icon }) => {
          const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`size-5 ${active ? "drop-shadow-[0_0_8px_oklch(0.82_0.21_145/0.8)]" : ""}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
