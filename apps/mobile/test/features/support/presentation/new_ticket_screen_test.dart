import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/support/presentation/new_ticket_screen.dart';
import 'package:mobile/features/support/presentation/support_providers.dart';

import '../../../support/fake_support_repository.dart';

void main() {
  late FakeSupportRepository repository;

  setUp(() {
    repository = FakeSupportRepository();
  });

  Widget wrap({String? initialOrderId, String? initialCategory}) {
    final router = GoRouter(
      initialLocation: '/support/new',
      routes: [
        GoRoute(
          path: '/support/new',
          builder: (context, state) => NewTicketScreen(
            initialOrderId: initialOrderId,
            initialCategory: initialCategory,
          ),
        ),
        GoRoute(
          path: '/support/:id',
          // Бодит SupportTicketDetailScreen нь WebSocket холболт нээдэг
          // (OrderTrackingScreen-тэй ижил, тест орчинд асуудалтай) тул
          // тестэд зөвхөн pushReplacement хийгдсэн ЭСЭХ, аль ID рүү
          // шилжсэнийг л шалгах stub Scaffold ашиглав.
          builder: (context, state) =>
              Scaffold(body: Text('ticket-detail-${state.pathParameters['id']}')),
        ),
      ],
    );
    return ProviderScope(
      overrides: [supportRepositoryProvider.overrideWithValue(repository)],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  testWidgets('гарчиг хоосон бол Илгээх дарахад createTicket ОГТ дуудагдахгүй', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('submit_new_ticket_button')));
    await tester.pumpAndSettle();

    expect(repository.createCalls, isEmpty);
    expect(find.text('Гарчиг заавал бөглөнө'), findsOneWidget);
  });

  testWidgets(
    'гарчиг+мессеж бичээд Илгээх дарахад createTicket+addMessage дуудагдаж, дэлгэрэнгүй рүү шилжинэ',
    (tester) async {
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('new_ticket_subject_field')),
        'Хямдралын купон ажиллахгүй байна',
      );
      await tester.enterText(
        find.byKey(const Key('new_ticket_message_field')),
        'Купон код оруулахад алдаа гарч байна',
      );
      await tester.tap(find.byKey(const Key('submit_new_ticket_button')));
      await tester.pumpAndSettle();

      expect(repository.createCalls, hasLength(1));
      expect(
        repository.createCalls.first.subject,
        'Хямдралын купон ажиллахгүй байна',
      );
      expect(repository.addMessageCalls, hasLength(1));
      expect(
        repository.addMessageCalls.first.body,
        'Купон код оруулахад алдаа гарч байна',
      );
      expect(find.text('ticket-detail-ticket-1'), findsOneWidget);
    },
  );

  testWidgets(
    'initialOrderId/initialCategory өгөгдсөн бол урьдчилан бөглөгдөж, createTicket-д дамжина (§7 модуль #13, 11)',
    (tester) async {
      await tester.pumpWidget(
        wrap(initialOrderId: '12345678-aaaa-bbbb-cccc-111111111111', initialCategory: 'ORDER_ISSUE'),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Захиалга №12345678'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('new_ticket_subject_field')),
        'Захиалга ирээгүй',
      );
      await tester.tap(find.byKey(const Key('submit_new_ticket_button')));
      await tester.pumpAndSettle();

      expect(repository.createCalls, hasLength(1));
      expect(repository.createCalls.first.category, 'ORDER_ISSUE');
      expect(
        repository.createCalls.first.orderId,
        '12345678-aaaa-bbbb-cccc-111111111111',
      );
    },
  );

  testWidgets('createTicket алдаа буцаавал SnackBar-аар алдааны мессеж харуулна', (
    tester,
  ) async {
    repository.createTicketError = const ApiException(
      code: 'ORDER_NOT_FOUND',
      message: 'Захиалга олдсонгүй',
    );
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('new_ticket_subject_field')),
      'Тест',
    );
    await tester.tap(find.byKey(const Key('submit_new_ticket_button')));
    await tester.pumpAndSettle();

    expect(find.text('Захиалга олдсонгүй'), findsOneWidget);
  });
}
