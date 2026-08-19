import { haversineDistanceMeters } from './haversine.util.js';

describe('haversineDistanceMeters', () => {
  it('ижил координатын хувьд 0 буцаана', () => {
    const point = { lat: 47.918, lng: 106.917 }; // Улаанбаатар
    expect(haversineDistanceMeters(point, point)).toBeCloseTo(0, 6);
  });

  it('1 градус өргөргийн ялгаа ≈ 111.19 км (meridian дагуух зай, найдвартай тооцоолж болохуйц)', () => {
    // dLng=0 үед Haversine томъёо яг л R * dLat(radian)-тай тэнцүү болдог
    // (математик хувьд тодорхой) тул нарийн nарийвчлалтай шалгаж болно.
    const from = { lat: 0, lng: 0 };
    const to = { lat: 1, lng: 0 };
    const expectedMeters = 6_371_000 * (Math.PI / 180);
    expect(haversineDistanceMeters(from, to)).toBeCloseTo(expectedMeters, 3);
  });

  it('Улаанбаатараас Дархан хүртэлх зай ~200 км-ийн орчимд байна (бодит газарзүйн лавлагаатай нийцтэй эсэхийг шалгах)', () => {
    const ulaanbaatar = { lat: 47.918, lng: 106.917 };
    const darkhan = { lat: 49.4867, lng: 105.9228 };
    const distanceKm = haversineDistanceMeters(ulaanbaatar, darkhan) / 1000;
    expect(distanceKm).toBeGreaterThan(170);
    expect(distanceKm).toBeLessThan(220);
  });
});
