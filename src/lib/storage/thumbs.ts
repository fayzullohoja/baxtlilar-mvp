import "server-only";
import fs from "node:fs/promises";
import type { ThumbWidth } from "./thumb-url";

export { THUMB_WIDTHS, parseThumbWidth, thumb, type ThumbWidth } from "./thumb-url";

/**
 * Превью картинок для списков - кеш в памяти процесса.
 *
 * Зачем превью вообще. В списке клиентов аватар рисуется кружком 32 пикселя, в
 * очереди фото-модерации превью 60x80, в мини-аппе карточка подбора - кружок
 * 64 пикселя. А в src подставлялся ОРИГИНАЛ снимка с телефона: сжатия в пути
 * загрузки нет нигде, клиент шлёт файл как есть, сервер кладёт байты как есть.
 * Замер на настоящем снимке: 5.08 МБ на один кружок, 122 МБ на страницу из
 * двух десятков строк.
 *
 * Почему кеш в ПАМЯТИ, а не на диске. Дисковый кеш пришлось бы чистить при
 * удалении пользователя - иначе превью паспорта и селфи удалённого человека
 * остаются лежать навсегда. Аватар в админке это ОДОБРЕННОЕ СЕЛФИ из приватного
 * бакета документов, то есть кроп лица из KYC. Мест, где сносятся файлы
 * пользователя, в проекте шесть, и все они ходят через remove() бакета, то есть
 * строго внутрь каталога бакета - до постороннего каталога с кешем ни одно не
 * дотянулось бы. Подцепить чистку к каждому и не забыть ни одного при следующей
 * правке - ровно тот случай, когда утечка заводится сама собой. В памяти чистить
 * нечего: на диск ничего не ложится, перезапуск обнуляет.
 *
 * Цена решения - после перезапуска превью считаются заново. На нашем объёме
 * (несколько десятков фотографий) это единицы секунд один раз.
 */

export type Thumb = { bytes: Uint8Array<ArrayBuffer>; contentType: string };

// Потолки кеша. Превью 160 пикселей весит 2-4 КБ, 640 - десятки КБ, так что
// две с половиной сотни записей это единицы мегабайт. Держим оба ограничения -
// и по числу записей, и по суммарному весу, чтобы широкие превью не съели память.
const MAX_ENTRIES = 256;
const MAX_BYTES = 16 * 1024 * 1024;

// Map хранит порядок вставки, поэтому вытеснение самого давнего - это удаление
// первого ключа. Отдельная структура для LRU не нужна.
const cache = new Map<string, Thumb>();
let cachedBytes = 0;

/**
 * Ограничитель одновременных пережатий - защита роута отдачи файлов.
 *
 * Роут /api/storage/o/ намеренно выведен и из-под лимитера запросов
 * (classifyPath -> "exempt"), и из-под требования сессии (isPublicApi).
 * Обоснование было записано прямо в лимитере: «подписанные HMAC-URL с высоким
 * легальным QPS» - и оно верно ровно пока роут читает файл с диска. Пережатие
 * картинки это уже работа процессора, и решает, платить ли за неё, КЛИЕНТ:
 * ширина в подпись не входит.
 *
 * Без ограничителя держатель любой законной подписанной ссылки (а она есть у
 * каждого пользователя на собственные фото) мог бы пачкой параллельных запросов
 * занять весь пул потоков libuv. Пул общий с fs.promises, приложение
 * однопроцессное, прод - две виртуальные ядра: встали бы ВСЕ файловые операции,
 * а не только выдача превью.
 *
 * Поэтому пережатий одновременно не больше двух, очередь ограничена, а на
 * переполнении честно возвращаем null - вызывающий отдаст оригинал. Это ровно
 * то поведение, которое было до появления превью, значит хуже не станет.
 */
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 16;
let running = 0;
let queued = 0;

// Один и тот же файл нередко просят сразу несколько запросов (страница открыта в
// двух вкладках, быстрый повторный заход, параллельная отрисовка списка). Без
// этой карты каждый запускал бы пережатие заново и жёг процессор впустую.
const inFlight = new Map<string, Promise<Thumb | null>>();

function keyOf(srcPath: string, mtimeMs: number, size: number, width: number): string {
  // Время правки и размер в ключе обязательны: паспорт и селфи лежат по
  // ПОСТОЯННОМУ пути (`${userId}/selfie.jpg`, upsert), то есть перезаливка
  // после «нужны правки» кладёт НОВЫЙ файл по СТАРОМУ пути. Будь ключом только
  // путь, модератор навсегда остался бы со снимком, который человек уже заменил.
  return `${srcPath}:${mtimeMs}:${size}:${width}`;
}

