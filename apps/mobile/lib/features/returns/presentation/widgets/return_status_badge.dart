import 'package:flutter/material.dart';

const _returnStatusLabels = {
  'REQUESTED': 'Хүсэлт гаргасан',
  'APPROVED': 'Зөвшөөрсөн',
  'REJECTED': 'Татгалзсан',
  'REFUNDED': 'Буцаагдсан',
  'REFUND_FAILED': 'Буцаалт амжилтгүй',
};

/// `apps/admin-web/src/components/ReturnStatusBadge.tsx`-тэй ЯГ ижил
/// Tailwind slate/blue/red/emerald/amber өнгөний кодчилол (brightness-ээр
/// хос хатуу утга — `AvailabilityBadge`-ийн ЯГ адилхан загвар, учир нь
/// эдгээр семантик өнгө `Theme.colorScheme`-д байхгүй).
class ReturnStatusBadge extends StatelessWidget {
  const ReturnStatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final dark = brightness == Brightness.dark;
    final (background, foreground) = switch (status) {
      'REQUESTED' => (
        dark ? const Color(0x2664748B) : const Color(0xFFF1F5F9),
        dark ? const Color(0xFFCBD5E1) : const Color(0xFF1E293B),
      ),
      'APPROVED' => (
        dark ? const Color(0x263B82F6) : const Color(0xFFDBEAFE),
        dark ? const Color(0xFF93C5FD) : const Color(0xFF1E40AF),
      ),
      'REJECTED' => (
        dark ? const Color(0x26EF4444) : const Color(0xFFFEE2E2),
        dark ? const Color(0xFFFCA5A5) : const Color(0xFF991B1B),
      ),
      'REFUNDED' => (
        dark ? const Color(0x2610B981) : const Color(0xFFD1FAE5),
        dark ? const Color(0xFF6EE7B7) : const Color(0xFF065F46),
      ),
      'REFUND_FAILED' => (
        dark ? const Color(0x26F59E0B) : const Color(0xFFFEF3C7),
        dark ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
      ),
      _ => (
        dark ? const Color(0x2664748B) : const Color(0xFFF1F5F9),
        dark ? const Color(0xFFCBD5E1) : const Color(0xFF1E293B),
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _returnStatusLabels[status] ?? status,
        style: TextStyle(
          color: foreground,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          height: 1,
        ),
      ),
    );
  }
}
