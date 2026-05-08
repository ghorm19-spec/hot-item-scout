import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Camera, ScanLine, QrCode, Sparkles, MapPin, Flame } from "lucide-react";
import { getHistory } from "@/lib/storage";
import { useEffect, useState } from "react";

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
  const [count, setCount] = useState(0);
  useEffect(() => { setCount(getHistory().length); }, []);

  const go = (mode: "photo" | "barcode" | "qr") =>
    navigate({ to: "/scan", search: { mode } as any });

  return (
    <AppShell>
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display font-black glow-primary">SF</div>
          <div>
            <p className="font-display font-bold leading-none">Flip it</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3" /> Global · Local currency
            </p>
          </div>
        </div>
        <Link to="/history" className="text-xs text-muted-foreground">
          {count} scan{count === 1 ? "" : "s"}
        </Link>
      </header>

      <section className="relative mt-4 rounded-3xl overflow-hidden p-6 grain bg-gradient-to-br from-secondary via-card to-secondary border border-border">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
          <Sparkles className="size-3.5" /> AI-powered · Worldwide
        </div>
        <h1 className="mt-3 text-4xl font-display font-black leading-[1.05]">
          Scan it. <br />
          <span className="text-primary">Score it.</span> Flip it.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Snap a thrift find anywhere in the world — get a real local-currency price, demand Hotness, and a flip plan in seconds.
        </p>

        <button
          onClick={() => go("photo")}
          className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-5 font-display font-bold text-lg active:scale-[0.99] transition glow-primary flex items-center justify-center gap-3"
        >
          <Camera className="size-6" /> Scan Now
        </button>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <ModeBtn label="Photo"  icon={<Camera className="size-5" />}  onClick={() => go("photo")} />
          <ModeBtn label="Barcode" icon={<ScanLine className="size-5" />} onClick={() => go("barcode")} />
          <ModeBtn label="QR"      icon={<QrCode className="size-5" />}   onClick={() => go("qr")} />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-2">
        <Stat tier="hot"  emoji="🚀" label="HIGH" sub=">70 score" />
        <Stat tier="warm" emoji="⚡" label="MED"  sub="35–70" />
        <Stat tier="cold" emoji="❄️" label="LOW"  sub="<35" />
      </section>

      <section className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
          <Flame className="size-3.5 text-accent" /> Hot worldwide right now
        </p>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
          {["Sneakers","Vintage denim","Pokémon cards","Vinyl records","Y2K fashion","Retro games","Designer bags","Film cameras"].map(t => (
            <span key={t} className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs">{t}</span>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Add to Home Screen for the full app · Unlimited scans
      </p>
    </AppShell>
  );
}

function ModeBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl bg-card border border-border py-3 flex flex-col items-center gap-1 text-xs font-medium active:scale-95 transition">
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
