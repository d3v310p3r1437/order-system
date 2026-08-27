import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/support/domain/support_ticket.dart';
import 'package:mobile/features/support/presentation/support_providers.dart';
import 'package:mobile/features/support/presentation/support_ticket_list_screen.dart';

import '../../../support/fake_support_repository.dart';

void main() {
  late FakeSupportRepository repository;

  setUp(() {
    repository = FakeSupportRepository();
  });

  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/support',
      routes: [
        GoRoute(
          path: '/support',
          builder: (context, state) => const SupportTicketListScreen(),
        ),
        GoRoute(
          path: '/support/new',
          builder: (context, state) => const Scaffold(body: Text('new-ticket')),
        ),
        GoRoute(
          path: '/support/:id',
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

  testWidgets('ачаалж байх үед skeleton харагдана', (tester) async {
    await tester.pumpWidget(wrap());

    expect(
      find.byKey(const Key('support_ticket_list_skeleton')),
      findsOneWidget,
    );
  });

  testWidgets('тасалбар байхгүй үед empty state харагдана', (tester) async {
    repository.tickets = [];
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('Тасалбар хараахан алга'), findsOneWidget);
  });

  testWidgets(
    'тасалбарын жагсаалт, статус, ангилал харагдана, карт дээр дарахад дэлгэрэнгүй рүү шилжинэ',
    (tester) async {
      repository.tickets = [
        SupportTicket(
          id: 'ticket-1',
          customerId: 'cust-1',
          orderId: 'order-1',
          subject: 'Захиалга ирсэнгүй',
          category: 'ORDER_ISSUE',
          status: 'OPEN',
          createdAt: DateTime(2026, 8, 27).toIso8601String(),
        ),
      ];
      await tester.pumpWidget(wrap());
      await tester.pumpAndSettle();

      expect(find.text('Захиалга ирсэнгүй'), findsOneWidget);
      expect(find.text('Захиалгын асуудал'), findsOneWidget);
      expect(find.text('Нээлттэй'), findsOneWidget);

      await tester.tap(find.byKey(const Key('support_ticket_card_ticket-1')));
      await tester.pumpAndSettle();

      expect(find.text('ticket-detail-ticket-1'), findsOneWidget);
    },
  );

  testWidgets('"+" товч дарахад шинэ тасалбар үүсгэх дэлгэц рүү шилжинэ', (
    tester,
  ) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('new_ticket_button')));
    await tester.pumpAndSettle();

    expect(find.text('new-ticket'), findsOneWidget);
  });
}
