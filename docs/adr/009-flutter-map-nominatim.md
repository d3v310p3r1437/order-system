# ADR 009: Mobile хаяг сонголтод Google Maps биш flutter_map/OSM + Nominatim ашиглах

- Статус: Хүлээн зөвшөөрсөн (MVP — Nominatim public API, ирээдүйд өөрийн
  geocoding container руу шилжиж болно, доорхыг үз).
- Огноо: 2026-08-20
- Холбоотой: `docs/plan.md` §7 модуль #5, #8; §8 (Cart→Checkout→QPay),
  `docs/adr/007-osm-osrm-routing.md` (адил хэв маягаар "provider абстракц +
  public demo/API-ийн хязгаарлалт" бичсэн жишээ), `apps/mobile/lib/features/
  checkout/*`

## Асуудал

Харилцагчийн Flutter апп дээр DELIVERY захиалгын хүргэлтийн хаягийг
сонгоход (1) газрын зургийг харуулах widget, (2) хаягаар хайж координат
олох (geocoding) үйлчилгээ хэрэгтэй. Хамгийн түгээмэл сонголт бол Google
Maps SDK (`google_maps_flutter`) + Google Places/Geocoding API, гэвч
ADR 007-той яг ижил шалтгаанаар энэ MVP-д тохирохгүй гэж дүгнэв.

## Шийдвэр

`docs/adr/007`-ийн backend талд аль хэдийн сонгосон OpenStreetMap
экосистемийг Flutter/mobile талд ч үргэлжлүүлнэ — ижил зарчим, тууштай
байдал (нэг л газарзүйн өгөгдлийн эх сурвалж):

- **Газрын зураг widget**: `flutter_map` (OSM tile, `google_maps_flutter`-ийн
  нээлттэй эх аналог) — API key/тооцооны данс шаардахгүй, `openstreetmap.org`-ийн
  стандарт tile server-ээс шууд зурагт tile татна.
- **Geocoding (хаягаар хайх)**: [Nominatim](https://nominatim.openstreetmap.org/)
  — OSM-ийн албан ёсны, үнэ төлбөргүй, API key шаардахгүй нийтийн
  geocoding API (`GET /search?q=...&format=json`). Debounce-той (300мс,
  каталогийн хайлтын `use-debounced-value` загвартай ижил зарчим) хайлт
  явуулна.
- **Пин чирж координат тааруулах**: `flutter_map`-ийн `MapController`-оор
  газрын зураг дээр төвийн pin-ийг чирэхэд шинэ координатыг шууд уншина —
  Nominatim-аас гадна нэмэлт "reverse geocoding" дуудлага ЗААВАЛ биш (хаягийн
  текст талбарыг хэрэглэгч гараар/хайлтаар аль хэдийн бөглөсөн байдаг).

## Google Maps-тай харьцуулбал (ADR 007-той ижил үндэслэл)

- **Зардал**: Google Maps SDK/Geocoding API мөн л сая дуудлага тутам
  төлбөртэй (Google-ийн албан ёсны үнийн хуудас), тогтмол cloud billing
  account + кредит карт шаардана — ADR 007-д аль хэдийн татгалзсан яг ижил
  "гадаад хамаарал" (docs/plan.md §11) шалтгаан.
- **Тууштай байдал**: backend аль хэдийн OSRM (чиглүүлэлт)-ийг OSM
  өгөгдлөөр ажиллуулж байгаа тул admin-web-ийн `DeliveryRouteMap`
  (Leaflet/OSM) БОЛОН Mobile-ийн хаяг сонголт/захиалга хянах зураг
  (flutter_map/OSM) хоёр талдаа НЭГ Л газарзүйн өгөгдлийн эх сурвалж
  (координатын нэгдсэн систем, зам сүлжээний дата) ашиглана — Google
  Maps-ийн proprietary tile/coordinate-той холилдохгүй.

## Хэрэгжилт

`apps/mobile/lib/features/checkout/`:
- `data/geocoding_repository.dart` — Nominatim-руу шууд (backend дамжуулалгүй,
  `ApiClient`-ийн biznes backend Dio-той ХОЛИЛДОХГҮЙ тусдаа `Dio` instance,
  `User-Agent` header заавал — Nominatim-ийн ашиглалтын нөхцөл (usage policy)
  тодорхой `User-Agent`/`Referer` шаарддаг) HTTP GET хийнэ.
- `presentation/address_screen.dart` — `flutter_map` + хайлтын талбар
  (debounce) + чирж болдог pin + "Баталгаажуулах" товч.
- `presentation/order_tracking_screen.dart` — DELIVERY захиалгад
  `GET /orders/:id/route`-ийн geometry-г (backend-ийн `[lng, lat]`
  дараалал, admin-web-ийн `DeliveryRouteMap`-тай ЯГ ижил хөрвүүлэлт
  шаардлагатай) `Polyline`-аар зурна.

## Одоогийн public Nominatim серверийн хязгаарлалт (мэдэгдэж буй эрсдэл)

- **Fair-use policy, SLA-гүй**: Nominatim-ийн нийтийн (`nominatim.openstreetmap.org`)
  сервер зөвхөн хөнгөн хэрэглээнд зориулагдсан (1 секундэд ≤1 хүсэлт гэсэн
  зөвлөмж, `User-Agent` заавал таниулах) — ADR 007-ийн OSRM demo серверийн
  адил хязгаарлалт, ижил шалтгаанаар зөвшөөрөгдсөн (MVP, доор "Ирээдүйн
  шилжилт").
- **Монголын хаягийн бүрдэл дутуу байж болзошгүй**: OSM community-driven
  тул зарим гудамж/байрны нэр Google-ийн хаягийн мэдээллийн баазтай
  харьцуулбал дутуу байж болзошгүй (ADR 007-ийн "зам сүлжээний дата дутуу"
  эрсдэлтэй ижил төрлийн, тусдаа тэмдэглэсэн хязгаарлалт).
- **Availability баталгаагүй**: `GeocodingRepository` HTTP алдааг catch
  хийж хэрэглэгчид "хайлт амжилтгүй, дахин оролдоно уу" гэсэн тодорхой
  UI төлөв (алдааны icon + "Дахин оролдох") харуулна, гэхдээ retry/circuit
  breaker механизм ЭНЭ MVP-д зохиогоогүй (OsrmRoutingProvider-тэй ижил
  зарчим).

## Ирээдүйд шийдвэрлэх зүйлс

- Хэрэглээ нэмэгдэхэд (ADR 007-ийн "Production ачаалал нэмэгдвэл" адил)
  өөрийн Nominatim/Photon container (эсвэл Mongolia-specific geocoding
  индекс) руу шилжих ажлыг backlog-т тэмдэглэнэ — `GeocodingRepository`-ийн
  interface (`search(query) → List<GeocodeResult>`) ӨӨРЧЛӨГДӨХГҮЙ, зөвхөн
  base URL солигдоно (QPay/OSRM-ийн "sandbox→production" шилжилттэй адил
  хэв маяг).
- Reverse geocoding (координатаас хаягийн текст рүү, жиш: pin чирэхэд
  хаягийн текстийг автоматаар шинэчлэх) энэ MVP-д ОРООГҮЙ — хэрэглэгч
  хаягийн текстийг гараар (эсвэл forward-geocoding хайлтаар) бөглөнө.
