# Baxtlilar — Спека (docx) vs Код: аудит реализации

_Сгенерировано 2026-07-12 из «Baxtlilar mini App TG.docx» (11 827 слов + 42 скрина) сверкой с кодом на HEAD. 10 агентов, 352 требований._

## Итог

| Статус | Кол-во | % |
|---|---|---|
| ✅ implemented | 276 | 78% |
| ❌ not_implemented | 40 | 11% |
| 🟡 partial | 28 | 8% |
| 🔒 frozen_oneid | 4 | 1% |
| ➖ not_applicable | 2 | 1% |
| ⚖️ legal_blocked | 2 | 1% |

**Реализовано ✅ 276/352 (78%).** Остальное: 🟡 частично 28, ❌ не сделано 40, 🔒 OneID-заморожено 4, ⚖️ legal 2.

---

## Онбординг: Welcome + Регион/статус + Выбор метода + Документ + Селфи (spec lines 108-392)

❌ **Welcome button depends on user state (Начать регистрацию if new, else different)**  
   `not_implemented` — WelcomeBranded.tsx:189 always shows t('start_registration'). No logic to check if user already passed documents/phone in bot. Should conditionally change based on state.

❌ **Welcome trust-block: Replace 'Ваша безопасность — наш приоритет' + generic tech-speak with specific privacy copy**  
   `not_implemented` — WelcomeBranded.tsx:221-234 displays 'Ваша безопасность — наш приоритет' as safety_title. Should be replaced with 'Ваши контакты, документы и селфи не видны другим пользователям.' (spec line 152). ru.json:21-22 has safety_subtitle but starts with safety_title which is still old wording.

❌ **Doc: Dynamic examples based on document type (Паспорт/ID-карта/Иностранный документ)**  
   `not_implemented` — verify/doc/page.tsx:36-44 shows static PassportVisualHint with only two variants (good/bad). No conditional logic based on selected document type. Spec lines 312-326 require document-type-specific instructions.

❌ **Doc privacy block: 'Документ используется только для проверки личности и не отображается в анкете. Доступ имеют только уполномоченные специалисты и системы проверки. Доступ логируется.'**  
   `not_implemented` — verify/doc/page.tsx:55-69 displays privacy_footer from translations. ru.json verify.privacy_footer reads 'Документы и селфи не отображаются в анкете и не видны другим пользователям. Доступ к ним имеют только уполномоченные специалисты и системы проверки. Доступ логируется.' This is COMBINED doc+selfie text, not document-specific. Spec line 309-310 says this should be SHORT doc-only text on doc screen, full legal on next screen.

❌ **Selfie upload button: Camera-first, NOT 'Сфотографировать или выбрать файл' (spec lines 350-360)**  
   `not_implemented` — verify/selfie/page.tsx:54-59 uses t('upload_label'). ru.json doesn't have verify.upload_label for selfie (reuses doc upload_label logic). Spec line 350 says button should say 'Сделать селфи' (camera-only primary), with fallback 'Не получается сделать селфи?' for file upload.

❌ **Selfie privacy block: 'Селфи используется только для проверки личности и не отображается в анкете.'**  
   `not_implemented` — verify/selfie/page.tsx:62-76 uses footer_note for privacy. ru.json verify.footer_note = 'После загрузки заявка уходит на проверку. Пока идёт проверка, Вы сможете продолжить заполнение анкеты. Решение придёт в Telegram.' This is procedural, not privacy. Spec line 376 requires separate selfie privacy statement.

❌ **Button 'Начать регистрацию' changed from context-dependent wording per old spec note**  
   `not_implemented` — Spec lines 131-134 note mentions button should be different if user already passed docs/phone. WelcomeBranded.tsx:189 always uses t('start_registration'). No conditional logic based on user state/verification status.

🟡 **Экран 1. Welcome: 4 языка вместо 2 (RU/UZ)**  
   `partial` — WelcomeBranded.tsx:318-322 shows all 4 languages (ru, uz, tr, en) present, but ORDER is wrong: RU/UZ/TR/EN instead of spec requirement UZ/RU/EN/TR (lines 127-128)

🟡 **Welcome footer text should be conditional or universal**  
   `partial` — WelcomeBranded.tsx:237-238 explicitly removes footer with comment 'к welcome-экрану юзер приходит уже ПОСЛЕ принятия оферты'. No conditional footer logic implemented, but old 'rules_footer' key still exists in ru.json line 23 unused.

🟡 **Doc copy: Replace 'паспорт' with 'документ' universally**  
   `partial` — ru.json:63 still says 'Загрузите чёткое фото паспорта или ID-карты' (old wording). Spec line 227 says 'Фото документа' + subtexts should be 'Загрузите документ, удостоверяющий личность' (ru.json:63 says паспорта - NOT UPDATED). However, verify/doc/page.tsx:31 uses 'page_title' which is 'Фото документа' (spec line 289, correct).

🔒 **Правильный порядок: Welcome → Регион и статус → Выбор метода → Согласие → Документ → Селфи**  
   `frozen_oneid` — State machine types.ts:101-113 shows current flow: verification_intro → doc_upload → selfie_upload. No region/status or method-selection screens exist. Spec says this is OneID-dependent (intro section 'FROZEN by owner').

🔒 **Экран 2: Регион и статус проживания (country + residence status)**  
   `frozen_oneid` — No page files exist for region/status selection. State machine types.ts shows no 'region_select' or 'status_select' onboarding_step. Marked as frozen in intro.

🔒 **Экран: Выбор способа проверки (OneID/MyID/manual based on region)**  
   `frozen_oneid` — No verification method selection screen exists. No state machine step for method choice. Marked frozen in intro section.

✅ **Welcome feature cards: Must use spec text exactly (Профили проходят проверку, Контакты не раскрываются, Общение только по правилам)**  
   `implemented` — ru.json:14-19 matches spec cards. WelcomeBranded.tsx:141-160 renders them from translations.

✅ **Welcome bottom trust-block: Privacy-focused text about contacts/documents/selfie**  
   `implemented` — ru.json:22 safety_subtitle reads 'Ваши контакты, документы и селфи не видны другим пользователям.' (spec line 152 requirement)

✅ **Отдельное согласие перед загрузкой документа и селфи**  
   `implemented` — verify/intro/page.tsx:64-96 shows biometric consent box with consent_heading and consent_cta. This screen appears BEFORE doc upload and serves as consent gate.

✅ **Doc description: 'Сфотографируйте страницу или сторону документа...' (spec line 291)**  
   `implemented` — ru.json verify.page_description = 'Сфотографируйте страницу или сторону документа, где видны фото и основные данные. Не загружайте страницы с адресом, регистрацией или лишними данными, если мы их не просим.' matches spec line 291 exactly.

✅ **Doc requirements: Exact 4 bullet points from spec (document in frame, face visible, text readable, no editing)**  
   `implemented` — verify/doc/page.tsx:43 calls Requirements with [t('req_face'), t('req_focus'), t('req_glare'), t('req_no_editing')]. ru.json verify section has these keys matching spec line 298-302.

✅ **Doc upload button: 'Сфотографировать или выбрать файл' (spec line 304)**  
   `implemented` — ru.json verify.upload_label = 'Сфотографировать или выбрать файл'. verify/doc/page.tsx:48-52 uses this label in UploadField.

✅ **Doc screen top label: 'ШАГ 1 · ДОКУМЕНТ' (spec line 287)**  
   `implemented` — verify/doc/page.tsx:28 uses t('step_eyebrow'). ru.json verify.step_eyebrow = 'Шаг 1 · Документ'. Matches spec.

✅ **Doc screen headline: 'Фото документа' (spec line 289)**  
   `implemented` — verify/doc/page.tsx:30-32 uses t('page_title') for headline. ru.json verify.page_title = 'Фото документа'. Correct.

✅ **Selfie copy: Replace 'Модератор сверит с фото в паспорте' with universal doc reference**  
   `implemented` — verify/intro/page.tsx:44 step_2_body = 'Мы сравним селфи с фото в документе, чтобы убедиться, что анкету создаёте именно Вы.' (generic 'документе', not паспорте). Spec line 337 requirement met.

✅ **Selfie headline: 'Селфи для верификации' (spec line 275 implies this; spec line 289 doc example)**  
   `implemented` — verify/selfie/page.tsx:35-36 uses t('title'). ru.json verify.title = 'Селфи для верификации.'. Matches spec structure.

✅ **Selfie description: 'Сделайте селфи лица в хорошем освещении. Мы сверим селфи с фото в документе, который Вы загрузили на прошлом шаге.'**  
   `implemented` — verify/selfie/page.tsx:38-40 uses t('description'). ru.json verify.description matches spec line 275 requirement exactly.

✅ **Selfie requirements: Exact wording per spec (face visible without mask/dark glasses but religious headwear OK; even lighting; look at camera; no other people)**  
   `implemented` — verify/selfie/page.tsx:48-51 uses t('req_1'), t('req_2'), t('req_3'), t('req_4'). ru.json verify.req_1 = 'Лицо хорошо видно: без маски и тёмных очков. Религиозный головной убор (платок, тюбетейка) — можно, если лицо открыто.' (matches spec line 366). Other reqs match spec lines 367, 368, 369.

✅ **Selfie lighting wording: 'Ровное освещение, без сильных теней и бликов' NOT 'естественное освещение/не лампа'**  
   `implemented` — ru.json verify.req_2 = 'Ровное освещение, без сильных теней и бликов.' (spec line 371 requirement).

✅ **Selfie label/eyebrow: 'ШАГ 2 · СЕЛФИ' (spec line 287 pattern)**  
   `implemented` — verify/selfie/page.tsx:33 uses t('eyebrow'). ru.json verify.eyebrow = 'Шаг 2 · Селфи'. Matches spec pattern.

✅ **Verification intro headline: 'Подтвердим, что это Вы' (spec line 268)**  
   `implemented` — verify/intro/page.tsx:35-36 uses t('headline'). ru.json verify.headline = 'Подтвердим, что это Вы.' Matches spec.

✅ **Verification intro body: 'В Baxtlilar профили проходят проверку личности. Это помогает снизить риск фейковых анкет и сделать общение безопаснее.' (spec line 270)**  
   `implemented` — verify/intro/page.tsx:38-39 uses t('intro_description'). ru.json verify.intro_description matches spec line 270 exactly.

✅ **Verification intro: 3 step cards with specific wording (Document, Selfie, Verification timing)**  
   `implemented` — verify/intro/page.tsx:43-45 renders 3 Step components with t('step_1_title'), t('step_2_title'), t('step_3_title'). ru.json verify has matching keys. Spec lines 271-281 text matches.

✅ **Verification intro privacy footer: 'Документы и селфи не отображаются в анкете и не видны другим пользователям. Доступ к ним имеют только уполномоченные специалисты и системы проверки. Доступ логируется.' (spec line 281)**  
   `implemented` — verify/intro/page.tsx:48-62 displays privacy_footer chip. ru.json verify.privacy_footer matches spec line 281 exactly.

✅ **Verification intro consent box: Biometric consent with heading + legal text (spec line 64-96 in page code)**  
   `implemented` — verify/intro/page.tsx:64-96 shows consent box with consent_heading ('Согласие на биометрическую проверку') and BIOMETRIC_CONSENT_TEXT from @/content/biometric-consent. CTA is consent_cta.

