"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_BARCODE } from "@/lib/barcode";
import { lookupByBarcode } from "@/lib/actions";
import type { CatalogProduct } from "@/lib/product-utils";

export type ScanOutcome =
  | { status: "found"; product: CatalogProduct; message: string; rawCode: string }
  | { status: "out_of_stock"; product: CatalogProduct; message: string; rawCode: string }
  | { status: "not_found"; code: string; message: string; rawCode: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (outcome: ScanOutcome) => void;
  title?: string;
  mode?: "sell" | "stock";
};

export function BarcodeScannerModal({
  open,
  onClose,
  onResult,
  title = "Scan barcode",
  mode = "sell",
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const regionId = `qr-reader-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onCloseRef = useRef(onClose);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState<"scanning" | "result">("scanning");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [manualCode, setManualCode] = useState("");

  onResultRef.current = onResult;
  onCloseRef.current = onClose;

  async function stopScanner() {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      s.clear();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
  }

  async function finishWithCode(code: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    void stopScanner();

    const lookup = await lookupByBarcode(code);
    let result: ScanOutcome;

    if (lookup.status === "found") {
      result = {
        status: "found",
        product: lookup.product,
        rawCode: code,
        message: mode === "sell" ? `Added ${lookup.product.name} to cart` : lookup.message,
      };
    } else if (lookup.status === "out_of_stock") {
      result = {
        status: "out_of_stock",
        product: lookup.product,
        rawCode: code,
        message: lookup.message,
      };
    } else {
      result = {
        status: "not_found",
        code: lookup.code,
        rawCode: code,
        message: lookup.message,
      };
    }

    setOutcome(result);
    setPhase("result");

    window.setTimeout(() => {
      onResultRef.current(result);
      onCloseRef.current();
    }, 1600);
  }

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setCameraError(null);
    setStarting(true);
    setPhase("scanning");
    setOutcome(null);
    setManualCode("");

    let cancelled = false;

    async function start() {
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 200)));
      if (cancelled || !document.getElementById(regionId)) return;

      const scanner = new Html5Qrcode(regionId, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => ({
              width: Math.floor(Math.min(viewfinderWidth * 0.92, 420)),
              height: Math.floor(Math.min(viewfinderHeight * 0.38, 180)),
            }),
            disableFlip: false,
          },
          (decodedText) => {
            if (cancelled || handledRef.current) return;
            void finishWithCode(decodedText);
          },
          () => {},
        );
        if (!cancelled) setStarting(false);
      } catch {
        if (!cancelled) {
          setStarting(false);
          setCameraError(
            "Camera blocked or unavailable. Allow camera access, or type the barcode below.",
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, regionId, mode]);

  function useDemoBarcode() {
    void finishWithCode(DEMO_BARCODE);
  }

  function submitManual() {
    const code = manualCode.trim();
    if (!code) return;
    void finishWithCode(code);
  }

  if (!open) return null;

  const resultTone =
    outcome?.status === "found"
      ? "success"
      : outcome?.status === "out_of_stock"
        ? "warn"
        : "error";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-3 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface-raised shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-brand" />
            <p className="text-sm font-semibold text-ink">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "result"}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken disabled:opacity-40"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {phase === "scanning" && (
            <>
              <p className="text-xs text-ink-muted">
                Hold the barcode inside the box. You will see found / not found before the scanner closes.
              </p>

              <div
                id={regionId}
                className={cn(
                  "min-h-[220px] overflow-hidden rounded-xl bg-ink [&_video]:w-full [&_video]:object-cover",
                  cameraError && "hidden",
                )}
              />

              {starting && !cameraError && (
                <p className="text-center text-sm text-ink-muted">Starting camera…</p>
              )}

              {!starting && !cameraError && (
                <p className="text-center text-xs text-ink-faint">Scanning… move closer if nothing happens</p>
              )}

              {cameraError && (
                <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-3 text-sm text-danger">
                  {cameraError}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Or type barcode"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm outline-none focus:border-brand"
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                />
                <button
                  type="button"
                  onClick={submitManual}
                  className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white"
                >
                  Go
                </button>
              </div>

              <button
                type="button"
                onClick={useDemoBarcode}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-sunken"
              >
                Demo: Rice 25kg barcode
              </button>
            </>
          )}

          {phase === "result" && outcome && (
            <div
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl px-4 py-8 text-center",
                resultTone === "success" && "bg-success-soft",
                resultTone === "warn" && "bg-warn-soft",
                resultTone === "error" && "bg-danger-soft",
              )}
            >
              {resultTone === "success" ? (
                <CheckCircle2 className="h-12 w-12 text-success" />
              ) : (
                <AlertCircle className={cn("h-12 w-12", resultTone === "warn" ? "text-warn" : "text-danger")} />
              )}
              <p className="text-lg font-semibold text-ink">{outcome.message}</p>
              <p className="font-mono text-xs text-ink-faint">{outcome.rawCode}</p>
            </div>
          )}

          {phase === "scanning" && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-sunken"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScanButton({
  onClick,
  className,
  label = "Scan",
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-deep active:scale-[0.98] sm:h-14 sm:px-4",
        className,
      )}
    >
      <Camera className="h-5 w-5" />
      {label}
    </button>
  );
}
