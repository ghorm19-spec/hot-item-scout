import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CameraScanner } from "@/components/CameraScanner";
import { Camera, ScanLine, QrCode, Upload, ArrowLeft, Loader2, RefreshCw, Home } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { valuate } from "@/lib/valuate.functions";
import { computeHotness } from "@/lib/hotness";
import { saveScan, type ScanRecord } from "@/lib/storage";
import { getRegion } from "@/lib/regions";
import { RegionPicker } from "@/components/RegionPicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";
import { validateBarcode } from "@/lib/barcode";
import { getCachedValuation, setCachedValuation } from "@/lib/product-cache";
import { primeAudio, playError } from "@/lib/sounds";
import { track } from "@/lib/telemetry";
import { withRetry, isOnline } from "@/lib/network";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/lib/auth";

type Mode = "photo" | "barcode" | "qr";

export const Route = createFileRoute("/scan")({
  component: ScanPage,
  validateSearch: (s: Record<string, unknown>): { mode: Mode } => ({
    mode: (s.mode === "barcode" || s.mode === "qr" ? s.mode : "photo") as Mode,
  }),
  head: () => ({ meta: [{ title: "Scan — Flip it" }] }),
});

function ScanPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useT();
  const [activeMode, setActiveMode] = useState<Mode>(mode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [lastInput, setLastInput] = useState<{ code?: string; imageBase64?: string } | null>(null);
  const valuateFn = useServerFn(valuate);
  const { user, loading: authLoading } = useAuth();
  const signedOut = !authLoading && !user;
  // Camera is "active" whenever the scanner is the foreground UI (no busy overlay, no error card)
  const cameraActive = !busy && !err;

  const requireAuth = () => {
    setNeedsAuth(true);
    setErr("Please sign in to scan.");
  };

  const restartScanner = () => {
    setErr(null);
    setNeedsAuth(false);
    setBusy(false);
    setScannerKey((k) => k + 1);
  };

  const handleResult = async (input: { code?: string; imageBase64?: string }) => {
    if (busy) return;
    if (signedOut) { requireAuth(); return; }
    setLastInput(input);

    track({ type: "scan.captured", mode: activeMode, ms: 0 });

    // Pre-validate barcode client-side
    if (activeMode === "barcode" && input.code) {
      const v = validateBarcode(input.code);
      if (!v.valid && v.kind !== "OTHER") {
        playError();
        navigator.vibrate?.([60, 40, 60]);
        track({ type: "scan.barcode_invalid", code: input.code });
        Sentry.addBreadcrumb({
          category: "scan",
          message: "scan_failed",
          data: { reason: "invalid_barcode", barcode: input.code },
        });
        setErr("That barcode looks like a misread. Hold steady and try again.");
        return;
      }
    }

    if (!isOnline()) {
      playError();
      setErr("You're offline. Reconnect and try again — scans need a network connection.");
      return;
    }

    setBusy(true); setErr(null); setNeedsAuth(false);
    const t0 = performance.now();
    try {
      const region = getRegion();
      const cacheKey = (activeMode !== "photo" && input.code) ? input.code : "";
      const cached = cacheKey ? getCachedValuation(cacheKey, region.code) : null;
      const v = cached || await withRetry(
        () => valuateFn({ data: { scanType: activeMode, code: input.code, imageBase64: input.imageBase64, region: { code: region.code, name: region.name, currency: region.currency, markets: region.markets } } }),
        { retries: 2 },
      );
      if (!cached && cacheKey) setCachedValuation(cacheKey, region.code, v);

      const exact = activeMode !== "photo" && !!input.code && v.verified;
      const hot = computeHotness({
        salesVelocity: v.salesVelocity,
        marginPotential: v.marginPotential,
        trendScore: v.trendScore,
        exactMatch: exact,
        torontoBoost: v.torontoBoost,
      });
      const rec: ScanRecord = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        title: v.title,
        category: v.category,
        thumbnail: input.imageBase64,
        scanType: activeMode,
        code: input.code,
        priceLow: v.priceLowCAD,
        priceHigh: v.priceHighCAD,
        currency: v.currency || "USD",
        condition: v.condition,
        comps: v.comps,
        hotness: hot,
        confidence: v.unknown ? 0 : Math.min(100, v.confidence + (hot.confidenceBonus || 0)),
        flipTip: v.flipTip,
        neighbourhood: v.neighbourhood,
        verified: v.verified,
        dataSource: v.dataSource,
        warnings: v.warnings,
        unknown: v.unknown,
        brand: v.brand,
        imageUrl: v.imageUrl,
        pricingTier: v.pricingTier,
        compsAreEstimates: v.compsAreEstimates,
        confidenceReasons: v.confidenceReasons,
        suggestBarcode: v.suggestBarcode,
        pricingSource: v.pricingSource,
        pricingSampleCount: v.pricingSampleCount,
        pricingMedian: v.pricingMedian,
        pricingLow: v.pricingLow,
        pricingHigh: v.pricingHigh,
        pricingRetrievedAt: v.pricingRetrievedAt,
      };
      saveScan(rec);
      track({ type: "valuation.ok", verified: !!v.verified, tier: v.pricingTier, confidence: rec.confidence, ms: Math.round(performance.now() - t0) });
      navigate({ to: "/result/$id", params: { id: rec.id } });
    } catch (e: any) {
      console.error("Valuation failed", e);
      playError();
      navigator.vibrate?.([60, 40, 60]);
      track({ type: "valuation.error", message: String(e?.message || e) });
      const status = e?.status ?? e?.response?.status ?? e?.cause?.status;
      const msg = String(e?.message || "");
      if (status === 401 || /\b401\b|unauthorized/i.test(msg)) {
        setNeedsAuth(true);
        setErr("Please sign in to scan.");
        setBusy(false);
        return;
      }
      Sentry.captureException(e, {
        extra: { context: "valuation_failure", barcode: input.code },
      });
      setErr(e?.message || "Something went wrong. Tap a mode again to retry.");
      setBusy(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => handleResult({ imageBase64: reader.result as string });
    reader.readAsDataURL(f);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      style={{ width: "100dvw", height: "100dvh" }}
    >
      {/* Full-screen camera fills the container */}
      <CameraScanner key={scannerKey} mode={activeMode} onCapture={handleResult} />

      {/* Floating overlays */}
      <div className="pointer-events-none absolute inset-0">
        {/* Top controls */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between gap-2"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 16px)",
            paddingLeft: 16,
            paddingRight: 16,
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={() => navigate({ to: "/" })}
            className="size-10 grid place-items-center rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white active:scale-95 transition"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <LanguagePicker />
            <RegionPicker />
            <label
              className={`size-10 grid place-items-center rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white transition ${signedOut ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
              aria-label="Upload photo"
              aria-disabled={signedOut}
              onClick={(e) => { if (signedOut) { e.preventDefault(); requireAuth(); } }}
            >
              <Upload className="size-4" />
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onUpload} disabled={signedOut} />
            </label>
          </div>
        </div>

        {/* Bottom controls: mode tabs + hint — hidden while camera is active so capture button stays clear */}
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col gap-3"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
            paddingLeft: 16,
            paddingRight: 16,
            pointerEvents: "auto",
            display: cameraActive ? "none" : "flex",
          }}
        >
          <p className="text-[11px] text-white/85 text-center drop-shadow">
            {activeMode === "photo" && t("scan.hint.photo")}
            {activeMode === "barcode" && t("scan.hint.barcode")}
            {activeMode === "qr" && t("scan.hint.qr")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <ModeTab icon={<Camera className="size-4" />}   label={t("mode.photo")}   active={activeMode==="photo"}   disabled={signedOut} onClick={() => { if (signedOut) return requireAuth(); primeAudio(); setActiveMode("photo"); restartScanner(); }} />
            <ModeTab icon={<ScanLine className="size-4" />} label={t("mode.barcode")} active={activeMode==="barcode"} disabled={signedOut} onClick={() => { if (signedOut) return requireAuth(); primeAudio(); setActiveMode("barcode"); restartScanner(); }} />
            <ModeTab icon={<QrCode className="size-4" />}   label={t("mode.qr")}      active={activeMode==="qr"}      disabled={signedOut} onClick={() => { if (signedOut) return requireAuth(); primeAudio(); setActiveMode("qr"); restartScanner(); }} />
          </div>
        </div>
      </div>

      {busy && (
        <div className="absolute inset-0 z-[110] grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl bg-card border border-border p-6 flex flex-col items-center gap-3 glow-primary">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-display font-bold">{t("scan.scoring")}</p>
            <p className="text-xs text-muted-foreground">{t("scan.scoring.sub")}</p>
          </div>
        </div>
      )}

      {err && (
        <div className="absolute inset-0 z-[105] grid place-items-center p-6 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-destructive/40 bg-card text-card-foreground p-5 shadow-2xl">
            <p className="font-display font-bold text-base mb-1">
              {needsAuth ? "Sign in required" : "Scan didn't go through"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">{err}</p>
            <div className="flex flex-col gap-2">
              {needsAuth ? (
                <button
                  onClick={() => navigate({ to: "/login", search: { redirect: "/scan", mode: activeMode } })}
                  className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold active:scale-95 transition"
                >
                  Sign in
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (lastInput && (activeMode !== "photo" ? lastInput.code : lastInput.imageBase64)) {
                        setErr(null);
                        handleResult(lastInput);
                      } else {
                        restartScanner();
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold active:scale-95 transition"
                  >
                    <RefreshCw className="size-4" /> Retry
                  </button>
                  <button
                    onClick={restartScanner}
                    className="w-full rounded-xl bg-secondary text-secondary-foreground px-4 py-2.5 text-sm font-semibold active:scale-95 transition"
                  >
                    Scan something else
                  </button>
                </>
              )}
              <button
                onClick={() => navigate({ to: "/" })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-transparent text-foreground px-4 py-2.5 text-sm font-semibold active:scale-95 transition"
              >
                <Home className="size-4" /> Go home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeTab({ icon, label, active, disabled, onClick }: { icon: React.ReactNode; label: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-disabled={disabled} className={`rounded-xl py-2 flex items-center justify-center gap-2 text-sm font-medium border transition backdrop-blur-md ${active ? "bg-primary text-primary-foreground border-primary glow-primary" : "bg-black/45 border-white/20 text-white"} ${disabled ? "opacity-50" : ""}`}>
      {icon}{label}
    </button>
  );
}
