import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/format/currency.dart';
import '../../../cart/presentation/cart_providers.dart';
import '../../domain/product.dart';
import '../../domain/product_variant.dart';
import 'availability_badge.dart';
import 'product_image_placeholder.dart';

/// Монгол хэл дээрх нийтлэг өнгөний нэрсийг бодит `Color`-т буулгана —
/// `ProductVariant.color`-ийг админ чөлөөт текстээр бичдэг (жиш: "улаан")
/// тул ЗӨВХӨН энд танигдсан нэрсийг л дугуй swatch-аар харуулж, танигдаагүй
/// нэрийг саарал fallback + текст label-аар л ялгана (алдаа шидэхгүй).
const Map<String, Color> _knownColorNames = {
  'улаан': Colors.red,
  'час улаан': Color(0xFFDC143C),
  'хөх': Colors.blue,
  'цэнхэр': Colors.lightBlue,
  'ногоон': Colors.green,
  'шар': Colors.yellow,
  'шар ногоон': Color(0xFFADFF2F),
  'цагаан': Colors.white,
  'хар': Colors.black,
  'саарал': Colors.grey,
  'хүрэн': Colors.brown,
  'ягаан': Colors.pink,
  'нил ягаан': Colors.purple,
  'улбар шар': Colors.orange,
  'алтан': Color(0xFFFFD700),
  'мөнгөн': Color(0xFFC0C0C0),
  'тэнгэрийн хөх': Color(0xFF87CEEB),
  'бор': Color(0xFF8B7355),
};

Color? _resolveColor(String name) =>
    _knownColorNames[name.trim().toLowerCase()];

/// Давхцалгүй, хоосон биш утгуудын жагсаалт (эрэмбэ хадгалагдана).
List<String> _distinctNonEmpty(Iterable<String?> values) {
  final result = <String>[];
  for (final v in values) {
    if (v != null && v.isNotEmpty && !result.contains(v)) {
      result.add(v);
    }
  }
  return result;
}

/// `ProductCard`-ийн зурган баруун доод буланд байрлах "Сагслах" FAB
/// дараад нээгддэг bottom sheet — тухайн НЭГ бүтээгдэхүүний дотоод variant
/// сонголт (яг тоо ширхэг +/- сонгодогтой адил, каталогийн ерөнхий
/// шүүлтүүр БИШ): 1-ээс олон variant-тай бол өнгө (дугуй swatch)/хэмжээ
/// (текст chip) тус тусад нь сонгуулж, тухайн хослолд тохирох ГАНЦ
/// variant-ийг тодорхойлно (боломжгүй хослолын chip disabled). Color/size
/// огт бүртгэгдээгүй (хуучин чөлөөт текст нэртэй) variant-уудад л
/// хуучин "variant бүрийг чипээр жагсаах" загвар руу ухардаг. 1
/// variant-тай бол ямар ч chip харагдахгүй, шууд тоо+нэмэх л байна.
/// `QuickReviewBottomSheet`-тэй ЯГ ижил "sheet өөрөө дуудагч талын state
/// мэдэхгүй, зөвхөн cartProvider-оор дамжуулж нэмээд SnackBar-аа өөрөө
/// харуулна" загвар.
class AddToCartBottomSheet extends ConsumerStatefulWidget {
  const AddToCartBottomSheet({super.key, required this.product});

  final Product product;

  @override
  ConsumerState<AddToCartBottomSheet> createState() =>
      _AddToCartBottomSheetState();
}

class _AddToCartBottomSheetState extends ConsumerState<AddToCartBottomSheet> {
  String? _selectedColor;
  String? _selectedSize;
  String? _selectedVariantId;
  int _quantity = 1;
  bool _isAdding = false;

  List<String> get _colors =>
      _distinctNonEmpty(widget.product.variants.map((v) => v.color));

  List<String> get _sizes =>
      _distinctNonEmpty(widget.product.variants.map((v) => v.size));

  bool get _hasStructuredAttributes => _colors.isNotEmpty || _sizes.isNotEmpty;

  @override
  void initState() {
    super.initState();
    final initial = widget.product.cheapestVariant;
    _selectedVariantId = initial?.id;
    _selectedColor = initial?.color;
    _selectedSize = initial?.size;
  }

  ProductVariant? get _selectedVariant {
    if (_hasStructuredAttributes) {
      for (final v in widget.product.variants) {
        if (v.color == _selectedColor && v.size == _selectedSize) return v;
      }
      return null;
    }
    final id = _selectedVariantId;
    if (id == null) return null;
    for (final v in widget.product.variants) {
      if (v.id == id) return v;
    }
    return null;
  }

  /// Тухайн өнгө одоо сонгогдсон хэмжээтэй хослоход бодит variant
  /// байгаа эсэх — байхгүй бол chip disabled харагдана.
  bool _isColorAvailable(String color) => widget.product.variants.any(
    (v) => v.color == color && (_selectedSize == null || v.size == _selectedSize),
  );

  bool _isSizeAvailable(String size) => widget.product.variants.any(
    (v) => v.size == size && (_selectedColor == null || v.color == _selectedColor),
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final product = widget.product;
    final variant = _selectedVariant;
    final colors = _colors;
    final sizes = _sizes;

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
              if (_hasStructuredAttributes) ...[
                if (colors.isNotEmpty) ...[
                  Text(
                    'Өнгө',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: colors.map((color) {
                      final available = _isColorAvailable(color);
                      return _ColorOptionChip(
                        key: Key('add_to_cart_color_chip_$color'),
                        label: color,
                        swatch: _resolveColor(color),
                        selected: color == _selectedColor,
                        onTap: available
                            ? () => setState(() => _selectedColor = color)
                            : null,
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                ],
                if (sizes.isNotEmpty) ...[
                  Text(
                    'Хэмжээ',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: sizes.map((size) {
                      final available = _isSizeAvailable(size);
                      return ChoiceChip(
                        key: Key('add_to_cart_size_chip_$size'),
                        label: Text(size),
                        selected: size == _selectedSize,
                        onSelected: available
                            ? (_) => setState(() => _selectedSize = size)
                            : null,
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                ],
              ] else ...[
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

/// Variant сонголтын дугуй өнгөт chip (`ColorChipRow`-ийн хуучин
/// "хайлтын facet" хувилбартай ижил дизайн, гэхдээ `onTap`-ийг ЗОРИУДАА
/// `null` дамжуулах боломжтой (disabled) — боломжгүй өнгө/хэмжээ
/// хослолыг харуулахад ашиглагдана).
class _ColorOptionChip extends StatelessWidget {
  const _ColorOptionChip({
    super.key,
    required this.label,
    required this.swatch,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final Color? swatch;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final enabled = onTap != null;
    final background = selected
        ? theme.colorScheme.primary
        : theme.colorScheme.secondary;
    final foreground = selected
        ? theme.colorScheme.onPrimary
        : theme.colorScheme.onSecondary;
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (swatch != null) ...[
                  Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: swatch,
                      shape: BoxShape.circle,
                      border: Border.all(color: foreground, width: 1),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  label,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: foreground,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
