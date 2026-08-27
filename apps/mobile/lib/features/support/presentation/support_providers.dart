import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/support_repository.dart';
import '../domain/support_ticket.dart';

final supportRepositoryProvider = Provider<SupportRepository>((ref) {
  return SupportRepository(apiClient: ref.watch(apiClientProvider));
});

/// SupportTicketListScreen — `orderListProvider`-той ижил
/// `FutureProvider.autoDispose` (pull-to-refresh `ref.refresh()`-ээр).
final supportTicketListProvider = FutureProvider.autoDispose<
  List<SupportTicket>
>((ref) {
  return ref.watch(supportRepositoryProvider).getTickets();
});

/// SupportTicketDetailScreen — тодорхой ticketId-ийн дэлгэрэнгүй
/// (`messages`-тэй хамт).
final supportTicketDetailProvider = FutureProvider.autoDispose
    .family<SupportTicket, String>((ref, ticketId) {
      return ref.watch(supportRepositoryProvider).getTicket(ticketId);
    });
