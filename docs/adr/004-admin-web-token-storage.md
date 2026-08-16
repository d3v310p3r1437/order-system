# ADR 004: admin-web access token-ийг зөвхөн in-memory state-д хадгална

- Статус: Хүлээн зөвшөөрсөн
- Огноо: 2026-08-16
- Холбоотой: `docs/plan.md` §6.2, `docs/adr/002-jwt-identity-only-authorization-from-db.md`,
  `apps/admin-web/src/App.tsx`

## Асуудал

`POST /auth/staff/login` (`apps/api/src/auth-staff`) нь Keycloak-ээс
ирсэн access/refresh token хосыг admin-web рүү буцаадаг. Frontend эдгээр
token-ыг хаана хадгалах вэ гэдэг нь аюулгүй байдлын шууд нөлөөтэй
шийдвэр: түгээмэл сонголт `localStorage`/`sessionStorage`, гэхдээ энэ нь
XSS халдлагад маш эмзэг (аливаа тухайн origin дээр ажиллах чадвартай
inject хийгдсэн script `localStorage`-ыг чөлөөтэй уншиж, token-ыг
халдлагачид алсаас илгээж болно).

## Шийдвэр

**Access token-ийг зөвхөн React in-memory state-д хадгална**
(`apps/admin-web/src/App.tsx`-ийн `useState<StaffSession | null>`) —
`localStorage`, `sessionStorage`, эсвэл JS-ээс уншигдах ямар ч
cookie-д ХЭЗЭЭ Ч бичихгүй. Login амжилттай болмогц refresh token-ыг ч
frontend код бүрэн үл тоомсорлож, хаана ч хадгалахгүй (одоогоор session
persist огт хийгддэггүй тул хэрэглэгддэггүй).

**Учир шалтгаан:** `localStorage`/`sessionStorage` бол тухайн origin
дээр ажиллах ямар ч JS (XSS-ийн үр дүнд inject хийгдсэн скрипт орно)
чөлөөтэй уншиж чаддаг бөгөөд, хадгалагдсан утга нь хуудас
хаагдсаны/refresh хийсний дараа ч persist хэвээр байдаг тул халдлагын
"цонх" (window) урт, олзворлох үнэ цэнэ өндөр. In-memory `useState`
утга нь зөвхөн тухайн page load-ийн JS heap-д амьдардаг тул хуудас
шинэчлэгдэх (F5), tab хаагдах үед автоматаар устдаг — persist-гүй тул
халдлагын цонх мэдэгдэхүйц богиносно (гэхдээ **тухайн session идэвхтэй
байх хугацаанд ажиллаж буй XSS-ээс бүрэн хамгаалахгүй** — доорх
хязгаарлалтыг үз).

## Одоогийн хязгаарлалт

- Хуудас шинэчлэгдэх (F5)/шинээр нээгдэх бүрд session бүрэн алдагдана —
  дахин нэвтрэх шаардлагатай (session persist Phase 1-д хийгдээгүй).
- Олон tab/цонх дундаа session синхрончлогдохгүй (tab тус бүр өөрийн
  in-memory state-тэй).
- Идэвхтэй session-ий үед ажиллаж буй XSS халдлага React state-ийг
  (memory dump-аар биш, зүгээр л component-ийн closure/context-оор)
  унших боломжтой хэвээр — in-memory нь "session идэвхтэй үед ямар ч
  script token уншиж чадахгүй" гэсэн үг биш, харин "session-ийн гадна,
  дараагийн ачаалалт хүртэл persist хийгдэхгүй" гэсэн үг.

## Ирээдүйн сайжруулалт (session persist хэрэгцээ гарвал)

Аль загварыг сонгосон ч **access token-ыг frontend JS-ийн уншиж болох
санах ойд (`localStorage`/`sessionStorage`) хэзээ ч бичихгүй** зарчим
хадгалагдана:

1. **Silent refresh:** access token-ыг мөн адил зөвхөн in-memory-д
   хадгалж, апп ачаалах бүрд (эсвэл `expiresIn`-ээс өмнө proactively)
   refresh token ашиглан шинэ access token авна. Refresh token-ыг хаана
   хадгалах нь доорх 2-р загвартай хослуулах эсвэл тусад нь шийдэх
   асуудал.
2. **httpOnly cookie дахь refresh token:** backend
   (`POST /auth/staff/login`, `POST /auth/customer/refresh`-тэй адил)
   refresh token-ыг хариу body-д биш, `Set-Cookie:
   refreshToken=...; HttpOnly; Secure; SameSite=Strict` header-ээр
   буцаана — JS огт унших/хандах боломжгүй, browser өөрөө дараагийн
   refresh хүсэлтэд автоматаар дамжуулна. Илүү аюулгүй (XSS-ээс бүрэн
   хамгаалагдсан refresh token) гэхдээ backend талд CSRF хамгаалалт
   (SameSite давхар, эсвэл CSRF token) нэмэлтээр хэрэгжүүлэх
   шаардлагатай болно.

## Мэдэгдэж буй цаашдын ажил

- Session persist механизм (Phase тодорхойгүй, бүтээгдэхүүний хэрэгцээ
  гарвал шийдэгдэнэ)
- httpOnly cookie загвар сонговол CSRF хамгаалалт заавал зэрэгцэн
  хэрэгжинэ
