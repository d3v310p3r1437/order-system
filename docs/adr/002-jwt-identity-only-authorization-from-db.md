# ADR 002: JWT зөвхөн identity нотолно, role/branch DB-ээс уншина

- Статус: Хүлээн зөвшөөрсөн
- Огноо: 2026-08-15
- Холбоотой: `docs/plan.md` §6.1 (RBAC матриц), §6.2 (нэвтрэлтийн архитектур),
  `docs/adr/001-rls-transaction-pattern.md`

## Асуудал

Хоёр тусдаа auth зам (custom customer-auth, Keycloak staff-auth) байгаа
тул JWT claim бүтэц нэгдмэл байх ёстой (§6.2). Түгээмэл хандлага бол
`role`, `branch_id`-г JWT дотор шууд claim болгож оруулах явдал — ингэвэл
authorization шалгалт хурдан (DB рүү нэмэлт хандалт хэрэггүй) болно.

Гэхдээ бидний тохиолдолд:
- Ажилтны эрх (role, аль салбарт харьяалагдах) нь `user_branch_roles`
  хүснэгтэд байрлаж, **олон мөр** байж болно (нэг хэрэглэгч олон салбарт
  өөр өөр role-той байж болно — §6.1 матриц).
- Эрх өөрчлөгдөх давтамж (админ шинэ салбар нэмэх, role хасах/нэмэх)
  нь access token-ийн 15 минутын хугацаанаас богино байж болзошгүй.
- Keycloak талд role/branch-ыг **custom claim mapper**-ээр DB-тэй sync
  хийх шаардлагатай болно (жиш: Keycloak realm role эсвэл group-ыг манай
  `user_branch_roles`-тай tacах, эсвэл Keycloak дотроо тусад нь
  duplicate хадгалах). Энэ нь **2 дахь эх сурвалж (source of truth)**
  үүсгэж, sync алдаа/хоцролт (жиш: DB-д role хассан ч Keycloak token
  дотор хуучин role хэвээр байх) — chsun аюулгүй байдлын том эрсдэл.

## Шийдвэр

**JWT (аль ч эх үүсвэрээс ирсэн ч) зөвхөн "identity"-г нотолно, role/branch
огт агуулахгүй:**

| Эх сурвалж | Claim |
|---|---|
| Custom (харилцагч) | `{ sub: <users.id>, iss: 'order-system-customer-auth', exp }` (HS256) |
| Keycloak (ажилтан) | Стандарт Keycloak claim-ууд + **нэг** custom mapper: `local_user_id` (= `users.id`) (RS256, JWKS) |

`TokenVerifierService.verify(rawToken)` нэг ижил interface-аар аль ч
эх үүсвэрийг баталгаажуулж, зөвхөн `{ localUserId }` буцаана.

**Role/branch-ыг ХЭЗЭЭ Ч JWT-ээс уншихгүй** — үргэлж `user_branch_roles`
хүснэгтээс (RLS-ээр аль хэдийн хамгаалагдсан) асууна:

```ts
// GET /auth/me — жишээ
const ubrRows = await tx.userBranchRole.findMany({ where: { userId } });
```

`ubr_select` RLS policy (`docs/adr/001-...`) аль хэдийн
`"userId" = app_current_user_id()` нөхцөлөөр өөрийнхөө мөрийг унших
эрхийг олгодог тул **нэмэлт RBAC guard шаардахгүйгээр** л ажиллана.

### Ганц эх сурвалж (single source of truth)

- Keycloak: зөвхөн **identity** (нэвтрэх, нууц үг) хариуцна.
- `user_branch_roles`: зөвхөн **authorization** (ямар role, аль салбарт)
  хариуцна.
- Хоёрын хооронд sync хийх claim mapper, cron, event listener огт
  хэрэггүй болно — role өөрчлөгдмөгц (DB транзакц) дараагийн хүсэлт
  бүрт шууд шинэ эрхээр ажиллана (JWT дахин авах хүлээх шаардлагагүй,
  учир нь JWT-д role анхнаасаа байгаагүй).

### Trade-off

- **Нэмэлт DB round-trip:** эрх шалгах `RolesGuard` (Phase 1-ийн
  дараагийн ажил) бүрт `user_branch_roles`-аас унших шаардлагатай.
  Учир нь request бүр аль хэдийн нэг interactive transaction дотор
  явагддаг (ADR 001), энэ нь **нэмэлт connection биш**, зөвхөн нэмэлт
  query — өртөг бага.
- **Self-registration / anonymous lookup RLS-тэй мөргөлдөх тохиолдол:**
  харилцагчийн бүртгэл/нэвтрэлт нь "хэн бэ" гэдгийг мэдэхээс өмнө DB-ээс
  асуух ёстой тул RLS-ийн "зөвхөн өөрийгөө уншина" policy-той шууд
  зөрчилддөг. Үүнийг **бүх талын read/write-ыг чөлөөлөх биш**, зөвхөн
  тухайн нэг functional need-д зориулсан **нарийн хүрээтэй SECURITY
  DEFINER функц** (`app_find_customer_id_by_phone` — зөвхөн `id`-г
  буцаадаг, `passwordHash` огт дэлгэдэггүй) болон "trusted context
  self-signup" (шинэ хэрэглэгч өөрийн шинэ id-г урьдчилан "би" гэж
  тохируулаад л insert хийх) хосолсон загвараар шийдсэн. Дэлгэрэнгүй:
  `src/auth-customer/auth-customer.service.ts` коммент, migration
  `add_customer_phone_lookup_function`.
- **Client талд role харах бол `/auth/me` дуудах шаардлагатай** (JWT-г
  decode хийгээд шууд role харах боломжгүй) — frontend/mobile апп
  нэвтэрсний дараа энэ endpoint-ыг дуудаж кэшлэх ёстой (state
  management-ийн хариуцлага, backend биш).

## Мэдэгдэж буй цаашдын ажил

- `RolesGuard`/`@Roles()` decorator (§6.1 матрицыг код болгох) — Phase 1
  дараагийн sprint.
- Refresh token-ийн revocation/rotation store одоогоор байхгүй (stateless
  JWT, зөвхөн `typ: 'refresh'` + 30 хоногийн exp) — жинхэнэ
  бүтээгдэхүүний шаардлага гарвал Redis эсвэл DB-д хадгалж revoke хийх
  боломжтой болгоно (энэ бол зөвхөн Phase 1 spike-ийн хамрах хүрээнээс
  гадуурх бүтээгдэхүүний шийдвэр тул энд шийдээгүй болгож үлдээв).
