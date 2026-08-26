import 'package:flutter/material.dart';

/// Нэр/үнийн ойролцоо харагдах товч badge: "★4.5 (23 сэтгэгдэл)" —
/// backend-ийн aggregate-аас ирсэн утгыг ШУУД харуулна, дахин
/// тооцоолохгүй.
class ReviewSummaryBadge extends StatelessWidget {
  const ReviewSummaryBadge({
    super.key,
    required this.averageRating,
    required this.totalCount,
  });

  final double averageRating;
  final int totalCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (totalCount == 0) {
      return Text(
        'Одоогоор сэтгэгдэл алга байна',
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, size: 18, color: Colors.amber.shade600),
        const SizedBox(width: 4),
        Text(
          averageRating.toStringAsFixed(1),
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          '($totalCount сэтгэгдэл)',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
