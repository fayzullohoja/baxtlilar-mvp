import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { verifyStorageSig, objectFsPath, mimeForPath } from "@/lib/storage/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Отдача приватных объектов (фото/документы) с Railway Volume по подписанной ссылке.
 * Доступ — только при валидной HMAC-подписи с непросроченным TTL (см. fs-store).
 * Замена Supabase Storage signed URL; инвариант 1 (контакты защищены) сохранён.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
): Promise<Response> {
  const { bucket, path: parts } = await params;
  const objectPath = parts.join("/");
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";

  if (!verifyStorageSig(bucket, objectPath, exp, sig)) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const file = await fs.readFile(objectFsPath(bucket, objectPath));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": mimeForPath(objectPath),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
