import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/support/data/support_repository.dart';
import 'package:mobile/features/support/domain/support_message.dart';
import 'package:mobile/features/support/domain/support_ticket.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake — `FakeReturnRepository`-тэй
/// ижил загвар.
class FakeSupportRepository implements SupportRepository {
  List<SupportTicket> tickets = [];
  ApiException? getTicketsError;
  ApiException? getTicketError;
  ApiException? createTicketError;
  ApiException? addMessageError;

  final List<({String subject, String category, String? orderId})>
  createCalls = [];
  final List<({String ticketId, String body})> addMessageCalls = [];

  @override
  Future<List<SupportTicket>> getTickets() async {
    if (getTicketsError != null) {
      throw getTicketsError!;
    }
    return tickets;
  }

  @override
  Future<SupportTicket> getTicket(String id) async {
    if (getTicketError != null) {
      throw getTicketError!;
    }
    return tickets.firstWhere((t) => t.id == id);
  }

  @override
  Future<SupportTicket> createTicket({
    required String subject,
    required String category,
    String? orderId,
  }) async {
    createCalls.add((subject: subject, category: category, orderId: orderId));
    if (createTicketError != null) {
      throw createTicketError!;
    }
    final ticket = SupportTicket(
      id: 'ticket-${createCalls.length}',
      customerId: 'cust-1',
      orderId: orderId,
      subject: subject,
      category: category,
      status: 'OPEN',
      createdAt: DateTime(2026, 8, 27).toIso8601String(),
    );
    tickets = [...tickets, ticket];
    return ticket;
  }

  @override
  Future<SupportMessage> addMessage(String ticketId, String body) async {
    addMessageCalls.add((ticketId: ticketId, body: body));
    if (addMessageError != null) {
      throw addMessageError!;
    }
    final message = SupportMessage(
      id: 'msg-${addMessageCalls.length}',
      ticketId: ticketId,
      senderId: 'cust-1',
      body: body,
      createdAt: DateTime(2026, 8, 27).toIso8601String(),
    );
    tickets = tickets
        .map(
          (t) => t.id == ticketId
              ? t.copyWith(messages: [...t.messages, message])
              : t,
        )
        .toList();
    return message;
  }
}
