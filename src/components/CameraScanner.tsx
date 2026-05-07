import { useEffect, useRef, useState } from "react";

type ScanMode = "photo" | "barcode" | "qr";

interface Props {
  mode: ScanMode;
  onCapture: (result: { code?: string; imageBase64?: string }) => void;
}

// Native BarcodeDetector when available (Chrome/Android, Safari iOS 17+)
const supportsBarcode = typeof window !== "undefined" && "BarcodeDetector" in window;

const BARCODE_FORMATS = [
  "qr_code","ean_13","ean_8","upc_a","upc_e","code_128","code_39","code_93","itf","codabar","data_matrix","aztec","pdf417"
];

export function CameraScanner({ mode, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

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

        if ((mode === "barcode" || mode === "qr") && supportsBarcode) {
          // @ts-expect-error - BarcodeDetector
          detectorRef.current = new window.BarcodeDetector({
            formats: mode === "qr" ? ["qr_code"] : BARCODE_FORMATS.filter(f => f !== "qr_code"),
          });
          loop();
        }
      } catch (e: any) {
        setError(e?.message || "Camera permission denied");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loop = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length > 0) {
        navigator.vibrate?.(60);
        onCapture({ code: codes[0].rawValue });
        return;
      }
    } catch {}
    rafRef.current = requestAnimationFrame(loop);
  };

  const snapshot = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
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

      {(mode === "barcode" || mode === "qr") && !supportsBarcode && (
        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-card/90 backdrop-blur p-3 text-xs text-muted-foreground">
          Live barcode scanning isn't supported in this browser. Tap SNAP and we'll read the code from the photo with AI.
          <button
            onClick={snapshot}
            className="mt-2 w-full rounded-lg bg-primary text-primary-foreground py-2 font-semibold"
          >Snap & decode</button>
        </div>
      )}
    </div>
  );
}
