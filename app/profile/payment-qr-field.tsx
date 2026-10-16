"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import { resizeForUpload } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";

// `url` shows it; it can be missing when the link couldn't be made, and the QR is still saved.
export type PaymentQr = { path: string; url: string | null } | null;

const noSubscription = () => () => {};

// An owner's UPI QR code (the "scan to pay" code from their UPI app), optional. A new image is
// uploaded into their own folder of the private payment-qr bucket straight away; saving the
// profile makes it the one riders see.
export function PaymentQrField({
  userId,
  saved,
  error,
}: {
  userId: string;
  saved: PaymentQr;
  error?: string;
}) {
  const [qr, setQr] = useState<PaymentQr>(saved);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The button opens the file picker only once the page's JavaScript is running; before that,
  // a tap would do nothing, so it waits.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const blob = await resizeForUpload(file);
      // Into the person's own folder: the only place Storage lets them upload.
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadFailed } = await createClient()
        .storage.from("payment-qr")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadFailed) throw uploadFailed;
      setQr({ path, url: URL.createObjectURL(blob) });
    } catch {
      setUploadError("The QR code couldn't be uploaded. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const message = uploadError ?? error;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">UPI QR code (optional)</p>
      <input type="hidden" name="upi_qr" value={qr?.path ?? ""} />
      {qr?.url && (
        // A local preview or a short-lived signed URL: not worth the image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr.url}
          alt="Your UPI QR code"
          className="h-40 w-40 rounded-lg border border-neutral-200 bg-white object-contain dark:border-neutral-700"
        />
      )}
      {qr && !qr.url && <p className="text-sm">Your QR code is saved.</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading || !ready}
          className="h-10 rounded-lg border border-neutral-300 px-3 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
        >
          {uploading
            ? "Uploading…"
            : qr
              ? "Change QR code"
              : "Add your QR code"}
        </button>
        {qr && (
          <button
            type="button"
            onClick={() => setQr(null)}
            className="h-10 rounded-lg px-3 text-sm font-medium text-red-600 dark:text-red-400"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={upload}
        className="hidden"
        aria-label="Upload your UPI QR code"
      />
      {message ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      ) : (
        <p className="text-sm text-neutral-500">
          A screenshot of the &ldquo;scan to pay&rdquo; code in your UPI app.
          Only riders with a seat in your car see it. Tap Save to keep it.
        </p>
      )}
    </div>
  );
}
