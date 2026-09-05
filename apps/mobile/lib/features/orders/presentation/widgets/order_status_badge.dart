import 'package:flutter/material.dart';

const _orderStatusLabels = {
  'CREATED': 'Үүсгэсэн',
  'CONFIRMED': 'Баталгаажсан',
  'PREPARING': 'Бэлтгэж байна',
  'READY': 'Бэлэн болсон',
  'COMPLETED': 'Дууссан',
  'CANCELLED': 'Цуцалсан',
};

/// (2026-09-05, §7 модуль #3-ийн UX сайжруулалт) Захиалгын түүхийн
/// жагсаалтыг НЭГ харцаар хялбар уншихын тулд 6 тусдаа өнгийг 4 бүлэг рүү
/// НЭГТГЭВ: CREATED+CONFIRMED → цэнхэр (эхлэл), PREPARING+READY → шар
/// (явцад байгаа), COMPLETED → ногоон, CANCELLED → улаан. ⚠️ Энэ нь
/// `apps/admin-web/src/components/OrderStatusBadge.tsx`-ийн (6 тусдаа
/// Tailwind slate/blue/amber/violet/emerald/red) хуучин зарчмаас ЗОРИУДАА
/// ХАЗАЙВ — admin-web-д staff бүх статус шилжилтийг НАРИЙВЧЛАН ялгах
/// шаардлагатай (жиш: "PREPARING эсвэл READY аль нь" гэдэг нь тэдэнд
/// ажлын урсгалын хувьд чухал), харин харилцагчийн Mobile талд "миний
/// захиалга ямар үе шатанд байна" гэдгийг ерөнхий 4 бүлгээр л мэдэх
/// хангалттай тул admin-web-ийг ХӨНДӨӨГҮЙ (тусад нь платформ тус бүрийн
/// UX-д тохирсон шийдвэр).
class OrderStatusBadge extends StatelessWidget {
  const OrderStatusBadge({super.key, required this.status, this.dense = false});

  final String status;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final dark = brightness == Brightness.dark;
    final (background, foreground) = switch (status) {
      'CREATED' || 'CONFIRMED' => (
        dark ? const Color(0x263B82F6) : const Color(0xFFDBEAFE),
        dark ? const Color(0xFF93C5FD) : const Color(0xFF1E40AF),
      ),
      'PREPARING' || 'READY' => (
        dark ? const Color(0x26F59E0B) : const Color(0xFFFEF3C7),
        dark ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
      ),
      'COMPLETED' => (
        dark ? const Color(0x2610B981) : const Color(0xFFD1FAE5),
        dark ? const Color(0xFF6EE7B7) : const Color(0xFF065F46),
      ),
      'CANCELLED' => (
        dark ? const Color(0x26EF4444) : const Color(0xFFFEE2E2),
        dark ? const Color(0xFFFCA5A5) : const Color(0xFF991B1B),
      ),
      _ => (
        dark ? const Color(0x2664748B) : const Color(0xFFF1F5F9),
        dark ? const Color(0xFFCBD5E1) : const Color(0xFF1E293B),
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
        _orderStatusLabels[status] ?? status,
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
