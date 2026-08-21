import 'package:dio/dio.dart';

import '../domain/geocode_result.dart';

/// `docs/adr/009-flutter-map-nominatim.md`: Nominatim-руу ШУУД (backend
/// дамжуулалгүй) хандана — biznes `ApiClient`-ийн Dio instance-тай
/// ХОЛИЛДОХГҮЙ тусдаа, учир нь Nominatim-д Authorization header
/// шаардлагагүй бөгөөд өөр base URL/timeout зохицуулалттай.
class GeocodingRepository {
  GeocodingRepository({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: 'https://nominatim.openstreetmap.org',
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 10),
              // Nominatim-ийн ашиглалтын нөхцөл (usage policy) тодорхой
              // танигдах User-Agent шаардана — үгүй бол хүсэлт блоклогдож
              // болзошгүй.
              headers: {'User-Agent': 'order-system-mobile-app'},
            ),
          );

  final Dio _dio;

  Future<List<GeocodeResult>> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      return [];
    }
    final response = await _dio.get<List<dynamic>>(
      '/search',
      queryParameters: {'q': trimmed, 'format': 'json', 'limit': 5},
    );
    return response.data!
        .cast<Map<String, dynamic>>()
        .map(GeocodeResult.fromJson)
        .toList();
  }
}
