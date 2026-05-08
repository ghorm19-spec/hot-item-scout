import { useEffect, useRef, useState } from "react";
import { playShutter, playSuccess, playDetect } from "@/lib/sounds";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

type ScanMode = "photo" | "barcode" | "qr";

interface Props {
  mode: ScanMode;
  onCapture: (result: { code?: string; imageBase64?: string }) => void;
}

const supportsNativeBarcode = typeof window !== "undefined" && "BarcodeDetector" in window;

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
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const detectorRef = useRef<any>(null);
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    firedRef.current = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
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
            } catch {
              // fall through to zxing
            }
          }
          // ZXing fallback (works on iOS Safari, Firefox, etc.)
          const hints = new Map();
          hints.set(
            DecodeHintType.POSSIBLE_FORMATS,
            mode === "qr" ? [BarcodeFormat.QR_CODE] : ZXING_BARCODE_FORMATS,
          );
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
          zxingRef.current = reader;
          if (videoRef.current) {
            reader.decodeFromVideoElement(videoRef.current, (result) => {
              if (result && !firedRef.current) {
                firedRef.current = true;
                fireCode(result.getText());
              }
            }).catch(() => {});
          }
        }
      } catch (e: any) {
        setError(e?.message || "Camera permission denied");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { (zxingRef.current as any)?.reset?.(); } catch {}
      zxingRef.current = null;
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fireCode = (code: string) => {
    navigator.vibrate?.(60);
    playDetect();
    setTimeout(() => playSuccess(), 120);
    onCapture({ code });
  };

  const nativeLoop = async () => {
    if (!videoRef.current || !detectorRef.current || firedRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length > 0) {
        firedRef.current = true;
        fireCode(codes[0].rawValue);
        return;
      }
    } catch {}
    rafRef.current = requestAnimationFrame(nativeLoop);
  };

  const snapshot = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c || firedRef.current) return;
    firedRef.current = true;
    playShutter();
    navigator.vibrate?.(40);
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setTimeout(() => playSuccess(), 200);
    onCapture({ imageBase64: dataUrl });
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Reticle */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className={`relative ${mode === "qr" ? "w-64 h-64" : mode === "barcode" ? "w-72 h-32" : "w-72 h-72"} rounded-2xl border-2 border-primary/80 glow-primary`}>
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
          <div className="absolute left-0 right-0 top-1/2 h-px bg-primary/70 animate-pulse" />
        </div>
      </div>

      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          Starting camera…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <p className="text-destructive font-semibold mb-2">Camera unavailable</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-3">Allow camera access, or upload a photo from the home screen.</p>
          </div>
        </div>
      )}

      {mode === "photo" && ready && (
        <button
          onClick={snapshot}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 size-20 rounded-full bg-primary text-primary-foreground glow-primary active:scale-95 transition grid place-items-center font-display font-bold"
          aria-label="Capture"
        >
          SNAP
        </button>
      )}

      {(mode === "barcode" || mode === "qr") && ready && (
        <div className="absolute bottom-4 left-4 right-4 text-center text-xs text-white/80 bg-black/40 rounded-xl py-2 backdrop-blur">
          Hold steady — auto-detecting {mode === "qr" ? "QR code" : "barcode"}…
        </div>
      )}
    </div>
  );
}
