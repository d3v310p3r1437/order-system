import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/coupon_validation.dart';

/// `apps/api/src/coupons/coupon.controller.ts`-руу хандах цэг —
/// `GET /coupons/validate` (мутациГҮЙ, checkout-ийн ӨМНӨ урьдчилан
/// шалгах зорилготой; бодит "redeem" зөвхөн `POST /orders`-ийн
/// `couponCode`-оор л, checkout дотор атомик хийгдэнэ).
class CouponRepository {
  CouponRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<CouponValidation> validate({
    required String code,
    required String orderAmount,
  }) async {
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/coupons/validate',
        queryParameters: {'code': code, 'orderAmount': orderAmount},
      );
      return CouponValidation.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
