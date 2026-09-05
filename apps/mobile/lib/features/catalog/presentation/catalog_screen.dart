import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/widgets/cart_app_bar_action.dart';
import 'catalog_providers.dart';
import 'widgets/availability_status_pill.dart';
import 'widgets/catalog_empty_state.dart';
import 'widgets/category_chip_row.dart';
import 'widgets/product_card.dart';
import 'widgets/product_card_skeleton.dart';

/// Каталог үзэх/хайх дэлгэц (docs/plan.md §7 модуль #3) — хайлт (debounce
/// 300мс), ангиллын chip шүүлт, 2 баганатай grid, pull-to-refresh, 3
/// зохих дизайнтай төлөв (ачаалж/өгөгдөлтэй/хоосон).
class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(catalogSearchProvider);
    final categoriesAsync = ref.watch(categoriesProvider);
    final notifier = ref.read(catalogSearchProvider.notifier);
    final selectedCategoryId = notifier.filter.categoryId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Каталог'),
        actions: const [CartAppBarAction()],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              key: const Key('catalog_search_field'),
              controller: _searchController,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Бүтээгдэхүүн хайх...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _buildSuffixIcon(searchState),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onChanged: notifier.setQuery,
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          const SizedBox(height: 4),
          categoriesAsync.when(
            data: (categories) => categories.isEmpty
                ? const SizedBox.shrink()
                : CategoryChipRow(
                    categories: categories,
                    selectedCategoryId: selectedCategoryId,
                    onSelect: notifier.setCategory,
                  ),
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: AvailabilityStatusPill(
              selected: notifier.filter.status,
              onSelect: notifier.setStatus,
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: RefreshIndicator(
              onRefresh: notifier.refresh,
              child: searchState.when(
                loading: () => const _CatalogGridSkeleton(),
                error: (error, _) => _CatalogErrorState(
                  onRetry: notifier.refresh,
                ),
                data: (products) => products.isEmpty
                    ? SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: SizedBox(
                          height:
                              MediaQuery.of(context).size.height * 0.55,
                          child: CatalogEmptyState(
                            query: notifier.filter.query,
                          ),
                        ),
                      )
                    : GridView.builder(
                        key: const Key('catalog_grid'),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        physics: const AlwaysScrollableScrollPhysics(),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              mainAxisSpacing: 16,
                              crossAxisSpacing: 16,
                              childAspectRatio: 0.62,
                            ),
                        itemCount: products.length,
                        itemBuilder: (context, index) {
                          final product = products[index];
                          return ProductCard(
                            product: product,
                            onTap: () =>
                                context.push('/products/${product.id}'),
                          );
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget? _buildSuffixIcon(AsyncValue<dynamic> searchState) {
    if (searchState.isLoading && searchState.hasValue) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    if (_searchController.text.isEmpty) {
      return null;
    }
    return IconButton(
      key: const Key('catalog_search_clear_button'),
      icon: const Icon(Icons.close),
      onPressed: () {
        _searchController.clear();
        ref.read(catalogSearchProvider.notifier).setQuery('');
        setState(() {});
      },
    );
  }
}

class _CatalogGridSkeleton extends StatelessWidget {
  const _CatalogGridSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      key: const Key('catalog_grid_skeleton'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      physics: const AlwaysScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        childAspectRatio: 0.62,
      ),
      itemCount: 6,
      itemBuilder: (context, index) => const ProductCardSkeleton(),
    );
  }
}

class _CatalogErrorState extends StatelessWidget {
  const _CatalogErrorState({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.55,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.cloud_off_rounded,
                  size: 48,
                  color: theme.colorScheme.error,
                ),
                const SizedBox(height: 16),
                Text(
                  'Каталог ачаалахад алдаа гарлаа',
                  style: theme.textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: onRetry,
                  child: const Text('Дахин оролдох'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
