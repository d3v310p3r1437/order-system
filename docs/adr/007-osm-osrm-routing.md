# ADR 007: Хүргэлтийн чиглүүлэлтэд Google Maps биш OpenStreetMap/OSRM ашиглах

- Статус: Хүлээн зөвшөөрсөн (MVP — public OSRM demo server, ирээдүйд
  өөрийн container руу шилжинэ, доорхыг үз).
- Огноо: 2026-08-19
- Холбоотой: `docs/plan.md` §8 Phase 4 (Хэсэг A), `docs/adr/006-qpay-verify-dont-trust.md`
  (адил хэв маягаар "provider абстракц + бодит холболт ирэхэд заавал
  баталгаажуулах зүйлс" бичсэн жишээ), `apps/api/src/routing/*`

## Асуудал

Захиалгын салбараас хүргэлтийн хаяг хүртэлх зам/зай/ETA тооцоолохын
тулд газарзүйн чиглүүлэлтийн (routing) үйлчилгээ хэрэгтэй. Хамгийн
түгээмэл сонголт бол Google Maps Directions API, гэхдээ доорх шалтгаанаар
энэ MVP-д тохирохгүй гэж дүгнэв.

## Судалгаа — зардлын харьцуулалт (эх сурвалж)

- **Google Maps Platform — Routes API/Directions API**: 2026 оны
  байдлаар үнийн загвар нь сая дуудлага тутам төлбөртэй (Essentials/
  Pro/Enterprise түвшин, "Directions" ойролцоогоор $5/1000 хүсэлт орчим,
  сарын $200 үнэгүй эрх багтаамжтай) — тогтмол cloud billing account,
  API key, кредит карт заавал шаардана (`https://mapsplatform.google.com/pricing/`,
  Google-ийн албан ёсны үнийн хуудас). Монголын жижиг/дунд бизнест энэ
  бол шинээр нэмэгдэх сар бүрийн зардал ба гадаад валютын төлбөрийн
  гэрээ — QPay-тэй адил "гадаад хамаарал" (docs/plan.md §11) үүсгэнэ.
- **OpenStreetMap (өгөгдөл) + OSRM (Open Source Routing Machine, зам
  тооцоолол)**: хоёулаа бүрэн нээлттэй эх код/өгөгдөл (ODbL/BSD лиценз),
  үнэ төлбөргүй, API key/бүртгэл шаардахгүй. `router.project-osrm.org`
  нь OSRM төслийн ӨӨРСДИЙН нийтэд зориулсан demo сервер (`http://project-osrm.org/`
  — "Demo server" гэдгийг өөрсдөө тодорхой зарлаж, **энэ бол production
  ачааллын үйлчилгээ БИШ** гэдгийг anхааруулдаг).

## Шийдвэр

`RoutingProvider` абстракц (`docs/plan.md` §8 Phase 4-ийн шууд заавраар,
`PaymentProvider`-тэй ЯГ ижил загвар — `docs/adr/006`) ашиглаж:

- **MVP (одоо)**: `ROUTING_PROVIDER=mock` (анхдагч, dev/CI-д) —
  `MockRoutingProvider` Haversine томъёогоор шулуун шугамын зай тооцоолж,
  бодит сүлжээ рүү огт хандахгүй. `ROUTING_PROVIDER=osrm` идэвхжвэл
  `OsrmRoutingProvider` `router.project-osrm.org`-ийн PUBLIC demo серверт
  хандана — энэ бол зардалгүй, гэрээ/бүртгэл шаардахгүй сонголт.
- **Ирээдүйн шилжилт (production ачаалал нэмэгдэхэд)**: OSRM-ийг
  ӨӨРСДИЙН Docker container-т (`osrm-backend` image) байршуулж,
  Монгол Улсын OSM extract (`https://download.geofabrik.de/asia/mongolia.html`)-ийг
  урьдчилан боловсруулж (`osrm-extract`/`osrm-contract`) ачаална.
  Энэ шилжилт `RoutingProvider` interface-д ЯМАР Ч өөрчлөлт
  ШААРДАХГҮЙ — зөвхөн `OSRM_BASE_URL` env-ийг `router.project-osrm.org`-оос
  өөрийн container-ийн хаяг руу солино (QPay-ийн "sandbox→production
  credential солих" шилжилттэй адил хэв маяг).

## Одоогийн public demo server-ийн хязгаарлалт (мэдэгдэж буй эрсдэл)

- **Fair-use, SLA-гүй**: OSRM төслийн demo сервер эрхэм зорилгоороо
  туршилт/жижиг хэрэглээнд зориулагдсан, том хэмжээний production
  ачааллыг тэсвэрлэхээр төлөвлөгдөөгүй (өөрсдийн баримт бичигт тодорхой
  зарлагдсан). Онц олон хэрэглэгчтэй болсон тохиолдолд саатал/rate-limit
  тохиолдож болзошгүй.
- **Зөвхөн `driving` профайл баталгаатай**: даалгаварт заасны дагуу
  зөвхөн `/route/v1/driving/...` ашигласан.
- **Availability баталгаагүй**: манай backend-ийн `OsrmRoutingProvider`
  HTTP статус/`code !== 'Ok'`-г алдаа болгож шидэх боловч (`osrm-routing.provider.ts`)
  demo сервер бүрэн боломжгүй болсон тохиолдолд GET /orders/:id/route
  500 буцаана — retry/circuit-breaker механизм ЭНЭ MVP-д зохиогоогүй.
- **Монголын зам сүлжээний OSM өгөгдлийн бүрэн бүтэн байдал**: OpenStreetMap
  бол community-driven тул зарим алслагдсан бүс нутгийн зам сүлжээ
  Google Maps-тай харьцуулбал дутуу байж болзошгүй (хот доторх хүргэлтэд
  энэ эрсдэл бага, гэхдээ мэдэгдэж буй хязгаарлалт).

## Хэрэгжилт

`apps/api/src/routing/`:
- `routing-provider.interface.ts` — `RoutingProvider`, `RoutePoint`,
  `RouteResult` (`geometry: [lng, lat][]`, GeoJSON/OSRM-ийн стандарт
  дараалал — admin-web Leaflet render хийхдээ [lat,lng]-рүү хөрвүүлнэ).
- `haversine.util.ts` + `mock-routing.provider.ts` — MVP, credential/сүлжээ
  шаардахгүй.
- `osrm-routing.provider.ts` — public demo, зөвхөн HTTP mock unit тестээр
  шалгагдсан (бодит сүлжээ рүү CI-д хэзээ ч хандахгүй).
- `routing.module.ts` — `ROUTING_PROVIDER` env DI сонголт.

## Ирээдүйд шийдвэрлэх зүйлс

- Production ачаалал нэмэгдвэл (§"Ирээдүйн шилжилт"-ийг үз) өөрийн OSRM
  container руу шилжих ажлыг backlog-т тэмдэглэнэ.
- OSRM-ийн `driving` профайлын хажуугаар явган/дугуйн профайл хэрэгцээ
  гарвал (жиш: явган хүргэгч) нэмж болно — `RoutingProvider` interface
  өөрчлөгдөхгүй, зөвхөн provider дотоод хэрэгжилтэд нэмэлт параметр.
