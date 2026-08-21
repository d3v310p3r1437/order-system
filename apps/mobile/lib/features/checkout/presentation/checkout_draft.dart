import 'package:flutter_riverpod/flutter_riverpod.dart';

/// DeliveryMethodScreen→AddressScreen→OrderReviewScreen 3 алхмын дундуур
/// хуримтлагдах checkout-ийн ноорог төлөв. `BranchSelectionScreen`-ийн
/// "Үргэлжлүүлэх" товч `start(branchId)`-ээр эхлүүлнэ.
class CheckoutDraft {
  const CheckoutDraft({
    required this.branchId,
    this.deliveryMethod = 'PICKUP',
    this.deliveryAddress,
    this.deliveryLatitude,
    this.deliveryLongitude,
  });

  final String branchId;
  final String deliveryMethod;
  final String? deliveryAddress;
  final double? deliveryLatitude;
  final double? deliveryLongitude;

  bool get isDelivery => deliveryMethod == 'DELIVERY';

  CheckoutDraft withDeliveryMethod(String method) {
    if (method == 'PICKUP') {
      // PICKUP-д deliveryAddress/Lat/Lng байх ЁСГҮЙ (backend DTO validation
      // яг ижил хатуу шаарддаг, checkout-order.dto.ts-ийг үз) — арга сольж
      // буцах үед хуучин утга үлдэхээс сэргийлж цэвэрлэнэ.
      return CheckoutDraft(branchId: branchId, deliveryMethod: 'PICKUP');
    }
    return CheckoutDraft(
      branchId: branchId,
      deliveryMethod: 'DELIVERY',
      deliveryAddress: deliveryAddress,
      deliveryLatitude: deliveryLatitude,
      deliveryLongitude: deliveryLongitude,
    );
  }

  CheckoutDraft withAddress({
    required String address,
    required double latitude,
    required double longitude,
  }) {
    return CheckoutDraft(
      branchId: branchId,
      deliveryMethod: deliveryMethod,
      deliveryAddress: address,
      deliveryLatitude: latitude,
      deliveryLongitude: longitude,
    );
  }
}

class CheckoutDraftNotifier extends Notifier<CheckoutDraft?> {
  @override
  CheckoutDraft? build() => null;

  void start(String branchId) {
    state = CheckoutDraft(branchId: branchId);
  }

  void setDeliveryMethod(String method) {
    final current = state;
    if (current == null) {
      return;
    }
    state = current.withDeliveryMethod(method);
  }

  void setAddress({
    required String address,
    required double latitude,
    required double longitude,
  }) {
    final current = state;
    if (current == null) {
      return;
    }
    state = current.withAddress(
      address: address,
      latitude: latitude,
      longitude: longitude,
    );
  }

  /// Checkout амжилттай дуусмагц (OrderSuccessScreen руу шилжихээс өмнө)
  /// ноорог төлөвийг цэвэрлэнэ — хэрэглэгч дахин "Захиалах" дарахад шинэ
  /// ноорог эхэлдэг байх ёстой.
  void reset() {
    state = null;
  }
}

final checkoutDraftProvider =
    NotifierProvider<CheckoutDraftNotifier, CheckoutDraft?>(
      CheckoutDraftNotifier.new,
    );
