import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../checkout/domain/order_detail.dart';
import '../../checkout/presentation/checkout_providers.dart';

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
}

final orderListProvider =
    AsyncNotifierProvider<OrderListNotifier, List<OrderDetail>>(
      OrderListNotifier.new,
    );
