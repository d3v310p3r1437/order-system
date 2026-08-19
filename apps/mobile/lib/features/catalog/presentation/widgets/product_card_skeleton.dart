import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// `ProductCard`-тай ЯГ ижил хэлбэр хэмжээтэй skeleton — жагсаалт
/// ачаалж байх үед энгийн spinner-ийн оронд карт хэлбэртэй shimmer
/// харуулж, layout "үсрэлт"-гүй болгоно.
class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Shimmer.fromColors(
      baseColor: base,
      highlightColor: Theme.of(context).colorScheme.surface,
      child: Container(
        decoration: BoxDecoration(
          color: base,
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AspectRatio(aspectRatio: 1, child: ColoredBox(color: Colors.white)),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(height: 14, width: 120, color: Colors.white),
                  const SizedBox(height: 8),
                  Container(height: 14, width: 70, color: Colors.white),
                  const SizedBox(height: 8),
                  Container(height: 18, width: 60, color: Colors.white),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
