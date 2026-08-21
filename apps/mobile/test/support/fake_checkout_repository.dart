import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/checkout/data/checkout_repository.dart';
import 'package:mobile/features/checkout/domain/checkout_result.dart';
import 'package:mobile/features/checkout/domain/order_detail.dart';
import 'package:mobile/features/checkout/domain/order_route.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake —
/// `test/support/fake_cart_repository.dart`-ийн загвартай адил.
class FakeCheckoutRepository implements CheckoutRepository {
  CheckoutResult? checkoutResult;
  ApiException? checkoutError;
  OrderDetail? orderDetail;
  OrderRoute? orderRoute;
  List<OrderDetail> orders = const [];
  ApiException? listOrdersError;

  final List<({String branchId, String deliveryMethod, String? couponCode})>
  checkoutCalls = [];
  final List<String> simulatePaidCalls = [];
  int listOrdersCallCount = 0;

  @override
  Future<List<OrderDetail>> listOrders() async {
    listOrdersCallCount++;
    if (listOrdersError != null) {
      throw listOrdersError!;
    }
    return orders;
  }

  @override
  Future<CheckoutResult> checkout({
    required String branchId,
    required String deliveryMethod,
    String? deliveryAddress,
    double? deliveryLatitude,
    double? deliveryLongitude,
    String? couponCode,
  }) async {
    checkoutCalls.add((
      branchId: branchId,
      deliveryMethod: deliveryMethod,
      couponCode: couponCode,
    ));
    if (checkoutError != null) {
      throw checkoutError!;
    }
    return checkoutResult ??
        const CheckoutResult(
          orderId: 'order-1',
          status: 'CREATED',
          providerInvoiceId: 'mock_inv_1',
          payUrl: 'mock://pay/mock_inv_1',
          qrText: 'mock-qr:mock_inv_1',
          bankDeeplinks: [],
        );
  }

  @override
  Future<OrderDetail> getOrder(String orderId) async {
    return orderDetail ??
        OrderDetail(
          id: orderId,
          status: 'CREATED',
          totalAmount: '10000.00',
          branchId: 'branch-1',
          items: const [],
          deliveryMethod: 'PICKUP',
          createdAt: DateTime(2026, 8, 20).toIso8601String(),
        );
  }

  @override
  Future<OrderRoute> getRoute(String orderId) async {
    return orderRoute ??
        const OrderRoute(
          distanceMeters: 1500,
          durationSeconds: 300,
          geometry: [
            [106.917, 47.918],
            [106.93, 47.925],
          ],
        );
  }

  @override
  Future<void> simulatePaid({
    required String orderId,
    required String providerInvoiceId,
  }) async {
    simulatePaidCalls.add(providerInvoiceId);
  }
}
