import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, BadgeCheck, AlertCircle, KeyRound, RefreshCw } from "lucide-react";
import { getPricingProviderStatus } from "@/lib/pricing/status.functions";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Flip it" }] }),
});

function SettingsPage() {
  const fetchStatus = useServerFn(getPricingProviderStatus);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["pricing-provider-status"],
    queryFn: () => fetchStatus(),
  });

  const providers = [
    { key: "ebay" as const,          name: "eBay (sold listings)",        envVar: "EBAY_API_KEY",      desc: "Real sold-listing comps replace AI estimates when available. Get an App ID from developer.ebay.com." },
    { key: "stockx" as const,        name: "StockX (sneakers)",           envVar: "STOCKX_API_KEY",    desc: "Partner-only API. Stub provider returns mock until credentials are wired." },
    { key: "pricecharting" as const, name: "PriceCharting (games)",       envVar: "PRICECHARTING_KEY", desc: "Paid REST API for video games and collectibles. Stub until credentials are wired." },
  ];

  return (
    <AppShell>
      <header className="pt-4 pb-3 flex items-center justify-between">
        <Link to="/" className="size-9 grid place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-display font-bold">Settings</h1>
        <button
          onClick={() => refetch()}
          className="size-9 grid place-items-center rounded-full bg-card border border-border active:scale-95 transition"
          aria-label="Refresh"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </header>

      <section className="mt-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Pricing data sources</p>
        <p className="text-xs text-muted-foreground mb-3">
          When connected, real sold-listing data replaces AI-estimated comps wherever possible.
        </p>

        {isLoading && <p className="text-sm text-muted-foreground">Checking connections…</p>}

        <div className="space-y-2">
          {providers.map((p) => {
            const connected = data?.[p.key]?.connected ?? false;
            return (
              <div key={p.key} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                  </div>
                  {connected ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-hot/40 bg-hot/10 text-hot text-[10px] font-bold uppercase tracking-wider px-2 py-1">
                      <BadgeCheck className="size-3" /> Connected
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-warm/40 bg-warm/10 text-warm text-[10px] font-bold uppercase tracking-wider px-2 py-1">
                      <AlertCircle className="size-3" /> Not connected
                    </span>
                  )}
                </div>

                {!connected && (
                  <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3 text-[11px] text-foreground/80 space-y-1.5">
                    <p className="flex items-center gap-1 font-bold text-foreground">
                      <KeyRound className="size-3.5" /> Add the credential
                    </p>
                    <p>
                      Open <span className="font-mono">Lovable Cloud → Secrets</span> and add a secret named{" "}
                      <span className="font-mono px-1 rounded bg-background border border-border">{p.envVar}</span>.
                    </p>
                    <p className="text-muted-foreground">
                      The key is stored server-side only — it is never sent to the browser. Refresh this page after saving.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Mock providers return <span className="font-mono">is_mock: true</span> and the app falls back to AI-estimated
          comps. AI estimates are always labeled as such — never as market data.
        </p>
      </section>
    </AppShell>
  );
}