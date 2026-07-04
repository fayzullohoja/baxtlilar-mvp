import "server-only";

/**
 * C6 — совпадает ли анкетный пол с верифицированным паспортным.
 *
 * user_profiles.gender = 'm'/'f' (выбор в анкете), user_identity.gender = 'M'/'F'
 * (введено модератором из паспорта при approve). Сравнение регистронезависимо.
 *
 * Контракт:
 *  - нет верифицированного пола (null/пусто) → true: не блокируем (у approved-юзера
 *    он есть, но если по какой-то причине отсутствует — не локаутим публикацию);
 *  - верифицированный есть, анкетный пропал → false: подтвердить совпадение нельзя;
 *  - оба есть → строгое равенство без учёта регистра.
 */
export function verifiedGenderMatches(
  profileGender: string | null | undefined,
  verifiedGender: string | null | undefined,
): boolean {
  const verified = verifiedGender?.trim().toLowerCase() ?? "";
  if (!verified) return true; // нечего сверять
  const profile = profileGender?.trim().toLowerCase() ?? "";
  return profile === verified;
}
