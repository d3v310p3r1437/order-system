import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/format/currency.dart';
import '../../../cart/presentation/cart_providers.dart';
import '../../domain/product.dart';
import '../../domain/product_variant.dart';
import 'availability_badge.dart';
import 'product_image_placeholder.dart';

/// `ProductCard`-ийн зурган баруун доод буланд байрлах "Сагслах" FAB
/// дараад нээгддэг bottom sheet (§7 модуль #3-ийн UX сайжруулалт,
/// 2026-09-05) — variant сонголт (өнгө/хэмжээ хослол, 1 вариант л бол
/// автоматаар сонгогдсон) + тоо +/- + "Сагсанд нэмэх". `QuickReviewBottomSheet`-тэй
/// (`features/reviews/presentation/widgets/`) ЯГ ижил "sheet өөрөө
/// дуудагч талын state мэдэхгүй, зөвхөн cartProvider-оор дамжуулж
/// нэмээд SnackBar-аа өөрөө харуулна" загвар.
class AddToCartBottomSheet extends ConsumerStatefulWidget {
  const AddToCartBottomSheet({super.key, required this.product});

  final Product product;

  @override
  ConsumerState<AddToCartBottomSheet> createState() =>
      _AddToCartBottomSheetState();
}

class _AddToCartBottomSheetState extends ConsumerState<AddToCartBottomSheet> {
  String? _selectedVariantId;
  int _quantity = 1;
  bool _isAdding = false;

  @override
  void initState() {
    super.initState();
    _selectedVariantId = widget.product.cheapestVariant?.id;
  }

  ProductVariant? get _selectedVariant {
    final id = _selectedVariantId;
    if (id == null) return null;
    for (final v in widget.product.variants) {
      if (v.id == id) return v;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final product = widget.product;
    final variant = _selectedVariant;

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    width: 56,
                    height: 56,
                    child: product.primaryImageUrl != null
                        ? CachedNetworkImage(
                            imageUrl: product.primaryImageUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, _, _) =>
                                const ProductImagePlaceholder(iconSize: 22),
                          )
                        : const ProductImagePlaceholder(iconSize: 22),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    product.name,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (product.variants.length > 1) ...[
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
                        key: Key('add_to_cart_variant_chip_${v.id}'),
                        label: Text(v.variantLabel),
                        selected: v.id == _selectedVariantId,
                        onSelected: (_) =>
                            setState(() => _selectedVariantId = v.id),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 16),
            ],
            if (variant != null)
              Row(
                children: [
                  Text(
                    formatTugrik(variant.basePrice),
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  AvailabilityBadge(result: variant.availability, dense: true),
                ],
              ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Тоо ширхэг', style: theme.textTheme.bodyMedium),
                _QuantityStepper(
                  quantity: _quantity,
                  onDecrement: _quantity > 1
                      ? () => setState(() => _quantity--)
                      : null,
                  onIncrement: () => setState(() => _quantity++),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                key: const Key('add_to_cart_bottom_sheet_submit'),
                icon: _isAdding
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.shopping_cart_outlined),
                label: const Text('Сагсанд нэмэх'),
                onPressed: variant == null || _isAdding ? null : _submit,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final variant = _selectedVariant;
    if (variant == null) return;
    setState(() => _isAdding = true);
    await ref.read(cartProvider.notifier).addQuantity(variant.id, _quantity);
    if (!mounted) return;
    final error = ref.read(cartProvider).error;
    final messenger = ScaffoldMessenger.of(context);
    if (error == null) {
      Navigator.of(context).pop();
      messenger.showSnackBar(
        const SnackBar(content: Text('Сагсанд нэмэгдлээ')),
      );
    } else {
      setState(() => _isAdding = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Сагсанд нэмэхэд алдаа гарлаа')),
      );
    }
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.onDecrement,
    required this.onIncrement,
  });

  final int quantity;
  final VoidCallback? onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _StepperButton(
          key: const Key('add_to_cart_decrement'),
          icon: Icons.remove,
          onPressed: onDecrement,
        ),
        SizedBox(
          width: 32,
          child: Text(
            '$quantity',
            key: const Key('add_to_cart_quantity'),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        _StepperButton(
          key: const Key('add_to_cart_increment'),
          icon: Icons.add,
          onPressed: onIncrement,
        ),
      ],
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({super.key, required this.icon, this.onPressed});

  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final enabled = onPressed != null;
    return Material(
      color: theme.colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            icon,
            size: 18,
            color: enabled
                ? theme.colorScheme.onSurfaceVariant
                : theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.35),
          ),
        ),
      ),
    );
  }
}

/// `showModalBottomSheet` дуудлагыг нэг газар нэгтгэсэн туслах функц —
/// `showQuickReviewBottomSheet()`-ийн ЯГ ижил elevation/shape тохиргоо
/// (доод navigation bar-тай tab-аас нээгдэхэд ч тодорхой ялгарна).
Future<void> showAddToCartBottomSheet({
  required BuildContext context,
  required Product product,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    elevation: 12,
    clipBehavior: Clip.antiAlias,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => AddToCartBottomSheet(product: product),
  );
}
