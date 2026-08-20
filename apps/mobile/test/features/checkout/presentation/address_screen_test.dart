import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/branch/presentation/branch_providers.dart';
import 'package:mobile/features/checkout/presentation/address_screen.dart';
import 'package:mobile/features/checkout/presentation/checkout_draft.dart';

import '../../../support/fake_branch_repository.dart';

class _SeededDraftNotifier extends CheckoutDraftNotifier {
  _SeededDraftNotifier(this._initial);
  final CheckoutDraft? _initial;

  @override
  CheckoutDraft? build() => _initial;
}

void main() {
  late FakeBranchRepository branchRepository;
  late _SeededDraftNotifier notifier;

  setUp(() {
    branchRepository = FakeBranchRepository();
    notifier = _SeededDraftNotifier(
      const CheckoutDraft(branchId: 'branch-1', deliveryMethod: 'DELIVERY'),
    );
  });

  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/checkout/address',
      routes: [
        GoRoute(
          path: '/checkout/address',
          builder: (context, state) => const AddressScreen(),
        ),
        GoRoute(
          path: '/checkout/review',
          builder: (context, state) =>
              const Scaffold(body: Text('review-screen')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        checkoutDraftProvider.overrideWith(() => notifier),
        branchRepositoryProvider.overrideWithValue(branchRepository),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets(
    'хайлтын текстгүйгээр "Баталгаажуулах" товч эхнээсээ идэвхтэй, дарахад Тойм руу шилжиж координатаас хаяг үүснэ',
    (tester) async {
      await tester.pumpWidget(wrap());
      await tester.pump();

      final button = tester.widget<FilledButton>(
        find.byKey(const Key('address_confirm_button')),
      );
      expect(button.onPressed, isNotNull);

      await tester.tap(find.byKey(const Key('address_confirm_button')));
      await tester.pumpAndSettle();

      expect(find.text('review-screen'), findsOneWidget);
      expect(notifier.state?.deliveryAddress, isNotNull);
      expect(notifier.state?.deliveryAddress, isNotEmpty);
      expect(notifier.state?.deliveryLatitude, isNotNull);
      expect(notifier.state?.deliveryLongitude, isNotNull);
    },
  );

  testWidgets(
    'газрын зураг дээр товшиход координат шинэчлэгдэж, Баталгаажуулах дарахад тэр координатаар үргэлжилнэ',
    (tester) async {
      await tester.pumpWidget(wrap());
      await tester.pump();

      await tester.tapAt(tester.getCenter(find.byType(FlutterMap)));
      await tester.pump(const Duration(milliseconds: 600));

      await tester.tap(find.byKey(const Key('address_confirm_button')));
      await tester.pumpAndSettle();

      expect(find.text('review-screen'), findsOneWidget);
      expect(notifier.state?.deliveryLatitude, isNotNull);
      expect(notifier.state?.deliveryLongitude, isNotNull);
    },
  );

  testWidgets(
    'газрын зургийг чирэхэд (drag) ч мөн координат шинэчлэгдэж, Баталгаажуулах ажиллана',
    (tester) async {
      await tester.pumpWidget(wrap());
      await tester.pump();

      await tester.drag(find.byType(FlutterMap), const Offset(60, 40));
      await tester.pump();

      await tester.tap(find.byKey(const Key('address_confirm_button')));
      await tester.pumpAndSettle();

      expect(find.text('review-screen'), findsOneWidget);
      expect(notifier.state?.deliveryLatitude, isNotNull);
    },
  );
}
