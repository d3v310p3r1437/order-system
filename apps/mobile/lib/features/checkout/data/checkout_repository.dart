import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/checkout_result.dart';
import '../domain/order_detail.dart';
import '../domain/order_route.dart';

/// `apps/api/src/orders/order.controller.ts`-руу хандах цэг.
class CheckoutRepository {
  CheckoutRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  /// ⚠️ `items` талбар ОГТ ИЛГЭЭХГҮЙ — backend Redis-ийн `cart:{userId}`-аас
  /// (харилцагч аль хэдийн `POST /cart/items`-ээр бичсэн) уншина
  /// (`checkout-order.dto.ts`-ийн толгой тайлбарыг үз). Амжилттай бол
  /// backend талд Redis сагс автоматаар цэвэрлэгдэнэ.
  Future<CheckoutResult> checkout({
    required String branchId,
    required String deliveryMethod,
    String? deliveryAddress,
    double? deliveryLatitude,
    double? deliveryLongitude,
  }) async {
    try {
      final response = await _apiClient.dio.post<Map<String, dynamic>>(
        '/orders',
        data: {
          'branchId': branchId,
          'deliveryMethod': deliveryMethod,
          if (deliveryMethod == 'DELIVERY') ...{
            'deliveryAddress': deliveryAddress,
            'deliveryLatitude': deliveryLatitude,
            'deliveryLongitude': deliveryLongitude,
          },
        },
      );
      return CheckoutResult.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<OrderDetail> getOrder(String orderId) async {
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/orders/$orderId',
      );
      return OrderDetail.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  /// Зөвхөн DELIVERY захиалгад ажиллана (PICKUP бол backend 400 буцаана —
  /// дуудагч тал `OrderDetail.isDelivery`-г эхлээд шалгасан байх ёстой).
  Future<OrderRoute> getRoute(String orderId) async {
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/orders/$orderId/route',
      );
      return OrderRoute.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  /// ⚠️ ЗӨВХӨН debug build-д (`kDebugMode`) дуудагдана — dev-only. 2 алхамтай:
  /// 1. `POST /payment/mock/simulate-paid/:id` — `MockPaymentProvider`-ийн
  ///    ДОТООД статусыг PAID болгоно (backend-ийн `checkPayment()`-ийн
  ///    дараагийн дуудлагад л нөлөөлнэ, Order мөрийг өөрөө ХАРААХАН
  ///    өөрчлөхгүй).
  /// 2. `POST /payment/webhook/:orderId` — бодит QPay-ийн серверээс ирэх
  ///    webhook-ыг simulate хийнэ (`docs/adr/006-qpay-verify-dont-trust.md`:
  ///    backend webhook payload-д ШУУД итгэхгүй, `checkPayment()`-ийг
  ///    дотроосоо дахин дуудаж баталгаажуулдаг тул payload-ийн агуулга
  ///    чухал биш, зөвхөн "шалгаад үз" гэсэн триггер) — ЭНЭ алхам л
  ///    Order.paidAt-г ЖИНХЭНЭ тавьж, `order.payment_confirmed` WebSocket
  ///    event-ийг өдөөнө. Зөвхөн 1-р алхмыг дангаар нь дуудвал ямар ч
  ///    бодит захиалгын төлөв өөрчлөгдөхгүй (webhook хэзээ ч ирэхгүй тул).
  Future<void> simulatePaid({
    required String orderId,
    required String providerInvoiceId,
  }) async {
    try {
      await _apiClient.dio.post<Map<String, dynamic>>(
        '/payment/mock/simulate-paid/$providerInvoiceId',
      );
      await _apiClient.dio.post<Map<String, dynamic>>(
        '/payment/webhook/$orderId',
        data: {'payment_id': providerInvoiceId},
      );
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
