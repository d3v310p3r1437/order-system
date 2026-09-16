import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/widgets/cart_app_bar_action.dart';
import '../../checkout/domain/order_detail.dart';
import '../../reviews/domain/review.dart';
import '../../reviews/presentation/widgets/quick_review_bottom_sheet.dart';
import 'order_list_providers.dart';
import 'widgets/order_list_card.dart';

const _activeStatuses = {'CREATED', 'CONFIRMED', 'PREPARING', 'READY'};

/// Захиалгын түүхийн дэлгэц (Захиалгууд tab, docs/plan.md §7 модуль #6) —
/// (2026-08-26) хуучин section-based (Идэвхтэй/Түүх нэг ListView дотор
/// бүлэглэгдсэн) байдлыг жинхэнэ `TabController`+`TabBarView` (swipe
/// хийдэг 2 таб) болгож дахин зохион байгуулав — §7 модуль #6-ийн
/// "Захиалгын түүх → Сэтгэгдэл" даалгаврын дагуу. Түүх таб дахь COMPLETED
/// захиалгын карт бүрийн бараа мөрөнд "★ Үнэлэх"/одны тоо харуулж,
/// `QuickReviewBottomSheet`-ийг нээнэ.
class OrderListScreen extends ConsumerStatefulWidget {
  const OrderListScreen({super.key});

  @override
  ConsumerState<OrderListScreen> createState() => _OrderListScreenState();
}

class _OrderListScreenState extends ConsumerState<OrderListScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(
    length: 2,
    vsync: this,
  );

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _openReview(OrderItemLine item) async {
    final productId = item.productId;
    if (productId == null) {
      return;
    }
    final wasEdit = item.myReview != null;
    await showQuickReviewBottomSheet(
      context: context,
      productId: productId,
      productName: item.displayName,
      productImageUrl: item.productImageUrl,
      existingReview: item.myReview,
      onReviewSaved: (Review review) {
        ref.read(orderListProvider.notifier).applyLocalReview(productId, review);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              wasEdit ? 'Үнэлгээ шинэчлэгдлээ' : 'Үнэлгээ илгээгдлээ',
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(orderListProvider);
    final notifier = ref.read(orderListProvider.notifier);

    // Идэвхтэй/Түүх tab-ийн тоог AppBar.bottom (build()-ийн эхэнд, `orders`
    // ирэхээс өмнө) тодорхойлох ёстой тул `ordersAsync.maybeWhen(data:...)`-аас
    // тооцно — ачаалж байгаа/алдаатай үед тоогүй ("Идэвхтэй"/"Түүх" гэсэн
    // хуучин энгийн шошго хэвээр).
    final orders = ordersAsync.maybeWhen(
      data: (orders) => orders,
      orElse: () => null,
    );
    final activeCount = orders
        ?.where((o) => _activeStatuses.contains(o.status))
        .length;
    final historyCount = orders
        ?.where((o) => !_activeStatuses.contains(o.status))
        .length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Захиалгууд'),
        actions: const [CartAppBarAction()],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              text: activeCount == null ? 'Идэвхтэй' : 'Идэвхтэй ($activeCount)',
            ),
            Tab(
              text: historyCount == null ? 'Түүх' : 'Түүх ($historyCount)',
            ),
          ],
        ),
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

          return TabBarView(
            controller: _tabController,
            children: [
              _OrderListTab(
                key: const Key('active_orders_tab'),
                orders: active,
                emptyText: 'Идэвхтэй захиалга алга байна',
                onRefresh: notifier.refresh,
                onReviewTap: null,
              ),
              _OrderListTab(
                key: const Key('history_orders_tab'),
                orders: history,
                emptyText: 'Захиалгын түүх хараахан алга',
                onRefresh: notifier.refresh,
                onReviewTap: _openReview,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _OrderListTab extends StatelessWidget {
  const _OrderListTab({
    super.key,
    required this.orders,
    required this.emptyText,
    required this.onRefresh,
    required this.onReviewTap,
  });

  final List<OrderDetail> orders;
  final String emptyText;
  final Future<void> Function() onRefresh;
  final ValueChanged<OrderItemLine>? onReviewTap;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      final theme = Theme.of(context);
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.5,
            child: Center(
              child: Text(
                emptyText,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: OrderListCard(
              order: order,
              onTap: () => context.push('/orders/${order.id}'),
              onReviewTap: onReviewTap,
            ),
          );
        },
      ),
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
