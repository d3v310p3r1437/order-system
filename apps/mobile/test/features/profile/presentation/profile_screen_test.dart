import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/providers.dart';
import 'package:mobile/features/cart/presentation/cart_providers.dart';
import 'package:mobile/features/profile/presentation/profile_screen.dart';

import '../../../support/fake_cart_repository.dart';
import '../../../support/fake_secure_token_storage.dart';

void main() {
  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/profile',
      routes: [
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          path: '/settings',
          builder: (context, state) => const Scaffold(body: Text('settings')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        secureTokenStorageProvider.overrideWithValue(
          FakeSecureTokenStorage(),
        ),
        cartRepositoryProvider.overrideWithValue(FakeCartRepository()),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('Тохиргоо мөр дарахад /settings руу шилжинэ', (tester) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('profile_logout_tile')), findsOneWidget);

    await tester.tap(find.byKey(const Key('profile_settings_tile')));
    await tester.pumpAndSettle();

    expect(find.text('settings'), findsOneWidget);
  });
}
