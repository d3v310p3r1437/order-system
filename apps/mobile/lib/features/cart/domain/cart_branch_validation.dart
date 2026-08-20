import '../../catalog/domain/availability.dart';

AvailabilityStatus _parseStatus(String raw) {
  switch (raw) {
    case 'IN_STOCK':
      return AvailabilityStatus.inStock;
    case 'PRE_ORDER':
      return AvailabilityStatus.preOrder;
    case 'OUT_OF_STOCK':
    default:
      return AvailabilityStatus.outOfStock;
  }
}

/// `apps/api/src/cart/cart.service.ts`-ийн `CartBranchValidationLine` —
/// `POST /cart/validate-branch`-ийн нэг мөр. `status`/`leadDays` нь
/// backend-ийн `computeAvailabilityStatus()`-ийн шийдвэр (ADR 005-ийн
/// "ганц газар л шийднэ" зарчим), энд дахин тооцоолохгүй.
class CartValidationLine {
  const CartValidationLine({
    required this.variantId,
    required this.quantity,
    required this.available,
    required this.status,
    this.productName,
    this.effectivePrice,
    this.leadDays,
  });

  factory CartValidationLine.fromJson(Map<String, dynamic> json) {
    return CartValidationLine(
      variantId: json['variantId'] as String,
      quantity: json['quantity'] as int,
      productName: json['productName'] as String?,
      available: json['available'] as bool,
      status: _parseStatus(json['status'] as String),
      effectivePrice: json['effectivePrice'] as String?,
      leadDays: json['leadDays'] as int?,
    );
  }

  final String variantId;
  final int quantity;
  final String? productName;
  final bool available;
  final AvailabilityStatus status;
  final String? effectivePrice;
  final int? leadDays;
}

class CartBranchValidation {
  const CartBranchValidation({
    required this.items,
    required this.totalAmount,
  });

  factory CartBranchValidation.fromJson(Map<String, dynamic> json) {
    return CartBranchValidation(
      items: (json['items'] as List<dynamic>)
          .map(
            (item) =>
                CartValidationLine.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      totalAmount: json['totalAmount'] as String,
    );
  }

  final List<CartValidationLine> items;
  final String totalAmount;

  int get availableCount => items.where((item) => item.available).length;
}
