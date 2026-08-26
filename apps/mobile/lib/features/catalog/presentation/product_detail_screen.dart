import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import 'package:go_router/go_router.dart';

import '../../../core/format/currency.dart';
import '../../cart/presentation/cart_providers.dart';
import '../../reviews/domain/review.dart';
import '../../reviews/presentation/review_providers.dart';
import '../../reviews/presentation/widgets/review_summary_badge.dart';
import '../../reviews/presentation/widgets/review_tile.dart';
import '../domain/availability.dart';
import '../domain/product.dart';
import '../domain/product_variant.dart';
import 'catalog_providers.dart';
import 'widgets/availability_badge.dart';
import 'widgets/product_image_placeholder.dart';

const _inlineReviewLimit = 3;

/// Бүтээгдэхүүний дэлгэрэнгүй (route: `/products/:id`) — Hero-тэй зурган
/// gallery, variant сонголт, тооцоолсон availability, "Сагслах" (§7 модуль
/// #5, `cartProvider.addOne()`).
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  String? _selectedVariantId;

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(productDetailProvider(widget.productId));

    return Scaffold(
      body: productAsync.when(
        loading: () => const _DetailSkeleton(),
        error: (error, _) => _DetailErrorState(
          onRetry: () =>
              ref.invalidate(productDetailProvider(widget.productId)),
        ),
        data: (product) => _ProductDetailBody(
          product: product,
          selectedVariantId: _selectedVariantId,
          onSelectVariant: (id) => setState(() => _selectedVariantId = id),
        ),
      ),
    );
  }
}

class _ProductDetailBody extends ConsumerStatefulWidget {
  const _ProductDetailBody({
    required this.product,
    required this.selectedVariantId,
    required this.onSelectVariant,
  });

  final Product product;
  final String? selectedVariantId;
  final ValueChanged<String> onSelectVariant;

  @override
  ConsumerState<_ProductDetailBody> createState() =>
      _ProductDetailBodyState();
}

class _ProductDetailBodyState extends ConsumerState<_ProductDetailBody> {
  final _pageController = PageController();
  int _page = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final product = widget.product;
    final variant = _resolveSelectedVariant();

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          backgroundColor: theme.colorScheme.surface,
          foregroundColor: theme.colorScheme.onSurface,
          expandedHeight: MediaQuery.of(context).size.width,
          flexibleSpace: FlexibleSpaceBar(
            background: _ImageGallery(
              productId: product.id,
              images: product.images.map((i) => i.url).toList(),
              page: _page,
              controller: _pageController,
              onPageChanged: (page) => setState(() => _page = page),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (product.brand != null) ...[
                  Text(
                    product.brand!.toUpperCase(),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                ],
                Text(
                  product.name,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                _ReviewSummaryRow(productId: product.id),
                const SizedBox(height: 16),
                if (variant != null) ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        formatTugrik(variant.basePrice),
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      AvailabilityBadge(result: variant.availability),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (variant.availability.status ==
                          AvailabilityStatus.preOrder &&
                      variant.availability.leadDays != null)
                    Text(
                      'Захиалснаас хойш ${variant.availability.leadDays} хоногийн дотор бэлэн болно',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                ],
                if (product.variants.length > 1) ...[
                  const SizedBox(height: 24),
                  Text(
                    'Сонголт',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: product.variants
                        .map(
                          (v) => ChoiceChip(
                            key: Key('variant_chip_${v.id}'),
                            label: Text(v.name),
                            selected: v.id == variant?.id,
                            onSelected: (_) => widget.onSelectVariant(v.id),
                          ),
                        )
                        .toList(),
                  ),
                ],
                if (product.description != null &&
                    product.description!.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text(
                    'Тайлбар',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.description!,
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.5),
                  ),
                ],
                const SizedBox(height: 32),
                _AddToCartButton(variant: variant),
                const SizedBox(height: 24),
                if (product.canReview == true)
                  _ReviewActionButton(
                    productId: product.id,
                    existingReview: product.myReview,
                  ),
                const SizedBox(height: 24),
                _ReviewsSection(product: product),
              ],
            ),
          ),
        ),
      ],
    );
  }

  ProductVariant? _resolveSelectedVariant() {
    final product = widget.product;
    if (product.variants.isEmpty) return null;
    if (widget.selectedVariantId != null) {
      for (final v in product.variants) {
        if (v.id == widget.selectedVariantId) return v;
      }
    }
    return product.cheapestVariant;
  }
}

class _ImageGallery extends StatelessWidget {
  const _ImageGallery({
    required this.productId,
    required this.images,
    required this.page,
    required this.controller,
    required this.onPageChanged,
  });

  final String productId;
  final List<String> images;
  final int page;
  final PageController controller;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final background = Theme.of(context).colorScheme.surfaceContainerHighest;
    if (images.isEmpty) {
      return Hero(
        tag: 'product-image-$productId',
        child: const ProductImagePlaceholder(iconSize: 56),
      );
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          controller: controller,
          onPageChanged: onPageChanged,
          itemCount: images.length,
          itemBuilder: (context, index) {
            final image = CachedNetworkImage(
              imageUrl: images[index],
              fit: BoxFit.cover,
              fadeInDuration: const Duration(milliseconds: 250),
              placeholder: (context, _) => Shimmer.fromColors(
                baseColor: background,
                highlightColor: Theme.of(context).colorScheme.surface,
                child: Container(color: background),
              ),
              errorWidget: (context, _, _) => Container(
                color: background,
                alignment: Alignment.center,
                child: const Icon(Icons.broken_image_outlined, size: 40),
              ),
            );
            return index == 0
                ? Hero(tag: 'product-image-$productId', child: image)
                : image;
          },
        ),
        if (images.length > 1)
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(images.length, (index) {
                final active = index == page;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: active ? 20 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: active
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
          ),
      ],
    );
  }
}

