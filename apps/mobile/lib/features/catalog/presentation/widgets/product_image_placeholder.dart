import 'package:flutter/material.dart';

/// Зураггүй бүтээгдэхүүнд зориулсан санаатай placeholder — алдааны дүрс
/// (`broken_image`) БИШ, брэндийн өнгийн зөөлөн градиент дэвсгэр дээр
/// жижиг, subtle `image_outlined` icon ашиглаж "буруу render" шиг
/// санагдахааргүй болгосон. `ProductCard` (жагсаалт) болон
/// `ProductDetailScreen` (дэлгэрэнгүй gallery) хоёуланд ижил зарчмаар
/// ашиглагдана.
class ProductImagePlaceholder extends StatelessWidget {
  const ProductImagePlaceholder({super.key, this.iconSize = 32});

  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colorScheme.secondary, colorScheme.surfaceContainerHighest],
        ),
      ),
      alignment: Alignment.center,
      child: Icon(
        Icons.image_outlined,
        size: iconSize,
        color: colorScheme.onSecondary.withValues(alpha: 0.35),
      ),
    );
  }
}
