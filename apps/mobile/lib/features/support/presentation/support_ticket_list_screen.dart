import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../domain/support_labels.dart';
import '../domain/support_ticket.dart';
import 'support_providers.dart';
import 'widgets/support_ticket_status_badge.dart';

/// §7 модуль #13, 8: "SupportTicketListScreen (жагсаалт, статус badge)".
/// RLS (`support_tickets_select`) CUSTOMER-д зөвхөн ӨӨРИЙН тасалбарыг
/// буцаадаг тул клиент талд дахин шүүлт хийхгүй.
class SupportTicketListScreen extends ConsumerWidget {
  const SupportTicketListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketsAsync = ref.watch(supportTicketListProvider);

    Future<void> refresh() => ref.refresh(supportTicketListProvider.future);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Тусламжийн төв'),
        actions: [
          IconButton(
            key: const Key('new_ticket_button'),
            icon: const Icon(Icons.add),
            tooltip: 'Шинэ тасалбар',
            onPressed: () => context.push('/support/new'),
          ),
        ],
      ),
      body: ticketsAsync.when(
        loading: () => const _SupportListSkeleton(),
        error: (error, _) => _ErrorState(onRetry: refresh),
        data: (tickets) {
          if (tickets.isEmpty) {
            return _EmptyState(onRefresh: refresh);
          }
          return RefreshIndicator(
            onRefresh: refresh,
            child: ListView.separated(
              key: const Key('support_ticket_list'),
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: tickets.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) =>
                  _SupportTicketCard(ticket: tickets[index]),
            ),
          );
        },
      ),
    );
  }
}

class _SupportTicketCard extends StatelessWidget {
  const _SupportTicketCard({required this.ticket});

  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      key: Key('support_ticket_card_${ticket.id}'),
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/support/${ticket.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      ticket.subject,
                      style: theme.textTheme.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  SupportTicketStatusBadge(status: ticket.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                supportCategoryLabels[ticket.category] ?? ticket.category,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _formatDate(ticket.createdAt),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _formatDate(String iso) {
    final date = DateTime.tryParse(iso);
    if (date == null) {
      return iso;
    }
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}

class _SupportListSkeleton extends StatelessWidget {
  const _SupportListSkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView.separated(
      key: const Key('support_ticket_list_skeleton'),
      padding: const EdgeInsets.all(16),
      itemCount: 4,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) => Container(
        height: 88,
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.7,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.support_agent_outlined,
                    size: 48,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(height: 16),
                  Text('Тасалбар хараахан алга', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    'Асуудал/асуулт байвал шинэ тасалбар үүсгээрэй',
                    style: theme.textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_rounded, size: 48, color: theme.colorScheme.error),
          const SizedBox(height: 16),
          Text('Тасалбар ачаалахад алдаа гарлаа', style: theme.textTheme.titleMedium),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Дахин оролдох')),
        ],
      ),
    );
  }
}
