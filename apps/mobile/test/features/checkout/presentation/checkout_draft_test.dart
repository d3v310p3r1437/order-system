import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkout/presentation/checkout_draft.dart';

void main() {
  late ProviderContainer container;

  setUp(() {
    container = ProviderContainer();
    addTearDown(container.dispose);
  });

  test('start() branchId-тэй шинэ ноорог (анхны PICKUP) үүсгэнэ', () {
    container.read(checkoutDraftProvider.notifier).start('branch-1');

    final draft = container.read(checkoutDraftProvider);
    expect(draft, isNotNull);
    expect(draft!.branchId, 'branch-1');
    expect(draft.deliveryMethod, 'PICKUP');
    expect(draft.isDelivery, isFalse);
  });

  test('setDeliveryMethod(DELIVERY) isDelivery-г true болгоно', () {
    final notifier = container.read(checkoutDraftProvider.notifier);
    notifier.start('branch-1');
    notifier.setDeliveryMethod('DELIVERY');

    final draft = container.read(checkoutDraftProvider)!;
    expect(draft.isDelivery, isTrue);
    expect(draft.deliveryAddress, isNull);
  });

  test('setAddress() хаяг/координатыг ноороготой хамт хадгална', () {
    final notifier = container.read(checkoutDraftProvider.notifier);
    notifier.start('branch-1');
    notifier.setDeliveryMethod('DELIVERY');
    notifier.setAddress(
      address: 'СБД, 1-р хороо',
      latitude: 47.925,
      longitude: 106.93,
    );

    final draft = container.read(checkoutDraftProvider)!;
    expect(draft.deliveryAddress, 'СБД, 1-р хороо');
    expect(draft.deliveryLatitude, 47.925);
    expect(draft.deliveryLongitude, 106.93);
  });

  test(
    'DELIVERY-ээс PICKUP руу буцахад хуучин хаяг/координат ЦЭВЭРЛЭГДЭНЭ (backend DTO validation-той нийцүүлэх)',
    () {
      final notifier = container.read(checkoutDraftProvider.notifier);
      notifier.start('branch-1');
      notifier.setDeliveryMethod('DELIVERY');
      notifier.setAddress(
        address: 'СБД, 1-р хороо',
        latitude: 47.925,
        longitude: 106.93,
      );

      notifier.setDeliveryMethod('PICKUP');

      final draft = container.read(checkoutDraftProvider)!;
      expect(draft.deliveryMethod, 'PICKUP');
      expect(draft.deliveryAddress, isNull);
      expect(draft.deliveryLatitude, isNull);
      expect(draft.deliveryLongitude, isNull);
    },
  );

  test('reset() ноорогийг null болгоно', () {
    final notifier = container.read(checkoutDraftProvider.notifier);
    notifier.start('branch-1');
    notifier.reset();

    expect(container.read(checkoutDraftProvider), isNull);
  });

  test('start()-аас өмнө setDeliveryMethod/setAddress дуудвал юу ч хийхгүй (null-safe)', () {
    final notifier = container.read(checkoutDraftProvider.notifier);
    notifier.setDeliveryMethod('DELIVERY');
    expect(container.read(checkoutDraftProvider), isNull);

    notifier.setAddress(address: 'x', latitude: 1, longitude: 1);
    expect(container.read(checkoutDraftProvider), isNull);
  });
}
