import { Injectable, Logger } from '@nestjs/common';
import type {
  RoutePoint,
  RouteResult,
  RoutingProvider,
} from './routing-provider.interface.js';

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
}

interface OsrmRouteResponse {
  code: string;
  routes?: OsrmRoute[];
}

// docs/plan.md §8 Phase 4, Хэсэг A #4, docs/adr/007-osm-osrm-routing.md:
// router.project-osrm.org-ийн НИЙТИЙН demo сервер рүү хандана — credential
// шаардахгүй, ГЭХДЭЭ fair-use хязгаарлалттай тул зөвхөн unit тестээр
// (HTTP mock, `qpay.provider.spec.ts`-ийн `global.fetch` mock хэв маягийг
// дахин ашигласан) шалгагдсан, e2e/CI-д хэзээ ч бодит сүлжээ рүү хандахгүй
// (`ROUTING_PROVIDER=mock` анхдагч).
@Injectable()
export class OsrmRoutingProvider implements RoutingProvider {
  private readonly logger = new Logger(OsrmRoutingProvider.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org';
  }

  async getRoute(from: RoutePoint, to: RoutePoint): Promise<RouteResult> {
    const url =
      `${this.baseUrl}/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OSRM route дуудлага амжилтгүй: HTTP ${res.status}`);
    }
    const body = (await res.json()) as OsrmRouteResponse;
    const route = body.routes?.[0];
    if (body.code !== 'Ok' || !route) {
      throw new Error(`OSRM зам олдсонгүй (code=${body.code ?? 'UNKNOWN'})`);
    }

    this.logger.debug(
      `OSRM route: ${route.distance}м, ${route.duration}с (public demo server — fair-use хязгаарлалттай)`,
    );

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry.coordinates,
    };
  }
}
