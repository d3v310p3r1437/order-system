import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/cart_branch_validation.dart';
import '../domain/cart_item.dart';

/// `apps/api/src/cart/cart.controller.ts`-руу хандах цэг — @Roles('CUSTOMER')
/// эндпойнтууд тул зөвхөн CUSTOMER эрхээр дуудна, userId серверт JWT-ээс
/// уншигдана (энд дамжуулдаггүй).
class CartRepository {
  CartRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<CartItem>> getCart() async {
    try {
      final response = await _apiClient.dio.get<List<dynamic>>('/cart');
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(CartItem.fromJson)
          .toList();
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  /// variantId сагсанд байхгүй бол нэмнэ, байвал quantity-г шинэ утгаар
  /// СОЛИНО (delta биш, upsert-set — `dto.quantity`-г дуудагч тал ӨӨРӨӨ
  /// шинэ бодит тоогоор тооцоод дамжуулна).
  Future<List<CartItem>> addOrUpdateItem({
    required String variantId,
    required int quantity,
  }) async {
    try {
      final response = await _apiClient.dio.post<List<dynamic>>(
        '/cart/items',
        data: {'variantId': variantId, 'quantity': quantity},
      );
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(CartItem.fromJson)
          .toList();
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<List<CartItem>> removeItem(String variantId) async {
    try {
      final response = await _apiClient.dio.delete<List<dynamic>>(
        '/cart/items/$variantId',
      );
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(CartItem.fromJson)
          .toList();
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<void> clear() async {
    try {
      await _apiClient.dio.delete<Map<String, dynamic>>('/cart');
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<CartBranchValidation> validateBranch(String branchId) async {
    try {
      final response = await _apiClient.dio.post<Map<String, dynamic>>(
        '/cart/validate-branch',
        data: {'branchId': branchId},
      );
      return CartBranchValidation.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
