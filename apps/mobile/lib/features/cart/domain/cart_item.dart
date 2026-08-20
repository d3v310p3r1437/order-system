import '../../../core/network/api_base_url.dart';

/// `apps/api/src/cart/cart.service.ts`-ийн `CartLineItem` — Redis дэх
/// variantId/quantity-г Postgres-ээс уншсан бүтээгдэхүүний нэр/зураг/
/// `basePrice`-тай нэгтгэсэн `GET/POST/DELETE /cart`-ийн хариу. Устсан/idle
/// variant бол `unavailable: true`, бусад талбар байхгүй (backend алдаа
/// шидэхгүй, зөвхөн тэмдэглэнэ — ADR 005-ийн "ганц газар л шийднэ" зарчим
/// Flutter талд ч мөн хамаарна, энд дахин шийдвэр гаргахгүй).
class CartItem {
  const CartItem({
    required this.variantId,
    required this.quantity,
    required this.unavailable,
    this.productId,
    this.productName,
    this.imageUrl,
    this.sku,
    this.unit,
    this.basePrice,
  });

  factory CartItem.fromJson(Map<String, dynamic> json) {
    final unavailable = json['unavailable'] as bool;
    if (unavailable) {
      return CartItem(
        variantId: json['variantId'] as String,
        quantity: json['quantity'] as int,
        unavailable: true,
      );
    }
    return CartItem(
      variantId: json['variantId'] as String,
      quantity: json['quantity'] as int,
      unavailable: false,
      productId: json['productId'] as String,
      productName: json['productName'] as String,
      imageUrl: json['imageUrl'] != null
          ? resolveMediaUrl(json['imageUrl'] as String)
          : null,
      sku: json['sku'] as String,
      unit: json['unit'] as String,
      basePrice: json['basePrice'] as String,
    );
  }

  final String variantId;
  final int quantity;
  final bool unavailable;
  final String? productId;
  final String? productName;
  final String? imageUrl;
  final String? sku;
  final String? unit;
  final String? basePrice;

  /// CartScreen-ийн товч (placeholder) нийт дүнд ашиглана — `basePrice`-аар
  /// тооцсон ойролцоо дүн, ЭЦСИЙН бодит үнэ (branchPrice override-тэй)
  /// ЗӨВХӨН `/cart/validate-branch`-аас (BranchSelectionScreen) ирнэ.
  double get estimatedLineTotal {
    if (unavailable || basePrice == null) {
      return 0;
    }
    return (double.tryParse(basePrice!) ?? 0) * quantity;
  }
}
