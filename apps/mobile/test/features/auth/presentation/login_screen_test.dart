import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/providers.dart';
import 'package:mobile/features/auth/presentation/login_screen.dart';

import '../../../support/fake_secure_token_storage.dart';

void main() {
  Widget wrap(Widget child) {
    return ProviderScope(
      overrides: [secureTokenStorageProvider.overrideWithValue(FakeSecureTokenStorage())],
      child: MaterialApp(home: child),
    );
  }

  testWidgets('талбарууд болон илгээх товч харагдана', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen()));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login_phone_field')), findsOneWidget);
    expect(find.byKey(const Key('login_password_field')), findsOneWidget);
    expect(find.byKey(const Key('login_submit_button')), findsOneWidget);
  });

  testWidgets('хоосон маягтаар илгээхэд validation алдаа харагдана', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('login_submit_button')));
    await tester.pump();

    expect(find.text('Утасны дугаараа оруулна уу'), findsOneWidget);
    expect(find.text('Нууц үгээ оруулна уу'), findsOneWidget);
  });

  testWidgets('буруу форматтай утасны дугаарт E.164 алдаа заана', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('login_phone_field')), '123');
    await tester.enterText(find.byKey(const Key('login_password_field')), 'password123');
    await tester.tap(find.byKey(const Key('login_submit_button')));
    await tester.pump();

    expect(
      find.text('Утасны дугаар E.164 форматтай байх ёстой (жиш: +97688112233)'),
      findsOneWidget,
    );
  });
}
