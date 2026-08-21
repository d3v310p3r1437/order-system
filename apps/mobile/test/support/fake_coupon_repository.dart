import 'package:mobile/features/coupons/data/coupon_repository.dart';
import 'package:mobile/features/coupons/domain/coupon_validation.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake —
/// `test/support/fake_checkout_repository.dart`-ийн загвартай адил.
class FakeCouponRepository implements CouponRepository {
  CouponValidation? validationResult;
  Object? validationError;

  final List<({String code, String orderAmount})> validateCalls = [];

  @override
  Future<CouponValidation> validate({
    required String code,
    required String orderAmount,
  }) async {
    validateCalls.add((code: code, orderAmount: orderAmount));
    if (validationError != null) {
      throw validationError!;
    }
    return validationResult ??
        CouponValidation(
          couponCode: code,
          discountType: 'FIXED_AMOUNT',
          discountValue: '1000',
          discountAmount: '1000',
        );
  }
}
