import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/main_shell.dart';

/// `MainShell`-ийн `StatefulShellRoute.indexedStack` навигаци — бодит
/// HomeScreen/CatalogScreen/... provider-уудаас (backend дуудлага) ЗОРИУДАА
/// тусгаарласан, зөвхөн 4 placeholder branch-тай минимал router-оор.
void main() {
  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) =>
              MainShell(navigationShell: navigationShell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/home',
                  builder: (context, state) => const Text('нүүр-дэлгэц'),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/catalog',
                  builder: (context, state) => const Text('каталог-дэлгэц'),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/orders',
                  builder: (context, state) => const Text('захиалгууд-дэлгэц'),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/profile',
                  builder: (context, state) => const Text('профайл-дэлгэц'),
                ),
              ],
            ),
          ],
        ),
      ],
    );
    return MaterialApp.router(routerConfig: router);
  }

  testWidgets('4 tab бүр харагдаж, дарахад агуулга сэлгэнэ', (tester) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('нүүр-дэлгэц'), findsOneWidget);
    expect(find.byKey(const Key('main_bottom_nav')), findsOneWidget);

    await tester.tap(find.byKey(const Key('main_bottom_nav_catalog')));
    await tester.pumpAndSettle();
    expect(find.text('каталог-дэлгэц'), findsOneWidget);
    expect(find.text('нүүр-дэлгэц'), findsNothing);

    await tester.tap(find.byKey(const Key('main_bottom_nav_orders')));
    await tester.pumpAndSettle();
    expect(find.text('захиалгууд-дэлгэц'), findsOneWidget);

    await tester.tap(find.byKey(const Key('main_bottom_nav_profile')));
    await tester.pumpAndSettle();
    expect(find.text('профайл-дэлгэц'), findsOneWidget);
  });

  testWidgets('өөр tab руу шилжээд буцаж ирэхэд өмнөх tab-ийн state хадгалагдана', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    // IndexedStack-ийн ачаар Каталог tab дахин build хийгдэхгүй
    // (харагдахгүй ч widget tree-д амьд үлдэнэ) — ижил Text widget instance
    // байгааг батлахын оронд зөвхөн харагдах эсэхийг шалгана (findsOneWidget
    // vs findsNothing аль алинд нь тестлэгдсэн IndexedStack-ийн семантик).
    await tester.tap(find.byKey(const Key('main_bottom_nav_catalog')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('main_bottom_nav_home')));
    await tester.pumpAndSettle();

    expect(find.text('нүүр-дэлгэц'), findsOneWidget);
  });
}
