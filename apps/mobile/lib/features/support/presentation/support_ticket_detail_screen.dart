import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../checkout/data/order_events_client.dart';
import '../domain/support_message.dart';
import 'support_providers.dart';
import 'widgets/support_ticket_status_badge.dart';

/// §7 модуль #13, 10: "SupportTicketDetailScreen: чат маягийн UI (өөрийн/
/// staff-ийн мессежийг өөр талд, өөр өнгөөр), WebSocket-оор бодит цагт
/// шинэ мессеж ирнэ, доод талд бичих талбар". `OrderTrackingScreen`-тэй
/// ЯГ ижил "screen өөрөө WS client lifecycle-аа удирддаг" зарчим —
/// `OrderEventsClient`-д Riverpod provider ЗОРИУДАА бичээгүй (autoDispose
/// listener бүртгэгдэхгүй бол шууд dispose хийчихдэг эрсдэлээс сэргийлнэ).
class SupportTicketDetailScreen extends ConsumerStatefulWidget {
  const SupportTicketDetailScreen({super.key, required this.ticketId});

  final String ticketId;

  @override
  ConsumerState<SupportTicketDetailScreen> createState() =>
      _SupportTicketDetailScreenState();
}

class _SupportTicketDetailScreenState
    extends ConsumerState<SupportTicketDetailScreen> {
  late final OrderEventsClient _eventsClient;
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _eventsClient = OrderEventsClient(
      tokenStorage: ref.read(secureTokenStorageProvider),
    );
    _connect();
  }

  Future<void> _connect() async {
    final socket = await _eventsClient.connect();
    socket.on(
      'connect',
      (_) => _eventsClient.subscribeToTicket(widget.ticketId),
    );
    socket.on('support.message.created', (data) {
      if (!mounted) {
        return;
      }
      final payload = (data as Map).cast<String, dynamic>();
      if (payload['ticketId'] != widget.ticketId) {
        return;
      }
      ref.invalidate(supportTicketDetailProvider(widget.ticketId));
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _eventsClient.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _messageController.text.trim();
    if (body.isEmpty || _sending) {
      return;
    }
    setState(() => _sending = true);
    try {
      await ref
          .read(supportRepositoryProvider)
          .addMessage(widget.ticketId, body);
      _messageController.clear();
      ref.invalidate(supportTicketDetailProvider(widget.ticketId));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Мессеж илгээхэд алдаа гарлаа')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ticketAsync = ref.watch(supportTicketDetailProvider(widget.ticketId));

    return Scaffold(
      appBar: AppBar(
        title: ticketAsync.maybeWhen(
          data: (ticket) => Text(ticket.subject),
          orElse: () => const Text('Тасалбар'),
        ),
        actions: [
          ticketAsync.maybeWhen(
            data: (ticket) => Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: SupportTicketStatusBadge(status: ticket.status),
              ),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: ticketAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            'Тасалбар ачаалахад алдаа гарлаа',
            style: theme.textTheme.bodyMedium,
          ),
        ),
        data: (ticket) {
          return Column(
            children: [
              Expanded(
                child: ticket.messages.isEmpty
                    ? Center(
                        child: Text(
                          'Мессеж хараахан алга',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      )
                    : ListView.builder(
                        key: const Key('support_message_list'),
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: ticket.messages.length,
                        itemBuilder: (context, index) {
                          final message = ticket.messages[index];
                          // Mobile ЗӨВХӨН харилцагчид зориулагдсан тул
                          // "өөрийн" гэдгийг senderId==ticket.customerId
                          // (эцэг тасалбарын эзэн) харьцуулж шийднэ —
                          // JWT/auth state-ээс тусад нь userId унших
                          // шаардлагагүй (ADR 005 "ганц газар л шийднэ"
                          // зарчимтай төстэй, хамгийн энгийн найдвартай зам).
                          final isOwn = message.senderId == ticket.customerId;
                          return _MessageBubble(message: message, isOwn: isOwn);
                        },
                      ),
              ),
              _ComposerBar(
                controller: _messageController,
                sending: _sending,
                enabled: !ticket.isClosed,
                onSend: _send,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.isOwn});

  final SupportMessage message;
  final bool isOwn;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Align(
      alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        key: Key('support_message_${message.id}'),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isOwn
              ? theme.colorScheme.primary
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message.body,
              style: TextStyle(
                color: isOwn
                    ? theme.colorScheme.onPrimary
                    : theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComposerBar extends StatelessWidget {
  const _ComposerBar({
    required this.controller,
    required this.sending,
    required this.enabled,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final bool enabled;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (!enabled) {
      return SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            border: Border(top: BorderSide(color: theme.colorScheme.outline)),
          ),
          child: Text(
            'Хаагдсан тасалбарт мессеж бичих боломжгүй',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      );
    }

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 20),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          border: Border(top: BorderSide(color: theme.colorScheme.outline)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                key: const Key('support_message_field'),
                controller: controller,
                minLines: 1,
                maxLines: 4,
                decoration: const InputDecoration(hintText: 'Мессеж бичих…'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              key: const Key('send_support_message_button'),
              onPressed: sending ? null : onSend,
              icon: sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}
