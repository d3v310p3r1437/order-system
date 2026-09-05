import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/branding_info.dart';

/// `GET /settings/branding` — @Roles()-гүй, RolesGuard ч ОГТ ороогүй
/// (нэвтрэлтгүй нээлттэй) endpoint тул CatalogRepository-с ЯЛГААТАЙ,
/// token байхгүй үед ч (ApiClient interceptor Authorization header-ийг
/// зүгээр л алгасна) хэвийн ажиллана.
class BrandingRepository {
  BrandingRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<BrandingInfo> getBranding() async {
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/settings/branding',
      );
      return BrandingInfo.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
