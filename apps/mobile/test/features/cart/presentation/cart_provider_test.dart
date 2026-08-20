import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';

import '../../../support/fake_cart_repository.dart';

void main() {
  late FakeCartRepository repository;
  late ProviderContainer container;

  setUp(() {
    repository = FakeCartRepository();
    container = ProviderContainer(
      overrides: [cartRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);
  });

  test('build() эхлээд getCart()-ийг дуудаж одоогийн сагсыг татна', () async {
    repository.items = [buildTestCartItem(variantId: 'v1')];

    final cart = await container.read(cartProvider.future);

    expect(cart, hasLength(1));
    expect(repository.getCartCallCount, 1);
  });

  test('setQuantity() шинэ variant нэмбэл backend-ийн буцаасан state-ээр шинэчлэгдэнэ', () async {
    await container.read(cartProvider.future);
    final notifier = container.read(cartProvider.notifier);

    await notifier.setQuantity('v1', 3);

    final state = container.read(cartProvider).value;
    expect(state, hasLength(1));
    expect(state!.single.quantity, 3);
    expect(repository.addOrUpdateCalls.single, (variantId: 'v1', quantity: 3));
  });

  test('setQuantity() аль хэдийн байгаа variant-ыг дахин дуудвал зөвхөн НЭГ мөр хэвээр үлдэж, тоо шинэчлэгдэнэ', () async {
    repository.items = [buildTestCartItem(variantId: 'v1', quantity: 2)];
    await container.read(cartProvider.future);
    final notifier = container.read(cartProvider.notifier);

    await notifier.setQuantity('v1', 7);

    final state = container.read(cartProvider).value;
    expect(state, hasLength(1));
    expect(state!.single.quantity, 7);
  });

  test('remove() variant-ыг устгана', () async {
    repository.items = [buildTestCartItem(variantId: 'v1')];
    await container.read(cartProvider.future);
    final notifier = container.read(cartProvider.notifier);

    await notifier.remove('v1');

    expect(container.read(cartProvider).value, isEmpty);
    expect(repository.removeCalls, ['v1']);
  });

  test('clear() ШУУД хоосон болгож, дараа нь дахин GET дуудахгүй', () async {
    repository.items = [buildTestCartItem(variantId: 'v1')];
    await container.read(cartProvider.future);
    final notifier = container.read(cartProvider.notifier);

    await notifier.clear();

    expect(container.read(cartProvider).value, isEmpty);
    expect(repository.clearCallCount, 1);
    // build()-ийн эхний ганц удаа л дуудагдсан — clear() дараа дахин
    // getCart() дуудахгүйгээр шууд хоосон төлөвт шилжинэ.
    expect(repository.getCartCallCount, 1);
  });

  test('cartItemCountProvider ачаалж дуустал 0, дараа нь item тоог буцаана', () async {
    repository.items = [
      buildTestCartItem(variantId: 'v1'),
      buildTestCartItem(variantId: 'v2'),
    ];

    expect(container.read(cartItemCountProvider), 0);

    await container.read(cartProvider.future);

    expect(container.read(cartItemCountProvider), 2);
  });
}
