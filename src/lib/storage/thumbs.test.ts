import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const TEST_DIR = path.join(os.tmpdir(), "bx-thumbs-test");
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
process.env.DATABASE_URL = "postgres://localhost/none";
process.env.TELEGRAM_BOT_TOKEN = "telegram-bot-token-xxxxxxxx";
process.env.STORAGE_DIR = TEST_DIR;

import { readThumb, __resetThumbCache } from "./thumbs";
import { thumb, parseThumbWidth, THUMB_WIDTHS } from "./thumb-url";

const SRC = path.join(TEST_DIR, "big.jpg");
const NOT_AN_IMAGE = path.join(TEST_DIR, "broken.jpg");

/**
 * Заведомо крупная картинка, чтобы уменьшение было видно по байтам.
 *
 * Шум брать НЕЛЬЗЯ, хотя он и кажется очевидным выбором: при уменьшении в
 * десяток раз любой шум усредняется в одинаковый серый прямоугольник, и два
 * РАЗНЫХ исходника дают побайтово одинаковое превью. Тест на подмену файла от
 * этого проходил бы всегда и ничего не проверял (проверено: 66 байт и там, и
 * там). Поэтому крупные цветные блоки - они переживают уменьшение.
 */
async function makeBigJpeg(to: string, seed = 1): Promise<void> {
  const { default: sharp } = await import("sharp");
  const w = 2000;
  const h = 1500;
  const px = Buffer.alloc(w * h * 3);
  const block = 250;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = (Math.floor(y / block) * 8 + Math.floor(x / block) + seed) % 6;
      const i = (y * w + x) * 3;
      px[i] = cell & 1 ? 240 : 20;
      px[i + 1] = cell & 2 ? 240 : 20;
      px[i + 2] = cell & 4 ? 240 : 20;
    }
  }
  await sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(to);
}

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
  await makeBigJpeg(SRC);
  await fs.writeFile(NOT_AN_IMAGE, Buffer.from("это вообще не картинка"));
});
afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});
beforeEach(() => {
  __resetThumbCache();
});

describe("превью для списков", () => {
  it("ужимает оригинал в десятки раз", async () => {
    const orig = (await fs.stat(SRC)).size;
    const t = await readThumb(SRC, 160);
    expect(t).not.toBeNull();
    expect(t!.contentType).toBe("image/webp");
    // Смысл всей правки: в кружок 32 пикселя не должен ехать мегабайтный файл.
    expect(t!.bytes.byteLength).toBeLessThan(orig / 20);
  });

  it("НИЧЕГО не пишет на диск - иначе превью пережили бы удаление аккаунта", async () => {
    // Ради этого свойства кеш и держится в памяти. Аватар в админке - это
    // одобренное селфи из KYC; файлы пользователя сносятся в шести местах, и
    // все они ходят через remove() бакета, то есть строго внутрь каталога
    // бакета. Посторонний файл на диске они бы не тронули, и кроп лица остался
    // бы лежать после «необратимого» удаления.
    const before = (await fs.readdir(TEST_DIR)).sort();
    await readThumb(SRC, 160);
    await readThumb(SRC, 320);
    const after = (await fs.readdir(TEST_DIR)).sort();
    expect(after).toEqual(before);
  });

  it("второй раз отдаётся из кеша, а не считается заново", async () => {
    const a = await readThumb(SRC, 320);
    const b = await readThumb(SRC, 320);
    expect(a).not.toBeNull();
    // Тот же объект - значит пережатия не было, взяли из кеша.
    expect(b).toBe(a);
  });

  it("перезаливка по ТОМУ ЖЕ пути даёт новое превью, а не старое", async () => {
    // Ровно случай паспорта и селфи: путь `${userId}/selfie.jpg` с upsert.
    // Будь ключом кеша только путь, модератор навсегда остался бы со снимком,
    // который человек уже заменил.
    const reupload = path.join(TEST_DIR, "selfie.jpg");
    await makeBigJpeg(reupload, 1);
    const before = await readThumb(reupload, 160);

    await new Promise((r) => setTimeout(r, 10));
    await makeBigJpeg(reupload, 3); // другой файл по тому же пути
    const after = await readThumb(reupload, 160);

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Buffer.from(after!.bytes).equals(Buffer.from(before!.bytes))).toBe(false);
  });

  it("десять одновременных запросов на одну картинку считают её один раз", async () => {
    // Без склейки параллельных запросов каждый из десяти запускал бы отдельное
    // пережатие - на двух ядрах это прямой путь занять весь пул потоков libuv,
    // общий с файловыми операциями всего приложения.
    const many = path.join(TEST_DIR, "concurrent.jpg");
    await makeBigJpeg(many, 2);
    const all = await Promise.all(Array.from({ length: 10 }, () => readThumb(many, 320)));
    expect(all.every((t) => t !== null)).toBe(true);
    // Все десять получили ОДИН И ТОТ ЖЕ объект - значит считалось однократно.
    for (const t of all) expect(t).toBe(all[0]);
  });

  it("нечитаемый файл не ломает выдачу - возвращаем null, вызывающий отдаст оригинал", async () => {
    expect(await readThumb(NOT_AN_IMAGE, 160)).toBeNull();
    expect(await readThumb(path.join(TEST_DIR, "нет-такого.jpg"), 160)).toBeNull();
  });

  it("ширина только из белого списка", () => {
    for (const w of THUMB_WIDTHS) expect(parseThumbWidth(String(w))).toBe(w);
    // Произвольная ширина - дармовая нагрузка на процессор для роута, который
    // намеренно выведен из-под лимитера запросов. Не принимаем.
    expect(parseThumbWidth("161")).toBeNull();
    expect(parseThumbWidth("10000")).toBeNull();
    expect(parseThumbWidth("abc")).toBeNull();
    expect(parseThumbWidth("0")).toBeNull();
    expect(parseThumbWidth("-160")).toBeNull();
    expect(parseThumbWidth(null)).toBeNull();
  });

  it("ширина приписывается к подписанной ссылке, не ломая её параметры", () => {
    const signed = "/api/storage/o/user-documents/u1/selfie.jpg?exp=123&sig=abc";
    expect(thumb(signed, 160)).toBe(`${signed}&w=160`);
    expect(thumb("/x/y.jpg", 320)).toBe("/x/y.jpg?w=320");
    expect(thumb(null, 160)).toBeNull();
    expect(thumb(undefined, 160)).toBeNull();
  });

  it("ширины хватает на кружок с objectFit:cover при плотности 3x", async () => {
    // fit:"inside" ограничивает ДЛИННУЮ сторону, а cover в квадратной коробке
    // масштабирует по КОРОТКОЙ. Если про это забыть, аватар на retina окажется
    // растянут из недостаточного превью - в первой версии правки так и было.
    const { default: sharp } = await import("sharp");
    const portrait = path.join(TEST_DIR, "portrait.jpg");
    await sharp(SRC).resize(1500, 2000, { fit: "fill" }).toFile(portrait);

    const t = await readThumb(portrait, 160);
    expect(t).not.toBeNull();
    const meta = await sharp(Buffer.from(t!.bytes)).metadata();
    const shortSide = Math.min(meta.width ?? 0, meta.height ?? 0);
    // кружок 32 px при плотности 3x требует 96 px по короткой стороне
    expect(shortSide).toBeGreaterThanOrEqual(96);
  });
});