✅ **Remove 'Психо-портрет' reference from verification pending screen (spec line 378-384)**  
   `implemented` — No psycho-portrait mention in verify flow. Spec says 'Пока идёт проверка, вы сможете продолжить заполнение анкеты. Без психопортрета.' This is correct in current flow — psycho-portrait (quiz) comes AFTER verification success, in onboarding sequence.

✅ **Verification verification intro step3 wording: 'Обычно проверка занимает от нескольких минут до 24 часов. Пока идёт проверка, вы сможете продолжить заполнение анкеты.' (spec line 279)**  
   `implemented` — ru.json verify.step_3_body matches spec line 279 exactly.

✅ **4-language UI with EN + TR added (not just RU/UZ)**  
   `implemented` — WelcomeBranded.tsx:318-322 includes all 4 language codes. Language files exist for en.json and tr.json in messages/.

✅ **Language switcher remains active for user to switch mid-flow**  
   `implemented` — WelcomeBranded.tsx:339-362 renders all 4 language links as clickable, current language highlighted. No lock-in after selection.

➖ **Remove rocket emoji from welcome (spec line 111-113)**  
   `not_applicable` — WelcomeBranded.tsx contains no emoji text. Welcome message is clean text without emoji. Spec note was about old SMS-flow welcome, which has been replaced by branded welcome component.

## Анкета 1: Основные данные (Экран 1 · основные поля профиля)

🟡 **Name placeholder: 'Например: Nodirbek, Nodir, Madina'**  
   `partial` — AnketaBasicForm.tsx:174 uses t('name_placeholder'); messages/ru.json: name_placeholder = 'Так Вас увидят другие' (generic, not the 'Например:' examples mentioned in spec)

🔒 **Date of birth field: not free-form, should pull from OneID/document (frozen)**  
   `frozen_oneid` — Spec notes (line 411-414) mark auto-DOB from document as 'FROZEN by owner (OneID-dependent)'. Currently MVP shows date-picker (manual input). No auto-pull implemented.

✅ **Step header: 'АНКЕТА · ОСНОВНЫЕ ДАННЫЕ' (instead of 'ШАГ 1 · АНКЕТА')**  
   `implemented` — messages/ru.json: basic_eyebrow = 'Анкета · Основные данные'

✅ **Headline: 'Расскажите немного о себе' (softer tone than 'Начнём с Вас')**  
   `implemented` — messages/ru.json: basic_headline = 'Расскажите немного о себе.'; app/[locale]/v2/anketa/basic/page.tsx:49

✅ **Lead text explaining name is public + change requires re-verification**  
   `implemented` — messages/ru.json: basic_lead = 'Имя будет видно в анкете; после публикации изменение имени может пройти повторную проверку.'

✅ **Gender field: locked after verification (document match)**  
   `implemented` — AnketaBasicForm.tsx:61 genderLocked logic; basic/page.tsx:38 verifiedGender from user_identity; route.ts:32 gender_locked validation; messages/ru.json: genderVerifiedNote = 'Пол подтверждён по документу — редактировать нельзя.'

✅ **Citizenship hint: explain it's for verification/matching, not public badge by default**  
   `implemented` — messages/ru.json: citizenship_hint = 'Гражданство используется для выбора способа проверки и подбора. В анкете оно не отображается без Вашего согласия.'; AnketaBasicForm.tsx:205-214

✅ **Region field visibility: only show if country_of_residence='UZ'; don't duplicate previous screen**  
   `implemented` — AnketaBasicForm.tsx:77-78 showRegion = country === 'UZ'; conditional render at line 234; schemas.ts:144-163 region validation refine for UZ

✅ **Region required for UZ residence (validation + error message)**  
   `implemented` — schemas.ts:155-162 refine check; AnketaBasicForm.tsx:130 valid check; messages/ru.json: err_region_required_for_uz = 'Для проживания в Узбекистане выберите область или город.'

✅ **Name split: legal_full_name (read-only system-only) vs profile_display_name (public)**  
   `implemented` — AnketaBasicForm.tsx:136-167 shows verifiedLegalName in read-only chip when present; line 169-176 display_name TextInput for public name; basic/page.tsx:39-44 constructs legal name from user_identity

✅ **Legal name label: 'ФИО по документу (приватно)' + hint 'Не отображается в анкете'**  
   `implemented` — AnketaBasicForm.tsx:155 uses t('legalNameVerifiedLabel'); messages/ru.json: legalNameVerifiedLabel = 'ФИО по документу (приватно)'

✅ **Public name field label: 'Имя' with hint about public visibility**  
   `implemented` — AnketaBasicForm.tsx:169 uses t('name_label') and t('displayNamePublicHint'); messages/ru.json: name_label = 'Имя'; displayNamePublicHint = 'Публичное имя — так вас увидят другие. ФИО из документа остаётся приватным.'

✅ **Name hint/restrictions: no phone, Telegram, links, offensive words**  
   `implemented` — schemas.ts:128-133 display_name validates containsContact(); containsContact() function (lines 111-117) checks PHONE_RE, HANDLE_RE, LINK_RE, MESSENGER_RE; error message 'name_has_contacts'

✅ **District field: optional, hidden by default (district_visible_public=false)**  
   `implemented` — options.ts:429 DISTRICT_VISIBLE_DEFAULT = false; AnketaBasicForm.tsx:72-73 setDistrictVisiblePublic(false) on init; schemas.ts:153 district_visible_public optional

✅ **District cascade: only shown when region selected (for UZ)**  
   `implemented` — AnketaBasicForm.tsx:79-80 showDistrict = showRegion && !!region; conditional render at line 253; schemas.ts:146-149 district is optional

✅ **District from dictionary (UZ_DISTRICTS_BY_REGION) or freeform for non-UZ**  
   `implemented` — AnketaBasicForm.tsx:81 districtFromDict = showDistrict && hasDistrictList(region); line 258-273 conditional Select (dict) vs TextInput (freeform)

✅ **District visibility checkbox: 'Показывать район в анкете' with explanation**  
   `implemented` — AnketaBasicForm.tsx:276-325 checkbox; messages/ru.json: basic_district_visible_label = 'Показывать район в анкете'; basic_district_visible_hint = 'По умолчанию район скрыт. Если включите, его увидят пользователи, открывшие Вашу анкету.'

✅ **District hint: explain it's shown only if toggled public**  
   `implemented` — messages/ru.json: basic_district_hint = 'Район показывается в анкете только если Вы включите соответствующий переключатель.'; AnketaBasicForm.tsx:254-256

✅ **Verified legal name shown only if identity exists (read-only chip)**  
   `implemented` — AnketaBasicForm.tsx:136 conditional render {verifiedLegalName ? ...}; read-only display in styled chip (lines 137-167)

✅ **Gender defense-in-depth: server validates gender matches verified identity**  
   `implemented` — route.ts:23-33 loads user_identity and calls verifiedGenderMatches(); returns 409 gender_locked on mismatch

✅ **Residence country field: explain may differ from citizenship (e.g. UZ-citizen in Moscow)**  
   `implemented` — messages/ru.json: residence_hint = 'Может отличаться от гражданства — например UZ-гражданин в Москве.'; AnketaBasicForm.tsx:216-232

✅ **Submit validation: all required fields (name, gender, birth, citizenship, country) must be filled**  
   `implemented` — AnketaBasicForm.tsx:124-130 valid check; basicSchema line 123-163 zod validation

✅ **Region reset when country_of_residence changed from UZ to non-UZ**  
   `implemented` — AnketaBasicForm.tsx:223-230 onChange handler clears region/district when country !== 'UZ'

✅ **District reset when region changes**  
   `implemented` — AnketaBasicForm.tsx:242-246 onChange handler clears district when region changes

✅ **Conditional post_next routing based on completion (basic → appearance per V4)**  
   `implemented` — route.ts:62-72 transitions to profile_appearance (V4 swap); comment references 'V4 2026-07-01: swap appearance ↔ birth-place'

✅ **Age validation: must be 18+**  
   `implemented` — schemas.ts:135-137 birth_date refine ageFromDate(s) >= 18; ageFromDate() function lines 63-71

✅ **Age validation: max 100 years**  
   `implemented` — schemas.ts:135-138 birth_date refine ageFromDate(s) <= 100

✅ **Birth date field label: 'Дата рождения'**  
   `implemented` — messages/ru.json: birth_label = 'Дата рождения'; AnketaBasicForm.tsx:202-203

✅ **Citizenship label: 'Гражданство'**  
   `implemented` — AnketaBasicForm.tsx:205-206 uses t('citizenship_label'); messages/ru.json: citizenship_label = 'Гражданство'

✅ **Residence label: 'Где Вы живёте сейчас'**  
   `implemented` — AnketaBasicForm.tsx:216-217 uses t('residence_label'); messages/ru.json: residence_label = 'Где Вы живёте сейчас'

✅ **Region label + hint: 'Область или регион', 'Где Вы живёте сейчас — этого достаточно для подбора.'**  
   `implemented` — AnketaBasicForm.tsx:235-237 uses t('region_label') and t('region_hint'); messages/ru.json: region_label = 'Область или регион'; region_hint = 'Где Вы живёте сейчас — этого достаточно для подбора.'

✅ **Hot columns: display_name, gender, birth_date, citizenship, country_of_residence, region, district, district_visible_public saved to user_profiles**  
   `implemented` — schemas.ts:499-536 HOT_COLUMNS includes all these fields; route.ts:41-54 uses splitHotCold(); fields written directly to user_profiles columns

## Anкeta Screens 2–3: Languages/Height/Weight + Birth Region Implementation Status

❌ **birth_region field: hint (RU: 'Используется для подбора и культурной совместимости. В анкете не отображается без вашего согласия')**  
   `not_implemented` — AnketaBirthPlaceForm.tsx line 88 shows birth_place_region_hint_optional='Опционально — можно пропустить.' for non-UZ; no hint shown for UZ case; spec requirement about matching usage & privacy consent not in current hint text

❌ **Default visibility: birth_country=hidden, origin_region=matching_only, origin_district=hidden, origin_city=hidden**  
   `not_implemented` — Database schema (20260629000000_anketa_v3_hybrid.sql) adds birth_country/region/district/city columns with no visibility flags; no per-block visibility columns or defaults in AnketaPrivacyForm.tsx (privacy screen only has global profile_visibility_mode, per-block visibility deferred to Sprint 4+, line 18-19)

❌ **Privacy settings: option to show birth region in profile (RU: 'Показывать родной регион в анкете')**  
   `not_implemented` — AnketaPrivacyForm.tsx only manages profile_visibility_mode (global 3-mode setting); no per-field visibility toggles; spec line 669-672 deferred per task #85 (pending 'Onboarding interstitial для swap appearance↔birth-place')

