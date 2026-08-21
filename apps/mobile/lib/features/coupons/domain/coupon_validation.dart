/// `GET /coupons/validate`-ийн буцаах хариу
/// (`apps/api/src/coupons/coupon.controller.ts`-ийн `validate()`-той тохирно).
/// `discountValue`/`discountAmount` — Prisma Decimal тул backend JSON-д
/// string болж сериалайзлагддаг (`OrderDetail`-ийн `totalAmount`-тай адил
/// зарчим).
class CouponValidation {
  const CouponValidation({
    required this.couponCode,
    required this.discountType,
    required this.discountValue,
    required this.discountAmount,
  });

  factory CouponValidation.fromJson(Map<String, dynamic> json) {
    final coupon = (json['coupon'] as Map).cast<String, dynamic>();
    return CouponValidation(
      couponCode: coupon['code'] as String,
      discountType: coupon['discountType'] as String,
      discountValue: coupon['discountValue'] as String,
      discountAmount: json['discountAmount'] as String,
    );
  }

  final String couponCode;
  final String discountType;
  final String discountValue;
  final String discountAmount;
}
