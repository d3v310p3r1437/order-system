import 'package:flutter/material.dart';

import '../../domain/availability.dart';

/// `apps/admin-web/src/components/AvailabilityBadge.tsx`-тэй ЯГ ижил
/// өнгөний кодчилол (ногоон=IN_STOCK, шар=PRE_ORDER, саарал=OUT_OF_STOCK) —
/// brand identity хоёр платформ хооронд давхарлана.
class AvailabilityBadge extends StatelessWidget {
  const AvailabilityBadge({
    super.key,
    required this.result,
    this.dense = false,
  });

  final AvailabilityResult result;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final (label, background, foreground) = switch (result.status) {
      AvailabilityStatus.inStock => (
        'Бэлэн',
        brightness == Brightness.dark
            ? const Color(0x2610B981)
            : const Color(0xFFD1FAE5),
        brightness == Brightness.dark
            ? const Color(0xFF6EE7B7)
            : const Color(0xFF065F46),
      ),
      AvailabilityStatus.preOrder => (
        result.leadDays != null
            ? 'Захиалгаар · ${result.leadDays} хоног'
            : 'Захиалгаар',
        brightness == Brightness.dark
            ? const Color(0x26F59E0B)
            : const Color(0xFFFEF3C7),
        brightness == Brightness.dark
            ? const Color(0xFFFCD34D)
            : const Color(0xFF92400E),
      ),
      AvailabilityStatus.outOfStock => (
        'Дууссан',
        brightness == Brightness.dark
            ? const Color(0x26EF4444)
            : const Color(0xFFFEE2E2),
        brightness == Brightness.dark
            ? const Color(0xFFFCA5A5)
            : const Color(0xFF991B1B),
      ),
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 10,
        vertical: dense ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: dense ? 11 : 12,
          fontWeight: FontWeight.w600,
          height: 1,
        ),
      ),
    );
  }
}
