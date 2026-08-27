/// `apps/api/src/support/support-ticket.controller.ts`-ийн `SupportMessage`
/// мөр — `POST /support-tickets/:ticketId/messages`-ийн хариу БОЛОН
/// `SupportTicket.messages`-ийн элемент.
class SupportMessage {
  const SupportMessage({
    required this.id,
    required this.ticketId,
    required this.senderId,
    required this.body,
    required this.createdAt,
  });

  factory SupportMessage.fromJson(Map<String, dynamic> json) {
    return SupportMessage(
      id: json['id'] as String,
      ticketId: json['ticketId'] as String,
      senderId: json['senderId'] as String,
      body: json['body'] as String,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String ticketId;
  final String senderId;
  final String body;
  final String createdAt;
}
