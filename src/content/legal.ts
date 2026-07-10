// Legal content for Baxtlilar (Telegram Mini App, serious/marriage-minded dating, Uzbekistan).
//
// ВНИМАНИЕ / DIQQAT:
// Тексты ниже — ЧЕРНОВИК. Они НЕ являются юридически выверенными документами и
// требуют проверки и доработки квалифицированным юристом до публикации.
// The texts below are a DRAFT and MUST be reviewed by a qualified lawyer before use.
//
// Bilingual (Russian + Uzbek-Latin). Uzbek orthography follows the app: oʻ, gʻ, ʻ.

export type LegalDoc = {
  slug: "terms" | "privacy" | "offer" | "rules";
  version: string;
  title: { ru: string; uz: string };
  sections: {
    heading: { ru: string; uz: string };
    body: { ru: string; uz: string };
  }[];
};

// Bump 2026-06-02 → 2026-06-19: добавили consent_type 'rules' (правила
// сообщества), синхронизированный с бот-flow.
// Bump 2026-06-19 → 2026-07-10: переписаны consent-тексты бота (pd_consent_ask
// перефразирован под спец оунера: 18+/семья/согласие + порядок документов;
// биометрия перенесена в mini-app). Хэш согласия = sha256(text + '::' + LEGAL_VERSION),
// поэтому смена текста consent требует нового version — иначе старые/новые
// согласия неотличимы. Re-consent НЕ форсится (version нигде не сравнивается),
// существующие согласия остаются валидны под 2026-06-19.
export const LEGAL_VERSION = "2026-07-10";