function remember(key: string, t: Thumb): void {
  cache.set(key, t);
  cachedBytes += t.bytes.byteLength;
  while (cache.size > MAX_ENTRIES || cachedBytes > MAX_BYTES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    const victim = cache.get(oldest.value);
    cache.delete(oldest.value);
    if (victim) cachedBytes -= victim.bytes.byteLength;
  }
}

// Отсутствие библиотеки и нечитаемый файл - это ДВЕ РАЗНЫЕ беды, и гасить их
// одинаково молча нельзя. Если sharp не встанет на сервере, превью просто
// перестанут получаться, а снаружи всё будет выглядеть штатно: код 200,
// правильные картинки, ноль ошибок - только каждая по пять мегабайт. Отличить
// «правка не доехала» от «это айфонный HEIC» стало бы невозможно, тем более
// без доступа к серверу. Поэтому про сломанную библиотеку сообщаем - один раз,
// чтобы не залить лог на каждый запрос.
let moduleFailureReported = false;

async function render(srcAbsPath: string, width: ThumbWidth): Promise<Thumb | null> {
  let sharp: typeof import("sharp").default;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch (e) {
    if (!moduleFailureReported) {
      moduleFailureReported = true;
      console.error(
        "[thumbs] sharp не загрузился - превью отключены, отдаём оригиналы. " +
          "Проверьте, что @img/sharp-linux-x64 установился при деплое:",
        e,
      );
    }
    return null;
  }

  try {
    // Одна операция - один поток libvips. Иначе одно пережатие само по себе
    // разбирает весь пул и ограничитель выше теряет смысл.
    sharp.concurrency(1);
    const out = await sharp(srcAbsPath, { failOn: "none" })
      .rotate() // учесть EXIF-поворот, иначе снимки с телефона лягут набок
      // fit:"inside" ограничивает ДЛИННУЮ сторону и сохраняет пропорции. Значит
      // короткая сторона выходит меньше запрошенной ширины, и в вёрстке с
      // objectFit:"cover" (квадратный кружок) масштабирование идёт как раз по
      // короткой. Поэтому ширины в thumb-url.ts взяты с запасом на это и на
      // плотность экрана - см. расчёт там.
      .resize(width, width, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    // Копия, а не вид на буфер: превью весит килобайты, копия ничего не стоит,
    // зато не удерживает и не отдаёт наружу чужие байты общего пула Buffer.
    return { bytes: new Uint8Array(out), contentType: "image/webp" };
  } catch {
    // Ожидаемая осечка: формат не читается (HEIC с айфона libheif отвергает
    // с «Number of references in iref box exceeds the security limits»), файл
    // битый. Это не повод шуметь в лог на каждый запрос - просто отдаём
    // оригинал, а не битую картинку у модератора.
    return null;
  }
}

/**
 * Превью заданной ширины. null - значит не получилось (нет библиотеки, формат
 * не читается, файла нет, сервер занят), и вызывающий обязан отдать оригинал.
 */
export async function readThumb(
  srcAbsPath: string,
  width: ThumbWidth,
): Promise<Thumb | null> {
  let stat;
  try {
    stat = await fs.stat(srcAbsPath);
  } catch {
    return null;
  }

  const key = keyOf(srcAbsPath, stat.mtimeMs, stat.size, width);

  const hit = cache.get(key);
  if (hit) {
    // Освежаем позицию в порядке вставки - это и есть «недавно использованный».
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const already = inFlight.get(key);
  if (already) return already;

  // Сервер занят - не встаём в бесконечную очередь, а сразу отдаём оригинал.
  if (running >= MAX_CONCURRENT && queued >= MAX_QUEUED) return null;

  const job = (async () => {
    queued++;
    try {
      while (running >= MAX_CONCURRENT) {
        await new Promise((r) => setTimeout(r, 25));
      }
    } finally {
      queued--;
    }
    running++;
    try {
      const t = await render(srcAbsPath, width);
      if (t) remember(key, t);
      return t;
    } finally {
      running--;
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, job);
  return job;
}

/** Только для тестов: обнулить кеш между сценариями. */
export function __resetThumbCache(): void {
  cache.clear();
  inFlight.clear();
  cachedBytes = 0;
}
