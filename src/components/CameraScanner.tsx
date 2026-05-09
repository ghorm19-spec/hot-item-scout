import { useEffect, useRef, useState, useCallback } from "react";
import { playShutter, playSuccess, playDetect, primeAudio } from "@/lib/sounds";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Zap, ZapOff, Focus, RefreshCw, Sun } from "lucide-react";
import { track } from "@/lib/telemetry";

type ScanMode = "photo" | "barcode" | "qr";
type ScanState = "starting" | "ready" | "scanning" | "detected" | "captured" | "error";

interface Props {
  mode: ScanMode;
  onCapture: (result: { code?: string; imageBase64?: string }) => void;
}

const supportsNativeBarcode = typeof window !== "undefined" && "BarcodeDetector" in window;
const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const NATIVE_BARCODE_FORMATS = [
  "ean_13","ean_8","upc_a","upc_e","code_128","code_39","code_93","itf","codabar","data_matrix","aztec","pdf417"
];

const ZXING_BARCODE_FORMATS = [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.ITF,
  BarcodeFormat.CODABAR, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC, BarcodeFormat.PDF_417,
];

export function CameraScanner({ mode, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ScanState>("starting");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [boostOn, setBoostOn] = useState(false);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);

  const detectorRef = useRef<any>(null);
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  // Multi-frame confirmation: only accept code after seeing it stable across frames
  const candidateRef = useRef<{ code: string; hits: number; firstAt: number } | null>(null);
  const REQUIRED_HITS = 2;
  const STABLE_WINDOW_MS = 800;

  const cleanupCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { (zxingRef.current as any)?.reset?.(); } catch {}
    zxingRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
  }, []);

  const startCameraRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    firedRef.current = false;
    candidateRef.current = null;
    setState("starting");
    setError(null);
    setTorchOn(false);
    setTorchSupported(false);
    track({ type: "scan.start", mode });

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // @ts-expect-error advanced focus hint
            focusMode: "continuous",
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const track0 = stream.getVideoTracks()[0];
        trackRef.current = track0;

        // Auto-recover if track ends unexpectedly (OS reclaim, hardware error)
        track0.addEventListener("ended", () => {
          track({ type: "camera.lifecycle", event: "track-ended" });
          if (!cancelled && !firedRef.current) {
            setState("error");
            setError("Camera stream lost. Tap retry.");
          }
        });

        const caps: any = track0.getCapabilities?.() || {};
        if (caps.torch) setTorchSupported(true);
        if (caps.focusMode?.includes?.("continuous")) {
          try { await track0.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }); } catch {}
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setState(mode === "photo" ? "ready" : "scanning");
        }

        if (mode === "barcode" || mode === "qr") {
          if (supportsNativeBarcode) {
            try {
              // @ts-expect-error - BarcodeDetector
              detectorRef.current = new window.BarcodeDetector({
                formats: mode === "qr" ? ["qr_code"] : NATIVE_BARCODE_FORMATS,
              });
              nativeLoop();
              return;
            } catch { /* fallthrough */ }
          }
          const hints = new Map();
          hints.set(
            DecodeHintType.POSSIBLE_FORMATS,
            mode === "qr" ? [BarcodeFormat.QR_CODE] : ZXING_BARCODE_FORMATS,
          );
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 });
          zxingRef.current = reader;
          if (videoRef.current) {
            reader.decodeFromVideoElement(videoRef.current, (result) => {
              if (result && !firedRef.current) considerCode(result.getText());
            }).catch(() => {});
          }
        }
      } catch (e: any) {
        track({ type: "camera.lifecycle", event: "permission-error" });
        setState("error");
        setError(e?.message || "Camera permission denied");
      }
    };
    startCameraRef.current = start;
    start();

    // Mobile lifecycle: pause on tab hidden, resume on visible
    const onVisibility = () => {
      if (document.hidden) {
        track({ type: "camera.lifecycle", event: "hidden" });
        cleanupCamera();
      } else if (!firedRef.current) {
        track({ type: "camera.lifecycle", event: "visible-resume" });
        start();
      }
    };
    const onOrientation = () => {
      track({ type: "camera.lifecycle", event: "orientation" });
      // Re-apply continuous AF after orientation change
      const t = trackRef.current;
      if (t) { try { t.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }); } catch {} }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("orientationchange", onOrientation);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", onOrientation);
      cleanupCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const retry = useCallback(() => {
    cleanupCamera();
    setError(null);
    setState("starting");
    startCameraRef.current?.();
  }, [cleanupCamera]);

  const considerCode = useCallback((raw: string) => {
    if (firedRef.current) return;
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    const cur = candidateRef.current;
    if (!cur || cur.code !== code || now - cur.firstAt > STABLE_WINDOW_MS) {
      candidateRef.current = { code, hits: 1, firstAt: now };
      return;
    }
    cur.hits += 1;
    if (cur.hits >= REQUIRED_HITS) {
      firedRef.current = true;
      setState("detected");
      navigator.vibrate?.([30, 40, 60]);
      playDetect();
      setTimeout(() => playSuccess(), 130);
      // brief visual confirm before handing off
      setTimeout(() => onCapture({ code }), 180);
    }
  }, [onCapture]);

  const nativeLoop = async () => {
    if (!videoRef.current || !detectorRef.current || firedRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length > 0) considerCode(codes[0].rawValue);
    } catch {}
    rafRef.current = requestAnimationFrame(nativeLoop);
  };

  const toggleTorch = async () => {
    const t = trackRef.current; if (!t) return;
    try {
      const next = !torchOn;
      await t.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
      navigator.vibrate?.(15);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleTapFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    const t = trackRef.current; if (!t) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusRing({ x, y });
    setTimeout(() => setFocusRing(null), 700);
    const caps: any = t.getCapabilities?.() || {};
    if (caps.focusMode?.includes?.("single-shot")) {
      try {
        await t.applyConstraints({ advanced: [{ focusMode: "single-shot" } as any] });
        setTimeout(async () => {
          try { await t.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }); } catch {}
        }, 600);
      } catch {}
    }
    navigator.vibrate?.(10);
  };

  const snapshot = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c || firedRef.current) return;
    firedRef.current = true;
    setState("captured");
    primeAudio();
    playShutter();
    navigator.vibrate?.([15, 25, 50]);
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.88);
    setTimeout(() => playSuccess(), 220);
    // Brief flash before navigating
    setTimeout(() => onCapture({ imageBase64: dataUrl }), 250);
  };

  // SVG corner-bracket reticle dimensions per mode
  const reticleW = mode === "qr" ? 256 : mode === "barcode" ? 288 : 288;
  const reticleH = mode === "qr" ? 256 : mode === "barcode" ? 128 : 288;
  const locked = state === "detected";
  const lockInset = locked ? 8 : 0;
  const reticleColor = locked ? "#00C853" : "#FFFFFF";

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-black select-none"
      onClick={handleTapFocus}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ filter: boostOn ? "brightness(1.35) contrast(1.08)" : undefined }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Capture flash */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${
          state === "captured" ? "opacity-80" : "opacity-0"
        }`}
      />

      {/* Reticle — SVG corner brackets */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg
          width={reticleW}
          height={reticleH}
          viewBox={`0 0 ${reticleW} ${reticleH}`}
          className="transition-all duration-200"
          style={{
            filter: `drop-shadow(0 0 6px rgba(0,0,0,0.55)) drop-shadow(0 0 12px ${locked ? "rgba(0,200,83,0.55)" : "rgba(255,255,255,0.25)"})`,
          }}
        >
          {(() => {
            const len = 28;
            const sw = 3;
            const x0 = lockInset;
            const y0 = lockInset;
            const x1 = reticleW - lockInset;
            const y1 = reticleH - lockInset;
            const corners = [
              `M ${x0} ${y0 + len} L ${x0} ${y0} L ${x0 + len} ${y0}`,
              `M ${x1 - len} ${y0} L ${x1} ${y0} L ${x1} ${y0 + len}`,
              `M ${x0} ${y1 - len} L ${x0} ${y1} L ${x0 + len} ${y1}`,
              `M ${x1 - len} ${y1} L ${x1} ${y1} L ${x1} ${y1 - len}`,
            ];
            return corners.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={reticleColor}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray="60 6"
                className={locked ? "" : "animate-reticle-pulse"}
              />
            ));
          })()}
        </svg>
        {(mode === "barcode" || mode === "qr") && !locked && (
          <div
            className="absolute h-0.5 bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-scanline"
            style={{ width: reticleW - 16 }}
          />
        )}
      </div>

      {/* Tap-to-focus indicator */}
      {focusRing && (
        <div
          className="pointer-events-none absolute size-16 -ml-8 -mt-8 rounded-full border-2 border-white/90 animate-ping-once"
          style={{ left: focusRing.x, top: focusRing.y }}
        />
      )}

      {/* Torch (when supported) or iOS brightness boost fallback */}
      {state !== "starting" && (torchSupported ? (
        <button
          onClick={(e) => { e.stopPropagation(); toggleTorch(); }}
          className={`absolute size-11 grid place-items-center rounded-full backdrop-blur-md border transition active:scale-95 ${
            torchOn ? "bg-primary text-primary-foreground border-primary" : "bg-black/45 text-white border-white/20"
          }`}
          style={{ top: "calc(max(env(safe-area-inset-top), 16px) + 56px)", right: 16 }}
          aria-label="Toggle torch"
        >
          {torchOn ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
        </button>
      ) : isIOS ? (
        <button
          onClick={(e) => { e.stopPropagation(); setBoostOn(v => !v); navigator.vibrate?.(10); }}
          className={`absolute size-11 grid place-items-center rounded-full backdrop-blur-md border transition active:scale-95 ${
            boostOn ? "bg-primary text-primary-foreground border-primary" : "bg-black/45 text-white border-white/20"
          }`}
          style={{ top: "calc(max(env(safe-area-inset-top), 16px) + 56px)", right: 16 }}
          aria-label="Boost brightness"
        >
          <Sun className="size-5" />
        </button>
      ) : null)}

      {state === "starting" && !error && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/80 bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Focus className="size-6 animate-pulse text-primary" />
            <p>Starting camera…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center bg-black/70">
          <div className="max-w-xs">
            <p className="text-destructive font-semibold mb-2">Camera unavailable</p>
            <p className="text-sm text-white/70">{error}</p>
            <p className="text-xs text-white/50 mt-3">Allow camera access, or upload a photo from the home screen.</p>
            <button
              onClick={(e) => { e.stopPropagation(); retry(); }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold active:scale-95 transition"
            >
              <RefreshCw className="size-4" /> Retry
            </button>
          </div>
        </div>
      )}

      {mode === "photo" && (state === "ready" || state === "captured") && (
        <button
          onClick={(e) => { e.stopPropagation(); snapshot(); }}
          disabled={state === "captured"}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 size-20 rounded-full bg-white/15 backdrop-blur-md border-4 border-white/90 active:scale-90 transition grid place-items-center disabled:opacity-60"
          aria-label="Capture"
        >
          <span className="size-14 rounded-full bg-white shadow-inner" />
        </button>
      )}

      {(mode === "barcode" || mode === "qr") && (state === "scanning" || state === "detected") && (
        <div className="absolute bottom-4 left-4 right-4 text-center text-xs text-white bg-black/50 rounded-xl py-2 backdrop-blur-md font-medium">
          {state === "detected" ? (
            <span className="text-hot font-bold">✓ Detected — analyzing…</span>
          ) : (
            <>Hold steady — auto-detecting {mode === "qr" ? "QR code" : "barcode"}…</>
          )}
        </div>
      )}
    </div>
  );
}