export const LEGAL_DOCS: Record<"terms" | "privacy" | "offer" | "rules", LegalDoc> = {
  terms: {
    slug: "terms",
    version: LEGAL_VERSION,
    title: {
      ru: "Пользовательское соглашение",
      uz: "Foydalanuvchi shartnomasi",
    },
    sections: [
      {
        heading: {
          ru: "1. Общие положения",
          uz: "1. Umumiy qoidalar",
        },
        body: {
          ru: "Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между оператором сервиса «Baxtlilar» (далее — «Оператор», «[Наименование оператора]») и физическим лицом (далее — «Пользователь»), использующим приложение «Baxtlilar» (далее — «Сервис») — Telegram Mini App для серьёзных знакомств с целью создания семьи. Начиная использовать Сервис, Пользователь подтверждает, что ознакомился с условиями Соглашения и принимает их в полном объёме. Если Пользователь не согласен с условиями, он обязан прекратить использование Сервиса. Соглашение составлено в соответствии с законодательством Республики Узбекистан.",
          uz: "Ushbu Foydalanuvchi shartnomasi (keyingi oʻrinlarda — «Shartnoma») «Baxtlilar» xizmati operatori (keyingi oʻrinlarda — «Operator», «[Operator nomi]») bilan «Baxtlilar» ilovasidan (keyingi oʻrinlarda — «Xizmat») — oila qurish maqsadida jiddiy tanishuvlar uchun moʻljallangan Telegram Mini App'dan foydalanuvchi jismoniy shaxs (keyingi oʻrinlarda — «Foydalanuvchi») oʻrtasidagi munosabatlarni tartibga soladi. Xizmatdan foydalanishni boshlash bilan Foydalanuvchi Shartnoma shartlari bilan tanishganini va ularni toʻliq qabul qilishini tasdiqlaydi. Agar Foydalanuvchi shartlarga rozi boʻlmasa, u Xizmatdan foydalanishni toʻxtatishi shart. Shartnoma Oʻzbekiston Respublikasi qonunchiligiga muvofiq tuzilgan.",
        },
      },
      {
        heading: {
          ru: "2. Требования к Пользователю (право на использование)",
          uz: "2. Foydalanuvchiga qoʻyiladigan talablar",
        },
        body: {
          ru: "Использовать Сервис вправе только дееспособные физические лица, достигшие 18 лет. Сервис предназначен для лиц с серьёзными намерениями — поиска партнёра для создания семьи, а не для развлечений или случайных знакомств. Регистрируясь, Пользователь подтверждает достижение совершеннолетия и достоверность предоставленных данных. Создание профиля от имени другого лица или предоставление ложных сведений о возрасте запрещено.",
          uz: "Xizmatdan faqat 18 yoshga toʻlgan, muomalaga layoqatli jismoniy shaxslar foydalanishi mumkin. Xizmat jiddiy niyatga ega — oila qurish uchun hayotiy hamroh izlayotgan shaxslar uchun moʻljallangan boʻlib, koʻngilochar yoki tasodifiy tanishuvlar uchun emas. Roʻyxatdan oʻtishda Foydalanuvchi voyaga yetganini va taqdim etgan maʼlumotlari haqqoniyligini tasdiqlaydi. Boshqa shaxs nomidan profil yaratish yoki yosh haqida yolgʻon maʼlumot berish taqiqlanadi.",
        },
      },
      {
        heading: {
          ru: "3. Учётная запись и верификация",
          uz: "3. Hisob va tasdiqlash (verifikatsiya)",
        },
        body: {
          ru: "Для доступа к функциям Сервиса Пользователь проходит верификацию: подтверждение номера телефона по SMS-коду, загрузку документа, удостоверяющего личность (паспорт/ID), и селфи для сверки. Загруженные данные проходят модерацию; Оператор вправе одобрить или отклонить заявку либо запросить повторную загрузку. Одобрение модератором не означает автоматическую публикацию профиля — публикация выполняется самим Пользователем. Пользователь обязан обеспечивать сохранность доступа к своей учётной записи и Telegram-аккаунту и несёт ответственность за действия, совершённые под его учётной записью.",
          uz: "Xizmat imkoniyatlaridan foydalanish uchun Foydalanuvchi tasdiqlashdan oʻtadi: telefon raqamini SMS-kod orqali tasdiqlash, shaxsni tasdiqlovchi hujjat (pasport/ID) va solishtirish uchun selfi yuklash. Yuklangan maʼlumotlar moderatsiyadan oʻtadi; Operator arizani maʼqullash, rad etish yoki qayta yuklashni soʻrash huquqiga ega. Moderator tomonidan maʼqullanishi profilning avtomatik eʼlon qilinishini anglatmaydi — eʼlon qilishni Foydalanuvchining oʻzi amalga oshiradi. Foydalanuvchi oʻz hisobi va Telegram akkauntiga kirish maʼlumotlarini saqlashi shart va oʻz hisobi ostida bajarilgan harakatlar uchun javobgardir.",
        },
      },
      {
        heading: {
          ru: "4. Правила поведения",
          uz: "4. Xulq-atvor qoidalari",
        },
        body: {
          ru: "Пользователь обязуется вести себя уважительно и не допускать оскорблений, домогательств, угроз и любого преследования других пользователей. Запрещается передавать свои контактные данные (телефон, мессенджеры, ссылки) до возникновения взаимного доверия — общение ведётся внутри Сервиса по взаимному интересу. Запрещается создавать поддельные профили, выдавать себя за другое лицо и использовать чужие фотографии. Пользователь не вправе использовать Сервис для коммерческой рекламы, мошенничества, попрошайничества или вовлечения в иные сервисы.",
          uz: "Foydalanuvchi hurmat bilan muomala qilish va boshqa foydalanuvchilarga nisbatan haqorat, taʼqib, tahdid hamda har qanday bezovta qilishga yoʻl qoʻymaslik majburiyatini oladi. Oʻzaro ishonch paydo boʻlgunga qadar shaxsiy aloqa maʼlumotlarini (telefon, messenjerlar, havolalar) berish taqiqlanadi — muloqot Xizmat ichida oʻzaro qiziqish asosida olib boriladi. Soxta profillar yaratish, oʻzini boshqa shaxs sifatida koʻrsatish va begona suratlardan foydalanish taqiqlanadi. Foydalanuvchi Xizmatdan tijoriy reklama, firibgarlik, tilanchilik yoki boshqa xizmatlarga jalb qilish uchun foydalana olmaydi.",
        },
      },
      {
        heading: {
          ru: "5. Запрещённый контент",
          uz: "5. Taqiqlangan kontent",
        },
        body: {
          ru: "Запрещается размещать материалы порнографического, насильственного, экстремистского характера, разжигающие национальную, расовую или религиозную вражду, а также любые материалы, нарушающие законодательство Республики Узбекистан. Запрещены фотографии с обнажением, чужие изображения без согласия, изображения несовершеннолетних в неприемлемом контексте, спам и ссылки на сторонние сайты. Оператор вправе удалять такой контент без предварительного уведомления.",
          uz: "Pornografik, zoʻravonlik, ekstremistik xarakterdagi, milliy, irqiy yoki diniy adovatni qoʻzgʻatuvchi materiallarni hamda Oʻzbekiston Respublikasi qonunchiligini buzuvchi har qanday materiallarni joylashtirish taqiqlanadi. Yalangʻochlik tasvirlari, rozilik soʻralmagan begona suratlar, voyaga yetmaganlarning nomaqbul tasvirlari, spam va begona saytlarga havolalar taqiqlanadi. Operator bunday kontentni oldindan ogohlantirmasdan oʻchirish huquqiga ega.",
        },
      },
      {
        heading: {
          ru: "6. Модерация и блокировки",
          uz: "6. Moderatsiya va bloklash",
        },
        body: {
          ru: "Оператор осуществляет модерацию профилей, фотографий и поведения пользователей. При нарушении Соглашения Оператор вправе вынести предупреждение, ограничить доступ к функциям, временно или бессрочно заблокировать учётную запись и удалить размещённые материалы. Решения о блокировке принимаются с учётом тяжести нарушения и истории действий Пользователя. Действия модераторов фиксируются во внутреннем журнале аудита.",
          uz: "Operator profillar, suratlar va foydalanuvchilar xulq-atvorini moderatsiya qiladi. Shartnoma buzilganda Operator ogohlantirish berish, funksiyalarga kirishni cheklash, hisobni vaqtincha yoki muddatsiz bloklash hamda joylashtirilgan materiallarni oʻchirish huquqiga ega. Bloklash haqidagi qarorlar buzilishning ogʻirligi va Foydalanuvchi harakatlari tarixini hisobga olgan holda qabul qilinadi. Moderatorlarning harakatlari ichki audit jurnalida qayd etiladi.",
        },
      },
      {
        heading: {
          ru: "7. Жалобы и блокировка пользователей",
          uz: "7. Shikoyatlar va foydalanuvchilarni bloklash",
        },
        body: {
          ru: "Пользователь вправе пожаловаться на другого пользователя и заблокировать его, прекратив получение от него сообщений и проявлений интереса. Поступившие жалобы рассматриваются модерацией; при подтверждении нарушений применяются меры из раздела 6. Намеренно ложные жалобы могут расцениваться как нарушение Соглашения. При угрозе жизни и безопасности рекомендуется также обратиться в компетентные органы.",
          uz: "Foydalanuvchi boshqa foydalanuvchi ustidan shikoyat qilish va uni bloklash, undan keladigan xabarlar va qiziqish bildirishlarni toʻxtatish huquqiga ega. Kelib tushgan shikoyatlar moderatsiya tomonidan koʻrib chiqiladi; buzilishlar tasdiqlansa, 6-bandda koʻrsatilgan choralar qoʻllanadi. Atayin yolgʻon shikoyatlar Shartnoma buzilishi sifatida baholanishi mumkin. Hayot va xavfsizlikka tahdid boʻlganda vakolatli organlarga ham murojaat qilish tavsiya etiladi.",
        },
      },
      {
        heading: {
          ru: "8. Ограничение ответственности",
          uz: "8. Javobgarlikni cheklash",
        },
        body: {
          ru: "Сервис предоставляет площадку для знакомств, но не гарантирует нахождение партнёра, заключение брака или достоверность сведений, сообщаемых другими пользователями. Оператор не несёт ответственности за действия пользователей вне Сервиса, за их офлайн-встречи и за последствия таких встреч. Пользователь принимает решения о доверии и общении самостоятельно и на свой риск. Сервис предоставляется «как есть»; Оператор прилагает разумные усилия для его бесперебойной работы, но не гарантирует отсутствие технических сбоев.",
          uz: "Xizmat tanishuv uchun maydon taqdim etadi, biroq hayotiy hamroh topilishini, nikoh tuzilishini yoki boshqa foydalanuvchilar bergan maʼlumotlar haqqoniyligini kafolatlamaydi. Operator foydalanuvchilarning Xizmatdan tashqari harakatlari, ularning oflayn uchrashuvlari va bunday uchrashuvlar oqibatlari uchun javobgar emas. Foydalanuvchi ishonch va muloqot boʻyicha qarorlarni mustaqil ravishda va oʻz tavakkaliga qabul qiladi. Xizmat «boricha» taqdim etiladi; Operator uning uzluksiz ishlashi uchun oqilona saʼy-harakat qiladi, biroq texnik nosozliklar boʻlmasligini kafolatlamaydi.",
        },
      },
      {
        heading: {
          ru: "9. Применимое право",
          uz: "9. Qoʻllaniladigan huquq",
        },
        body: {
          ru: "К настоящему Соглашению и отношениям сторон применяется законодательство Республики Узбекистан. Споры разрешаются путём переговоров, а при недостижении согласия — в порядке, установленном законодательством Республики Узбекистан по месту нахождения Оператора.",
          uz: "Ushbu Shartnomaga va tomonlar oʻrtasidagi munosabatlarga Oʻzbekiston Respublikasi qonunchiligi qoʻllanadi. Nizolar muzokaralar yoʻli bilan, kelishuvga erishilmaganda esa Oʻzbekiston Respublikasi qonunchiligida belgilangan tartibda Operator joylashgan joy boʻyicha hal etiladi.",
        },
      },
      {
        heading: {
          ru: "10. Изменения Соглашения",
          uz: "10. Shartnomaga oʻzgartirishlar",
        },
        body: {
          ru: "Оператор вправе изменять Соглашение, размещая новую редакцию в Сервисе. Продолжение использования Сервиса после вступления изменений в силу означает согласие Пользователя с обновлёнными условиями. Рекомендуется периодически просматривать актуальную версию документа. Дата версии указана в нижней части страницы.",
          uz: "Operator yangi tahrirni Xizmatda joylashtirgan holda Shartnomani oʻzgartirish huquqiga ega. Oʻzgartirishlar kuchga kirgandan keyin Xizmatdan foydalanishni davom ettirish Foydalanuvchining yangilangan shartlarga roziligini bildiradi. Hujjatning amaldagi versiyasini vaqti-vaqti bilan koʻrib turish tavsiya etiladi. Versiya sanasi sahifaning pastki qismida koʻrsatilgan.",
        },
      },
      {
        heading: {
          ru: "11. Контакты",
          uz: "11. Aloqa",
        },
        body: {
          ru: "По вопросам, связанным с Соглашением и работой Сервиса, обращайтесь к Оператору: [Наименование оператора], [адрес], электронная почта: [email]. ИНН: [ИНН].",
          uz: "Shartnoma va Xizmat ishi bilan bogʻliq savollar boʻyicha Operatorga murojaat qiling: [Operator nomi], [manzil], elektron pochta: [email]. STIR (INN): [INN].",
        },
      },
    ],
  },

  privacy: {
    slug: "privacy",
    version: LEGAL_VERSION,
    title: {
      ru: "Политика обработки персональных данных",
      uz: "Shaxsiy maʼlumotlarni qayta ishlash siyosati",
    },
    sections: [
      {
        heading: {
          ru: "1. Общие положения",
          uz: "1. Umumiy qoidalar",
        },
        body: {
          ru: "Настоящая Политика описывает, как оператор сервиса «Baxtlilar» (далее — «Оператор», «[Наименование оператора]») обрабатывает персональные данные пользователей. Политика разработана в соответствии с Законом Республики Узбекистан «О персональных данных» и иными нормативными актами. Используя Сервис, Пользователь подтверждает ознакомление с настоящей Политикой. Цель документа — обеспечить прозрачность обработки данных и защиту прав субъектов персональных данных.",
          uz: "Ushbu Siyosat «Baxtlilar» xizmati operatori (keyingi oʻrinlarda — «Operator», «[Operator nomi]») foydalanuvchilarning shaxsiy maʼlumotlarini qanday qayta ishlashini tavsiflaydi. Siyosat Oʻzbekiston Respublikasining «Shaxsga doir maʼlumotlar toʻgʻrisida»gi Qonuni va boshqa meʼyoriy hujjatlarga muvofiq ishlab chiqilgan. Xizmatdan foydalanish orqali Foydalanuvchi ushbu Siyosat bilan tanishganini tasdiqlaydi. Hujjatning maqsadi — maʼlumotlarni qayta ishlash shaffofligini va shaxsiy maʼlumotlar subyektlari huquqlarini taʼminlash.",
        },
      },
      {
        heading: {
          ru: "2. Какие данные собираются",
          uz: "2. Qanday maʼlumotlar yigʻiladi",
        },
        body: {
          ru: "Оператор обрабатывает: номер телефона; данные документа, удостоверяющего личность (паспорт/ID), и селфи — для верификации; данные профиля (имя, возраст, город, информация о себе); ответы на опрос (анкету ценностей и предпочтений); фотографии; идентификатор Telegram и технические данные использования (даты входа, действия в Сервисе). Часть данных относится к специальным/чувствительным; они обрабатываются с повышенными мерами защиты и не публикуются в открытом доступе.",
          uz: "Operator quyidagilarni qayta ishlaydi: telefon raqami; shaxsni tasdiqlovchi hujjat (pasport/ID) maʼlumotlari va selfi — tasdiqlash uchun; profil maʼlumotlari (ism, yosh, shahar, oʻzi haqida maʼlumot); soʻrovnoma javoblari (qadriyatlar va afzalliklar anketasi); suratlar; Telegram identifikatori va texnik foydalanish maʼlumotlari (kirish sanalari, Xizmatdagi harakatlar). Maʼlumotlarning bir qismi maxsus/nozik toifaga kiradi; ular kuchaytirilgan himoya choralari bilan qayta ishlanadi va ochiq tarzda eʼlon qilinmaydi.",
        },
      },
      {
        heading: {
          ru: "3. Цели обработки",
          uz: "3. Qayta ishlash maqsadlari",
        },
        body: {
          ru: "Данные обрабатываются для: верификации личности и подтверждения реальности пользователей; формирования и показа профилей и подбора подходящих собеседников (матчинг); обеспечения безопасности, модерации контента и предотвращения мошенничества; технической поддержки и улучшения качества Сервиса. Контактные данные, документы и селфи не используются для рекламы и не передаются другим пользователям.",
          uz: "Maʼlumotlar quyidagilar uchun qayta ishlanadi: shaxsni tasdiqlash va foydalanuvchilarning haqiqiyligini tekshirish; profillarni shakllantirish va koʻrsatish hamda mos suhbatdoshlarni tanlash (matching); xavfsizlikni taʼminlash, kontentni moderatsiya qilish va firibgarlikning oldini olish; texnik qoʻllab-quvvatlash va Xizmat sifatini yaxshilash. Aloqa maʼlumotlari, hujjatlar va selfi reklama uchun ishlatilmaydi va boshqa foydalanuvchilarga berilmaydi.",
        },
      },
      {
        heading: {
          ru: "4. Правовое основание (согласие)",
          uz: "4. Huquqiy asos (rozilik)",
        },
        body: {
          ru: "Основанием обработки персональных данных является согласие субъекта персональных данных, которое Пользователь даёт при прохождении онбординга и верификации. Согласие даётся свободно, конкретно и осознанно. Пользователь вправе отозвать согласие в любой момент, что повлечёт прекращение обработки и удаление данных в порядке, предусмотренном законодательством, за исключением данных, которые Оператор обязан хранить по закону.",
          uz: "Shaxsiy maʼlumotlarni qayta ishlash asosi — shaxsiy maʼlumotlar subyektining roziligi boʻlib, uni Foydalanuvchi onboarding va tasdiqlashdan oʻtish jarayonida beradi. Rozilik erkin, aniq va ongli ravishda beriladi. Foydalanuvchi istalgan vaqtda rozilikni qaytarib olish huquqiga ega, bu esa qayta ishlashning toʻxtatilishiga va maʼlumotlarning qonunchilikda nazarda tutilgan tartibda oʻchirilishiga olib keladi, Operator qonun boʻyicha saqlashga majbur boʻlgan maʼlumotlar bundan mustasno.",
        },
      },
      {
        heading: {
          ru: "5. Хранение, локализация и сроки",
          uz: "5. Saqlash, lokalizatsiya va muddatlar",
        },
        body: {
          ru: "Персональные данные граждан Республики Узбекистан хранятся и обрабатываются с использованием технических средств, физически расположенных на территории Республики Узбекистан, в соответствии с требованиями о локализации. Данные хранятся в течение срока, необходимого для целей обработки, и удаляются по достижении целей, отзыве согласия или удалении учётной записи, за исключением случаев обязательного хранения по закону. Оператор стремится минимизировать объём и срок хранения данных.",
          uz: "Oʻzbekiston Respublikasi fuqarolarining shaxsiy maʼlumotlari lokalizatsiya talablariga muvofiq Oʻzbekiston Respublikasi hududida joylashgan texnik vositalar yordamida saqlanadi va qayta ishlanadi. Maʼlumotlar qayta ishlash maqsadlari uchun zarur boʻlgan muddat davomida saqlanadi va maqsadga erishilganda, rozilik qaytarib olinganda yoki hisob oʻchirilganda oʻchiriladi, qonun boʻyicha majburiy saqlash hollari bundan mustasno. Operator maʼlumotlar hajmi va saqlash muddatini minimallashtirishga intiladi.",
        },
      },
      {
        heading: {
          ru: "6. Кто имеет доступ к данным",
          uz: "6. Maʼlumotlarga kim kirish huquqiga ega",
        },
        body: {
          ru: "Доступ к персональным данным имеют уполномоченные сотрудники и модераторы Оператора в объёме, необходимом для выполнения их функций (верификация, модерация, поддержка). Доступ к чувствительным данным (документы, селфи) ограничен и по умолчанию скрыт; действия с такими данными логируются. Оператор не продаёт персональные данные третьим лицам.",
          uz: "Shaxsiy maʼlumotlarga Operatorning vakolatli xodimlari va moderatorlari oʻz vazifalarini bajarish (tasdiqlash, moderatsiya, qoʻllab-quvvatlash) uchun zarur boʻlgan hajmda kirish huquqiga ega. Nozik maʼlumotlarga (hujjatlar, selfi) kirish cheklangan va sukut boʻyicha yashirilgan; bunday maʼlumotlar bilan bajarilgan harakatlar jurnalga yoziladi. Operator shaxsiy maʼlumotlarni uchinchi shaxslarga sotmaydi.",
        },
      },
      {
        heading: {
          ru: "7. Меры безопасности",
          uz: "7. Xavfsizlik choralari",
        },
        body: {
          ru: "Оператор принимает правовые, организационные и технические меры для защиты данных от неправомерного доступа, изменения, раскрытия или уничтожения: разграничение прав доступа, шифрование передачи данных, хранение чувствительных файлов в закрытом хранилище, журналирование действий администраторов. Несмотря на принимаемые меры, абсолютная безопасность передачи данных через интернет не может быть гарантирована.",
          uz: "Operator maʼlumotlarni noqonuniy kirish, oʻzgartirish, oshkor qilish yoki yoʻq qilishdan himoya qilish uchun huquqiy, tashkiliy va texnik choralarni koʻradi: kirish huquqlarini chegaralash, maʼlumotlar uzatishni shifrlash, nozik fayllarni yopiq omborda saqlash, administratorlar harakatlarini jurnalga yozish. Koʻrilayotgan choralarga qaramay, internet orqali maʼlumot uzatishning mutlaq xavfsizligini kafolatlab boʻlmaydi.",
        },
      },
      {
        heading: {
          ru: "8. Права субъекта данных",
          uz: "8. Maʼlumotlar subyektining huquqlari",
        },
        body: {
          ru: "Пользователь вправе: получать информацию об обработке своих данных; требовать уточнения, исправления или блокирования неточных данных; требовать удаления (уничтожения) данных и отзывать согласие; ограничивать обработку. Для реализации прав следует обратиться к Оператору по контактам, указанным ниже. Оператор рассматривает обращение в сроки, установленные законодательством Республики Узбекистан.",
          uz: "Foydalanuvchi quyidagi huquqlarga ega: oʻz maʼlumotlari qayta ishlanishi haqida maʼlumot olish; notoʻgʻri maʼlumotlarni aniqlashtirish, tuzatish yoki bloklashni talab qilish; maʼlumotlarni oʻchirish (yoʻq qilish)ni talab qilish va rozilikni qaytarib olish; qayta ishlashni cheklash. Huquqlarni amalga oshirish uchun quyida koʻrsatilgan aloqa maʼlumotlari orqali Operatorga murojaat qilish lozim. Operator murojaatni Oʻzbekiston Respublikasi qonunchiligida belgilangan muddatlarda koʻrib chiqadi.",
        },
      },
      {
        heading: {
          ru: "9. Трансграничная передача",
          uz: "9. Chegaralararo uzatish",
        },
        body: {
          ru: "По общему правилу персональные данные граждан Республики Узбекистан не передаются за пределы страны. Если для работы отдельных технических сервисов потребуется трансграничная передача, она осуществляется только при наличии оснований, предусмотренных законодательством, и при обеспечении надлежащего уровня защиты в стране-получателе. Об изменениях в этой части Оператор уведомляет в актуальной редакции Политики.",
          uz: "Umumiy qoidaga koʻra, Oʻzbekiston Respublikasi fuqarolarining shaxsiy maʼlumotlari mamlakat tashqarisiga uzatilmaydi. Agar ayrim texnik xizmatlar ishlashi uchun chegaralararo uzatish zarur boʻlsa, u faqat qonunchilikda nazarda tutilgan asoslar mavjud boʻlganda va qabul qiluvchi davlatda himoyaning tegishli darajasi taʼminlanganda amalga oshiriladi. Bu boradagi oʻzgarishlar haqida Operator Siyosatning amaldagi tahririda xabar beradi.",
        },
      },
      {
        heading: {
          ru: "10. Файлы cookie и сессия",
          uz: "10. Cookie fayllari va sessiya",
        },
        body: {
          ru: "Для работы авторизации Сервис использует технические cookie и данные сессии (в том числе httpOnly cookie), необходимые для безопасного входа и поддержания авторизованного состояния. Эти данные применяются исключительно для функционирования Сервиса и не используются для трекинга в рекламных целях. Отключение технических cookie может сделать использование Сервиса невозможным.",
          uz: "Avtorizatsiya ishlashi uchun Xizmat texnik cookie va sessiya maʼlumotlaridan (jumladan httpOnly cookie) foydalanadi, ular xavfsiz kirish va avtorizatsiya holatini saqlash uchun zarur. Ushbu maʼlumotlar faqat Xizmat ishlashi uchun qoʻllaniladi va reklama maqsadida kuzatish uchun ishlatilmaydi. Texnik cookie'larni oʻchirish Xizmatdan foydalanishni imkonsiz qilishi mumkin.",
        },
      },
      {
        heading: {
          ru: "11. Контакты Оператора",
          uz: "11. Operator aloqa maʼlumotlari",
        },
        body: {
          ru: "Оператор обработки персональных данных: [Наименование оператора], [адрес]. По вопросам обработки данных и реализации прав обращайтесь на электронную почту: [email]. Ответственное за обработку лицо (DPO): [email]. ИНН: [ИНН].",
          uz: "Shaxsiy maʼlumotlarni qayta ishlash operatori: [Operator nomi], [manzil]. Maʼlumotlarni qayta ishlash va huquqlarni amalga oshirish boʻyicha savollar uchun elektron pochta orqali murojaat qiling: [email]. Maʼlumotlarni qayta ishlash uchun masʼul shaxs (DPO): [email]. STIR (INN): [INN].",
        },
      },
    ],
  },

  offer: {
    slug: "offer",
    version: LEGAL_VERSION,
    title: {
      ru: "Публичная оферта",
      uz: "Ommaviy oferta",
    },
    sections: [
      {
        heading: {
          ru: "1. Предмет оферты",
          uz: "1. Oferta predmeti",
        },
        body: {
          ru: "Настоящая Публичная оферта (далее — «Оферта») — это предложение оператора сервиса «Baxtlilar» (далее — «Оператор», «[Наименование оператора]») заключить договор об оказании услуг платформы знакомств для серьёзных отношений на условиях, изложенных ниже. Услуги включают предоставление доступа к функциям Сервиса: создание профиля, верификация, подбор собеседников и общение по взаимному интересу в рамках Telegram Mini App «Baxtlilar».",
          uz: "Ushbu Ommaviy oferta (keyingi oʻrinlarda — «Oferta») — «Baxtlilar» xizmati operatorining (keyingi oʻrinlarda — «Operator», «[Operator nomi]») quyida bayon etilgan shartlar asosida jiddiy munosabatlar uchun tanishuv platformasi xizmatlarini koʻrsatish boʻyicha shartnoma tuzish taklifidir. Xizmatlar Xizmat imkoniyatlaridan foydalanishni oʻz ichiga oladi: profil yaratish, tasdiqlash, suhbatdoshlarni tanlash va «Baxtlilar» Telegram Mini App doirasida oʻzaro qiziqish asosida muloqot qilish.",
        },
      },
      {
        heading: {
          ru: "2. Акцепт оферты",
          uz: "2. Ofertani qabul qilish (aksept)",
        },
        body: {
          ru: "Акцептом (полным и безоговорочным принятием) условий Оферты является начало использования Сервиса: прохождение регистрации, верификации и/или иных действий в приложении. С момента акцепта договор считается заключённым на условиях настоящей Оферты, Пользовательского соглашения и Политики обработки персональных данных. Если Пользователь не согласен с условиями, он не должен использовать Сервис.",
          uz: "Oferta shartlarining aksepti (toʻliq va shartsiz qabul qilinishi) — Xizmatdan foydalanishni boshlash: roʻyxatdan oʻtish, tasdiqlash va/yoki ilovadagi boshqa harakatlar. Aksept lahzasidan boshlab shartnoma ushbu Oferta, Foydalanuvchi shartnomasi va Shaxsiy maʼlumotlarni qayta ishlash siyosati shartlari asosida tuzilgan hisoblanadi. Agar Foydalanuvchi shartlarga rozi boʻlmasa, u Xizmatdan foydalanmasligi kerak.",
        },
      },
      {
        heading: {
          ru: "3. Бесплатные и платные услуги",
          uz: "3. Bepul va pulli xizmatlar",
        },
        body: {
          ru: "На текущем этапе основные функции Сервиса (регистрация, верификация, создание профиля, базовый подбор и общение по взаимному интересу) предоставляются бесплатно. В дальнейшем Оператор может ввести дополнительные платные возможности (премиум-функции). Стоимость, состав и условия оплаты платных услуг будут заранее доведены до Пользователя в Сервисе; платные функции активируются только при явном согласии Пользователя.",
          uz: "Ayni bosqichda Xizmatning asosiy imkoniyatlari (roʻyxatdan oʻtish, tasdiqlash, profil yaratish, asosiy tanlash va oʻzaro qiziqish asosida muloqot) bepul taqdim etiladi. Kelgusida Operator qoʻshimcha pulli imkoniyatlarni (premium funksiyalar) joriy qilishi mumkin. Pulli xizmatlarning narxi, tarkibi va toʻlov shartlari Foydalanuvchiga Xizmatda oldindan yetkaziladi; pulli funksiyalar faqat Foydalanuvchining aniq roziligi bilan faollashtiriladi.",
        },
      },
      {
        heading: {
          ru: "4. Обязанности сторон",
          uz: "4. Tomonlarning majburiyatlari",
        },
        body: {
          ru: "Оператор обязуется предоставлять доступ к функциям Сервиса, обеспечивать модерацию и защиту персональных данных в соответствии с Политикой. Пользователь обязуется предоставлять достоверные данные, соблюдать Пользовательское соглашение и правила поведения, не нарушать права других пользователей и законодательство Республики Узбекистан. Стороны добросовестно исполняют принятые обязательства.",
          uz: "Operator Xizmat imkoniyatlaridan foydalanishni taʼminlash, moderatsiyani amalga oshirish va shaxsiy maʼlumotlarni Siyosatga muvofiq himoya qilish majburiyatini oladi. Foydalanuvchi haqqoniy maʼlumotlar berish, Foydalanuvchi shartnomasi va xulq-atvor qoidalariga rioya qilish, boshqa foydalanuvchilar huquqlari va Oʻzbekiston Respublikasi qonunchiligini buzmaslik majburiyatini oladi. Tomonlar olingan majburiyatlarni vijdonan bajaradilar.",
        },
      },
      {
        heading: {
          ru: "5. Отказ от ответственности",
          uz: "5. Javobgarlikdan voz kechish",
        },
        body: {
          ru: "Оператор предоставляет площадку для знакомств и не отвечает за действия и решения пользователей, достоверность сообщаемых ими сведений, их офлайн-встречи и последствия таких встреч. Оператор не гарантирует достижение конкретного результата (знакомство, отношения, брак). Сервис предоставляется «как есть»; Оператор не несёт ответственности за временную недоступность Сервиса по причинам, не зависящим от него.",
          uz: "Operator tanishuv uchun maydon taqdim etadi va foydalanuvchilarning harakatlari va qarorlari, ular bergan maʼlumotlar haqqoniyligi, ularning oflayn uchrashuvlari va bunday uchrashuvlar oqibatlari uchun javobgar emas. Operator aniq natijaga (tanishuv, munosabatlar, nikoh) erishilishini kafolatlamaydi. Xizmat «boricha» taqdim etiladi; Operator oʻziga bogʻliq boʻlmagan sabablarga koʻra Xizmatning vaqtincha mavjud emasligi uchun javobgar emas.",
        },
      },
      {
        heading: {
          ru: "6. Разрешение споров",
          uz: "6. Nizolarni hal etish",
        },
        body: {
          ru: "Все споры и разногласия стороны стремятся урегулировать путём переговоров. При недостижении согласия спор подлежит рассмотрению в порядке, установленном законодательством Республики Узбекистан. К Оферте применяется материальное право Республики Узбекистан.",
          uz: "Barcha nizo va kelishmovchiliklarni tomonlar muzokaralar yoʻli bilan hal etishga intiladilar. Kelishuvga erishilmaganda nizo Oʻzbekiston Respublikasi qonunchiligida belgilangan tartibda koʻrib chiqilishi lozim. Ofertaga Oʻzbekiston Respublikasining moddiy huquqi qoʻllanadi.",
        },
      },
      {
        heading: {
          ru: "7. Реквизиты Оператора",
          uz: "7. Operator rekvizitlari",
        },
        body: {
          ru: "[реквизиты оператора] — Наименование: [Наименование оператора]; адрес: [адрес]; ИНН: [ИНН]; электронная почта: [email]. Полные банковские и регистрационные реквизиты будут указаны в окончательной редакции документа.",
          uz: "[operator rekvizitlari] — Nomi: [Operator nomi]; manzil: [manzil]; STIR (INN): [INN]; elektron pochta: [email]. Toʻliq bank va roʻyxatga olish rekvizitlari hujjatning yakuniy tahririda koʻrsatiladi.",
        },
      },
    ],
  },
  // ЧЕРНОВИК — требует юр-проверки. Правила сообщества: что можно/нельзя в
  // чате и публичных полях. Воркфлоу из spec'а Экран 2 — требует консент на
  // правила как отдельную галку (consent_type='rules').
  rules: {
    slug: "rules",
    version: LEGAL_VERSION,
    title: {
      ru: "Правила сообщества",
      uz: "Hamjamiyat qoidalari",
    },
    sections: [
      {
        heading: { ru: "1. Уважение и серьёзные намерения", uz: "1. Hurmat va jiddiy niyatlar" },
        body: {
          ru: "Baxtlilar — для пользователей, готовых к серьёзным отношениям и созданию семьи. Уважительный тон в общении обязателен.",
          uz: "Baxtlilar — jiddiy munosabatlarga va oilani yaratishga tayyor foydalanuvchilar uchun. Muloqotda hurmatli ohang majburiy.",
        },
      },
      {
        heading: { ru: "2. Что запрещено", uz: "2. Nima taqiqlanadi" },
        body: {
          ru: "Запрещены: оскорбления, домогательства, угрозы, спам и реклама, попытки получить или раскрыть контактные данные в публичных полях, выдача себя за другое лицо, фейковые анкеты, упоминание или просьбы об интимных встречах без серьёзных намерений, а также употребление, распространение или пропаганда запрещённых веществ и любое поведение, создающее угрозу безопасности других пользователей.",
          uz: "Taqiqlanadi: haqorat, taʼqib, tahdid, spam va reklama, ommaviy maydonlarda kontakt maʼlumotlarini olishga yoki oshkor qilishga urinish, boshqa shaxs sifatida koʻrsatish, soxta anketalar, jiddiy niyatsiz yaqinlik haqida soʻrash, shuningdek, taqiqlangan moddalarni isteʼmol qilish, tarqatish yoki targʻib qilish va boshqa foydalanuvchilar xavfsizligiga tahdid soluvchi har qanday xatti-harakat.",
        },
      },
      {
        heading: { ru: "3. Защита приватности", uz: "3. Maxfiylik himoyasi" },
        body: {
          ru: "Не публикуйте свои или чужие телефоны, мессенджеры, адреса в анкете или открытых сообщениях до взаимного согласия. Анти-контакт фильтр удалит такие сообщения автоматически.",
          uz: "Anketada yoki ochiq xabarlarda oʻzingizning yoki boshqalarning telefonini, messenjerlarini, manzillarini oʻzaro rozilik boʻlmaguncha eʼlon qilmang. Anti-kontakt filtr bunday xabarlarni avtomatik oʻchiradi.",
        },
      },
      {
        heading: { ru: "4. Жалобы и блокировки", uz: "4. Shikoyatlar va bloklash" },
        body: {
          ru: "При нарушении правил пользователь может отправить жалобу. Подтверждённое нарушение ведёт к ограничению функций, временной приостановке или блокировке аккаунта. Решение блокировки требует подтверждения двумя модераторами.",
          uz: "Qoidalar buzilganda foydalanuvchi shikoyat yuborishi mumkin. Tasdiqlangan buzilish funksiyalarni cheklash, vaqtinchalik toʻxtatish yoki hisobni bloklashga olib keladi. Bloklash qarori ikki moderator tomonidan tasdiqlanishni talab qiladi.",
        },
      },
      {
        heading: { ru: "5. Несовершеннолетние и подделка возраста", uz: "5. Voyaga yetmaganlar va yoshni soxtalashtirish" },
        body: {
          ru: "Пользоваться сервисом могут только лица 18 лет и старше. Указание заведомо недостоверного возраста — основание для немедленной блокировки.",
          uz: "Xizmatdan faqat 18 yoshdan oshganlar foydalanishi mumkin. Yoshni qasddan soxtalashtirish — darhol bloklash uchun asos.",
        },
      },
    ],
  },
};
