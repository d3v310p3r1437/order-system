import 'package:flutter/material.dart';

import '../../domain/support_labels.dart';

/// `apps/admin-web/src/components/SupportTicketStatusBadge.tsx`-тэй ЯГ ижил
/// slate/blue/emerald/red өнгөний кодчилол — `ReturnStatusBadge.dart`-ийн
/// ЯГ адилхан brightness-based загвар.
class SupportTicketStatusBadge extends StatelessWidget {
  const SupportTicketStatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final dark = brightness == Brightness.dark;
    final (background, foreground) = switch (status) {
      'OPEN' => (
        dark ? const Color(0x2664748B) : const Color(0xFFF1F5F9),
        dark ? const Color(0xFFCBD5E1) : const Color(0xFF1E293B),
      ),
      'IN_PROGRESS' => (
        dark ? const Color(0x263B82F6) : const Color(0xFFDBEAFE),
        dark ? const Color(0xFF93C5FD) : const Color(0xFF1E40AF),
      ),
      'RESOLVED' => (
        dark ? const Color(0x2610B981) : const Color(0xFFD1FAE5),
        dark ? const Color(0xFF6EE7B7) : const Color(0xFF065F46),
      ),
      'CLOSED' => (
        dark ? const Color(0x26EF4444) : const Color(0xFFFEE2E2),
        dark ? const Color(0xFFFCA5A5) : const Color(0xFF991B1B),
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
        supportStatusLabels[status] ?? status,
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
