/// <reference lib="webworker" />
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from "@zxing/library";

type DecodeMsg = {
  type: "decode";
  id: number;
  mode: "barcode" | "qr";
  buffer: ArrayBuffer;
  width: number;
  height: number;
};
type InMsg = DecodeMsg;

const ctx: DedicatedWorkerGlobalScope = self as any;

const BARCODE_FORMATS = [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.ITF,
  BarcodeFormat.CODABAR, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC, BarcodeFormat.PDF_417,
];
const NATIVE_BARCODE_FORMATS = [
  "ean_13","ean_8","upc_a","upc_e","code_128","code_39","code_93","itf","codabar","data_matrix","aztec","pdf417",
];

// Native BarcodeDetector is exposed in DedicatedWorkerGlobalScope on Chromium.
let nativeDetectorBarcode: any = null;
let nativeDetectorQR: any = null;
const hasNative = typeof (ctx as any).BarcodeDetector !== "undefined";
if (hasNative) {
  try { nativeDetectorBarcode = new (ctx as any).BarcodeDetector({ formats: NATIVE_BARCODE_FORMATS }); } catch {}
  try { nativeDetectorQR = new (ctx as any).BarcodeDetector({ formats: ["qr_code"] }); } catch {}
}

function makeReader(mode: "barcode" | "qr") {
  const reader = new MultiFormatReader();
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, mode === "qr" ? [BarcodeFormat.QR_CODE] : BARCODE_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return reader;
}
const readerBarcode = makeReader("barcode");
const readerQR = makeReader("qr");

function toLuminance(img: ImageData): Uint8ClampedArray {
  const data = img.data;
  const out = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0, j = 0, len = data.length; i < len; i += 4, j++) {
    const a = data[i + 3];
    if (a === 0) { out[j] = 0xff; continue; }
    out[j] = (306 * data[i] + 601 * data[i + 1] + 117 * data[i + 2] + 0x200) >> 10;
  }
  return out;
}

async function decode(mode: "barcode" | "qr", imageData: ImageData): Promise<string | null> {
  // Try native first when available.
  const detector = mode === "qr" ? nativeDetectorQR : nativeDetectorBarcode;
  if (detector) {
    try {
      const codes = await detector.detect(imageData);
      if (codes && codes.length > 0 && codes[0].rawValue) return String(codes[0].rawValue);
    } catch { /* fall through to zxing */ }
  }
  // ZXing fallback.
  try {
    const lum = toLuminance(imageData);
    const source = new RGBLuminanceSource(lum, imageData.width, imageData.height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const reader = mode === "qr" ? readerQR : readerBarcode;
    const result = reader.decode(bitmap);
    reader.reset();
    return result?.getText() ?? null;
  } catch {
    return null;
  }
}

ctx.addEventListener("message", async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (!msg || msg.type !== "decode") return;
  try {
    const data = new Uint8ClampedArray(msg.buffer);
    const imageData = new ImageData(data, msg.width, msg.height);
    const barcode = await decode(msg.mode, imageData);
    ctx.postMessage({ type: "result", id: msg.id, barcode });
  } catch (e: any) {
    ctx.postMessage({ type: "error", id: msg.id, message: String(e?.message || e) });
  }
});

export {};