/// `apps/api/src/returns/return-request.controller.ts`-ийн `ReturnRequest`
/// мөр — `GET /returns`/`POST /returns`-ийн хариу. `orderId` нь backend-ийн
/// `ORDER_ITEM_INCLUDE = { orderItem: { include: { order: true } } }`-аас
/// (nested `orderItem.order.id`) гаргаж авсан — flat талбар БИШ.
class ReturnRequestRecord {
  const ReturnRequestRecord({
    required this.id,
    required this.orderItemId,
    required this.orderId,
    required this.status,
    required this.reason,
    required this.requestedAt,
    this.rejectedReason,
  });

  factory ReturnRequestRecord.fromJson(Map<String, dynamic> json) {
    final orderItem = json['orderItem'] as Map<String, dynamic>?;
    final order = orderItem?['order'] as Map<String, dynamic>?;
    return ReturnRequestRecord(
      id: json['id'] as String,
      orderItemId: json['orderItemId'] as String,
      orderId: order?['id'] as String? ?? '',
      status: json['status'] as String,
      reason: json['reason'] as String,
      requestedAt: json['requestedAt'] as String,
      rejectedReason: json['rejectedReason'] as String?,
    );
  }

  final String id;
  final String orderItemId;
  final String orderId;
  final String status;
  final String reason;
  final String requestedAt;
  final String? rejectedReason;

  /// `return-refund.util.ts`-ийн `ACTIVE_RETURN_STATUSES`-тай ижил —
  /// энэ orderItemId-д ШИНЭ буцаалт хүсэх боломжгүй (аль хэдийн
  /// шийдвэрлэгдэж байгаа) төлөв.
  bool get isActive => status == 'REQUESTED' || status == 'APPROVED';
}
