import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Camera, ScanLine, QrCode, Sparkles, MapPin, Flame, LogIn } from "lucide-react";
import { getHistory } from "@/lib/storage";
import { useEffect, useState } from "react";
import { RegionPicker } from "@/components/RegionPicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { getRegion, type Region } from "@/lib/regions";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Flip it — Scan. Score. Flip." },
      { name: "description", content: "Scan thrift, vintage and used items. Instant resale price + Hotness Score in your local currency, anywhere in the world." },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const { t } = useT();
  const { user, loading: authLoading } = useAuth();
  const signedOut = !authLoading && !user;
  const [count, setCount] = useState(0);
  const [region, setRegion] = useState<Region | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  useEffect(() => { setCount(getHistory().length); setRegion(getRegion()); }, []);

  const go = (mode: "photo" | "barcode" | "qr") => {
    if (signedOut) { setShowAuthPrompt(true); return; }
    navigate({ to: "/scan", search: { mode } as any });
  };

  return (
    <AppShell>
      <header className="pt-6 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-9 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display font-black glow-primary">FI</div>
          <div className="min-w-0">
            <p className="font-display font-bold leading-none">Flip it</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="size-3 shrink-0" />
              {region ? `${region.name} · ${region.currency}` : t("app.tagline_global")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LanguagePicker />
          <RegionPicker onChange={(r) => setRegion(r)} />
          <Link to="/history" className="text-xs text-muted-foreground whitespace-nowrap">
            {count}
          </Link>
        </div>
      </header>

      <section className="relative mt-4 rounded-3xl overflow-hidden p-6 grain bg-gradient-to-br from-secondary via-card to-secondary border border-border">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
          <Sparkles className="size-3.5" /> {t("home.badge")}
        </div>
        <h1 className="mt-3 text-4xl font-display font-black leading-[1.05]">
          {t("home.title.scan")} <br />
          <span className="text-primary">{t("home.title.score")}</span> {t("home.title.flip")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("home.lead")}
        </p>

        <button
          onClick={() => go("photo")}
          aria-disabled={signedOut}
          className={`mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-5 font-display font-bold text-lg transition glow-primary flex items-center justify-center gap-3 ${signedOut ? "opacity-50" : "active:scale-[0.99]"}`}
        >
          <Camera className="size-6" /> {t("home.cta")}
        </button>

        {showAuthPrompt && signedOut && (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/15 text-destructive p-3 text-sm flex items-center justify-between gap-3">
            <span>Please sign in to scan.</span>
            <button
              onClick={() => navigate({ to: "/login", search: { redirect: "/scan", mode: "photo" } })}
              className="shrink-0 rounded-lg bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-semibold active:scale-95 transition flex items-center gap-1"
            >
              <LogIn className="size-3.5" /> Sign in
            </button>
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <ModeBtn label={t("mode.photo")}  icon={<Camera className="size-5" />}  disabled={signedOut} onClick={() => go("photo")} />
          <ModeBtn label={t("mode.barcode")} icon={<ScanLine className="size-5" />} disabled={signedOut} onClick={() => go("barcode")} />
          <ModeBtn label={t("mode.qr")}      icon={<QrCode className="size-5" />}   disabled={signedOut} onClick={() => go("qr")} />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-2">
        <Stat tier="hot"  emoji="🚀" label={t("tier.high")} sub={t("tier.high.sub")} />
        <Stat tier="warm" emoji="⚡" label={t("tier.med")}  sub={t("tier.med.sub")} />
        <Stat tier="cold" emoji="❄️" label={t("tier.low")}  sub={t("tier.low.sub")} />
      </section>

      <section className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
          <Flame className="size-3.5 text-accent" /> {t("home.hot_title")}
        </p>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 scrollbar-none snap-x snap-mandatory">
          {[
            "Sneakers","Vintage denim","Pokémon cards","Vinyl records","Y2K fashion",
            "Retro games","Designer bags","Film cameras","Vintage tees","Carhartt",
            "Levi's 501","Trading cards","Funko Pop","Lego sets","Mid-century furniture",
            "Watches","Streetwear","Designer toys","Vintage tech","Outdoor gear",
            "Workwear","Band tees","Polaroid","Vintage Nike","Stüssy",
          ].map(t => (
            <button
              key={t}
              onClick={() => navigate({ to: "/scan", search: { mode: "photo" } as any })}
              className="snap-start shrink-0 rounded-full border border-border bg-card hover:bg-secondary px-3 py-1.5 text-xs whitespace-nowrap transition"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        {t("home.footer")}
      </p>
    </AppShell>
  );
}

function ModeBtn({ label, icon, disabled, onClick }: { label: string; icon: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-disabled={disabled} className={`rounded-xl bg-card border border-border py-3 flex flex-col items-center gap-1 text-xs font-medium transition ${disabled ? "opacity-50" : "active:scale-95"}`}>
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}

function Stat({ tier, emoji, label, sub }: { tier: "hot"|"warm"|"cold"; emoji: string; label: string; sub: string }) {
  const cls = tier === "hot" ? "glow-hot" : tier === "warm" ? "glow-warm" : "glow-cold";
  const text = tier === "hot" ? "text-hot" : tier === "warm" ? "text-warm" : "text-cold";
  return (
    <div className={`rounded-2xl border border-border bg-card p-3 text-center ${cls}`}>
      <div className="text-xl">{emoji}</div>
      <div className={`font-display font-bold text-sm ${text}`}>{label}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
