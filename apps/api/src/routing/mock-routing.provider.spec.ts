import { MockRoutingProvider } from './mock-routing.provider.js';
import { haversineDistanceMeters } from './haversine.util.js';

describe('MockRoutingProvider', () => {
  const provider = new MockRoutingProvider();
  const from = { lat: 47.918, lng: 106.917 };
  const to = { lat: 47.925, lng: 106.93 };

  it('Haversine зайг ашиглаж distanceMeters тооцно', async () => {
    const result = await provider.getRoute(from, to);
    expect(result.distanceMeters).toBeCloseTo(
      haversineDistanceMeters(from, to),
      6,
    );
  });

  it('дундаж 30км/ц хурдаар durationSeconds тооцно', async () => {
    const result = await provider.getRoute(from, to);
    const expectedSeconds = result.distanceMeters / ((30 * 1000) / 3600);
    expect(result.durationSeconds).toBeCloseTo(expectedSeconds, 6);
  });

  it('geometry нь [lng, lat] дараалалтай 2 цэгээс бүрдсэн шулуун', async () => {
    const result = await provider.getRoute(from, to);
    expect(result.geometry).toEqual([
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]);
  });
});