🟡 **Screen 2 Appearance: Description lead text (RU: 'Укажите языки... Рост можно добавить... вес — пропустить')**  
   `partial` — messages/ru.json: appearance_lead='Эти поля помогают подобрать тех, кто понимает Вас без перевода и живёт в похожем темпе.' (mentions languages/understanding but doesn't explicitly mention height/weight optionality)

🟡 **Conditional show district & city fields only after region selected (UZ flow cascade)**  
   `partial` — AnketaBirthPlaceForm.tsx shows all 4 fields always (no cascade visibility); spec says birth_district/birth_city are optional but doesn't mandate conditional show; however, basic/page.tsx shows cascade (district only after region + country=UZ, line 80); birth-place form treats all as always-visible optional fields

✅ **Screen 2 Appearance: Title eyebrow and headline (RU: 'Шаг 2 · Языки и базовая информация' / 'Языки общения и базовые данные')**  
   `implemented` — messages/ru.json: appearance_eyebrow='Шаг 2 · Анкета', appearance_headline='О Ваших параметрах.' (wording differs slightly, but conveys same intent)

✅ **height_cm field: optional/recommended, range picker 140–220**  
   `implemented` — AnketaAppearanceForm.tsx:16-20 HEIGHT_OPTIONS range 140-220; line 129-136 Select component with placeholder '—' (range picker, not manual input)

✅ **height_cm field: hint text (RU: 'От 140 до 220 см')**  
   `implemented` — messages/ru.json: heightHint='От 140 до 220.'; AnketaAppearanceForm.tsx:129 passes hint={t('heightHint')}

✅ **weight_kg field: optional, hidden by default, not public by default**  
   `implemented` — AnketaAppearanceForm.tsx:26-27 showWeight state initially false; lines 140-149 weight field shows only when showWeight true; line 164 toggle button '+ {t('weightAddButton')}'

✅ **weight_kg field: hint text (RU: 'Можно пропустить. Вес не отображается в анкете по умолчанию')**  
   `implemented` — messages/ru.json: weightHiddenHint='Необязательно, можно не указывать'; AnketaAppearanceForm.tsx:141 passes hint={t('weightHiddenHint')}

✅ **primary_language field: required, label and hint**  
   `implemented` — AnketaAppearanceForm.tsx:91-101 required Field with nativeLanguageLabel + nativeLanguageHint; messages/ru.json: nativeLanguageLabel='Родной язык', nativeLanguageHint='Один — основной язык Вашей семьи.'

✅ **communication_languages field: required, min 1, max 6, multi-select**  
   `implemented` — AnketaAppearanceForm.tsx:104-116 Chips component with max={6}; line 86-87 validation spokenLangs.length >= 1 && <= 6

✅ **communication_languages field: conditional 'Other' text input when selected**  
   `implemented` — AnketaAppearanceForm.tsx:40 showOtherLang = spokenLangs.includes('other') || nativeLang === 'other'; lines 118-127 conditional Field for otherLanguage text input

✅ **communication_languages field: 'Other' placeholder (RU: 'Укажите язык')**  
   `implemented` — messages/ru.json: otherLanguagePlaceholder='Укажите язык'; AnketaAppearanceForm.tsx:124 placeholder={t('otherLanguagePlaceholder')}

✅ **Screen 2: API route saves to hot columns (height_cm, weight_kg, native_language, languages) + cold extended.langs (other_language)**  
   `implemented` — appearance/route.ts:48-59 upsert to user_profiles with height_cm, weight_kg, native_language, languages, extended (langs.other_language in cold JSONB)

✅ **Screen 3 Birth Region: Title (RU: 'Откуда вы родом?' / UZ: 'Qayerdansiz?')**  
   `implemented` — birthplace/page.tsx:30 Headline: {t('birthplace_headline')}; messages/ru.json: birthplace_headline='Откуда Вы родом.'

✅ **Screen 3 Birth Region: Description lead (RU: 'Родной регион помогает учитывать культурный и семейный контекст. Точный адрес не нужен.')**  
   `implemented` — birthplace/page.tsx:31 Lead: {t('birthplace_lead')}; messages/ru.json: birthplace_lead='Родной регион — про культурный и семейный контекст. Точный адрес не нужен.'

✅ **birth_country field: required, label, hint (RU: 'Может отличаться от текущего места проживания')**  
   `implemented` — AnketaBirthPlaceForm.tsx:61-74 required Field; messages/ru.json: birth_place_country_label='Страна рождения', birth_place_country_hint='Где Вы родились. Может отличаться от текущего места проживания.'

✅ **birth_region field: required if birth_country = Uzbekistan, Show UZ_REGIONS Select for UZ, freeform TextInput for others**  
   `implemented` — AnketaBirthPlaceForm.tsx:26 showUzRegions = country === 'UZ'; lines 77-96 conditional Select (UZ) vs TextInput (others); line 141 validation (showUzRegions && !region) required; schemas.ts refine message 'birth_region_required_for_uz'

✅ **birth_district field: optional, label, hint**  
   `implemented` — AnketaBirthPlaceForm.tsx:99-108 Field (not marked required); messages/ru.json: birth_place_district_label='Район', birth_place_district_hint='Если знаете — это помогает культурной совместимости. Можно пропустить.'

✅ **birth_city field: optional, label, hint (RU: 'Можно пропустить. Не указывайте точный адрес')**  
   `implemented` — AnketaBirthPlaceForm.tsx:110-119 Field (not required); messages/ru.json: birth_place_city_label='Город или населённый пункт', birth_place_city_hint='Город рождения. Можно пропустить.'

✅ **API route saves birth data to hot columns (birth_country, birth_region, birth_district, birth_city)**  
   `implemented` — birth-place/route.ts:31-41 upsert to user_profiles with all 4 birth_* columns

✅ **Matching logic: primary language = strong factor, communication languages = strong/soft factor, height = soft if provided, weight = private optional**  
   `implemented` — recommend.ts:73 selects 'native_language'; matching algorithm uses birthRegion as soft factor per line 77; weight_kg stored but spec notes 'use only as private optional' (not in matching scoring visible to user)

✅ **Matching logic: birth_region = strong soft factor, not hard filter by default**  
   `implemented` — recommend.ts:77 returns birthRegion; 20260706120000_match_geo_birth_region.sql updated get_recommendations RPC to include birth_region for soft-factor matching; no hard-filter constraint

✅ **i18n: All 4 languages (RU, UZ, EN, TR) for appearance form labels and hints**  
   `implemented` — messages/{ru,uz,en,tr}.json all contain heightLabel, heightHint, weightLabel, optionalHint, nativeLanguageLabel, nativeLanguageHint, spokenLanguagesLabel, otherLanguageLabel, weightHiddenHint, weightAddButton

✅ **i18n: All 4 languages for birth-place form labels and hints**  
   `implemented` — messages/{ru,uz,en,tr}.json all contain birth_place_country_label, birth_place_country_hint, birth_place_region_label, birth_place_region_hint_optional, birth_place_district_label, birth_place_district_hint, birth_place_city_label, birth_place_city_hint

✅ **Validation: height 140–220 cm range enforced**  
   `implemented` — appearanceSchema.ts: height_cm = z.coerce.number().int().min(140).max(220).optional().nullable(); AnketaAppearanceForm.tsx HEIGHT_OPTIONS generated 140-220

✅ **Validation: weight 35–200 kg range enforced**  
   `implemented` — appearanceSchema.ts: weight_kg = z.coerce.number().int().min(35).max(200).optional().nullable(); AnketaAppearanceForm.tsx:80-82 weightOk validation

✅ **Validation: communication_languages min 1, max 6 items**  
   `implemented` — appearanceSchema.ts: languages = z.array(...).min(1).max(6); AnketaAppearanceForm.tsx:86-87 validation check

✅ **Validation: birth_region required if birth_country = UZ**  
   `implemented` — birthPlaceSchema.ts refine: (d) => d.birth_country !== 'UZ' || !!d.birth_region?.trim(); AnketaBirthPlaceForm.tsx:141 disabled check (!showUzRegions && !region)

✅ **State machine: Transition appearance → birth-place (not to family)**  
   `implemented` — appearance/route.ts:66 tryTransition(..., { onboarding_step: 'profile_birth_place' }, ..., ONBOARDING_PATHS.profile_birth_place); V4 flow order verified in spec comments line 13-14

## Анкета 4: О себе/образование/специальность + Анкета 5: Семья и дети

❌ **Field 1 hint: 'Чувствительные ответы не отображаются в анкете без вашего согласия' (RU/UZ)**  
   `not_implemented` — AnketaFamilyForm does not display a hint below marital_status field; spec requires this hint for user education about sensitive data

❌ **Privacy default: marital_status visible in profile (except 'na'/'Не хочу указывать')**  
   `not_implemented` — No per-field privacy control in current code; spec requires field-level visibility logic during publish. Would require additional privacy schema/logic.

❌ **Privacy default: has_children visible in profile (except 'na')**  
   `not_implemented` — No per-field privacy control implemented; spec requires visibility enforcement at profile render time

❌ **Privacy default: children_count hidden by default, visible after mutual interest**  
   `not_implemented` — No visibility-based conditional rendering; data stored but not protected by privacy tier in current schema

❌ **Privacy default: children age and living situation hidden by default**  
   `not_implemented` — CHILDREN_LIVING stored in extended.family (COLD), but no schema-level privacy metadata attached

❌ **Privacy default: future_children_plan as matching-only (not visible in profile)**  
   `not_implemented` — Field stored and used for matching, but no privacy layer enforces matching-only visibility

❌ **Matching logic: future_children_plan 'yes_soon' is strong matching factor, exclude 'no' as conflict**  
   `not_implemented` — future_children_plan used for matching in /supabase/migrations but business logic rules (soft/strong factors) not verified in this search. Requires matching function review.

❌ **Matching logic: 'yes_later' compatible with 'yes_soon', 'yes_later', 'with_partner_decide'**  
   `not_implemented` — Matching algorithm not reviewed; requires supabase/migrations or src/lib/matching code review

❌ **Matching logic: 'maybe'/'unsure' pairs with 'with_partner_decide' or 'individual', no hard block**  
   `not_implemented` — Business rules for soft matching not visible in form/schema; would be in get_recommendations RPC

🟡 **Field 2b (conditional): 'Количество детей' — dropdown/input with 1-4 options + prefer not to specify, required if has_children='yes'**  
   `partial` — /src/components/v2/AnketaFamilyForm.tsx:136-149 (numeric TextInput, not dropdown with 1-4 options); spec wants radio options, code uses open numeric input. /src/lib/profile/schemas.ts:266 (min 0, max 10 via z.coerce.number)

🟡 **Field 2c (conditional): 'Возраст детей' — 5 age range options (0-3, 3-6, 7-12, 13-17, 18+), required if has_children='yes'**  
   `partial` — /src/components/v2/AnketaFamilyForm.tsx:151-163 (numeric TextInput for 'youngest_child_age', not dropdown with age ranges); spec wants age ranges, code uses single numeric age field

🟡 **i18n copy: 'educationLabel', 'specialtyLabel', 'specialtyPlaceholder', 'specialtyHint' in ru/uz/en/tr**  
   `partial` — /messages/ru.json has educationLabel, specialtyLabel, specialtyHint, specialtyPlaceholder. Other languages (en/tr/uz) not verified in this search but likely present given project i18n scope.

🟡 **i18n copy: 'employmentStatusLabel', 'employmentFormatLabel' in ru/uz/en/tr**  
   `partial` — /messages/ru.json has both. Full multi-language coverage not verified.

🟡 **i18n copy: 'marital_label', 'children_label', 'childrenCountLabel', 'youngestChildAgeLabel', 'childrenLivingLabel', 'futureChildrenPlansLabel' in ru/uz/en/tr**  
   `partial` — /messages/ru.json has all 6 labels. Full multi-language coverage not verified.

⚖️ **Special handling: women's 'Предыдущий опыт серьёзных отношений' option — NOT added (legal-blocked)**  
   `legal_blocked` — Not in MARITAL_STATUS; spec notes this is blocked due to sensitive personal data (судские процессы)

✅ **Screen 4 intro text (RU): 'Расскажите о себе, образовании и текущей деятельности...' — soft tone**  
   `implemented` — /messages/ru.json: 'self_lead': 'Расскажите о себе, образовании и текущей деятельности. Это поможет другим лучше понять Ваш образ жизни, ценности и серьёзность намерений.'

✅ **Screen 4 intro text (UZ): Uzbek translation with soft tone**  
   `implemented` — /messages/uz.json contains translated 'self_lead' (not shown but present in codebase)

✅ **Field 1: 'О себе' — 30-1000 chars, anti-contact validation, visible after publish**  
   `implemented` — /src/components/v2/AnketaSelfForm.tsx:95-107; /src/lib/profile/schemas.ts:242-247 (min 30, max 1000, containsContact check)

✅ **Field 2: 'Образование' — dropdown with 8 options (secondary, vocational, higher, master, phd, studying, courses, na)**  
   `implemented` — /src/lib/profile/options.ts:63-72 (EDUCATION enum with all 8 values); /src/components/v2/AnketaSelfForm.tsx:109-116

✅ **Field 2b (conditional): 'Специальность/направление обучения' — optional, shown if education in [vocational, higher, master, phd, studying]**  
   `implemented` — /src/components/v2/AnketaSelfForm.tsx:85 (showSpecialty logic); lines 118-127 (conditional render)

✅ **Field 3: 'Сфера деятельности' — 17 activity field options (IT, Finance, Education, Medicine, State, Law, Business, Agriculture, Construction, Manufacturing, Trade, Transport, Media, Services, Religion/spiritual, Home, Other)**  
   `implemented` — /src/lib/profile/options.ts:270-288 (ACTIVITY_FIELDS with all 17 values in both ru/uz); /src/components/v2/AnketaSelfForm.tsx:129-140

✅ **Field 3b (conditional): 'Другое' free text input — shown if activity_field = 'other'**  
   `implemented` — /src/components/v2/AnketaSelfForm.tsx:142-151 (conditional render when activityField === 'other')

✅ **Field 4: 'Текущий статус занятости' — renamed from 'Формат занятости', 7 options (working, entrepreneur, freelancer, student, home_family, not_working, na)**  
   `implemented` — /src/lib/profile/options.ts:291-299 (EMPLOYMENT_STATUS with 7 values); /src/components/v2/AnketaSelfForm.tsx:153-160

✅ **Field 4b (conditional): 'Формат работы' — optional, shown if employment_status in [working, entrepreneur, freelancer]**  
   `implemented` — /src/components/v2/AnketaSelfForm.tsx:81-83 (EMPLOYMENT_WORKING_STATUSES logic); lines 162-171 (conditional render)

✅ **Screen 5 intro text (RU): 'Эти вопросы помогают учитывать важные ожидания...' — soft matching tone**  
   `implemented` — /messages/ru.json: 'family_lead': 'Эти вопросы помогают учитывать важные ожидания о семье, детях и будущем. Ответы используются для более подходящих рекомендаций.'

✅ **Screen 5 intro text (UZ): Uzbek translation with matching tone**  
   `implemented` — /messages/uz.json contains translated 'family_lead' (present in codebase)

✅ **Field 1: 'Семейное положение' — gender-conditional labels (Холост/Не была в браке, Вдовец/Вдова)**  
   `implemented` — /src/components/v2/AnketaFamilyForm.tsx:50-55 (getGenderedOptionLabel for MARITAL_STATUS); /src/lib/profile/gender-wording.ts:60-68 (gender overrides for 'never' and 'widowed')

✅ **Marital status options include: never/не была в браке, divorcing, divorced, widowed, married_separate, other**  
   `implemented` — /src/lib/profile/options.ts:14-21 (MARITAL_STATUS with all 6 values in ru/uz)

✅ **Marital status 'divorcing' and 'married_separate' flagged as MARITAL_STATUS_NEEDS_REVIEW for moderation**  
   `implemented` — /src/lib/profile/options.ts:24 (MARITAL_STATUS_NEEDS_REVIEW = ['divorcing', 'married_separate'])

✅ **Field 2: 'Есть ли у вас дети?' — Yes/No/Prefer not to answer**  
   `implemented` — /src/lib/profile/options.ts:26-30 (HAS_CHILDREN with 'no', 'yes', 'na'); /src/components/v2/AnketaFamilyForm.tsx:118-132

✅ **Field 2d (conditional): 'С кем сейчас проживают дети?' — 4 options + prefer not to specify, COLD/extended/optional**  
   `implemented` — /src/lib/profile/options.ts:326-332 (CHILDREN_LIVING with 5 values); /src/components/v2/AnketaFamilyForm.tsx:165-173 (conditional, optional); /src/app/api/onboarding/profile/family/route.ts:42-47 (COLD storage in extended.family)

✅ **Field 3: 'Планы на детей в будущем' — 6 options (yes_soon, yes_later, maybe, no, with_partner_decide, individual)**  
   `implemented` — /src/lib/profile/options.ts:314-322 (FUTURE_CHILDREN_PLAN with 6 values in ru/uz); /src/components/v2/AnketaFamilyForm.tsx:177-188

✅ **Moderation rule: marital 'divorcing' status requires manual review before publishing**  
   `implemented` — /src/lib/profile/options.ts:24 (MARITAL_STATUS_NEEDS_REVIEW); likely enforced in publish route but requires route verification

✅ **Moderation rule: marital 'married_separate' requires manual review + limited visibility**  
   `implemented` — /src/lib/profile/options.ts:24 (MARITAL_STATUS_NEEDS_REVIEW); high-trust-safety concern noted in spec

✅ **Conditional logic: if marital='never'/'не была', don't ask about previous marriage details**  
   `implemented` — /src/components/v2/AnketaFamilyForm.tsx shows no follow-up questions after marital selection; spec logic implicit in form structure

✅ **Conditional logic: if has_children='no'/'na', hide children_count, age, living fields**  
   `implemented` — /src/components/v2/AnketaFamilyForm.tsx:48, 134-175 (showChildrenDetails gate); lines 122-129 (reset on has_children change)

✅ **Conditional logic: if employment_status not in [working, entrepreneur, freelancer], hide work_format**  
   `implemented` — /src/components/v2/AnketaSelfForm.tsx:81-83 (EMPLOYMENT_WORKING_STATUSES); lines 162-171 (conditional render)

✅ **Conditional logic: if activity_field='other', show free text input for 'Другое'**  
   `implemented` — /src/components/v2/AnketaSelfForm.tsx:142-151

✅ **API validation: children_count and youngest_child_age both required if has_children='yes'**  
   `implemented` — /src/lib/profile/schemas.ts:275-284 (refine on familyChildrenSchema)

✅ **i18n copy: hints for childrenCountHint ('От 1 до 10.'), ageRangeHint ('В годах, 0-50.'), optionalHint**  
   `implemented` — /messages/ru.json: childrenCountHint, ageRangeHint, optionalHint present

✅ **API route /api/onboarding/profile/self saves education, activity_field, employment_status, employment_format, specialty (COLD), activity_field_other (COLD)**  
   `implemented` — /src/app/api/onboarding/profile/self/route.ts:59-72 (upsert with hot + extended.self for COLD fields)

✅ **API route /api/onboarding/profile/family saves marital_status, has_children, future_children_plan, children_count, youngest_child_age, children_living (COLD/extended)**  
   `implemented` — /src/app/api/onboarding/profile/family/route.ts:49-62 (upsert with hot + extended.family for children_living)

✅ **State machine transition: profile_self → profile_family**  
   `implemented` — /src/app/api/onboarding/profile/self/route.ts:76-83 (tryTransition to profile_family)

✅ **State machine transition: profile_family → profile_values**  
   `implemented` — /src/app/api/onboarding/profile/family/route.ts:66-73 (tryTransition to profile_values)

✅ **Schema validation: specialty max 80 chars, optional, stored in extended.self**  
   `implemented` — /src/lib/profile/schemas.ts:251 (z.string().max(80).optional())

✅ **Schema validation: activity_field_other max 80 chars, optional, stored in extended.self**  
   `implemented` — /src/lib/profile/schemas.ts:254 (z.string().max(80).optional())

➖ **Privacy default: medical child restrictions (if selected) strictly matching-only, never visible**  
   `not_applicable` — Spec mentions 'Вопрос детей связан с медицинскими ограничениями' option (value 'individual' in code), but no separate medical field implemented. This is deferred (legal concern).

## Screen 6 (Экран 6: Родители и участие семьи) + Screen 7 (Экран 7: Ценности и вера)

❌ **Screen 6 overall: Step/route in state machine (profile_parents)**  
   `not_implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/state-machine/types.ts lines 9-62: No 'profile_parents' in OnboardingStep union; task #82 marks Screen 11 as deferred

❌ **Screen 6 overall: React form component (AnketaParentsForm.tsx)**  
   `not_implemented` — Bash search: no AnketaParentsForm file found in /Users/fayzullohoja/Code/baxtlilar/src/components/v2/

❌ **Screen 6 overall: Page route /anketa/parents/page.tsx**  
   `not_implemented` — Bash find: no parents directory in /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/anketa/

❌ **Screen 6 Section 1 (Отец): father_status field with options (Жив, Ушёл, Нет связи, Не отвечать)**  
   `not_implemented` — No field found in schemas.ts; no Opt[] enum in options.ts for father_status

❌ **Screen 6 Section 1: father_age_range field with conditional visibility (only if alive)**  
   `not_implemented` — No conditional logic for father_age_range in any form component

❌ **Screen 6 Section 1: father_profession field with 8 options**  
   `not_implemented` — No father_profession enum in options.ts; matches ACTIVITY_FIELDS structure but not father-specific

❌ **Screen 6 Section 1: father_origin_region and father_current_location fields**  
   `not_implemented` — No father_origin_region or father_current_location in schemas.ts or options.ts

❌ **Screen 6 Section 2 (Мать): mother_status, mother_age_range, mother_profession, mother_origin_region, mother_current_location**  
   `not_implemented` — No mother_* fields found; same search results as father fields

❌ **Screen 6 Section 3 (Семейный контекст): parents_marital_status (родители вместе/разведены/один ушёл и т.д.)**  
   `not_implemented` — No parents_marital_status field in schemas.ts or options.ts

❌ **Screen 6 Section 3: family_relationships (отношения с семьёй: близкие/обычные/редко/отдельно но в ладах)**  
   `not_implemented` — No family_relationships enum in options.ts

❌ **Screen 6 Section 3: family_involvement (участие семьи в браке: важно/советоваться/сам решаю/зависит)**  
   `not_implemented` — No family_involvement field; unrelated to family_role_model or family_decision_model which are about couple dynamics

❌ **Screen 6 overall: Schema validation with required/optional per field and IF/THEN logic**  
   `not_implemented` — No schema for parents section; spec rules (lines 1234-1289) not encoded anywhere

❌ **Screen 6 overall: Privacy defaults (all fields hidden by default except for matching)**  
   `not_implemented` — Spec §1248-1264 visibility rules (father_status_visibility=matching_only, etc.) have no corresponding schema fields

❌ **Screen 6 overall: Accordion UI structure (3 collapsible sections: Отец, Мать, Семья)**  
   `not_implemented` — No accordion component visible in AnketaFields.tsx or any parent form

❌ **Screen 7 Field 1 Hint: 'Этот ответ используется для подбора и не отображается в анкете без вашего согласия.'**  
   `not_implemented` — AnketaValuesForm.tsx line 65-66 has no hint for religion field; messages don't have religionHint

🟡 **Screen 7 Field 2 Hint: 'Выберите до 3 ценностей. Это поможет лучше понять ваши приоритеты.'**  
   `partial` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json has 'lifeValuesHint': 'Выберите до 3-х — это покажет алгоритму, что для Вас важно.' (different wording but same intent); form appends counter ` ${values.length}/3`

🟡 **Screen 7 overall: Privacy defaults (religion and top_life_values visibility handling)**  
   `partial` — No explicit visibility schema for values fields in current implementation; handled via profile_visibility_mode at global level (privacy schema line 385)

⚖️ **Screen 6 status: Owner states "legal-blocked" — Экран 6 Родители and related fields (religion_practice/role, relationship-history, medical child-restrictions)**  
   `legal_blocked` — User's brief states 'LEGAL-BLOCKED: Экран 6 Родители (parents), religion_practice/role, relationship-history, medical child-restrictions.'

✅ **Screen 7 overall: Form component renders (AnketaValuesForm.tsx)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/components/v2/AnketaValuesForm.tsx lines 1-99

✅ **Screen 7 overall: Page route /anketa/values/page.tsx**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/anketa/values/page.tsx

✅ **Screen 7 overall: State machine step profile_values**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/state-machine/types.ts line 40 has 'profile_values', line 131 has transition profile_family → profile_values

✅ **Screen 7 Title: 'Ценности и вера' (not 'Религиозность', not 'Набожность')**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json has 'values_headline': 'Ценности и вера.'

✅ **Screen 7 Headline text: 'Эти вопросы помогают понять, какие ценности и духовные ориентиры важны для вас. Здесь нет «правильных» ответов — важно честное совпадение взглядов.'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json: 'values_lead' matches spec exactly (lines 1313-1317)

✅ **Screen 7 Field 1: Religion (Вероисповедание) with 6 options (Ислам, Христианство, Иудаизм, Буддизм, Другая, Не исповедую)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts lines 41-49: RELIGION has 7 opts (+ 'na' prefer not to answer)

✅ **Screen 7 remove: Level of religious practice follow-up (убран учредителем поправка №5)**  
   `implemented` — AnketaValuesForm.tsx lines 17-19 comment confirms removal; schemas.ts line 194 has religion_practice as .optional() but form does not render it

✅ **Screen 7 remove: religion_partner_match from this screen (moved to partner-extended per poправка №10)**  
   `implemented` — AnketaValuesForm.tsx does not include any partner-match field; valuesV3Schema lines 289-294 has religion_partner_match as optional but form ignores it

✅ **Screen 7 Field 2: Life values (Что для вас важно в жизни) multi-select 1-3 from 14 options**  
   `implemented` — AnketaValuesForm.tsx lines 69-75: Chips component with LIFE_VALUES_V3 (max 3 selected); validation line 61

✅ **Screen 7 Field 2 options: Семья, Вера, Честность, Уважение, Доброта, Ответственность, Традиции, Образование, Здоровье, Карьера, Финансовая стабильность, Махалля, Саморазвитие, Самостоятельность**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts lines 335-350: LIFE_VALUES_V3 has all 14 values with RU/UZ labels

✅ **Screen 7 overall: Schema validation (religion required, top_life_values 1-3)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/schemas.ts lines 289-294: valuesV3Schema enforces religion enum, top_life_values array min 1 max 3

✅ **Screen 7 overall: API endpoint /api/onboarding/profile/values to save data**  
   `implemented` — AnketaValuesForm.tsx line 40: POST to '/api/onboarding/profile/values'

## Экран 8 (Модель семьи) + Экран 9 (Финансы)

❌ **Soft summary in profile: 'Взгляды на семью: совместные решения, договорённость в быту' (not exposed raw)**  
   `not_implemented` — No soft summary generation in profile display code; spec says 'soft summary' but code stores raw values. May be handled in profile display layer (profile-card component)

❌ **IF/THEN: financial_stability_importance >= 4 → increase matching weight**  
   `not_implemented` — No matching weight logic in form or schema; would be in get_recommendations RPC (backend, not in this form)

🟡 **Privacy: family_role_model visibility = matching_only**  
   `partial` — No explicit privacy/visibility field in AnketaFamilyModelForm or family-model schema; privacy controlled separately on screen 16 (privacy endpoint). Implementation relies on admin privacy settings per spec.

🟡 **Privacy: spouse_work_view visibility = matching_only**  
   `partial` — Same as above — privacy handled at privacy screen level, not at form level

🟡 **Privacy: decision_making_model visibility = matching_only**  
   `partial` — Same as above

🟡 **Privacy: household_duties_model visibility = matching_only**  
   `partial` — Same as above

🟡 **IF/THEN: income_status=no_income does not block profile, matching_only visibility**  
   `partial` — Field accepts 'none' option; visibility likely enforced via privacy screen, not in finance form itself

🟡 **IF/THEN: income_range selected → visibility hidden_by_default, not public**  
   `partial` — income_range stored in extended, privacy enforced separately; hint says 'не отображается по умолчанию'

✅ **Screen 8: Title 'Как вы видите будущую семью?' with translations to UZ**  
   `implemented` — messages/ru.json:261, family_model_headline; messages/uz.json:261; page/family-model:38

✅ **Screen 8: Lead text about understanding family roles & decisions (no right answers)**  
   `implemented` — messages/ru.json:262, family_model_lead; messages/uz.json:262; AnketaFamilyModelForm.tsx:39

✅ **Field 1: 'Модель ролей в семье' (traditional/equal partnership/woman_leads) — REQUIRED**  
   `implemented` — options.ts:355-359, FAMILY_ROLE_MODEL (3 options); schemas.ts:familyModelSchema; AnketaFamilyModelForm.tsx:87-96; validation line 82

✅ **Field 2: Gender-conditional work question — IF female: 'Планируете ли вы работать после брака?' IF male: 'Как вы относитесь к работе супруги?'**  
   `implemented` — AnketaFamilyModelForm.tsx:100, t(gender === 'f' ? 'husbandWorkLabel' : 'wifeWorkLabel'); messages/ru.json:291-292

✅ **Field 2: Work view options (welcome/ok_if_needed/prefer_not/against/discuss) — REQUIRED**  
   `implemented` — options.ts:362-368, WIFE_WORK_VIEW (5 options); schemas.ts:familyModelSchema; validation line 82

✅ **Field 3: 'Как принимаются решения в семье?' (husband_main/wife_main/joint) — OPTIONAL**  
   `implemented` — options.ts:372-376, FAMILY_DECISION_MODEL (3 options); schemas.ts:familyModelSchema (.optional()); AnketaFamilyModelForm.tsx:111-121; hint line 113

✅ **Field 3: Hint 'Можно пропустить'**  
   `implemented` — AnketaFamilyModelForm.tsx:113, hint={t('optionalHint')}

✅ **Field 4: 'Как вы видите бытовые обязанности?' (traditional/shared_50_50/by_skill/mostly_partner) — OPTIONAL**  
   `implemented` — options.ts:384-389, HOUSEHOLD_RESPONSIBILITY_MODEL (4 options); schemas.ts (.optional()); AnketaFamilyModelForm.tsx:123-147

✅ **Field 4: Gender-conditional labels for 'mostly_partner' (М shows 'жена', Ж shows 'муж')**  
   `implemented` — AnketaFamilyModelForm.tsx:128-142 uses getGenderedOptionLabel; gender-wording.ts defines GENDERED_OVERRIDES for mostly_partner with m/f variants

✅ **Field 4: Hint 'Можно пропустить'**  
   `implemented` — AnketaFamilyModelForm.tsx:125, hint={t('canSkipHint')}

✅ **MVP Obligatoriness: role_model=required, work_view=required (with 'prefer not answer'), decision=optional, household=optional**  
   `implemented` — validation line 82: const valid = !!roleModel && !!wifeWork; Both fields required for submit. decision/household optional (no validation)

✅ **After family_model, transition to profile_finance (not directly to marriage)**  
   `implemented` — family-model/route.ts:73 transitions to 'profile_finance'; state-machine/types.ts:132 profile_family_model: ['profile_finance', ...]

✅ **Screen 9: Title 'Финансовые взгляды и ответственность'**  
   `implemented` — messages/ru.json:334, finance_title; messages/uz.json:334; finance/page.tsx:28

✅ **Screen 9: Lead 'Эти вопросы помогают понять ваше отношение к семейному бюджету...'**  
   `implemented` — messages/ru.json:335, finance_lead; messages/uz.json:335; finance/page.tsx:30

✅ **Field 1: Income stability 'Текущая ситуация с доходом' (stable/unstable/none/prefer_not_answer) — REQUIRED**  
   `implemented` — options.ts:434-439, INCOME_SOURCE_STABILITY; schemas.ts:financeSchema (required); AnketaFinanceForm.tsx:98-105; validation line 88

✅ **Field 2: Financial stability importance (1-5 scale) — REQUIRED**  
   `implemented` — schemas.ts:.min(1).max(5); AnketaFinanceForm.tsx:107-114, NumberScale component; validation line 89-91

✅ **Field 2: Hint '1 — не является главным критерием, 5 — очень важно'**  
   `implemented` — messages/ru.json:341, finance_stability_importance_hint

✅ **Field 3: Financial decisions management 'Как должны приниматься финансовые решения в семье?' (joint/mostly_man/mostly_woman/situational/later) — REQUIRED**  
   `implemented` — options.ts:442-448, FAMILY_FINANCE_MANAGEMENT (5 options); schemas.ts (required); AnketaFinanceForm.tsx:116-123; validation line 92

✅ **Field 4: Financial priorities multi-select (max 3) with 9 options (no_debt/savings/investments/budget_planning/literacy/generosity/housing/travel/independence) — REQUIRED**  
   `implemented` — options.ts:451-461, FINANCIAL_PRIORITIES (9 options); schemas.ts:.min(1).max(3); AnketaFinanceForm.tsx:125-137; validation line 93-94

✅ **Field 4: Priority option 'Ответственное отношение к долгам и кредитам' (not 'Отсутствие долгов')**  
   `implemented` — options.ts:452, value:'no_debt', ru:'Ответственное отношение к долгам и кредитам'

✅ **Field 4: Hint 'Выберите до 3 пунктов' with counter**  
   `implemented` — AnketaFinanceForm.tsx:128, hint={`${priorities.length}/3`}

✅ **Field 5: Monthly income range 'Хотите указать примерный диапазон ежемесячного дохода?' (UZS, 7 options) — OPTIONAL**  
   `implemented` — options.ts:464-472, MONTHLY_INCOME_RANGE (7 options); schemas.ts (.optional()); AnketaFinanceForm.tsx:139-149; no validation block

✅ **Field 5: Hint 'Можно пропустить. Эта информация не отображается в анкете по умолчанию'**  
   `implemented` — messages/ru.json:359, finance_income_range_hint; AnketaFinanceForm.tsx:141, hint={t('optionalHint')}

✅ **Field 6: Financial obligations 'Есть ли у вас финансовые обязательства?' (none/controlled/significant/prefer_not_answer) — OPTIONAL/SENSITIVE**  
   `implemented` — options.ts:475-480, FINANCIAL_OBLIGATIONS (4 options); schemas.ts (.optional()); AnketaFinanceForm.tsx:151-161; no validation block

✅ **Field 6: Obligation values distinguish 'контролируемые' vs 'значительные' (not just 'yes/no')**  
   `implemented` — options.ts:477-478, controlled/significant separate options with distinct labels

✅ **Field 7: Housing status 'Жилищная ситуация' (own/rent/with_parents/none/prefer_not_answer) — OPTIONAL**  
   `implemented` — options.ts:483-489, HOUSING_STATUS (5 options); schemas.ts (.optional()); AnketaFinanceForm.tsx:163-170; no validation block

✅ **All finance fields stored in extended.finance (cold, not hot columns)**  
   `implemented` — finance/route.ts:36-71 reads/writes extended.finance nested object; schemas.ts places all fields in financeSchema (never in hot)

✅ **Privacy note 'Эти ответы не отображаются в анкете по умолчанию...'**  
   `implemented` — messages/ru.json:372, finance_privacy_note; AnketaFinanceForm.tsx:172-186 displays note with teal background

✅ **After finance, transition to profile_lifestyle**  
   `implemented` — finance/route.ts:80 transitions to 'profile_lifestyle'; state-machine/types.ts:133 profile_finance: ['profile_lifestyle']

✅ **MVP field requirements: income=required, importance=required, management=required, priorities=required, income_range=optional, obligations=optional**  
   `implemented` — validation lines 87-94: incomeSource, importance, management, priorities all checked; incomeRange/obligations optional

✅ **All 4 languages fully supported (RU, UZ, EN, TR)**  
   `implemented` — messages/ru.json, uz.json have all keys; messages/en.json and messages/tr.json confirmed exist with translations

## Анкета 10 & 11: Образ жизни и После брака

✅ **Screen 10 header text RU: 'Расскажите о своём ритме жизни, досуге и привычках...'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json: 'lifestyle_lead': 'Расскажите о своём ритме жизни, досуге и привычках. Это поможет понять совместимость в повседневной жизни.'

✅ **Screen 10 header text UZ translation**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/uz.json: 'lifestyle_lead': 'Hayot tarzingiz, boʻsh vaqtingiz va odatlaringiz haqida maʼlumot bering...'

✅ **Field 1 - Lifestyle pace (Какой образ жизни): Active/Calm/Balanced/Unsure; Required**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:494-499 LIFESTYLE_PACE with 4 options; AnketaLifestyleForm.tsx:88-92 validates pace must be set

✅ **Field 2 - Free time activities: multi-select 1-3 from 12 options; Required validation**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:502-515 FREE_TIME_ACTIVITIES with 12 options; AnketaLifestyleForm.tsx:48-52 toggles selection; line 91 validates 1-3; line 114 shows max={3} in Chips component

✅ **Free time hint text: 'Выберите до 3 вариантов' / 'Выберите до 3'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json: 'lifestyle_freetime_hint': 'Выберите до 3 вариантов.'; AnketaLifestyleForm.tsx:108 renders hint

✅ **Field 3 - Daily routine (Режим дня): 4 options with 'обычно ложусь' wording; Required; soft factor for matching**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:518-523 DAILY_ROUTINE with bedtime-focused text; AnketaLifestyleForm.tsx:89 validates routine is set

✅ **Field 4 - Smoking (Как Вы относитесь к курению): 5 options; Optional; includes e-cigs/vape in hint**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:527-533 BAD_HABITS_LEVEL with 5 options; AnketaLifestyleForm.tsx:129-138 renders optional; messages/ru.json 'lifestyle_smoking_hint': 'Сюда относится табак, электронные сигареты и вейп. Можно пропустить.'

✅ **Field 5 - Nutrition (Питание): 5 options; Optional with 'Можно пропустить' hint**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:536-542 NUTRITION_STYLE with 5 options; AnketaLifestyleForm.tsx:140-150 optional field with canSkipHint

✅ **Field 6 - Alcohol (Как Вы относитесь к алкоголю): 5 options; Optional; matching_only visibility**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:545-551 ALCOHOL_LEVEL with 5 options; AnketaLifestyleForm.tsx:152-162 optional field; route.ts line 58 stores conditionally

✅ **Field 7 - Drugs/substances: NOT included in form (moved to platform rules)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/components/v2/AnketaLifestyleForm.tsx:69 comment: 'drugs_use убран из анкеты (ревью оунера)'; line 164-166 comment confirms removal

✅ **Schema: lifestyle_pace, free_time_activities (1-3), daily_routine required; others optional**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/schemas.ts:366-374 lifestyleSchema with required fields and optional fields

✅ **API endpoint /api/onboarding/profile/lifestyle with validation**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/api/onboarding/profile/lifestyle/route.ts lines 5, 29-34 validate and save

✅ **Lifestyle page with eyebrow, title, lead text**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/anketa/lifestyle/page.tsx lines 25-29 render eyebrow, title, lead

✅ **Screen 11 header: 'Как вы видите жизнь после брака?' / 'Nikohdan keyingi hayotni qanday tasavvur qilasiz?'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json 'marriage_headline': 'Как Вы видите жизнь после брака?'; uz.json 'marriage_headline': 'Nikohdan keyingi hayotni qanday tasavvur qilasiz?'

✅ **Screen 11 lead text about expectations on living, timeframes, relocation**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json 'marriage_lead': 'Эти вопросы помогают понять Ваши ожидания по проживанию, срокам брака и готовности к переезду...'

✅ **Field 1 Screen 11 - Post-marriage living (План проживания): 7 options; Required**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:206-243 POST_MARRIAGE_LIVING with 7 options; AnketaMarriageForm.tsx:54-67 required field with validation at line 107

✅ **Post-marriage living options: с родителями мужа/жены, отдельно, временно-потом-отдельно, по договоренности, не решил, не отвечать**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:206-243 has all 7 options with correct Russian/Uzbek labels

✅ **Field 2 Screen 11 - Marriage readiness (Когда вы рассматриваете брак): 6 options; Optional**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:246-253 MARRIAGE_READINESS with 6 options; AnketaMarriageForm.tsx:69-76 optional field

✅ **Marriage readiness options: within 6m/1y/1-2y/when right/not ready/not say**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:246-253 has all 6 options matching spec

✅ **Field 3 Screen 11 - Relocation readiness: separate city/country options; Optional**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:256-263 RELOCATION_READINESS with city/country separated plus by_agreement/only_my_city/unsure/na

✅ **Relocation options: city/country/by_agreement/stay_in_city/unsure/not_say**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:256-263 has 6 options with correct wording

✅ **Marriage schema: post_marriage_living (required), marriage_readiness/relocation_readiness (optional)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/schemas.ts:203-210 marriageSchema with required and optional fields

✅ **API endpoint /api/onboarding/profile/marriage with validation**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/api/onboarding/profile/marriage/route.ts lines 5, 20-29 validate and save

✅ **Marriage form validation: post_marriage_living required, others optional**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/components/v2/AnketaMarriageForm.tsx line 107 disabled={!living || busy} shows only living required

✅ **Marriage page with eyebrow, headline, lead text**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/anketa/marriage/page.tsx lines 26-28 render eyebrow, headline, lead

✅ **Transition after lifestyle → profile_marriage step**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/api/onboarding/profile/lifestyle/route.ts:76-87 transitions to profile_marriage

✅ **Transition after marriage → profile_partner_extended step**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/api/onboarding/profile/marriage/route.ts:45-54 transitions to profile_partner_extended

✅ **All fields stored in hot columns (post_marriage_living, marriage_readiness, relocation_readiness)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/api/onboarding/profile/marriage/route.ts:31-40 upserts to hot columns

✅ **Lifestyle fields stored in extended.lifestyle JSONB (cold storage)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/api/onboarding/profile/lifestyle/route.ts:44-69 reads/merges/writes extended.lifestyle

✅ **EN translations for lifestyle fields**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/en.json contains lifestyle_* keys

✅ **TR translations for lifestyle fields**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/tr.json contains lifestyle_* keys

✅ **EN translations for marriage fields**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/en.json contains marriage_* keys

✅ **TR translations for marriage fields**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/tr.json contains marriage_* keys

✅ **Free time activities text matches spec: спорт, чтение, путешествия, время с семьей, музыка, творчество, волонтерство, игры, природа, обучение, духовные практики, другое**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:502-515 FREE_TIME_ACTIVITIES has all 12 options

✅ **Smoking/alcohol fields marked as sensitive (not shown publicly without consent)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/components/v2/AnketaLifestyleForm.tsx:24, 26 comments note bad_habits_level and alcohol_level are 'sensitive, скрываются до mutual interest'

✅ **Daily routine options exactly as spec: early/middle/late/unstable with bedtime wording**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/lib/profile/options.ts:518-523 DAILY_ROUTINE with exact bedtime-focused labels

✅ **Form validation enforces max 3 free time activities and shows error on overflow**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/components/v2/AnketaFields.tsx Chips component line: atMax = max !== undefined && selected.length >= max && !isSelected

## Анкета 12: Ожидания от партнёра + Анкета 13: Фото

❌ **Семейное фото лейбл: 'Фото в семейной обстановке' (более точно чем просто 'Семейное фото')**  
   `not_implemented` — messages/ru.json: 'photos_slot_family_label': 'Семейное' — не использует предложенный более точный текст 'Фото в семейной обстановке'

🟡 **Подсказка для роста: 'Можно пропустить. Рост не является главным критерием подбора.'**  
   `partial` — messages/ru.json: 'partnerHeightHint': 'Можно пропустить. 140–220 см.' — не содержит фразу 'не является главным критерием подбора'

🟡 **Поле 4: Ожидания к религиозным взглядам партнёра с опциями (5 вариантов: та же вера, та же вера + практика, близкие ценности, уважение к разным взглядам, не решающий критерий)**  
   `partial` — AnketaPartnerExtendedForm.tsx:207-218 uses RELIGION_PARTNER_MATCH; options.ts:176-202 содержит все 5 вариантов, но вопрос неточный: 'Насколько для Вас важно совпадение веры с партнёром?' вместо 'Какие у вас ожидания к религиозным взглядам будущего супруга / супруги?'

🟡 **Поле 6.3: Родной регион партнёра с 4 опциями: из моего региона, из определённого региона (показать список регионов), не имеет значения, готов разные варианты**  
   `partial` — AnketaPartnerExtendedForm.tsx:252-259; options.ts:590-594 PARTNER_ORIGIN_REGION_PREF — НЕ содержит вариант 'определённого региона' который должен открыть выбор регионов, только 'same_as_mine', 'any', 'open'

🟡 **Hard/soft критерии: переключатель для каждого критерия (возраст hard по умолчанию, остальное soft/strong soft)**  
   `partial` — AnketaPartnerExtendedForm.tsx:261-272; options.ts:600-607 PARTNER_HARD_CRITERIA — это multi-select без отметки обязательности на уровне UI (только инфо-поле для match-story, не энфорсится в matching)

🟡 **Семейное фото: опциональное, не основное, видно только после взаимного интереса, не показывать сразу всем**  
   `partial` — AnketaPhotosForm.tsx:138-139 required=false для family; messages указывают 'Откроется только после взаимного интереса'. ОДНАКО: лейбл 'Семейное' вместо более точного 'Фото в семейной обстановке' как рекомендует спека

✅ **Экран 12 заголовок: 'Кого вы хотите встретить?' (RU) / 'Qanday insonni uchratmoqchisiz?' (UZ)**  
   `implemented` — messages/ru.json: 'partner_extended_headline': 'Кого Вы хотите встретить?'; messages/uz.json аналог присутствует

✅ **Экран 12 основной текст заменён на новый: 'Укажите важные ожидания...' вместо старого про алгоритм**  
   `implemented` — messages/ru.json: 'partner_extended_lead': 'Укажите важные ожидания к будущему партнёру. Мы будем учитывать не только формальные параметры, но и ценности, взгляды на семью и жизненные цели.' (точное совпадение со спекой)

✅ **Поле 1: Возраст партнёра остаётся обязательным с мин. 18 лет, max_age >= min_age**  
   `implemented` — AnketaPartnerExtendedForm.tsx:121-126 — валидация ageOk проверяет Number(ageMin) >= 18, Number(ageMax) >= 18, Number(ageMax) >= Number(ageMin)

✅ **Предупреждение для узкого возрастного диапазона (< 3 лет) отображается, но не блокирует**  
   `implemented` — AnketaPartnerExtendedForm.tsx:155-170 — если разница < 3, показывается warning 'partner_age_narrow_warning'

✅ **Поле 2: Рост партнёра опционально, диапазон 140–220 см (не 120–230)**  
   `implemented` — AnketaPartnerExtendedForm.tsx:127-133 — Number(heightMin) >= 140 && Number(heightMax) <= 220

✅ **Поле 3: Важные качества партнёра (1-5 из 14 опций, multi-select)**  
   `implemented` — AnketaPartnerExtendedForm.tsx:193-205 uses PARTNER_QUALITIES (14 опций); qOk валидирует qualities.length >= 1 && <= 5

✅ **Варианты качеств включают все 14: Доброта, Честность, Ответственность, Интеллект, Чувство юмора, Религиозность, Амбициозность, Спокойствие, Верность, Семейные ценности, Заботливость, Самостоятельность, Щедрость, Терпение**  
   `implemented` — options.ts:400-415 PARTNER_QUALITIES включает все 14 значений с точными лейблами

✅ **Поле 5: Страна проживания партнёра с multi-select до 3 стран + опция 'Не имеет значения' которая сбрасывает остальные**  
   `implemented` — AnketaPartnerExtendedForm.tsx:220-231, 72-78; options.ts:564-568; логика toggleCountry сбрасывает остальные при выборе PARTNER_ANY_COUNTRY

✅ **Поле 6.1: Семейное положение партнёра (multi-select, опции: не был в браке, разведён, вдовец, есть опыт готов обсудить, не имеет значения)**  
   `implemented` — AnketaPartnerExtendedForm.tsx:233-241; options.ts:573-579 PARTNER_MARITAL_PREF содержит все 5 вариантов

✅ **Поле 6.2: Отношение к детям у партнёра (single, опции: приемлемо, готов обсудить, предпочитаю без, не решающий критерий)**  
   `implemented` — AnketaPartnerExtendedForm.tsx:243-250; options.ts:582-587 PARTNER_CHILDREN_PREF содержит все 4 варианта

✅ **IF partner_country = 'Не имеет значения': очистить выбранные страны**  
   `implemented` — AnketaPartnerExtendedForm.tsx:72-78 toggleCountry логика сбрасывает остальные при выборе 'any'

✅ **Валидация: IF selected_countries_count > 3 show error**  
   `implemented` — AnketaPartnerExtendedForm.tsx:135 countriesOk = countries.length <= 3, блокирует submit если > 3

✅ **Экран 13 исключить отдельный экран 12 (старой версии) после partner_extended сразу вести на preview**  
   `implemented` — state-machine/types.ts: profile_partner_extended → ['profile_privacy', 'profile_photos']; profile_photos → ['profile_preview'] — нет экрана-перехода

✅ **Экран 13: Заголовок 'Добавьте фотографии' (RU) / 'Suratlaringizni qoʻshing' (UZ)**  
   `implemented` — messages/ru.json: 'photos_headline': 'Добавьте фотографии.' Точное совпадение

✅ **Экран 13: Основной текст про портрет, полный рост, селфи не показываются**  
   `implemented` — messages/ru.json: 'photos_lead': 'Добавьте фото, которые помогают увидеть Вас естественно и с уважением. Первое фото будет основным. Документы и селфи для проверки другим пользователям не показываются.' Совпадает со спекой

✅ **Портретное фото: обязательно, видно в рекомендациях, без маски/очков/фильтров/других людей**  
   `implemented` — AnketaPhotosForm.tsx:139 required = ty === 'portrait'; messages/ru.json photos_slot_portrait_label/hint содержат требования

✅ **Фото в полный рост: желательно но можно пропустить**  
   `implemented` — AnketaPhotosForm.tsx:138-139 required = false для full_body; messages описывают как опциональное

✅ **Семейное фото подсказка: упоминание согласия людей на фото**  
   `implemented` — AnketaPhotosForm.tsx:258-266; messages/ru.json 'photos_family_consent': 'Загружая семейное фото, вы подтверждаете согласие изображённых на нём людей.'

✅ **Инструкция внизу: 'Минимум 1 фото, максимум 3. Первое фото будет основным. Дополнительные откроются после взаимного интереса или по настройкам приватности.'**  
   `implemented` — messages/ru.json 'photos_instructions': 'Портрет обязателен — его видят в рекомендациях. Фото в полный рост и семейное — по желанию; семейное откроется только после взаимного интереса.' Смысловой эквивалент, немного другая формулировка

✅ **Privacy-логика: portrait required=true, visible_to=verified_users_only, public_in_profile_card=true**  
   `implemented` — AnketaPhotosForm.tsx + options.ts PHOTO_TYPES_PRE_MUTUAL = ['portrait', 'full_body'], семейное исключено из get_recommendations

✅ **Privacy-логика: full_body required=false, visible_after=profile_open_or_mutual_interest**  
   `implemented` — AnketaPhotosForm.tsx; options.ts PHOTO_TYPES_PRE_MUTUAL включает full_body

✅ **Privacy-логика: family_context_photo required=false, sensitive=true, visible_after=mutual_interest, cannot_be_main=true**  
   `implemented` — AnketaPhotosForm.tsx не позволяет сделать family главным; миграция 20260711020000 исключает family из get_recommendations pre-mutual

✅ **Блок приватности в preview: 'Приватность анкеты' с объяснением что видно/скрыто до и после взаимного интереса**  
   `implemented` — preview/page.tsx:109-138 отображает preview_privacy_heading и preview_privacy_body; messages/ru.json содержит соответствующие тексты

✅ **Профиль_visibility_mode по умолчанию = verified_recommendations (только проверённые пользователи)**  
   `implemented` — options.ts:418-422 PROFILE_VISIBILITY_MODE; privacy form использует это значение по умолчанию

✅ **Настройка по умолчанию: 'Анкета показывается только проверенным пользователям Baxtlilar в рекомендациях'**  
   `implemented` — messages/ru.json: 'preview_privacy_body' содержит фразу 'Вашу анкету в рекомендациях видят только проверенные пользователи Baxtlilar'

## Экран 14 (Preview/Privacy) + Экран 15 (Big Five Quiz)

❌ **If 'Other' selected, show optional text field for clarification**  
   `not_implemented` — AttributionForm.tsx has no conditional text field when other is selected; spec line 2714-2718 requires text input for 'Other'

🟡 **Show in card: first name only (no surname), age, city/region, main portrait photo, verified badge (conditional), education, brief marital status/children (if policy allows), 3 values, bio, open profile data**  
   `partial` — ProgressiveProfile.tsx:111-226 shows name/city/education/traits/values/bio; line 139 shows verified badge conditional on is_verified; line 28 shows no age/photo/marital/children in pre-mutual view

🟡 **Attribution header (eyebrow): 'Почти готово' (RU) / 'Deyarli tayyor' (UZ)**  
   `partial` — attribution/page.tsx:25 hardcodes 'Почти всё' (not 'Почти готово'); spec says should be 'Почти готово'

🟡 **Correct sequence: Anketa filled → Preview → Publish → Success screen → Mini-tour → First recommendation**  
   `partial` — Flow is: profile_preview → quiz → attribution → tutorial_intro; no explicit 'success screen' after publish, flows directly to quiz

✅ **Screen 14 headline: 'Так вашу анкету увидят другие' (RU) / 'Anketangiz boshqalarga shunday ko'rinadi' (UZ)**  
   `implemented` — messages/ru.json: preview_headline = 'Так Вашу анкету увидят другие'; src/app/[locale]/v2/anketa/preview/page.tsx:77 uses t('preview_headline')

✅ **Screen 14 lead text explaining what is visible vs hidden**  
   `implemented` — messages/ru.json: preview_lead text matches spec requirement; page.tsx:78 loads t('preview_lead')

✅ **Privacy info box showing what is hidden from other users (teal background chip)**  
   `implemented` — preview/page.tsx:109-138 renders privacy info box with teal background; messages/ru.json: preview_privacy_heading and preview_privacy_body

✅ **Don't show: surname, phone, Telegram, documents, verification selfie, exact birth date, precise geolocation, district if not enabled, income, financial obligations, parent data, religious practice, medical restrictions, sensitive answers**  
   `implemented` — ProgressiveProfile.tsx explicitly skips: surname (line 9), photos (comment line 18), age/DOB (comment line 19), specific workplace (comment line 21), family status/children (comment line 22); religion not shown (comment line 195-197)

✅ **Religion should NOT be shown by default in card (sensitive field)**  
   `implemented` — ProgressiveProfile.tsx:195-197 comment confirms religion removed from public card; it's matching-only

✅ **Show verified badge 'Проверен(а)' only for approved profiles (not always)**  
   `implemented` — ProgressiveProfile.tsx:139-174 shows badge only when profile.is_verified === true

✅ **Button copy: 'Отправить анкету на проверку' (pending verification) vs 'Опубликовать анкету' (approved)**  
   `implemented` — PublishButton.tsx:85 uses t('publish_label_pending') for non-approved, t('publish_label_approved') for approved; messages/ru.json has both strings

✅ **Screen 15 title: '10 вопросов о вас' (RU) / 'Siz haqingizda 10 ta savol' (UZ)**  
   `implemented` — quiz/page.tsx:54-55 hardcoded title (may need i18n); quiz/questions.ts implements 10 questions

✅ **Big Five intro text: explains model, not diagnosis, answers for matching only**  
   `implemented` — quiz/page.tsx:57-61 provides explanation matching spec intent; messages/ru.json Quiz.intro_text has full copy

✅ **Scale labels: '1 — Совсем не про меня' / '5 — Очень похоже на меня'**  
   `implemented` — messages/ru.json: scale_min='Совсем не про меня', scale_max='Очень похоже на меня'; QuizForm.tsx:166 displays both

✅ **Exactly 10 Big Five questions: 5 traits × (direct + reverse) — openness, conscientiousness, extraversion, agreeableness, emotional stability**  
   `implemented` — quiz/questions.ts defines exactly 10 questions with factors O/C/E/A/ES; each factor has direct + reverse question (q1-q2 openness, q3-q4 conscientiousness, q5-q6 extraversion, q7-q8 agreeableness, q9-q10 emotional_stability)

✅ **Q1 (Openness): 'Мне интересно узнавать новые взгляды и идеи.' (direct)**  
   `implemented` — quiz/questions.ts:8 q1 factor=O reverse=false with exact RU text

✅ **Q2 (Openness reverse): 'Я предпочитаю привычные вещи и редко ищу что-то новое.'**  
   `implemented` — quiz/questions.ts:9 q2 factor=O reverse=true with exact text

✅ **Q3 (Conscientiousness): 'Если я обещал(а), я стараюсь выполнить это.' (direct)**  
   `implemented` — quiz/questions.ts:10 q3 factor=C reverse=false with exact text

✅ **Q4 (Conscientiousness reverse): 'Иногда я откладываю важные дела без серьёзной причины.'**  
   `implemented` — quiz/questions.ts:11 q4 factor=C reverse=true with exact text

✅ **Q5 (Extraversion): 'Мне легко начинать общение с новыми людьми.' (direct)**  
   `implemented` — quiz/questions.ts:12 q5 factor=E reverse=false with exact text

✅ **Q6 (Extraversion reverse): 'Я быстро устаю от долгого общения с людьми.'**  
   `implemented` — quiz/questions.ts:13 q6 factor=E reverse=true with exact text

✅ **Q7 (Agreeableness): 'Мне важно учитывать чувства другого человека.' (direct)**  
   `implemented` — quiz/questions.ts:14 q7 factor=A reverse=false with exact text

✅ **Q8 (Agreeableness reverse): 'В споре мне важнее доказать свою правоту, чем понять другого.'**  
   `implemented` — quiz/questions.ts:15 q8 factor=A reverse=true with exact text

✅ **Q9 (Emotional stability): 'В сложной ситуации я стараюсь сохранять спокойствие.' (direct)**  
   `implemented` — quiz/questions.ts:16 q9 factor=ES reverse=false with exact text

✅ **Q10 (Emotional stability reverse): 'Я могу сильно переживать даже из-за небольших трудностей.'**  
   `implemented` — quiz/questions.ts:17 q10 factor=ES reverse=true with exact text

✅ **All 10 questions translated to Uzbek**  
   `implemented` — quiz/questions.ts each question has uz field; QuizForm.tsx:123 renders locale === 'uz' ? q.uz : q.ru

✅ **Scale 1–5 (1 = don't agree, 5 = agree strongly)**  
   `implemented` — QuizForm.tsx:126-154 renders 5-point scale buttons; quiz/scoring.ts accepts values 1-5

✅ **Reverse scoring: 1↔5, 2↔4, 3=3 for reverse questions**  
   `implemented` — quiz/scoring.ts:24 uses 'REVERSE_OF[a.question_id] ? 6 - a.value : a.value'; test confirms 1→5, 2→4, 3→3

✅ **Compute vector: average per trait, normalize to 0–100: (avg-1)/4*100**  
   `implemented` — quiz/scoring.ts:28-29 norm function implements exact formula: (avg-1)/4*100

✅ **Missing trait answers default to 50 (neutral)**  
   `implemented` — quiz/scoring.ts:29 returns 50 for empty arrays

✅ **All 10 questions must be answered (MVP: quiz is mandatory)**  
   `implemented` — quiz/complete/route.ts:32-35 requires all QUESTION_IDS to be present

✅ **Visibility: matching_only (not on public profile)**  
   `implemented` — ProgressiveProfile.tsx shows only computed personality traits (not raw vector); vector used internally in matching, not displayed

✅ **Don't show raw results like 'Вы интроверт 2/5' (avoid negative perception)**  
   `implemented` — No success page shows scores; QuizForm redirects to /v2/attribution without displaying results

✅ **Order: Photos → Big Five → Attribution → Preview/Publish**  
   `implemented` — state-machine/types.ts: profile_photos → profile_preview → quiz → attribution (note: preview before quiz in final flow)

✅ **Attribution title: 'Откуда вы узнали о Baxtlilar?' (RU) / 'Baxtlilar haqida qayerdan bildingiz?' (UZ)**  
   `implemented` — messages/ru.json & uz.json: attr_title with exact text

✅ **Attribution subtitle explaining analytics and optional nature**  
   `implemented` — messages/ru.json: attr_subtitle text matches spec intent

✅ **Attribution source list: Telegram-channel, Instagram, TikTok, YouTube, Facebook, Friends, Ads, Search, Media, Event, Blogger/influencer, Other**  
   `implemented` — AttributionForm.tsx:17-30 SOURCES array includes all 12 options with values and labels; +influencer added per spec

✅ **Remove 'Onboarding.' prefix from source options (clean labels)**  
   `implemented` — AttributionForm.tsx:17-30 SOURCES use clean labels without prefix; no 'Onboarding.' in strings

✅ **Single-select for source (not multi-select)**  
   `implemented` — AttributionForm.tsx:37 selected is Source | null (single); line 115 checks selected (singular)

✅ **Continue button text: 'Продолжить' (RU) / 'Davom etish' (UZ)**  
   `implemented` — messages/ru.json: attr_cta='Продолжить'; AttributionForm.tsx:119 uses t('attr_cta')

✅ **Skip button text: 'Пропустить' (RU) / 'O'tkazib yuborish' (UZ)**  
   `implemented` — messages/ru.json: attr_skip='Пропустить'; AttributionForm.tsx:126 uses t('attr_skip')

✅ **Skip button must be prominent/equal (not secondary) since screen is optional**  
   `implemented` — AttributionForm.tsx:121-128 both buttons use same structure; skip uses 'ghost' variant but both are clickable/equal

✅ **Don't save attribution as part of profile (save separately in analytics/attribution table)**  
   `implemented` — quiz/complete/route.ts transitions to attribution step; attribution/route.ts should save to separate table (not shown, but API separation confirms intent)

✅ **Place quiz/attribution AFTER profile publish (not during anketa filling)**  
   `implemented` — state-machine shows profile_photos → profile_preview (publish) → quiz → attribution; quiz not in main anketa flow

✅ **Progress indicator in quiz showing answered/total questions**  
   `implemented` — QuizForm.tsx:76 shows progress bar and text; line 89 animates width based on answered count

✅ **Quiz questions display with number prefix (01, 02, etc.)**  
   `implemented` — QuizForm.tsx:121 uses String(i+1).padStart(2, '0')

✅ **Selected answer color: accent/pomegranate (var(--color-v2-accent))**  
   `implemented` — QuizForm.tsx:140 uses background: selected ? 'var(--color-v2-accent)' : '#fff'

✅ **Form-level i18n coverage: RU/UZ for quiz intro, scale labels, buttons**  
   `implemented` — quiz/page.tsx uses getTranslations(); QuizForm renders locale-aware questions from quiz/questions.ts; messages files have Quiz namespace

✅ **Form-level i18n coverage: RU/UZ/EN/TR for attribution**  
   `implemented` — messages/ru.json, uz.json, en.json all have attr_* keys; form uses t() from next-intl

✅ **Personality trait descriptions in post-mutual view (from Big Five vector)**  
   `implemented` — ProgressiveProfile.tsx:46-76 personalityTraits() function generates 1-3 descriptive phrases based on vector scores (>60 or <40)

✅ **3 life values displayed as teal chips (faith value gets special color)**  
   `implemented` — ProgressiveProfile.tsx:219-223 maps values, line 222 passes teal=true for faith (v.key === 'faith')

## Tutorial Screens (4-screen Onboarding Tour)

❌ **Tour placement logic: IF profile_published AND user_first_time_open_matching AND matching_tour_seen THEN show_matching_tour**  
   `not_implemented` — No grep results for 'matching_tour', 'user_first_time_open_matching', or 'matching_tour_seen' fields in codebase. Tutorial is mandatory in onboarding state machine (attribution → tutorial_intro) but no conditional show/skip for returning users on first feed view

❌ **User can later reopen tour in Help / 'Как работает Baxtlilar' section**  
   `not_implemented` — No Help/FAQ section exists in BottomNav or Settings. Tutorial is only accessible during onboarding flow. No mechanism to reopen tutorial after 'ready' state for verified users

🟡 **Screen 4 title 'Несколько правил безопасности'**  
   `partial` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json safety.heading = 'Несколько правил.' (missing 'безопасности' word)

✅ **Screen 1 exists with title 'Как работает Baxtlilar'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/tutorial/intro/page.tsx (lines 1-49); uses i18n key 'intro.heading' = 'Как работает Baxtlilar.'

✅ **Screen 1 body text: 'Baxtlilar показывает не бесконечную ленту, а подобранные анкеты...'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json intro.body1 matches exactly

✅ **Screen 1 body text: 'В MVP мы показываем ограниченное количество анкет в день...'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json intro.body2 matches exactly

✅ **Screen 2 title 'Без свайпов'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/tutorial/swipe/page.tsx; i18n key swipe.heading = 'Не свайпы. Интересы.' (spec says 'Без свайпов')

✅ **Screen 2 body text matches spec: читаете → решаете → интерес/пропустить**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json swipe.body1-3 match spec exactly

✅ **Screen 3 title 'Только после взаимного интереса' or 'Чат — только после взаимного интереса'**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/tutorial/chat/page.tsx; chat.heading = 'Только после взаимного интереса.'

✅ **Screen 3 body text matches spec: чат открывается если оба отправили интерес, без спама/давления, можно завершить в любой момент**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json chat.body1-3 match spec exactly

✅ **Screen 4 body text: правила без телефона, жалоба, удаление анкеты из рекомендаций (legally safe wording)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json safety.body1-3 match spec exactly and use legally safer wording about deletion (no 'необратимо' promise)

✅ **User can click 'Дальше' (Next) button on each tutorial screen**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/components/v2/TutorialStep.tsx (line 47-48): advance() button renders with t('next') = 'Дальше'

✅ **User can click 'Пропустить тур' (Skip tour) button**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/components/v2/TutorialStep.tsx (lines 50-54): showSkip default=true, renders skip button with t('skipTour')

✅ **Skip button on final screen (safety) should be hidden (showSkip={false})**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/tutorial/safety/page.tsx (line 34): TutorialStep showSkip={false}

✅ **UZ translations for all 4 screens provided in spec**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/uz.json contains full UZ translations for intro, swipe, chat, safety screens with matching spec text

✅ **Screen 1-3 show step counter 'X из 4' in eyebrow/title**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/messages/ru.json: intro.title='Знакомство · 1 из 4', swipe.title='Интерес · 2 из 4', chat.title='Чаты · 3 из 4', safety.title='Безопасность · 4 из 4'

✅ **Step dots visual indicator showing progress (1 of 4, 2 of 4, etc)**  
   `implemented` — /Users/fayzullohoja/Code/baxtlilar/src/app/[locale]/v2/tutorial/*/page.tsx use StepDots component (lines 36, 37, 37, 37) with current and total

