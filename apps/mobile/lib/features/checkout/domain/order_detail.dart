/// `apps/api/src/orders/order.service.ts`-ийн `OrderItem` — эцсийн (захиалга
/// үүсэх мөчийн) үнийн snapshot, ХЭЗЭЭ Ч дараа нь өөрчлөгдөхгүй.
class OrderItemLine {
  const OrderItemLine({
    required this.variantId,
    required this.quantity,
    required this.unitPriceSnapshot,
  });

  factory OrderItemLine.fromJson(Map<String, dynamic> json) {
    return OrderItemLine(
      variantId: json['variantId'] as String,
      quantity: json['quantity'] as int,
      unitPriceSnapshot: json['unitPriceSnapshot'] as String,
    );
  }

  final String variantId;
  final int quantity;
  final String unitPriceSnapshot;
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
    this.deliveryAddress,
    this.deliveryLatitude,
    this.deliveryLongitude,
    this.paidAt,
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
      deliveryAddress: json['deliveryAddress'] as String?,
      deliveryLatitude: (json['deliveryLatitude'] as num?)?.toDouble(),
      deliveryLongitude: (json['deliveryLongitude'] as num?)?.toDouble(),
      paidAt: json['paidAt'] as String?,
    );
  }

  final String id;
  final String status;
  final String totalAmount;
  final String branchId;
  final List<OrderItemLine> items;
  final String deliveryMethod;
  final String? deliveryAddress;
  final double? deliveryLatitude;
  final double? deliveryLongitude;
  final String? paidAt;

  bool get isDelivery => deliveryMethod == 'DELIVERY';
}
