import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { computeBadges, getHistory, type ScanRecord } from "@/lib/storage";

export const Route = createFileRoute("/badges")({
  component: BadgesPage,
  head: () => ({ meta: [{ title: "Badges - Flip it" }] }),
});

const BADGE_CONDITIONS: Record<string, string> = {
  first: "Complete your first scan",
  five_hot: "Find 5 high-score items",
  "500": "Reach $500 estimated profit",
  streak10: "Complete 10 scans",
};

function BadgesPage() {
  const [items, setItems] = useState<ScanRecord[]>([]);
  useEffect(() => { setItems(getHistory()); }, []);
  const badges = computeBadges(items);

  return (
    <AppShell>
      <div className="min-h-screen bg-white text-[#111827]">
        <header className="pt-6 pb-5">
          <h1 className="font-display font-black text-2xl text-[#111827]">Your Badges</h1>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {badges.map((b) => (
            <div
              key={b.key}
              className={`rounded-xl p-4 text-center ${
                b.earned
                  ? "border border-[#1D9E75] bg-white"
                  : "border border-transparent bg-[#F3F4F6] opacity-50"
              }`}
            >
              <div className={`mx-auto grid h-12 w-12 place-items-center text-5xl ${b.earned ? "drop-shadow-[0_0_14px_rgba(29,158,117,0.55)]" : "grayscale"}`}>
                {b.emoji}
              </div>
              <p className="mt-4 font-bold text-[#111827]">{b.label}</p>
              <p className="mt-1 text-xs text-[#6B7280]">{BADGE_CONDITIONS[b.key] || "Keep scanning to unlock"}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
