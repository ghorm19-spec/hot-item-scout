import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Camera, Flame, DollarSign, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Flip it — Scan it. Score it. Flip it." },
      { name: "description", content: "Point your camera at any item — get the resale price, demand score, and where to sell it. In 3 seconds." },
      { property: "og:title", content: "Flip it — Scan it. Score it. Flip it." },
      { property: "og:description", content: "Instant resale price + demand score for thrift, vintage and used items, anywhere in the world." },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const signedIn = !authLoading && !!user;

  // Authenticated users bypass the landing entirely and go straight to /scan.
  useEffect(() => {
    if (signedIn) navigate({ to: "/scan", search: { mode: "photo" } as any, replace: true });
  }, [signedIn, navigate]);

  const goSignIn = () =>
    navigate({ to: "/login", search: { redirect: "/scan", mode: "photo" } });

  if (authLoading || signedIn) {
    return (
      <AppShell>
        <div className="min-h-[60vh] grid place-items-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* HERO */}
      <section className="relative mt-6 rounded-3xl overflow-hidden p-6 sm:p-8 grain bg-gradient-to-br from-secondary via-card to-secondary border border-border">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
          <Sparkles className="size-3.5" /> Resale, decoded
        </div>
        <h1 className="mt-3 text-4xl sm:text-5xl font-display font-black leading-[1.05]">
          Scan it.<br />
          <span className="text-primary">Score it.</span> Flip it.
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md">
          Point your camera at any item — get the resale price, demand score, and where to sell it.
          <span className="text-foreground font-semibold"> In 3 seconds.</span>
        </p>
        <button
          onClick={goSignIn}
          className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground py-5 font-display font-bold text-lg transition glow-primary flex items-center justify-center gap-3 active:scale-[0.99]"
        >
          <Camera className="size-6" /> Start Scanning Free
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Free forever for casual scans · No credit card
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section className="mt-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 text-center">
          How it works
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Step n={1} title="Scan" body="Point your camera at any item." />
          <Arrow />
          <Step n={2} title="Score" body="See the Hotness Score and live resale price in your currency." />
          <Arrow />
          <Step n={3} title="Sell" body="Get told exactly which platform to list it on in your country." />
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="mt-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center">
          Built for
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Thrift shoppers",
            "Arbitrage buyers",
            "Garage sale hunters",
            "Side hustlers",
            "Selling from home",
          ].map((c) => (
            <span
              key={c}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* REAL EXAMPLES */}
      <section className="mt-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center flex items-center justify-center gap-1">
          <Flame className="size-3.5 text-accent" /> Real flips
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <FlipCard buy="$4" item="vinyl" sell="$38" platform="Discogs" tier="hot" />
          <FlipCard buy="$18" item="jacket" sell="$74" platform="Depop" tier="warm" />
          <FlipCard buy="$48" item="sneakers" sell="$190" platform="eBay" tier="hot" />
        </div>
      </section>

      {/* WORLDWIDE */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center">
          Works worldwide
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
          <Country flag="🇺🇸" platform="eBay" />
          <Country flag="🇨🇦" platform="Kijiji" />
          <Country flag="🇬🇧" platform="Depop" />
          <Country flag="🇩🇪" platform="Vinted" />
          <Country flag="🇫🇷" platform="Leboncoin" />
          <Country flag="🇯🇵" platform="Mercari" />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mt-10 mb-8 rounded-3xl bg-gradient-to-br from-primary/15 via-card to-secondary border border-primary/30 p-6 text-center glow-primary">
        <DollarSign className="size-7 text-primary mx-auto" />
        <h2 className="mt-2 text-2xl font-display font-black">Join free. No credit card.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start finding flips in your neighbourhood in under a minute.
        </p>
        <button
          onClick={goSignIn}
          className="mt-5 w-full rounded-2xl bg-primary text-primary-foreground py-4 font-display font-bold text-base transition glow-primary flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          Start Scanning Free <ArrowRight className="size-5" />
        </button>
      </section>
    </AppShell>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-card p-4">
      <div className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-display font-black text-sm glow-primary">
        {n}
      </div>
      <p className="mt-3 font-display font-bold text-base">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden sm:flex items-center justify-center text-muted-foreground">
      <ArrowRight className="size-5" />
    </div>
  );
}

function FlipCard({ buy, item, sell, platform, tier }: { buy: string; item: string; sell: string; platform: string; tier: "hot" | "warm" }) {
  const glow = tier === "hot" ? "glow-hot" : "glow-warm";
  const text = tier === "hot" ? "text-hot" : "text-warm";
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${glow}`}>
      <p className="text-xs text-muted-foreground">
        {buy} {item}
      </p>
      <p className={`mt-1 font-display font-black text-xl ${text}`}>→ {sell}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">sold on {platform}</p>
    </div>
  );
}

function Country({ flag, platform }: { flag: string; platform: string }) {
  return (
    <div>
      <div className="text-2xl leading-none">{flag}</div>
      <div className="mt-1 text-[10px] text-muted-foreground font-medium">{platform}</div>
    </div>
  );
}
