import type { RoutePoint } from './routing-provider.interface.js';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Хоёр GPS координатын (шулуун шугамын, "as the crow flies") зайг
// Haversine томъёогоор тооцно — MockRoutingProvider-ийн цорын ганц зорилго
// бодит сүлжээ рүү хандалгүй ойролцоо зай гаргах тул энэ хангалттай нарийвчлалтай.
export function haversineDistanceMeters(
  from: RoutePoint,
  to: RoutePoint,
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}
