// Bilingual бот-копи. Hardcoded RU+UZ+TR+EN, без next-intl: бот живёт за пределами
// рендера, локали грузить незачем. Большинство сообщений двуязычные через "\n\n",
// чтобы не заставлять выбирать язык на самом первом сообщении.

import { BIOMETRIC_CONSENT_TEXT } from "@/content/biometric-consent";

const APP_URL = process.env.APP_URL ?? "https://baxtlilar-mvp-production.up.railway.app";

export const M = {
  greeting:
    "Salom! 👋\n" +
    "Baxtlilar — bu jiddiy va himoyalangan tanishuv ilovasi.\n\n" +
    "Привет! 👋\n" +
    "Baxtlilar — приложение для серьёзных, защищённых знакомств.\n\n" +
    "Merhaba! 👋\n" +
    "Baxtlilar — ciddi ve güvenli bir tanışma uygulamasıdır.\n\n" +
    "Hello! 👋\n" +
    "Baxtlilar — an app for serious, protected dating.\n\n" +
    "Tilni tanlang / Выберите язык / Dil seçin / Choose language:",
  lang_ru: "🇷🇺 Русский",
  lang_uz: "🇺🇿 Oʻzbekcha",
  lang_tr: "🇹🇷 Türkçe",
  lang_en: "🇬🇧 English",

  contact_ask: {
    ru:
      "Чтобы зарегистрироваться, поделитесь номером телефона.\n" +
      "Нажмите кнопку ниже — Telegram отправит номер автоматически.\n\n" +
      "SMS мы НЕ шлём: номер уже подтверждён Telegram'ом.",
    uz:
      "Roʻyxatdan oʻtish uchun telefon raqamingni ulash.\n" +
      "Pastdagi tugmani bos — Telegram raqamni avtomatik yuboradi.\n\n" +
      "Biz SMS yubormaymiz: raqam allaqachon Telegram tomonidan tasdiqlangan.",
    tr:
      "Kayıt olmak için telefon numaranızı paylaşın.\nAşağıdaki düğmeye basın — Telegram numarayı otomatik olarak gönderir.\n\nSMS GÖNDERMİYORUZ: numara Telegram tarafından zaten doğrulanmıştır.",
    en:
      "To register, share your phone number.\nTap the button below — Telegram will send the number automatically.\n\nWe do NOT send SMS: the number is already verified by Telegram.",
  },
  contact_button: { ru: "📱 Поделиться номером", uz: "📱 Raqamni ulashish",
    tr:
      "📱 Numarayı paylaş",
    en: "📱 Share number",
  },
  contact_not_yours: {
    ru: "Это чужой номер. Поделитесь СВОИМ через кнопку.",
    uz: "Bu boshqa odamning raqami. Tugma orqali OʻZ raqamingni ulash.",
    tr:
      "Bu başka birinin numarası. Düğme aracılığıyla KENDİ numaranızı paylaşın.",
    en: "This is someone else's number. Share YOUR own number using the button.",
  },

  pd_consent_ask: {
    ru:
      "📜 <b>Документы Baxtlilar</b>\n\n" +
      "Перед продолжением ознакомьтесь с условиями платформы. Продолжая регистрацию, Вы подтверждаете, что:\n" +
      "— Вам исполнилось 18 лет;\n" +
      "— Вы понимаете, что Baxtlilar создан для серьёзных знакомств с целью создания семьи;\n" +
      "— Вы принимаете документы платформы;\n" +
      "— Вы даёте согласие на обработку персональных данных для регистрации, проверки, анкеты и работы сервиса.\n\n" +
      "Документы:\n" +
      `1. <a href="${APP_URL}/legal/user-agreement.pdf">Пользовательское соглашение</a>\n` +
      `2. <a href="${APP_URL}/legal/rules.pdf">Правила платформы</a>\n` +
      `3. <a href="${APP_URL}/legal/privacy.pdf">Политика конфиденциальности</a>\n` +
      `4. <a href="${APP_URL}/legal/pd-consent.pdf">Согласие на обработку персональных данных</a>\n\n` +
      "После принятия условий мы попросим Ваш номер телефона через Telegram.\n" +
      "Согласие на селфи / биометрическую проверку запросим отдельно перед верификацией.",
    uz:
      "📜 <b>Baxtlilar hujjatlari</b>\n\n" +
      "Davom etishdan oldin platforma shartlari bilan tanishib chiqing. Roʻyxatdan oʻtishni davom ettirar ekansiz, quyidagilarni tasdiqlaysiz:\n" +
      "— Sizga 18 yosh toʻlgan;\n" +
      "— Baxtlilar oila qurish maqsadida jiddiy tanishuvlar uchun yaratilganini tushunasiz;\n" +
      "— platforma hujjatlarini qabul qilasiz;\n" +
      "— roʻyxatdan oʻtish, tekshirish, anketa va xizmat ishlashi uchun shaxsiy maʼlumotlarni qayta ishlashga rozilik berasiz.\n\n" +
      "Hujjatlar:\n" +
      `1. <a href="${APP_URL}/legal/user-agreement.pdf">Foydalanuvchi shartnomasi</a>\n` +
      `2. <a href="${APP_URL}/legal/rules.pdf">Platforma qoidalari</a>\n` +
      `3. <a href="${APP_URL}/legal/privacy.pdf">Maxfiylik siyosati</a>\n` +
      `4. <a href="${APP_URL}/legal/pd-consent.pdf">Shaxsiy maʼlumotlarni qayta ishlashga rozilik</a>\n\n` +
      "Shartlarni qabul qilganingizdan soʻng Telegram orqali telefon raqamingizni soʻraymiz.\n" +
      "Selfi / biometrik tekshiruvga rozilik verifikatsiyadan oldin alohida soʻraladi.",
    tr:
      "📜 <b>Baxtlilar belgeleri</b>\n\nDevam etmeden önce platform koşullarını inceleyin. Kayda devam ederek şunları onaylamış olursunuz:\n— 18 yaşını doldurduğunuzu;\n— Baxtlilar'ın aile kurmak amacıyla ciddi tanışmalar için oluşturulduğunu anladığınızı;\n— Platform belgelerini kabul ettiğinizi;\n— Kayıt, doğrulama, anket ve hizmetin işleyişi için kişisel verilerinizin işlenmesine rıza gösterdiğinizi.\n\nBelgeler:\n1. <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/user-agreement.pdf\">Kullanıcı Sözleşmesi</a>\n2. <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/rules.pdf\">Platform Kuralları</a>\n3. <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/privacy.pdf\">Gizlilik Politikası</a>\n4. <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/pd-consent.pdf\">Kişisel Verilerin İşlenmesine Rıza</a>\n\nKoşulları kabul ettikten sonra Telegram aracılığıyla telefon numaranızı isteyeceğiz.\nSelfie / biyometrik doğrulama için rızayı, doğrulamadan önce ayrıca isteyeceğiz.",
    en:
      "📜 <b>Baxtlilar documents</b>\n\n" +
      "Before continuing, please review the platform terms. By continuing registration, you confirm that:\n" +
      "— you are at least 18 years old;\n" +
      "— you understand that Baxtlilar is created for serious dating with the goal of starting a family;\n" +
      "— you accept the platform documents;\n" +
      "— you consent to the processing of personal data for registration, verification, your profile, and the operation of the service.\n\n" +
      "Documents:\n" +
      `1. <a href="${APP_URL}/legal/user-agreement.pdf">User Agreement</a>\n` +
      `2. <a href="${APP_URL}/legal/rules.pdf">Platform Rules</a>\n` +
      `3. <a href="${APP_URL}/legal/privacy.pdf">Privacy Policy</a>\n` +
      `4. <a href="${APP_URL}/legal/pd-consent.pdf">Consent to Personal Data Processing</a>\n\n` +
      "After you accept the terms, we'll ask for your phone number via Telegram.\n" +
      "Consent to the selfie / biometric check will be requested separately before verification.",
  },
  pd_consent_yes: { ru: "✅ Согласен", uz: "✅ Roziman",
    tr:
      "✅ Kabul ediyorum",
    en: "✅ I agree",
  },
  pd_consent_no: { ru: "❌ Отказаться", uz: "❌ Rad etish",
    tr:
      "❌ Reddet",
    en: "❌ Decline",
  },

  // 2026-07-10: биометрия перенесена в mini-app. Этот текст остаётся ТОЛЬКО для
  // legacy-юзеров, застрявших на bot_consent_biometric (bio:* handler ещё жив).
  // Единый источник с app-версией → (text::LEGAL_VERSION) tuple consistent.
  bio_consent_ask: BIOMETRIC_CONSENT_TEXT,
  bio_consent_yes: { ru: "✅ Согласен на биометрию", uz: "✅ Biometriyaga roziman",
    tr:
      "✅ Biyometriye rıza gösteriyorum",
    en: "✅ I consent to biometrics",
  },
  bio_consent_no: { ru: "❌ Отказаться", uz: "❌ Rad etish",
    tr:
      "❌ Reddet",
    en: "❌ Decline",
  },

  ready: {
    ru:
      "✅ Готово. Номер подтверждён.\n" +
      "Откройте Baxtlilar Mini App, чтобы продолжить регистрацию: выбрать регион, способ проверки и создать анкету.",
    uz:
      "✅ Tayyor. Raqam tasdiqlandi.\n" +
      "Roʻyxatni davom ettirish uchun Baxtlilar Mini App'ni oching: hududni tanlang, tekshiruv usulini tanlang va anketa yarating.",
    tr:
      "✅ Hazır. Numara doğrulandı.\nKayda devam etmek için Baxtlilar Mini App'i açın: bölge seçin, doğrulama yöntemini belirleyin ve anket oluşturun.",
    en:
      "✅ Done. Your number is verified.\n" +
      "Open the Baxtlilar Mini App to continue registration: choose your region, the verification method, and create your profile.",
  },
  open_app: { ru: "Открыть Baxtlilar", uz: "Baxtlilar'ni ochish",
    tr:
      "Baxtlilar'ı aç",
    en: "Open Baxtlilar",
  },
  // Текст постоянной menu-кнопки (без эмодзи — короче и стабильнее в TG UI).
  menu_button: { ru: "Открыть Baxtlilar", uz: "Baxtlilar'ni ochish",
    tr:
      "Baxtlilar'ı aç",
    en: "Open Baxtlilar",
  },

  already_active: {
    ru: "Вы уже в Baxtlilar. Откройте Mini App:",
    uz: "Siz allaqachon Baxtlilar'dasiz. Mini App'ni oching:",
    tr:
      "Zaten Baxtlilar'dasınız. Mini App'i açın:",
    en: "You're already in Baxtlilar. Open the Mini App:",
  },

  declined_pd: {
    ru:
      "Без принятия условий мы не можем создать аккаунт и обработать данные для работы платформы.\n" +
      "Вы можете вернуться к документам и продолжить позже — отправьте /start.",
    uz:
      "Shartlarni qabul qilmasangiz, hisob yarata olmaymiz va platforma ishlashi uchun maʼlumotlarni qayta ishlay olmaymiz.\n" +
      "Hujjatlarga qaytib, keyinroq davom ettirishingiz mumkin — /start yuboring.",
    tr:
      "Koşulları kabul etmeden hesap oluşturamaz ve platformun işleyişi için verileri işleyemeyiz.\nBelgelere geri dönüp daha sonra devam edebilirsiniz — /start gönderin.",
    en:
      "Without accepting the terms, we can't create an account or process data for the platform to work.\n" +
      "You can return to the documents and continue later — send /start.",
  },
  declined_bio: {
    ru: "Без согласия на биометрию верификация невозможна. Если передумаете — /start.",
    uz: "Biometriya roziligi boʻlmasa, tasdiqlash mumkin emas. Fikring oʻzgarsa — /start.",
    tr:
      "Biyometriye rıza olmadan doğrulama mümkün değildir. Fikrinizi değiştirirseniz — /start.",
    en: "Verification isn't possible without consent to biometrics. If you change your mind — /start.",
  },

  resume_at_step: {
    ru: "Продолжим. Текущий шаг — ниже.",
    uz: "Davom etamiz. Joriy qadam — quyida.",
    tr:
      "Devam edelim. Mevcut adım — aşağıda.",
    en: "Let's continue. Your current step is below.",
  },

  error_generic: {
    ru: "Что-то пошло не так. Попробуйте /start ещё раз.",
    uz: "Nimadir notoʻgʻri ketdi. /start ni qaytadan urinib koʻr.",
    tr:
      "Bir şeyler ters gitti. /start ile tekrar deneyin.",
    en: "Something went wrong. Try /start again.",
  },

  // F-006: cooldown после удаления аккаунта. {until} подставляется ISO-датой
  // (день; точная локализация не нужна).
  phone_cooldown: {
    ru: "Этот номер недавно использовался для удалённого аккаунта. Регистрация повторно — после {until}. Если ошибка — напишите в поддержку.",
    uz: "Bu raqam yaqinda oʻchirilgan hisob uchun ishlatilgan. Qaytadan roʻyxatdan oʻtish {until} dan keyin. Xato boʻlsa — qoʻllab-quvvatlash xizmatiga yozing.",
    tr:
      "Bu numara yakın zamanda silinen bir hesap için kullanıldı. Yeniden kayıt — {until} tarihinden sonra. Bir hata varsa — destek ekibine yazın.",
    en: "This number was recently used for a deleted account. You can register again after {until}. If this is a mistake — contact support.",
  },

  // R2/C8/C11: blocking-tombstone от модератора. Не показываем until-дату
  // (10 лет), чтобы не выглядело как «подождать год». Прямо — в поддержку.
  phone_blocking: {
    ru: "Регистрация с этим номером недоступна. Если Вы считаете это ошибкой — напишите в поддержку.",
    uz: "Bu raqam bilan roʻyxatdan oʻtish mumkin emas. Agar bu xato deb hisoblasangiz — qoʻllab-quvvatlash xizmatiga yozing.",
    tr:
      "Bu numarayla kayıt kullanılamıyor. Bunun bir hata olduğunu düşünüyorsanız — destek ekibine yazın.",
    en: "Registration with this number is unavailable. If you think this is a mistake — contact support.",
  },
  phone_check_failed: {
    ru: "Не удалось проверить номер. Попробуйте чуть позже.",
    uz: "Raqamni tekshirib boʻlmadi. Bir oz keyinroq urinib koʻring.",
    tr:
      "Numara doğrulanamadı. Biraz sonra tekrar deneyin.",
    en: "Couldn't verify the number. Please try again a little later.",
  },
  blocked_by_moderator: {
    ru: "Заблокирован модератором.",
    uz: "Moderator tomonidan bloklangan.",
    tr:
      "Moderatör tarafından engellendi.",
    en: "Blocked by a moderator.",
  },
  phone_recognize_failed: {
    ru: "Не удалось распознать номер. Попробуйте ещё раз.",
    uz: "Raqam tushunilmadi. Qaytadan urinib koʻring.",
    tr:
      "Numara tanınamadı. Tekrar deneyin.",
    en: "Couldn't recognize the number. Please try again.",
  },
  phone_duplicate: {
    ru: "Этот номер уже зарегистрирован в Baxtlilar.",
    uz: "Bu raqam Baxtlilar da allaqachon roʻyxatdan oʻtgan.",
    tr:
      "Bu numara Baxtlilar'da zaten kayıtlı.",
    en: "This number is already registered in Baxtlilar.",
  },

  // === Команды бота (2026-07-10, спец оунера: /app /status /support /language /privacy) ===

  // /app — открыть мини-аппу свежей inline-кнопкой (свежий start-token).
  cmd_app_prompt: {
    ru: "Открываю Baxtlilar. Нажмите кнопку ниже:",
    uz: "Baxtlilar'ni ochyapman. Pastdagi tugmani bosing:",
    tr:
      "Baxtlilar'ı açıyorum. Aşağıdaki düğmeye basın:",
    en: "Opening Baxtlilar. Tap the button below:",
  },

  // /status — статус профиля. Ответ зависит от lifecycle/onboarding_step.
  status_onboarding_bot: {
    ru: "Регистрация ещё не завершена. Отправьте /start, чтобы продолжить.",
    uz: "Roʻyxatdan oʻtish tugallanmagan. Davom etish uchun /start yuboring.",
    tr:
      "Kayıt henüz tamamlanmadı. Devam etmek için /start gönderin.",
    en: "Registration isn't finished yet. Send /start to continue.",
  },
  status_onboarding_app: {
    ru: "Профиль заполняется. Откройте Baxtlilar Mini App, чтобы продолжить:",
    uz: "Profil toʻldirilmoqda. Davom etish uchun Baxtlilar Mini App'ni oching:",
    tr:
      "Profil dolduruluyor. Devam etmek için Baxtlilar Mini App'i açın:",
    en: "Your profile is being filled in. Open the Baxtlilar Mini App to continue:",
  },
  status_needs_changes: {
    ru: "Верификация требует доработки. Откройте Baxtlilar Mini App и следуйте подсказкам:",
    uz: "Tasdiqlash uchun tuzatish kerak. Baxtlilar Mini App'ni oching va koʻrsatmalarga amal qiling:",
    tr:
      "Doğrulama için düzeltme gerekiyor. Baxtlilar Mini App'i açın ve yönergeleri izleyin:",
    en: "Verification needs some changes. Open the Baxtlilar Mini App and follow the prompts:",
  },
  status_active: {
    ru: "Ваша анкета активна. Откройте Baxtlilar Mini App:",
    uz: "Anketangiz faol. Baxtlilar Mini App'ni oching:",
    tr:
      "Anketiniz aktif. Baxtlilar Mini App'i açın:",
    en: "Your profile is active. Open the Baxtlilar Mini App:",
  },
  status_paused: {
    ru: "Ваша анкета на паузе. Откройте Baxtlilar Mini App, чтобы возобновить:",
    uz: "Anketangiz pauzada. Davom ettirish uchun Baxtlilar Mini App'ni oching:",
    tr:
      "Anketiniz duraklatıldı. Devam ettirmek için Baxtlilar Mini App'i açın:",
    en: "Your profile is paused. Open the Baxtlilar Mini App to resume:",
  },
  status_blocked: {
    ru: "Доступ ограничен модератором.",
    uz: "Kirish moderator tomonidan cheklangan.",
    tr:
      "Erişim moderatör tarafından kısıtlandı.",
    en: "Access restricted by a moderator.",
  },

  // /support — канал поддержки. {url} = env().SUPPORT_URL; если не задан — fallback.
  support_info: {
    ru: "Поддержка Baxtlilar: {url}\nНапишите нам — поможем.",
    uz: "Baxtlilar qoʻllab-quvvatlash: {url}\nBizga yozing — yordam beramiz.",
    tr:
      "Baxtlilar destek: {url}\nBize yazın — yardımcı oluruz.",
    en: "Baxtlilar support: {url}\nWrite to us — we'll help.",
  },
  support_no_url: {
    ru: "Служба поддержки скоро будет доступна. Спасибо за терпение.",
    uz: "Qoʻllab-quvvatlash xizmati tez orada ishga tushadi. Sabringiz uchun rahmat.",
    tr:
      "Destek hizmeti yakında kullanıma açılacak. Sabrınız için teşekkürler.",
    en: "Support will be available soon. Thank you for your patience.",
  },

  // /language — смена языка интерфейса (setlang:*, без транзиции онбординга).
  language_ask: {
    ru: "Выберите язык интерфейса:",
    uz: "Interfeys tilini tanlang:",
    tr:
      "Arayüz dilini seçin:",
    en: "Choose the interface language:",
  },
  // pick() по ВЫБРАННОМУ языку: ru-поле подтверждает на русском, uz — на узбекском.
  language_changed: {
    ru: "Готово. Язык переключён на русский.",
    uz: "Tayyor. Til oʻzbekchaga oʻzgartirildi.",
    tr:
      "Hazır. Arayüz dili Türkçe olarak değiştirildi.",
    en: "Done. The interface language is now English.",
  },

  // /privacy — приватность и правила (те же 4 PDF, но без consent-рамки).
  privacy_info: {
    ru:
      "🔒 <b>Приватность и правила</b>\n\n" +
      `• <a href="${APP_URL}/legal/privacy.pdf">Политика конфиденциальности</a>\n` +
      `• <a href="${APP_URL}/legal/rules.pdf">Правила платформы</a>\n` +
      `• <a href="${APP_URL}/legal/user-agreement.pdf">Пользовательское соглашение</a>\n` +
      `• <a href="${APP_URL}/legal/pd-consent.pdf">Согласие на обработку персональных данных</a>\n\n` +
      "Ваши данные не показываются другим пользователям без Вашего согласия.",
    uz:
      "🔒 <b>Maxfiylik va qoidalar</b>\n\n" +
      `• <a href="${APP_URL}/legal/privacy.pdf">Maxfiylik siyosati</a>\n` +
      `• <a href="${APP_URL}/legal/rules.pdf">Platforma qoidalari</a>\n` +
      `• <a href="${APP_URL}/legal/user-agreement.pdf">Foydalanuvchi shartnomasi</a>\n` +
      `• <a href="${APP_URL}/legal/pd-consent.pdf">Shaxsiy maʼlumotlarni qayta ishlashga rozilik</a>\n\n` +
      "Maʼlumotlaringiz roziligingizsiz boshqa foydalanuvchilarga koʻrsatilmaydi.",
    tr:
      "🔒 <b>Gizlilik ve kurallar</b>\n\n• <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/privacy.pdf\">Gizlilik Politikası</a>\n• <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/rules.pdf\">Platform Kuralları</a>\n• <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/user-agreement.pdf\">Kullanıcı Sözleşmesi</a>\n• <a href=\"https://baxtlilar-mvp-production.up.railway.app/legal/pd-consent.pdf\">Kişisel Verilerin İşlenmesine Rıza</a>\n\nVerileriniz, rızanız olmadan diğer kullanıcılara gösterilmez.",
    en:
      "🔒 <b>Privacy and rules</b>\n\n" +
      `• <a href="${APP_URL}/legal/privacy.pdf">Privacy Policy</a>\n` +
      `• <a href="${APP_URL}/legal/rules.pdf">Platform Rules</a>\n` +
      `• <a href="${APP_URL}/legal/user-agreement.pdf">User Agreement</a>\n` +
      `• <a href="${APP_URL}/legal/pd-consent.pdf">Consent to Personal Data Processing</a>\n\n` +
      "Your data is not shown to other users without your consent.",
  },

  // === Коды-приглашения (2026-08-11): шаг bot_invite_code между языком и офертой ===
  invite_ask: {
    ru:
      "Baxtlilar сейчас работает по приглашениям.\n\n" +
      "Наш клуб пока закрытый: войти можно только по коду от человека, который уже здесь.\n" +
      "Отправьте код сообщением - или откройте ссылку-приглашение, которую Вам прислали.",
    uz:
      "Baxtlilar hozircha taklif asosida ishlaydi.\n\n" +
      "Klubimiz yopiq: faqat shu yerda boʻlgan insonning kodi bilan kirish mumkin.\n" +
      "Kodni xabar qilib yuboring - yoki sizga yuborilgan taklif havolasini oching.",
    tr:
      "Baxtlilar şu anda davetle çalışıyor.\n\n" +
      "Kulübümüz kapalı: yalnızca burada olan birinin koduyla girebilirsiniz.\n" +
      "Kodu mesaj olarak gönderin - ya da size gönderilen davet bağlantısını açın.",
    en:
      "Baxtlilar is currently invite-only.\n\n" +
      "Our club is closed for now: you can join only with a code from someone already here.\n" +
      "Send the code as a message - or open the invitation link you were given.",
  },
  invite_accepted: {
    ru: "Приглашение принято. Добро пожаловать в Baxtlilar.",
    uz: "Taklif qabul qilindi. Baxtlilarga xush kelibsiz.",
    tr: "Davet kabul edildi. Baxtlilar'a hoş geldiniz.",
    en: "Invitation accepted. Welcome to Baxtlilar.",
  },
  invite_not_found: {
    ru: "Такого кода нет. Проверьте раскладку и попробуйте снова - в коде только буквы и цифры.",
    uz: "Bunday kod yoʻq. Klaviatura tilini tekshirib, qayta urinib koʻring - kodda faqat harf va raqamlar boʻladi.",
    tr: "Böyle bir kod yok. Klavye düzenini kontrol edip tekrar deneyin - kodda yalnızca harf ve rakam var.",
    en: "No such code. Check your keyboard layout and try again - the code has only letters and digits.",
  },
  invite_disabled: {
    ru: "Этот код больше не действует. Попросите у пригласившего новый.",
    uz: "Bu kod endi ishlamaydi. Taklif qilgan insondan yangisini soʻrang.",
    tr: "Bu kod artık geçerli değil. Sizi davet edenden yenisini isteyin.",
    en: "This code no longer works. Ask the person who invited you for a new one.",
  },
  invite_no_code_button: {
    ru: "Нет кода?", uz: "Kod yoʻqmi?", tr: "Kodunuz yok mu?", en: "No code?",
  },
  invite_no_code_text: {
    ru:
      "Мы растём только через личные рекомендации - так безопаснее для всех, кто уже здесь.\n\n" +
      "Если Вам некого попросить, напишите нам, и мы подскажем.",
    uz:
      "Biz faqat shaxsiy tavsiyalar orqali oʻsamiz - bu shu yerdagilar uchun xavfsizroq.\n\n" +
      "Soʻraydigan odamingiz boʻlmasa, bizga yozing, yoʻl koʻrsatamiz.",
    tr:
      "Yalnızca kişisel tavsiyelerle büyüyoruz - bu, burada olan herkes için daha güvenli.\n\n" +
      "İsteyeceğiniz kimse yoksa bize yazın, yardımcı olalım.",
    en:
      "We grow only through personal recommendations - it is safer for everyone already here.\n\n" +
      "If you have no one to ask, write to us and we will help.",
  },
} as const;

export type Lang = "ru" | "uz" | "tr" | "en";

// pick по выбранному языку. Fallback на ru, если у записи нет варианта для языка
// (например BIOMETRIC_CONSENT_TEXT пока без en) — чтобы бот никогда не слал undefined.
export function pick(
  m: { ru: string; uz: string; tr: string; en?: string },
  lang: Lang,
): string {
  return m[lang] ?? m.ru;
}
