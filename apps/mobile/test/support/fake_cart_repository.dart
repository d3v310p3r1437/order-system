import 'package:mobile/features/cart/data/cart_repository.dart';
import 'package:mobile/features/cart/domain/cart_branch_validation.dart';
import 'package:mobile/features/cart/domain/cart_item.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake —
/// `test/features/catalog/presentation/catalog_screen_test.dart`-ийн
/// `FakeCatalogRepository` загвартай адил.
class FakeCartRepository implements CartRepository {
  List<CartItem> items = [];
  Object? getCartError;
  Object? addOrUpdateError;
  CartBranchValidation Function(String branchId)? validateBranchHandler;

  int getCartCallCount = 0;
  int clearCallCount = 0;
  final List<({String variantId, int quantity})> addOrUpdateCalls = [];
  final List<String> removeCalls = [];

  @override
  Future<List<CartItem>> getCart() async {
    getCartCallCount++;
    if (getCartError != null) {
      throw getCartError!;
    }
    return items;
  }

  @override
  Future<List<CartItem>> addOrUpdateItem({
    required String variantId,
    required int quantity,
  }) async {
    addOrUpdateCalls.add((variantId: variantId, quantity: quantity));
    if (addOrUpdateError != null) {
      throw addOrUpdateError!;
    }
    final index = items.indexWhere((item) => item.variantId == variantId);
    if (index >= 0) {
      final existing = items[index];
      items = [
        ...items.sublist(0, index),
        CartItem(
          variantId: existing.variantId,
          quantity: quantity,
          unavailable: existing.unavailable,
          productId: existing.productId,
          productName: existing.productName,
          imageUrl: existing.imageUrl,
          sku: existing.sku,
          unit: existing.unit,
          basePrice: existing.basePrice,
        ),
        ...items.sublist(index + 1),
      ];
    } else {
      items = [...items, buildTestCartItem(variantId: variantId, quantity: quantity)];
    }
    return items;
  }

  @override
  Future<List<CartItem>> removeItem(String variantId) async {
    removeCalls.add(variantId);
    items = items.where((item) => item.variantId != variantId).toList();
    return items;
  }

  @override
  Future<void> clear() async {
    clearCallCount++;
    items = [];
  }

  @override
  Future<CartBranchValidation> validateBranch(String branchId) async {
    return validateBranchHandler?.call(branchId) ??
        const CartBranchValidation(items: [], totalAmount: '0.00');
  }
}

CartItem buildTestCartItem({
  required String variantId,
  int quantity = 1,
  String productName = 'Тест бүтээгдэхүүн',
  String basePrice = '10000',
  String? imageUrl,
}) {
  return CartItem(
    variantId: variantId,
    quantity: quantity,
    unavailable: false,
    productId: 'product-$variantId',
    productName: productName,
    imageUrl: imageUrl,
    sku: 'sku-$variantId',
    unit: 'ширхэг',
    basePrice: basePrice,
  );
}
