// Апп-ийн үндсэн smoke тест — session хадгалагдаагүй үед /login дэлгэц
// анхны байрлал болж ачаалагдахыг баталгаажуулна.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/app/providers.dart';

import 'support/fake_secure_token_storage.dart';

void main() {
  testWidgets('session байхгүй үед LoginScreen ачаалагдана', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureTokenStorageProvider.overrideWithValue(
            FakeSecureTokenStorage(),
          ),
        ],
        child: const OrderSystemApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login_phone_field')), findsOneWidget);
    expect(find.byKey(const Key('login_submit_button')), findsOneWidget);
  });
}
