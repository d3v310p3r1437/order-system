import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/branch/presentation/branch_providers.dart';
import 'package:mobile/features/checkout/data/location_service.dart';
import 'package:mobile/features/checkout/presentation/address_screen.dart';
import 'package:mobile/features/checkout/presentation/checkout_draft.dart';
import 'package:mobile/features/checkout/presentation/checkout_providers.dart';

import '../../../support/fake_branch_repository.dart';
import '../../../support/fake_location_service.dart';

class _SeededDraftNotifier extends CheckoutDraftNotifier {
  _SeededDraftNotifier(this._initial);
  final CheckoutDraft? _initial;

  @override
  CheckoutDraft? build() => _initial;
}

void main() {
  late FakeBranchRepository branchRepository;
  late FakeLocationService locationService;
  late _SeededDraftNotifier notifier;

  setUp(() {
    branchRepository = FakeBranchRepository();
    // Анхдагчаар GPS татгалзсан гэж үзнэ — одоо байгаа (GPS-ээс өмнөх)
    // тестүүд хуучин fallback (хотын төв)/гар товших-чирэх зан төлөвийг
    // шалгадаг тул, GPS-ийг ЗОРИУДАА "амжилтгүй" төлөвт тавьсан.
    locationService = FakeLocationService()
      ..error = LocationPermissionDeniedException();
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
        locationServiceProvider.overrideWithValue(locationService),
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

  testWidgets(
    'GPS зөвшөөрөгдсөн бол pin захиалагчийн бодит байршилд эхэлж, Баталгаажуулахад тэр координат дамжина',
    (tester) async {
      locationService
        ..error = null
        ..result = const LocationCoordinates(latitude: 47.90, longitude: 106.80);
      await tester.pumpWidget(wrap());
      await tester.pump();

      expect(locationService.callCount, 1);

      await tester.tap(find.byKey(const Key('address_confirm_button')));
      await tester.pumpAndSettle();

      expect(notifier.state?.deliveryLatitude, 47.90);
      expect(notifier.state?.deliveryLongitude, 106.80);
    },
  );

  testWidgets(
    'GPS зөвшөөрөл татгалзсан үед хуучин fallback (хотын төв) хэвээр ажиллана',
    (tester) async {
      // setUp()-ийн анхдагч (LocationPermissionDeniedException) хэвээр.
      await tester.pumpWidget(wrap());
      await tester.pump();

      await tester.tap(find.byKey(const Key('address_confirm_button')));
      await tester.pumpAndSettle();

      expect(notifier.state?.deliveryLatitude, 47.9184);
      expect(notifier.state?.deliveryLongitude, 106.9177);
    },
  );

  testWidgets(
    'GPS-ийн бусад алдаа (жиш: байршлын үйлчилгээ унтраалттай) үед ч мөн адил fallback ажиллана',
    (tester) async {
      locationService.error = LocationServiceDisabledException();
      await tester.pumpWidget(wrap());
      await tester.pump();

      await tester.tap(find.byKey(const Key('address_confirm_button')));
      await tester.pumpAndSettle();

      expect(notifier.state?.deliveryLatitude, 47.9184);
      expect(notifier.state?.deliveryLongitude, 106.9177);
    },
  );

  testWidgets(
    '"Миний байршил руу очих" товч дарахад GPS-ийг дахин дуудаж, шинэ координатаар шилжинэ',
    (tester) async {
      await tester.pumpWidget(wrap());
      await tester.pump();
      // Анхны (татгалзсан) оролдлого 1 удаа дуудагдсан байна.
      expect(locationService.callCount, 1);

      locationService
        ..error = null
        ..result = const LocationCoordinates(latitude: 48.0, longitude: 107.0);
      await tester.tap(find.byKey(const Key('my_location_button')));
      await tester.pump();

      expect(locationService.callCount, 2);

      await tester.tap(find.byKey(const Key('address_confirm_button')));
      await tester.pumpAndSettle();

      expect(notifier.state?.deliveryLatitude, 48.0);
      expect(notifier.state?.deliveryLongitude, 107.0);
    },
  );
}
