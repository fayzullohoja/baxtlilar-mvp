// «Семейный компас» — MVP 10 вопросов (Big Five). Ответ: шкала 1–5.
export type Factor = "O" | "C" | "E" | "A" | "ES";
export type Question = { id: string; factor: Factor; ru: string; uz: string };

export const QUESTIONS: Question[] = [
  { id: "q1", factor: "O", ru: "Мне интересно узнавать новые взгляды и идеи.", uz: "Menga yangi qarashlar va gʻoyalarni bilish qiziq." },
  { id: "q2", factor: "C", ru: "Если я обещал(а), я стараюсь выполнить это.", uz: "Vaʼda bergan boʻlsam, uni bajarishga harakat qilaman." },
  { id: "q3", factor: "C", ru: "Мне важно заранее обсуждать важные решения.", uz: "Muhim qarorlarni oldindan muhokama qilish men uchun muhim." },
  { id: "q4", factor: "E", ru: "Мне важно часто общаться с близким человеком.", uz: "Yaqin inson bilan tez-tez muloqot qilish men uchun muhim." },
  { id: "q5", factor: "A", ru: "Мне важно учитывать чувства другого человека.", uz: "Boshqa insonning hislarini hisobga olish men uchun muhim." },
  { id: "q6", factor: "A", ru: "Мне близка идея взаимной поддержки в семье.", uz: "Oilada oʻzaro qoʻllab-quvvatlash gʻoyasi menga yaqin." },
  { id: "q7", factor: "ES", ru: "В сложной ситуации я стараюсь сохранять спокойствие.", uz: "Qiyin vaziyatda xotirjamlikni saqlashga harakat qilaman." },
  { id: "q8", factor: "ES", ru: "Мне важно обсуждать проблемы без крика и давления.", uz: "Muammolarni baqiriqsiz va bosimsiz muhokama qilish muhim." },
  { id: "q9", factor: "ES", ru: "Мне нужна поддержка, но я не жду, что меня поймут всегда.", uz: "Menga qoʻllab-quvvatlash kerak, lekin meni doim tushunishlarini kutmayman." },
  { id: "q10", factor: "A", ru: "Мне важно, чтобы в отношениях были доверие и честность.", uz: "Munosabatlarda ishonch va halollik boʻlishi men uchun muhim." },
];

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
