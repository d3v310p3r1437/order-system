import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/widgets/cart_app_bar_action.dart';
import '../../checkout/domain/order_detail.dart';
import 'order_list_providers.dart';
import 'widgets/order_list_card.dart';

const _activeStatuses = {'CREATED', 'CONFIRMED', 'PREPARING', 'READY'};

/// Захиалгын түүхийн дэлгэц (Захиалгууд tab, docs/plan.md §7 модуль #6) —
/// идэвхтэй захиалгууд дээд талд тусад нь бүлэглэгдэнэ, tap хийхэд
/// `OrderTrackingScreen` рүү шилжинэ.
class OrderListScreen extends ConsumerWidget {
  const OrderListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(orderListProvider);
    final notifier = ref.read(orderListProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Захиалгууд'),
        actions: const [CartAppBarAction()],
      ),
      body: ordersAsync.when(
        loading: () => const _OrderListSkeleton(),
        error: (error, _) => _ErrorState(onRetry: notifier.refresh),
        data: (orders) {
          if (orders.isEmpty) {
            return _EmptyState(onRefresh: notifier.refresh);
          }
          final active = orders
              .where((o) => _activeStatuses.contains(o.status))
              .toList();
          final history = orders
              .where((o) => !_activeStatuses.contains(o.status))
              .toList();

          return RefreshIndicator(
            onRefresh: notifier.refresh,
            child: ListView(
              key: const Key('order_list'),
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (active.isNotEmpty) ...[
                  _SectionHeader('Идэвхтэй захиалгууд'),
                  const SizedBox(height: 8),
                  for (final order in active) _buildCard(context, order),
                  const SizedBox(height: 16),
                ],
                if (history.isNotEmpty) ...[
                  _SectionHeader('Түүх'),
                  const SizedBox(height: 8),
                  for (final order in history) _buildCard(context, order),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCard(BuildContext context, OrderDetail order) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: OrderListCard(
        order: order,
        onTap: () => context.push('/orders/${order.id}'),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(
        context,
      ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
    );
  }
}

class _OrderListSkeleton extends StatelessWidget {
  const _OrderListSkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView.separated(
      key: const Key('order_list_skeleton'),
      padding: const EdgeInsets.all(16),
      itemCount: 4,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) => Container(
        height: 112,
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
                    Icons.receipt_long_outlined,
                    size: 48,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(height: 16),
                  Text('Захиалга хийгээгүй байна', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    'Каталогоос бүтээгдэхүүн сонгож захиалаарай',
                    style: theme.textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    key: const Key('order_list_go_to_catalog_button'),
                    onPressed: () => context.go('/catalog'),
                    child: const Text('Каталог руу очих'),
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
          Text('Захиалгууд ачаалахад алдаа гарлаа', style: theme.textTheme.titleMedium),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Дахин оролдох')),
        ],
      ),
    );
  }
}
