import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/catalog/presentation/catalog_providers.dart';
import 'package:mobile/features/catalog/presentation/product_detail_screen.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';

import '../../../support/fake_cart_repository.dart';
import '../../../support/fake_catalog_repository.dart';

void main() {
  late FakeCatalogRepository catalogRepository;
  late FakeCartRepository cartRepository;

  setUp(() {
    catalogRepository = FakeCatalogRepository();
    catalogRepository.getProductHandler = (id) => buildTestProduct(id: id);
    cartRepository = FakeCartRepository();
  });

  // `_DetailSkeleton` (ачаалж байгаа төлөв) scroll-гүй Column тул анхдагч
  // 800x600 квадрат тестийн дэлгэц дээр (SliverAppBar-ийн expandedHeight
  // нь MediaQuery-ийн width-тэй тэнцүү болгодог) overflow гарна — жинхэнэ
  // (өндөр нь өргөнөөс их) утасны дэлгэцтэй ойролцоо хэмжээ тавьж шийднэ.
  void setPhoneViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  late GoRouter router;

  // "Сагслах" → буцах товч Navigator.pop()-ийг дуудна тул анхны байрлал
  // ганцхан /products/:id байвал (стек хоосорч) алга — Каталогоос push
  // хийсэн ЖИНХЭНЭ урсгалыг дуурайлган эхлээд /catalog-руу орж, дараа нь
  // тестийн дотор /products/p1 руу push хийнэ. `NoTransitionPage` —
  // SnackBar-ийн animation-той зэрэгцэн pop-ийн шилжилтийн animation
  // эхлэхэд (тестийн fake clock-д хоёр AnimationController зэрэг
  // эхлэхэд гардаг тогтворгүй байдлаас) зайлсхийнэ.
  Widget wrap() {
    router = GoRouter(
      initialLocation: '/catalog',
      routes: [
        GoRoute(
          path: '/catalog',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: Scaffold(body: Text('catalog'))),
        ),
        GoRoute(
          path: '/products/:id',
          pageBuilder: (context, state) => NoTransitionPage(
            child: ProductDetailScreen(productId: state.pathParameters['id']!),
          ),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        catalogRepositoryProvider.overrideWithValue(catalogRepository),
        cartRepositoryProvider.overrideWithValue(cartRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets(
    '"Сагслах" товч дарахад амжилттай SnackBar харагдаад, өмнөх дэлгэц рүү буцна',
    (tester) async {
      setPhoneViewport(tester);
      await tester.pumpWidget(wrap());
      router.push('/products/p1');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add_to_cart_button')));
      // SnackBar анимацийг харах зорилгоор pumpAndSettle-ийн ӨМНӨ нэг frame.
      await tester.pump();

      expect(find.text('Сагсанд нэмэгдлээ'), findsOneWidget);
      expect(cartRepository.addOrUpdateCalls, [(variantId: 'variant-p1', quantity: 1)]);

      await tester.pumpAndSettle();

      expect(find.byType(ProductDetailScreen), findsNothing);
    },
  );

  testWidgets(
    'сагсанд нэмэхэд алдаа гарвал алдааны SnackBar харагдаад, дэлгэц дээр үлдэнэ',
    (tester) async {
      setPhoneViewport(tester);
      cartRepository.addOrUpdateError = Exception('backend боломжгүй');
      await tester.pumpWidget(wrap());
      router.push('/products/p1');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add_to_cart_button')));
      await tester.pump();

      expect(find.text('Сагсанд нэмэхэд алдаа гарлаа'), findsOneWidget);

      await tester.pumpAndSettle();

      expect(find.byType(ProductDetailScreen), findsOneWidget);
    },
  );
}
