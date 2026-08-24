import "server-only";
import crypto from "node:crypto";

/** Хеш пароля: scrypt. Формат: scrypt$<saltHex>$<hashHex>. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * Заглушка для выравнивания времени ответа при неизвестном логине.
 *
 * Без неё вход в админку работал оракулом: у несуществующей учётки
 * verifyPassword не вызывался вовсе, ответ возвращался заметно быстрее, и по
 * времени можно было перебрать, какие логины существуют. Дальше это
 * складывалось с блокировкой по учётке - зная логин, чужую админскую учётку
 * можно запереть на 15 минут пятью неверными паролями, а админка нужна ровно
 * тогда, когда кого-то надо срочно забанить.
 *
 * Хэш считается один раз при загрузке модуля от случайного пароля: значение
 * никому не подходит, а стоимость проверки такая же, как у настоящего.
 */
const DUMMY_HASH = hashPassword(crypto.randomBytes(32).toString("hex"));

/**
 * Проверка пароля с постоянным временем относительно СУЩЕСТВОВАНИЯ учётки.
 * Если записи нет, всё равно считаем scrypt по заглушке и возвращаем false.
 */
export function verifyPasswordConstantTime(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) {
    verifyPassword(password, DUMMY_HASH);
    return false;
  }
  return verifyPassword(password, stored);
}
