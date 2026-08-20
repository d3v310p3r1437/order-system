import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/checkout_repository.dart';
import '../data/geocoding_repository.dart';
import '../domain/order_detail.dart';
import '../domain/order_route.dart';

final checkoutRepositoryProvider = Provider<CheckoutRepository>((ref) {
  return CheckoutRepository(apiClient: ref.watch(apiClientProvider));
});

final geocodingRepositoryProvider = Provider<GeocodingRepository>((ref) {
  return GeocodingRepository();
});

// ⚠️ `OrderEventsClient`-д (WebSocket) ЗОРИУДАА provider бичээгүй — энэ
// нь PaymentScreen/OrderTrackingScreen-ийн ХАМААРАЛТАЙ screen-lifecycle
// холболт (screen нээгдэхэд шинээр нээгдэж, хаагдахад ЗААВАЛ хаагдах
// ёстой). `Provider.autoDispose`-г зөвхөн `ref.read()`-ээр ашиглавал
// ямар ч listener бүртгэгдээгүй тул Riverpod дараагийн microtask-д шууд
// dispose хийчихэж болзошгүй (watch хийхгүй бол autoDispose-ийн "хэн ч
// сонсохгүй бол устгана" зарчим шууд хэрэгждэг) — тиймээс screen бүр
// `State.initState()`-д шууд `OrderEventsClient(tokenStorage:
// ref.read(secureTokenStorageProvider))`-ээр өөрөө үүсгэж,
// `State.dispose()`-д `.dispose()`-ыг өөрөө дуудна.

/// OrderTrackingScreen-ийн эхний ачаалалт — `order.status_changed` WebSocket
/// event ирэх бүрд дэлгэц дотроосоо (StateNotifier биш, дэлгэцийн local
/// state-ээр) шинэчлэгддэг тул энд дахин ашиглагдахгүй (autoDispose,
/// family) — дэлгэц бүр шинэ орж ирэх бүрд дахин татна.
final orderDetailProvider = FutureProvider.autoDispose.family<OrderDetail, String>((
  ref,
  orderId,
) {
  return ref.watch(checkoutRepositoryProvider).getOrder(orderId);
});

final orderRouteProvider = FutureProvider.autoDispose.family<OrderRoute, String>((
  ref,
  orderId,
) {
  return ref.watch(checkoutRepositoryProvider).getRoute(orderId);
});
