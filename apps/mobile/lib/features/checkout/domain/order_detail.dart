/// `apps/api/src/orders/order.service.ts`-ийн `OrderItem` — эцсийн (захиалга
/// үүсэх мөчийн) үнийн snapshot, ХЭЗЭЭ Ч дараа нь өөрчлөгдөхгүй.
/// ⚠️ `id` нь `OrderItem.id` (Захиалгын түүх/Буцаалт хүсэх дэлгэцэд
/// `POST /returns`-ийн `orderItemId`-аар шаардагдана — `variantId`-тай
/// БҮҮ андуур). `productName`/`variantName` нь backend-ийн
/// `order.service.ts`-ийн `ORDER_ITEM_VARIANT_INCLUDE`-ээс ирнэ, устсан
/// вариант/бүтээгдэхүүнтэй захиалгад null байж болно.
class OrderItemLine {
  const OrderItemLine({
    required this.id,
    required this.variantId,
    required this.quantity,
    required this.unitPriceSnapshot,
    this.productName,
    this.variantName,
  });

  factory OrderItemLine.fromJson(Map<String, dynamic> json) {
    final variant = json['variant'] as Map<String, dynamic>?;
    final product = variant?['product'] as Map<String, dynamic>?;
    return OrderItemLine(
      id: json['id'] as String,
      variantId: json['variantId'] as String,
      quantity: json['quantity'] as int,
      unitPriceSnapshot: json['unitPriceSnapshot'] as String,
      productName: product?['name'] as String?,
      variantName: variant?['name'] as String?,
    );
  }

  final String id;
  final String variantId;
  final int quantity;
  final String unitPriceSnapshot;
  final String? productName;
  final String? variantName;

  /// "Ariel угаалгын нунтаг 3кг" маягийн харуулах нэр — productName
  /// байхгүй бол (устсан бүтээгдэхүүн) variantId-ийн товч хэлбэрийг
  /// эргэлт буцаана.
  /// ⚠️ Зарим демо/бодит бүтээгдэхүүний `Product.name`-д АЛЬ ХЭДИЙН
  /// хэмжээ/сав баглаа орсон байдаг (жиш: "Кока-Кола 0.5Л"-ийн variant
  /// нэр нь мөн "0.5Л") — ийм үед `variantName`-г шууд залгавал
  /// "Кока-Кола 0.5Л 0.5Л" гэж давхардуулна. Тиймээс `productName`-д
  /// `variantName` АЛЬ ХЭДИЙН орсон эсэхийг (том/жижиг үсэг үл
  /// хамааран) шалгаад, орсон бол дахин залгахгүй.
  String get displayName {
    if (productName == null) {
      return variantId.length > 8 ? variantId.substring(0, 8) : variantId;
    }
    if (variantName == null) {
      return productName!;
    }
    final alreadyIncluded = productName!
        .toLowerCase()
        .contains(variantName!.toLowerCase());
    return alreadyIncluded ? productName! : '$productName $variantName';
  }
}

/// `GET /orders/:id`-ийн хариу — `order-state-machine.ts`-ийн дараалалтай
/// нийцсэн `status`-аар OrderTrackingScreen timeline зурна.
class OrderDetail {
  const OrderDetail({
    required this.id,
    required this.status,
    required this.totalAmount,
    required this.branchId,
    required this.items,
    required this.deliveryMethod,
    required this.createdAt,
    this.deliveryAddress,
    this.deliveryLatitude,
    this.deliveryLongitude,
    this.paidAt,
    this.completedAt,
  });

  factory OrderDetail.fromJson(Map<String, dynamic> json) {
    return OrderDetail(
      id: json['id'] as String,
      status: json['status'] as String,
      totalAmount: json['totalAmount'] as String,
      branchId: json['branchId'] as String,
      items: (json['items'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(OrderItemLine.fromJson)
          .toList(),
      deliveryMethod: json['deliveryMethod'] as String? ?? 'PICKUP',
      createdAt: json['createdAt'] as String,
      deliveryAddress: json['deliveryAddress'] as String?,
      deliveryLatitude: (json['deliveryLatitude'] as num?)?.toDouble(),
      deliveryLongitude: (json['deliveryLongitude'] as num?)?.toDouble(),
      paidAt: json['paidAt'] as String?,
      completedAt: json['completedAt'] as String?,
    );
  }

  final String id;
  final String status;
  final String totalAmount;
  final String branchId;
  final List<OrderItemLine> items;
  final String deliveryMethod;
  final String createdAt;
  final String? deliveryAddress;
  final double? deliveryLatitude;
  final double? deliveryLongitude;
  final String? paidAt;
  final String? completedAt;

  bool get isDelivery => deliveryMethod == 'DELIVERY';

  /// COMPLETED захиалгыг completedAt-аас хойш 7 хоногийн дотор буцаах
  /// боломжтой (backend-ийн `return-refund.util.ts`-ийн
  /// `isWithinReturnWindow()`-той ЯГ ижил RETURN_WINDOW_DAYS=7 — эцсийн
  /// баталгаажуулалт үргэлж серверт, энэ бол зөвхөн UI-ийн товч
  /// харуулах/нуух шийдвэр).
  bool get canRequestReturn {
    if (status != 'COMPLETED' || completedAt == null) {
      return false;
    }
    final elapsed = DateTime.now().difference(DateTime.parse(completedAt!));
    return elapsed <= const Duration(days: 7);
  }
}
