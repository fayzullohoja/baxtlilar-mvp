import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { verifyStorageSig, objectFsPath, mimeForPath } from "@/lib/storage/fs-store";
import { parseThumbWidth, readThumb } from "@/lib/storage/thumbs";

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
  // Кешируем ровно до истечения подписи, не дольше.
  //
  // Что это даёт и чего НЕ даёт. Фото профиля лежат по пути с отметкой времени,
  // путь уникален на каждую загрузку - байты по нему не меняются никогда, такую
  // ссылку можно держать в кеше весь её час. А паспорт и селфи лежат по
  // постоянному пути (`${userId}/${kind}.${ext}` с upsert), то есть перезаливка
  // после «нужны правки» кладёт НОВЫЙ файл по СТАРОМУ пути.
  //
  // Для второго случая привязка к exp риск устаревания НЕ снимает, а ограничивает
  // сверху. Пока exp был уникален на каждый рендер, ссылка менялась постоянно и
  // старую картинку взять было неоткуда; теперь exp постоянен внутри окна сетки,
  // и модератор в худшем случае видит прежний документ до конца этого окна - для
  // TTL 300 с это 75 секунд. Ради работающего кеша разменяно сознательно: без
  // него каждая отрисовка списка тянула все снимки заново.
  const maxAge = Math.max(0, Math.min(3600, exp - Math.floor(Date.now() / 1000)));

  try {
    const fsPath = objectFsPath(bucket, objectPath);

    // Превью для списков: там картинка рисуется размером в несколько десятков
    // пикселей, а оригинал весит мегабайты. Ширина проверена по белому списку;
    // если превью сделать не вышло (нет библиотеки, формат не читается, сервер
    // занят) - идём дальше и отдаём оригинал.
    const width = parseThumbWidth(url.searchParams.get("w"));
    if (width) {
      const small = await readThumb(fsPath, width);
      if (small) {
        return new Response(small.bytes, {
          headers: {
            "Content-Type": small.contentType,
            "Cache-Control": `private, max-age=${maxAge}`,
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    const file = await fs.readFile(fsPath);
    // Вид на те же байты, а НЕ копия (было `new Uint8Array(file)`): файл уже
    // целиком в памяти, и второй экземпляр удваивал пик на каждый запрос. При
    // скриншотах до 5 МБ и списке отзывов это сотни лишних мегабайт на боксе
    // 2 vCPU / 2-4 ГБ. Границы вида заданы явно: Buffer бывает окном в общий
    // пул, и `new Uint8Array(file.buffer)` отдал бы наружу чужие байты пула.
    const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
    return new Response(bytes, {
      headers: {
        "Content-Type": mimeForPath(objectPath),
        "Cache-Control": `private, max-age=${maxAge}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
