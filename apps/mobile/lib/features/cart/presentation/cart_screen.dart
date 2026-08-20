import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/currency.dart';
import '../domain/cart_item.dart';
import 'cart_providers.dart';
import 'widgets/cart_item_tile.dart';

/// Сагсны дэлгэц (docs/plan.md §7 модуль #5) — жагсаалт, тоо хэмжээ +/-,
/// устгах, ойролцоо нийт дүн + "Захиалах" товч (`/branch-select` рүү
/// шилжинэ, эцсийн бодит үнэ/бэлэн байдал тэндээс шалгагдана).
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartAsync = ref.watch(cartProvider);
    final notifier = ref.read(cartProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Сагс'),
        actions: [
          cartAsync.maybeWhen(
            data: (items) => items.isEmpty
                ? const SizedBox.shrink()
                : IconButton(
                    key: const Key('clear_cart_button'),
                    icon: const Icon(Icons.delete_outline),
                    tooltip: 'Сагс цэвэрлэх',
                    onPressed: notifier.clear,
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      // ⚠️ Scaffold.bottomNavigationBar слотыг ЗОРИУДАА ашиглаагүй — доор
      // тайлбарласан бодит (Android emulator дээр screenshot-оор
      // баталгаажуулсан) layout алдаа гарсан: footer тэр слотод байрлахад
      // Scaffold.body 0 өндөртэй болж, footer бүтэн дэлгэцийг эзэлдэг
      // байсан. CatalogScreen-ийн ЯГ адилхан, батлагдсан загвар
      // (Column > Expanded(жагсаалт) + доод хэсэгт footer widget) руу
      // шилжүүлж засав.
      body: cartAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorState(onRetry: notifier.refresh),
        data: (items) {
          if (items.isEmpty) {
            return const _EmptyState();
          }
          return Column(
            children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: notifier.refresh,
                  child: ListView.separated(
                    key: const Key('cart_list'),
                    padding: const EdgeInsets.all(16),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return CartItemTile(
                        item: item,
                        onIncrement: () => notifier.setQuantity(
                          item.variantId,
                          item.quantity + 1,
                        ),
                        onDecrement: item.quantity > 1
                            ? () => notifier.setQuantity(
                                item.variantId,
                                item.quantity - 1,
                              )
                            : null,
                        onRemove: () => notifier.remove(item.variantId),
                      );
                    },
                  ),
                ),
              ),
              _CartFooter(items: items),
            ],
          );
        },
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.shopping_cart_outlined,
              size: 48,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text('Сагс хоосон байна', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'Каталогоос бүтээгдэхүүн сонгож сагслаарай',
              style: theme.textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
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
          Text('Сагс ачаалахад алдаа гарлаа', style: theme.textTheme.titleMedium),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Дахин оролдох')),
        ],
      ),
    );
  }
}

class _CartFooter extends StatelessWidget {
  const _CartFooter({required this.items});

  final List<CartItem> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = items.fold<double>(
      0,
      (sum, item) => sum + item.estimatedLineTotal,
    );

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          border: Border(top: BorderSide(color: theme.colorScheme.outline)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Нийт (ойролцоогоор)', style: theme.textTheme.bodySmall),
                  Text(
                    formatTugrik(total.toStringAsFixed(0)),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            FilledButton(
              key: const Key('go_to_branch_select_button'),
              onPressed: () => context.push('/branch-select'),
              child: const Text('Захиалах'),
            ),
          ],
        ),
      ),
    );
  }
}
