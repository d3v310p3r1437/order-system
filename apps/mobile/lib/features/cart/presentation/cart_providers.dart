import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/cart_repository.dart';
import '../domain/cart_item.dart';

final cartRepositoryProvider = Provider<CartRepository>((ref) {
  return CartRepository(apiClient: ref.watch(apiClientProvider));
});

/// Сагсны одоогийн төлөв — нэмэх/устгах/цэвэрлэх бүрд backend-ийн ШИНЭЧЛЭГДСЭН
/// (эргэн буцаасан) жагсаалтаар ШУУД шинэчлэгдэнэ, дахин `getCart()` дуудах
/// шаардлагагүй (сервер аль хэдийн шинэ cart-ыг л хариунд буцаадаг).
class CartNotifier extends AsyncNotifier<List<CartItem>> {
  @override
  FutureOr<List<CartItem>> build() {
    return ref.read(cartRepositoryProvider).getCart();
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<CartItem>>();
    state = await AsyncValue.guard(
      () => ref.read(cartRepositoryProvider).getCart(),
    );
  }

  /// +/- adjuster шинэ (бодит) тоо хэмжээг ӨӨРӨӨ тооцоод дамжуулна —
  /// серверийн `POST /cart/items` upsert-set семантиктай яг тохирно.
  Future<void> setQuantity(String variantId, int quantity) async {
    state = await AsyncValue.guard(
      () => ref
          .read(cartRepositoryProvider)
          .addOrUpdateItem(variantId: variantId, quantity: quantity),
    );
  }

  /// `ProductDetailScreen`-ийн "Сагслах" товч дуудна — variantId сагсанд
  /// аль хэдийн байвал тоог 1-ээр нэмнэ, байхгүй бол 1-ээр шинээр нэмнэ.
  Future<void> addOne(String variantId) => addQuantity(variantId, 1);

  /// `AddToCartBottomSheet`-ийн тоо +/- сонголттой "Сагсанд нэмэх" товч
  /// дуудна — variantId сагсанд аль хэдийн байвал тоог [delta]-аар нэмнэ,
  /// байхгүй бол [delta]-аар шинээр нэмнэ (upsert-set семантикийг энд,
  /// ганц газар тооцно — дуудагч тал одоогийн тоог мэдэх шаардлагагүй).
  Future<void> addQuantity(String variantId, int delta) async {
    final current = state.value ?? await future;
    var existingQuantity = 0;
    for (final item in current) {
      if (item.variantId == variantId) {
        existingQuantity = item.quantity;
        break;
      }
    }
    await setQuantity(variantId, existingQuantity + delta);
  }

  Future<void> remove(String variantId) async {
    state = await AsyncValue.guard(
      () => ref.read(cartRepositoryProvider).removeItem(variantId),
    );
  }

  Future<void> clear() async {
    await ref.read(cartRepositoryProvider).clear();
    state = const AsyncData<List<CartItem>>([]);
  }
}

final cartProvider = AsyncNotifierProvider<CartNotifier, List<CartItem>>(
  CartNotifier.new,
);

/// HomeScreen-ийн сагсны icon badge тоо — ачаалж байгаа/алдаатай үед 0
/// (badge зүгээр л харагдахгүй, алдаа шидэхгүй).
final cartItemCountProvider = Provider<int>((ref) {
  final cart = ref.watch(cartProvider);
  return cart.maybeWhen(data: (items) => items.length, orElse: () => 0);
});
