import { OsrmRoutingProvider } from './osrm-routing.provider.js';

// docs/adr/007-osm-osrm-routing.md: бодит router.project-osrm.org рүү
// хэзээ ч хандахгүй, зөвхөн HTTP давхаргыг (global fetch) mock хийж URL
// бүтэц/хариу задлах логикийг л шалгана (qpay.provider.spec.ts-тэй адил).
function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  global.fetch = fetchMock;
  return fetchMock;
}

describe('OsrmRoutingProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('зөв URL (lng,lat дараалал, geometries=geojson) бүрдүүлж дуудна', async () => {
    const fetchMock = mockFetchOnce(200, {
      code: 'Ok',
      routes: [
        {
          distance: 5230.4,
          duration: 612.1,
          geometry: {
            coordinates: [
              [106.917, 47.918],
              [106.93, 47.925],
            ],
          },
        },
      ],
    });

    const provider = new OsrmRoutingProvider();
    const result = await provider.getRoute(
      { lat: 47.918, lng: 106.917 },
      { lat: 47.925, lng: 106.93 },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/route/v1/driving/106.917,47.918;106.93,47.925?overview=full&geometries=geojson',
      ),
    );
    expect(result).toEqual({
      distanceMeters: 5230.4,
      durationSeconds: 612.1,
      geometry: [
        [106.917, 47.918],
        [106.93, 47.925],
      ],
    });
  });

  it('code !== "Ok" бол алдаа шиднэ', async () => {
    mockFetchOnce(200, { code: 'NoRoute', routes: [] });
    const provider = new OsrmRoutingProvider();
    await expect(
      provider.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }),
    ).rejects.toThrow(/OSRM зам олдсонгүй/);
  });

  it('HTTP статус амжилтгүй бол алдаа шиднэ', async () => {
    mockFetchOnce(503, {});
    const provider = new OsrmRoutingProvider();
    await expect(
      provider.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }),
    ).rejects.toThrow(/HTTP 503/);
  });
});
