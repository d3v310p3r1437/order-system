import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';
import 'package:mobile/features/catalog/domain/availability.dart';
import 'package:mobile/features/catalog/domain/product.dart';
import 'package:mobile/features/catalog/domain/product_variant.dart';
import 'package:mobile/features/catalog/presentation/widgets/add_to_cart_bottom_sheet.dart';

import '../../../../support/fake_cart_repository.dart';

/// Өнгө/хэмжээ хослолын variant тодорхойлолт (§7 модуль #3-ийн засвар,
/// 2026-09-05 нэмэлт: chip мөрүүд ЗӨВХӨН тухайн нэг бүтээгдэхүүний
/// доторх variant сонголт, каталогийн ерөнхий шүүлтүүр БИШ гэдгийг
/// тодруулсны дараах хувилбар) — 2 өнгө × 2 хэмжээгээс ГАНЦ хослол
/// (хөх/M) ЗОРИУДАА дутуу, disabled chip-ийг шалгахад ашиглана.
Product _buildVariantMatrixProduct() {
  const availability = AvailabilityResult(status: AvailabilityStatus.inStock);
  return const Product(
    id: 'p1',
    name: 'Куртка',
    slug: 'kurtka',
    isActive: true,
    images: [],
    variants: [
      ProductVariant(
        id: 'v-red-s',
        productId: 'p1',
        name: 'Улаан, S',
        sku: 'sku-red-s',
        unit: 'ширхэг',
        basePrice: '10000',
        isActive: true,
        defaultPreOrderEnabled: false,
        availability: availability,
        color: 'улаан',
        size: 'S',
      ),
      ProductVariant(
        id: 'v-red-m',
        productId: 'p1',
        name: 'Улаан, M',
        sku: 'sku-red-m',
        unit: 'ширхэг',
        basePrice: '20000',
        isActive: true,
        defaultPreOrderEnabled: false,
        availability: availability,
        color: 'улаан',
        size: 'M',
      ),
      ProductVariant(
        id: 'v-blue-s',
        productId: 'p1',
        name: 'Хөх, S',
        sku: 'sku-blue-s',
        unit: 'ширхэг',
        basePrice: '15000',
        isActive: true,
        defaultPreOrderEnabled: false,
        availability: availability,
        color: 'хөх',
        size: 'S',
      ),
      // "хөх / M" хослол ЗОРИУДАА байхгүй — disabled chip шалгахад.
    ],
  );
}

void main() {
  late FakeCartRepository cartRepository;

  setUp(() {
    cartRepository = FakeCartRepository();
  });

  Widget wrap(Product product) {
    return ProviderScope(
      overrides: [cartRepositoryProvider.overrideWithValue(cartRepository)],
      child: MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () =>
                    showAddToCartBottomSheet(context: context, product: product),
                child: const Text('Сагслах'),
              ),
            ),
          ),
        ),
      ),
    );
  }

  ChoiceChip sizeChip(WidgetTester tester, String size) => tester.widget<ChoiceChip>(
    find.byKey(Key('add_to_cart_size_chip_$size')),
  );

  testWidgets('өнгө/хэмжээ chip сонгоход тохирох variant тодорхойлогдож, боломжгүй хослол disabled болно', (
    tester,
  ) async {
    final product = _buildVariantMatrixProduct();
    await tester.pumpWidget(wrap(product));
    await tester.tap(find.text('Сагслах'));
    await tester.pumpAndSettle();

    // Анхны сонголт — хамгийн хямд variant (улаан/S, 10,000₮).
    expect(find.text('10,000₮'), findsOneWidget);
    expect(sizeChip(tester, 'S').selected, isTrue);
    expect(sizeChip(tester, 'M').onSelected, isNotNull);

    // "хөх" сонгоход (S хэвээр сонгогдсон, хөх+S байгаа тул боломжтой) —
    // variant/үнэ шинэ хослол руу шинэчлэгдэнэ.
    await tester.tap(find.byKey(const Key('add_to_cart_color_chip_хөх')));
    await tester.pumpAndSettle();
    expect(find.text('15,000₮'), findsOneWidget);

    // "хөх"-той хослоход "M" хэмжээ байхгүй тул chip disabled (onSelected
    // == null) — Flutter ChoiceChip-ийн стандарт "идэвхгүй" илэрхийлэл.
    expect(sizeChip(tester, 'M').onSelected, isNull);
    expect(sizeChip(tester, 'S').onSelected, isNotNull);

    // Disabled chip дээр дарахад ямар ч өөрчлөлт орохгүй (сонголт хэвээр
    // хөх/S) — ChoiceChip-ийн onSelected==null үед tap ямар ч effect-гүй.
    await tester.tap(find.byKey(const Key('add_to_cart_size_chip_M')));
    await tester.pumpAndSettle();
    expect(find.text('15,000₮'), findsOneWidget);

    // Захиалгад нэмэхэд ЯГ тухайн (хөх/S) variant-ийн id дамжина.
    await tester.tap(find.byKey(const Key('add_to_cart_bottom_sheet_submit')));
    await tester.pumpAndSettle();

    expect(
      cartRepository.addOrUpdateCalls.single,
      (variantId: 'v-blue-s', quantity: 1),
    );
  });

  testWidgets('1 variant-тай бүтээгдэхүүнд chip сонголт огт харагдахгүй', (
    tester,
  ) async {
    const product = Product(
      id: 'p2',
      name: 'Даавуун цүнх',
      slug: 'daavuun-tsuntskh',
      isActive: true,
      images: [],
      variants: [
        ProductVariant(
          id: 'v-1',
          productId: 'p2',
          name: 'Стандарт',
          sku: 'sku-1',
          unit: 'ширхэг',
          basePrice: '8000',
          isActive: true,
          defaultPreOrderEnabled: false,
          availability: AvailabilityResult(status: AvailabilityStatus.inStock),
        ),
      ],
    );
    await tester.pumpWidget(wrap(product));
    await tester.tap(find.text('Сагслах'));
    await tester.pumpAndSettle();

    expect(find.text('Өнгө'), findsNothing);
    expect(find.text('Хэмжээ'), findsNothing);
    expect(find.text('Сонголт'), findsNothing);
    expect(find.text('8,000₮'), findsOneWidget);
  });
}
