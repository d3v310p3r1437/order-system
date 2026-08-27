import 'support_message.dart';

/// `apps/api/src/support/support-ticket.controller.ts`-ийн `SupportTicket`
/// мөр — `GET /support-tickets`/`POST /support-tickets`-ийн хариу
/// `messages`-гүй, `GET /support-tickets/:id`-ийн хариу `messages`-тэй
/// ирнэ (backend-ийн `TICKET_WITH_MESSAGES_INCLUDE`-той тохирно).
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.customerId,
    this.orderId,
    required this.subject,
    required this.category,
    required this.status,
    required this.createdAt,
    this.resolvedAt,
    this.closedAt,
    this.messages = const [],
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    final rawMessages = json['messages'] as List<dynamic>?;
    return SupportTicket(
      id: json['id'] as String,
      customerId: json['customerId'] as String,
      orderId: json['orderId'] as String?,
      subject: json['subject'] as String,
      category: json['category'] as String,
      status: json['status'] as String,
      createdAt: json['createdAt'] as String,
      resolvedAt: json['resolvedAt'] as String?,
      closedAt: json['closedAt'] as String?,
      messages: rawMessages == null
          ? const []
          : rawMessages
                .cast<Map<String, dynamic>>()
                .map(SupportMessage.fromJson)
                .toList(),
    );
  }

  final String id;
  final String customerId;
  final String? orderId;
  final String subject;
  final String category;
  final String status;
  final String createdAt;
  final String? resolvedAt;
  final String? closedAt;
  final List<SupportMessage> messages;

  bool get isClosed => status == 'CLOSED';

  SupportTicket copyWith({String? status, List<SupportMessage>? messages}) {
    return SupportTicket(
      id: id,
      customerId: customerId,
      orderId: orderId,
      subject: subject,
      category: category,
      status: status ?? this.status,
      createdAt: createdAt,
      resolvedAt: resolvedAt,
      closedAt: closedAt,
      messages: messages ?? this.messages,
    );
  }
}
