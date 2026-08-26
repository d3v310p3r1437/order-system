import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../checkout/domain/order_detail.dart';
import '../../checkout/presentation/checkout_providers.dart';
import '../../reviews/domain/review.dart';

/// Захиалгын түүхийн жагсаалт (Захиалгууд tab) — `CartNotifier`-тэй ижил
/// `AsyncNotifier` загвар (pull-to-refresh `refresh()`-ээр дахин ачаална).
class OrderListNotifier extends AsyncNotifier<List<OrderDetail>> {
  @override
  FutureOr<List<OrderDetail>> build() {
    return ref.read(checkoutRepositoryProvider).listOrders();
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<OrderDetail>>();
    state = await AsyncValue.guard(
      () => ref.read(checkoutRepositoryProvider).listOrders(),
    );
  }

  /// (2026-08-26) `QuickReviewBottomSheet`-ээр амжилттай илгээсний дараа
  /// дуудагдана — дахин `GET /orders`-г API-аар татахгүйгээр, тухайн
  /// `productId`-той ХАМААРАХ бүх захиалгын карт дээрх OrderItem-д (нэг
  /// бүтээгдэхүүн олон захиалгад давтагдаж болзошгүй) шинэ `Review`-г
  /// ШУУД (local state) залгана.
  void applyLocalReview(String productId, Review review) {
    final current = state.value;
    if (current == null) {
      return;
    }
    state = AsyncData(
      current
          .map(
            (order) => order.copyWith(
              items: order.items
                  .map(
                    (item) => item.productId == productId
                        ? item.copyWith(myReview: review)
                        : item,
                  )
                  .toList(),
            ),
          )
          .toList(),
    );
  }
}

final orderListProvider =
    AsyncNotifierProvider<OrderListNotifier, List<OrderDetail>>(
      OrderListNotifier.new,
    );
