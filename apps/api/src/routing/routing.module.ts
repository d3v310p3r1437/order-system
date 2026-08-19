import { Module } from '@nestjs/common';
import { MockRoutingProvider } from './mock-routing.provider.js';
import { OsrmRoutingProvider } from './osrm-routing.provider.js';
import { ROUTING_PROVIDER } from './routing-provider.interface.js';

// docs/plan.md §8 Phase 4, Хэсэг A #4: `ROUTING_PROVIDER` env-ээр аль
// provider-ийг DI-д залгахаа сонгоно (анхдагч `mock`) — payment.module.ts-тэй
// ЯГ ижил factory загвар.
@Module({
  providers: [
    MockRoutingProvider,
    OsrmRoutingProvider,
    {
      provide: ROUTING_PROVIDER,
      useFactory: (mock: MockRoutingProvider, osrm: OsrmRoutingProvider) =>
        process.env.ROUTING_PROVIDER === 'osrm' ? osrm : mock,
      inject: [MockRoutingProvider, OsrmRoutingProvider],
    },
  ],
  exports: [ROUTING_PROVIDER],
})
export class RoutingModule {}
