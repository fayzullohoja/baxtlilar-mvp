// «Семейный компас» — Big Five, 10 вопросов (5 факторов × direct + reverse).
// Ответ: шкала 1–5. Ревью оунера 2026-07-10: чистая Big Five-структура —
// каждый фактор ровно 2 вопроса (прямой + обратный), без «ценностных» вопросов.
export type Factor = "O" | "C" | "E" | "A" | "ES";
export type Question = { id: string; factor: Factor; reverse: boolean; ru: string; uz: string };

export const QUESTIONS: Question[] = [
  { id: "q1", factor: "O", reverse: false, ru: "Мне интересно узнавать новые взгляды и идеи.", uz: "Menga yangi qarashlar va gʻoyalarni bilish qiziq." },
  { id: "q2", factor: "O", reverse: true, ru: "Я предпочитаю привычные вещи и редко ищу что-то новое.", uz: "Men odatiy narsalarni afzal koʻraman va kamdan-kam yangi narsa izlayman." },
  { id: "q3", factor: "C", reverse: false, ru: "Если я обещал(а), я стараюсь выполнить это.", uz: "Vaʼda bergan boʻlsam, uni bajarishga harakat qilaman." },
  { id: "q4", factor: "C", reverse: true, ru: "Иногда я откладываю важные дела без серьёзной причины.", uz: "Baʼzan muhim ishlarni jiddiy sababsiz keyinga qoldiraman." },
  { id: "q5", factor: "E", reverse: false, ru: "Мне легко начинать общение с новыми людьми.", uz: "Yangi odamlar bilan muloqotni boshlash menga oson." },
  { id: "q6", factor: "E", reverse: true, ru: "Я быстро устаю от долгого общения с людьми.", uz: "Odamlar bilan uzoq muloqot meni tez charchatadi." },
  { id: "q7", factor: "A", reverse: false, ru: "Мне важно учитывать чувства другого человека.", uz: "Boshqa insonning hislarini hisobga olish men uchun muhim." },
  { id: "q8", factor: "A", reverse: true, ru: "В споре мне важнее доказать свою правоту, чем понять другого.", uz: "Bahsda boshqani tushunishdan koʻra oʻz haqligimni isbotlash muhimroq." },
  { id: "q9", factor: "ES", reverse: false, ru: "В сложной ситуации я стараюсь сохранять спокойствие.", uz: "Qiyin vaziyatda xotirjamlikni saqlashga harakat qilaman." },
  { id: "q10", factor: "ES", reverse: true, ru: "Я могу сильно переживать даже из-за небольших трудностей.", uz: "Kichik qiyinchiliklar ham meni kuchli xavotirga solishi mumkin." },
];

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
