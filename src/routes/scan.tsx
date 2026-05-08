import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CameraScanner } from "@/components/CameraScanner";
import { Camera, ScanLine, QrCode, Upload, ArrowLeft, Loader2 } from "lucide-react";
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
  const valuateFn = useServerFn(valuate);

  const handleResult = async (input: { code?: string; imageBase64?: string }) => {
    if (busy) return;

    // Pre-validate barcode client-side: bail fast on misreads instead of paying for AI hallucination.
    if (activeMode === "barcode" && input.code) {
      const v = validateBarcode(input.code);
      if (!v.valid && v.kind !== "OTHER") {
        setErr("That barcode looks like a misread. Hold steady and try again.");
        return;
      }
    }

    setBusy(true); setErr(null);
    try {
      const region = getRegion();
      const cacheKey = (activeMode !== "photo" && input.code) ? input.code : "";
      const cached = cacheKey ? getCachedValuation(cacheKey, region.code) : null;
      const v = cached || await valuateFn({ data: { scanType: activeMode, code: input.code, imageBase64: input.imageBase64, region: { code: region.code, name: region.name, currency: region.currency, markets: region.markets } } });
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
      };
      saveScan(rec);
      navigate({ to: "/result/$id", params: { id: rec.id } });
    } catch (e: any) {
      console.error("Valuation failed", e);
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
    <AppShell>
      <header className="pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/" })} className="size-9 grid place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="font-display font-bold">{t("scan.title")}</h1>
          <LanguagePicker />
          <RegionPicker />
        </div>
        <label className="size-9 grid place-items-center rounded-full bg-card border border-border cursor-pointer">
          <Upload className="size-4" />
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onUpload} />
        </label>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <ModeTab icon={<Camera className="size-4" />}   label={t("mode.photo")}   active={activeMode==="photo"}   onClick={() => setActiveMode("photo")} />
        <ModeTab icon={<ScanLine className="size-4" />} label={t("mode.barcode")} active={activeMode==="barcode"} onClick={() => setActiveMode("barcode")} />
        <ModeTab icon={<QrCode className="size-4" />}   label={t("mode.qr")}      active={activeMode==="qr"}      onClick={() => setActiveMode("qr")} />
      </div>

      <div className="aspect-[3/4] w-full">
        <CameraScanner mode={activeMode} onCapture={handleResult} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground text-center">
        {activeMode === "photo" && t("scan.hint.photo")}
        {activeMode === "barcode" && t("scan.hint.barcode")}
        {activeMode === "qr" && t("scan.hint.qr")}
      </p>

      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl bg-card border border-border p-6 flex flex-col items-center gap-3 glow-primary">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-display font-bold">{t("scan.scoring")}</p>
            <p className="text-xs text-muted-foreground">{t("scan.scoring.sub")}</p>
          </div>
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
          {err}
        </div>
      )}
    </AppShell>
  );
}

function ModeTab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-xl py-2 flex items-center justify-center gap-2 text-sm font-medium border transition ${active ? "bg-primary text-primary-foreground border-primary glow-primary" : "bg-card border-border text-muted-foreground"}`}>
      {icon}{label}
    </button>
  );
}
