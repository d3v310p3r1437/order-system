// docs/plan.md §8 Phase 4, Хэсэг A: салбараас хүргэлтийн цэг хүртэлх
// чиглэл/зайг тооцох provider-ийн абстракц. PaymentProvider-тэй (§8 Phase
// 3b) ЯГ ИЖИЛ загвар — MockRoutingProvider (CI/тестэд, бодит сүлжээ рүү
// хэзээ ч хандахгүй) БОЛОН OsrmRoutingProvider (router.project-osrm.org
// public demo) хоёулаа энэ interface-ийг хэрэгжүүлж, `ROUTING_PROVIDER`
// DI token-оор сольж залгах боломжтой (RoutingModule, env
// `ROUTING_PROVIDER=mock|osrm`).
//
// ⚠️ `geometry`-ийн координатын дараалал `[lng, lat]` (OSRM/GeoJSON-ийн
// стандарт `geometries=geojson` буцаадаг хэлбэртэй ЯГ ижил) — GPS-ийн
// уламжлалт "хойд өргөрөг эхэлж" ([lat, lng]) БИШ. admin-web-ийн Leaflet
// `Polyline` бол эсрэгээрээ [lat, lng] хүлээдэг тул зурахдаа заавал
// хөрвүүлэх ёстой (`DeliveryRouteMap.tsx`-ийн тайлбарыг үз).
export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][];
}

export interface RoutingProvider {
  getRoute(from: RoutePoint, to: RoutePoint): Promise<RouteResult>;
}

// NestJS custom provider token (interface-ийг runtime-д DI token болгож
// ашиглах боломжгүй тул string token хэрэгтэй) — payment-provider.interface.ts-тэй адил.
export const ROUTING_PROVIDER = 'ROUTING_PROVIDER';
