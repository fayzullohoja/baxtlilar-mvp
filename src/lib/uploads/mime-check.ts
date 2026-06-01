/**
 * Проверка реального типа файла по «магическим байтам» (защита от .exe→.jpg).
 * Разрешены: JPEG, PNG, WebP, HEIC/HEIF. Возвращает тип или null.
 */
export type AllowedImage = "image/jpeg" | "image/png" | "image/webp" | "image/heic";

export function detectImageType(buf: Uint8Array): AllowedImage | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";

  const ascii = (i: number, s: string) =>
    [...s].every((ch, k) => buf[i + k] === ch.charCodeAt(0));

  // WebP: "RIFF"...."WEBP"
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";

  // HEIC/HEIF: ....ftyp{heic|heix|mif1|msf1|heim|hevc}
  if (ascii(4, "ftyp")) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (["heic", "heix", "mif1", "msf1", "heim", "hevc", "hevx"].includes(brand))
      return "image/heic";
  }

  return null;
}

export function extForType(t: AllowedImage): string {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[t];
}
