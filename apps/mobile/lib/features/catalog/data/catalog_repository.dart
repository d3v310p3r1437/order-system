import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/category.dart';
import '../domain/product.dart';

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
  /// анхны жагсаалт).
  Future<List<Product>> search({String? q, String? categoryId}) async {
    final queryParameters = <String, dynamic>{};
    if (q != null && q.isNotEmpty) {
      queryParameters['q'] = q;
    }
    if (categoryId != null) {
      queryParameters['categoryId'] = categoryId;
    }
    try {
      final response = await _apiClient.dio.get<List<dynamic>>(
        '/catalog/search',
        queryParameters: queryParameters,
      );
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(Product.fromJson)
          .toList();
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
