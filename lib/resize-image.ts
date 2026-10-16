// Shrinks a phone photo before it's uploaded, so the free 1 GB of Storage lasts and the
// photos load quickly on mobile data. Browser only (it uses a canvas).
//
// The result is a JPEG at most MAX_SIDE pixels on its longest side and, where possible, at
// most MAX_BYTES. The car-photos bucket rejects anything over 300 KB.

const MAX_SIDE = 1280;
const MAX_BYTES = 200_000;

export async function resizeForUpload(file: File): Promise<Blob> {
  // "from-image" applies the camera's rotation, so portrait photos stay upright.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    let side = MAX_SIDE;
    // Lower the quality first, then the size, until it fits.
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser can't resize images.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.7, 0.55]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (blob && blob.size <= MAX_BYTES) return blob;
        if (blob && attempt === 3 && quality === 0.55) return blob;
      }
      side = Math.round(side * 0.75);
    }
    throw new Error("Couldn't make the photo small enough.");
  } finally {
    bitmap.close();
  }
}
