/// `apps/api/src/routing/routing-provider.interface.ts`-ийн `RouteResult` —
/// `GET /orders/:id/route`-ийн хариу. ⚠️ `geometry` нь backend-ийн
/// тайлбарын дагуу **[lng, lat]** дараалалтай (GeoJSON/OSRM стандарт) —
/// `flutter_map`-ийн `LatLng` ([lat, lng])-тэй ЯЛГААТАЙ тул зурахдаа ЗААВАЛ
/// эргүүлж хөрвүүлнэ (`admin-web`-ийн `DeliveryRouteMap.tsx`-ийн
/// `toLeafletLatLngs()`-тэй ижил зарчим).
class OrderRoute {
  const OrderRoute({
    required this.distanceMeters,
    required this.durationSeconds,
    required this.geometry,
  });

  factory OrderRoute.fromJson(Map<String, dynamic> json) {
    return OrderRoute(
      distanceMeters: (json['distanceMeters'] as num).toDouble(),
      durationSeconds: (json['durationSeconds'] as num).toDouble(),
      geometry: (json['geometry'] as List<dynamic>)
          .map(
            (point) => (point as List<dynamic>)
                .map((value) => (value as num).toDouble())
                .toList(),
          )
          .toList(),
    );
  }

  final double distanceMeters;
  final double durationSeconds;
  final List<List<double>> geometry;
}