class _AddToCartButton extends ConsumerStatefulWidget {
  const _AddToCartButton({required this.variant});

  final ProductVariant? variant;

  @override
  ConsumerState<_AddToCartButton> createState() => _AddToCartButtonState();
}

class _AddToCartButtonState extends ConsumerState<_AddToCartButton> {
  bool _isAdding = false;

  @override
  Widget build(BuildContext context) {
    // `AppTheme`-ийн `elevatedButtonTheme` анхдагчаар аль хэдийн
    // primary/onPrimary (Home дэлгэцийн "Каталог үзэх" карттай ижил
    // визуал жин) тул давхар style override хийгээгүй (login/register-ийн
    // ижил зарчим).
    final variant = widget.variant;
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        key: const Key('add_to_cart_button'),
        icon: _isAdding
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.shopping_cart_outlined),
        label: const Text('Сагслах'),
        onPressed: variant == null || _isAdding
            ? null
            : () => _addToCart(variant.id),
      ),
    );
  }

  Future<void> _addToCart(String variantId) async {
    setState(() => _isAdding = true);
    await ref.read(cartProvider.notifier).addOne(variantId);
    if (!mounted) return;
    setState(() => _isAdding = false);

    final error = ref.read(cartProvider).error;
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error == null
              ? 'Сагсанд нэмэгдлээ'
              : 'Сагсанд нэмэхэд алдаа гарлаа',
        ),
      ),
    );
    // Алдаа гарвал хэрэглэгч энд үлдэж дахин оролдох боломжтой байх ёстой
    // тул зөвхөн амжилттай үед л Каталог руу буцаана.
    if (error == null) {
      Navigator.of(context).pop();
    }
  }
}

/// Нэр/үнийн ойролцоо ★4.5 (23 сэтгэгдэл) badge (§7 модуль #11 6) —
/// `productReviewsProvider`-аас aggregate-ийг уншиж, ачаалж байх/алдааны
/// үед зүгээр л ХООСОН орон зай (жижиг loading indicator ч биш —
/// бүтээгдэхүүний үндсэн мэдээллийг блоклохгүй) харуулна.
class _ReviewSummaryRow extends ConsumerWidget {
  const _ReviewSummaryRow({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(productReviewsProvider(productId));
    return reviewsAsync.when(
      loading: () => const SizedBox(height: 20),
      error: (error, _) => const SizedBox.shrink(),
      data: (data) => ReviewSummaryBadge(
        averageRating: data.averageRating,
        totalCount: data.totalCount,
      ),
    );
  }
}

/// canReview=true үед л харагдана — myReview байгаа эсэхээс хамааран
/// "Үнэлгээ өгөх" (шинээр) эсвэл "Засварлах" (aль хэдийн бичсэн) гэсэн
/// нэртэй товч болно.
class _ReviewActionButton extends StatelessWidget {
  const _ReviewActionButton({required this.productId, this.existingReview});

  final String productId;
  final Review? existingReview;

  @override
  Widget build(BuildContext context) {
    final isEdit = existingReview != null;
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        key: const Key('review_action_button'),
        icon: Icon(isEdit ? Icons.edit_outlined : Icons.star_outline_rounded),
        label: Text(isEdit ? 'Үнэлгээгээ засварлах' : 'Үнэлгээ өгөх'),
        onPressed: () => context.push(
          '/products/$productId/review',
          extra: existingReview,
        ),
      ),
    );
  }
}

/// "Сэтгэгдлүүд" хэсэг — эхний [_inlineReviewLimit] сэтгэгдлийг товч
/// харуулж, олон бол "Бүгдийг харах" товч.
class _ReviewsSection extends ConsumerWidget {
  const _ReviewsSection({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final reviewsAsync = ref.watch(productReviewsProvider(product.id));

    return reviewsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (error, _) => const SizedBox.shrink(),
      data: (data) {
        if (data.reviews.isEmpty) {
          return const SizedBox.shrink();
        }
        final preview = data.reviews.take(_inlineReviewLimit).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Сэтгэгдлүүд',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const Divider(),
            for (final review in preview) ReviewTile(review: review),
            if (data.totalCount > preview.length) ...[
              const SizedBox(height: 4),
              Center(
                child: TextButton(
                  key: const Key('view_all_reviews_button'),
                  onPressed: () =>
                      context.push('/products/${product.id}/reviews'),
                  child: Text('Бүгдийг харах (${data.totalCount})'),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Shimmer.fromColors(
      baseColor: base,
      highlightColor: Theme.of(context).colorScheme.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Container(color: Colors.white),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(height: 20, width: 200, color: Colors.white),
                const SizedBox(height: 12),
                Container(height: 28, width: 120, color: Colors.white),
                const SizedBox(height: 24),
                Container(height: 16, width: double.infinity, color: Colors.white),
                const SizedBox(height: 8),
                Container(height: 16, width: double.infinity, color: Colors.white),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailErrorState extends StatelessWidget {
  const _DetailErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text(
                'Бүтээгдэхүүн ачаалахад алдаа гарлаа',
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onRetry, child: const Text('Дахин оролдох')),
            ],
          ),
        ),
      ),
    );
  }
}
