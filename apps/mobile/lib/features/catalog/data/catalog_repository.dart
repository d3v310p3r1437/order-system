import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/category.dart';
import '../domain/product.dart';
import '../domain/search_facets.dart';

/// `apps/api/src/catalog/{category,product,search}`-руу хандах цэг —
/// @Roles()-гүй (зөвхөн нэвтэрсэн байхыг шаарддаг) endpoint-ууд тул
/// CUSTOMER эрхээр шууд дуудаж болно.
class CatalogRepository {
  CatalogRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<Category>> getCategories() async {
    try {
      final response = await _apiClient.dio.get<List<dynamic>>('/categories');
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(Category.fromJson)
          .toList();
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  /// `q`/`categoryId` хоёулаа хоосон бол backend Meilisearch-руу хоосон
  /// query илгээж, идэвхтэй бүтээгдэхүүн бүрийг буцаана (нүүр каталогийн
  /// анхны жагсаалт). (2026-09-05) Хариу `{products, facets}` болж
  /// өргөтгөв — facets.colors/sizes-ийг chip шүүлтүүрийг динамикаар
  /// үүсгэхэд ашиглана (§7 модуль #3-ийн UX сайжруулалт).
  Future<CatalogSearchResult> search({
    String? q,
    String? categoryId,
    String? color,
    String? size,
  }) async {
    final queryParameters = <String, dynamic>{};
    if (q != null && q.isNotEmpty) {
      queryParameters['q'] = q;
    }
    if (categoryId != null) {
      queryParameters['categoryId'] = categoryId;
    }
    if (color != null) {
      queryParameters['color'] = color;
    }
    if (size != null) {
      queryParameters['size'] = size;
    }
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/catalog/search',
        queryParameters: queryParameters,
      );
      final body = response.data!;
      final products = (body['products'] as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(Product.fromJson)
          .toList();
      final facets = SearchFacets.fromJson(
        body['facets'] as Map<String, dynamic>,
      );
      return CatalogSearchResult(products: products, facets: facets);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<Product> getProduct(String id) async {
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/products/$id',
      );
      return Product.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
