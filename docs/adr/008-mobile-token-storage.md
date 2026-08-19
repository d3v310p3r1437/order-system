# ADR 008: Mobile апп access/refresh token-ыг OS Keychain/Keystore-д хадгална

- Статус: Хүлээн зөвшөөрсөн
- Огноо: 2026-08-19
- Холбоотой: `docs/plan.md` §6.2, `docs/adr/004-admin-web-token-storage.md`,
  `apps/mobile/lib/core/storage/secure_token_storage.dart`

## Асуудал

`POST /auth/customer/login`/`register` (`apps/api/src/auth-customer`) нь
access/refresh JWT хос буцаадаг. `docs/adr/004`-д admin-web (browser,
React) талд эдгээрийг зөвхөн in-memory state-д хадгалахаар шийдсэн байсан
— учир нь `localStorage`/`sessionStorage` бол тухайн origin дээр ажиллах
ямар ч XSS-ээр inject хийгдсэн script чөлөөтэй уншдаг. Mobile апп мөн
адил асуултын өмнө зогсож байна: token-ыг хаана хадгалах вэ?

## Шийдвэр

**Flutter апп дээр access/refresh token-ыг `flutter_secure_storage`-аар
(`lib/core/storage/secure_token_storage.dart`) OS-ийн Keychain (iOS)/
Keystore-аар нөөцлөгдсөн EncryptedSharedPreferences (Android)-д
хадгална** — admin-web-ийн in-memory-гээс ЗОРИУДАА ЯЛГААТАЙ шийдвэр.

## Яагаад admin-web-ээс өөр (ADR 004-ийн эсрэг биш, өөр аюулын загвар)

ADR 004-ийн "in-memory" шийдвэр нь browser-ийн XSS аюулын загварт
зориулагдсан: **browser** дээр ямар ч origin-same script (inject хийгдсэн
эсэхээс үл хамааран) `localStorage`-ыг чөлөөтэй уншдаг тул persist
хийгдэх ямар ч хадгалалт халдлагад өртөмтгий, харин session persist-ийн
ашиг тус (дахин нэвтрэх шаардлагагүй) харьцангуй бага (F5 ховор,
tab дахин нээхэд л дахин нэвтрэх шаардлагатай).

Mobile апп дээр энэ тэнцвэр бүрмөсөн өөрчлөгддөг:

1. **Аюулын загвар өөр.** Flutter native апп нь browser-ийн "аль ч
   origin-same script token уншина" гэсэн XSS threat model-д ОГТ
   өртдөггүй (веб хуудасны script inject хийх зам байхгүй). iOS
   Keychain/Android Keystore нь OS-ийн sandbox-аар тухайн апп-ийн
   package/bundle ID-д онцгойлон түгжигдсэн — өөр апп (root/jailbreak-гүй
   энгийн төхөөрөмж дээр) ЭНЭ хадгалалтыг уншиж чадахгүй.
2. **In-memory-ийн ашиг тус mobile дээр байхгүй, зардал их.** Mobile апп
   хэрэглэгч дэлгэц унтраах, апп background руу орох, OS санах ой
   чөлөөлөх (kill) зэрэгт байнга өртдөг тул in-memory session хадгалбал
   хэрэглэгч апп нээх бүрдээ (хамгийн энгийн "дэлгэц унтарсан" тохиолдолд
   ч) дахин нэвтрэх шаардлагатай болно — mobile UX-д энэ хүлээн
   зөвшөөрөгдөхгүй муу дадлага (browser tab-аас ялгаатай, апп
   "хэвийн ажилладаг" гэдэг хүлээлт өндөр).
3. **OS-ийн зориулалттай механизм байдаг.** Browser-т XSS-ээс бүрэн
   хамгаалагдсан "persist боловч JS-ээс уншигдахгүй" хадгалалт байхгүй
   (ADR 004-ийн "Ирээдүйн сайжруулалт"-д зөвхөн httpOnly cookie гэсэн
   backend-ийн дэмжлэг шаардсан шийдэл л байдаг), харин mobile OS
   (iOS/Android) яг ЭНЭ зорилгоор зохион бүтээсэн encrypted, sandbox-аар
   хамгаалагдсан хадгалалтын API-тай (Keychain/Keystore) — үүнийг
   ашиглахгүй байх шалтгаангүй.

## Хязгаарлалт

- Root/jailbreak хийсэн төхөөрөмж дээр Keychain/Keystore-ийн
  хамгаалалтын баталгаа сулардаг (OS sandbox-аа өөрөө эвдэрсэн тул) —
  энэ бол платформын ерөнхий хязгаарлалт, апп-аас засах боломжгүй.
- `SecureTokenStorage`-ыг зөвхөн `ApiClient`-ийн (`lib/core/network/
  api_client.dart`) `Authorization` header болон 401→logout урсгалд
  ашиглана — токены агуулгыг (JWT `sub`/`exp`) UI логикт decode хийж
  ашиглах шаардлагагүй (backend-ийн ADR 002-той адил "JWT зөвхөн
  identity нотлоно" зарчим клиент талд ч баримтлагдана).
