import { Injectable } from '@nestjs/common';
import { haversineDistanceMeters } from './haversine.util.js';
import type {
  RoutePoint,
  RouteResult,
  RoutingProvider,
} from './routing-provider.interface.js';

// Хотын дундаж хурд (км/ц) — бодит замын муруйлт/түгжрэл тооцоогүй,
// зөвхөн ойролцоо ETA гаргах зорилготой (CI/тестэд, бодит сүлжээ рүү
// хэзээ ч хандахгүй).
const ASSUMED_SPEED_METERS_PER_SECOND = (30 * 1000) / 3600;

// docs/plan.md §8 Phase 4, Хэсэг A #3: шулуун шугамын (straight-line) зайг
// Haversine томъёогоор тооцож, geometry-г 2 цэгээс бүрдсэн энгийн шулуун
// болгож буцаадаг — QPay/mock-payment.provider.ts-тэй адил dev/тестэд
// зориулсан, credential/сүлжээ шаардахгүй provider.
@Injectable()
export class MockRoutingProvider implements RoutingProvider {
  getRoute(from: RoutePoint, to: RoutePoint): Promise<RouteResult> {
    const distanceMeters = haversineDistanceMeters(from, to);
    const durationSeconds = distanceMeters / ASSUMED_SPEED_METERS_PER_SECOND;

    return Promise.resolve({
      distanceMeters,
      durationSeconds,
      // routing-provider.interface.ts-ийн тайлбарын дагуу [lng, lat] дараалалтай.
      geometry: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    });
  }
}
