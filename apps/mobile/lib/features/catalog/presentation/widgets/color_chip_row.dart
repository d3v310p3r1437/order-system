import 'package:flutter/material.dart';

/// Монгол хэл дээрх нийтлэг өнгөний нэрсийг бодит `Color`-т буулгана —
/// `ProductVariant.color`-ийг админ chi чөлөөт текстээр бичдэг (жиш:
/// "улаан") тул ЗӨВХӨН энд танигдсан нэрсийг л дугуй swatch-аар харуулж,
/// танигдаагүй нэрийг саарал fallback + текст label-аар л ялгана (алдаа
/// шидэхгүй, "мэдэхгүй өнгө" гэдгийг чимээгүй барина).
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

Color? _resolveColor(String name) => _knownColorNames[name.trim().toLowerCase()];

/// Хэвтээ гүйлгэдэг өнгөт дугуй chip мөр (§7 модуль #3-ийн UX
/// сайжруулалт, 2026-09-05) — эх сурвалж `facets.colors` (`GET
/// /catalog/search`-ийн хариунаас). Хоосон бол ОГТ рендерлэгдэхгүй.
class ColorChipRow extends StatelessWidget {
  const ColorChipRow({
    super.key,
    required this.colors,
    required this.selectedColor,
    required this.onSelect,
  });

  final List<String> colors;
  final String? selectedColor;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        key: const Key('color_chip_row'),
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: colors.length + 1,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _ColorChip(
              label: 'Бүгд',
              swatch: null,
              selected: selectedColor == null,
              onTap: () => onSelect(null),
            );
          }
          final color = colors[index - 1];
          return _ColorChip(
            key: Key('color_chip_$color'),
            label: color,
            swatch: _resolveColor(color),
            selected: selectedColor == color,
            onTap: () => onSelect(color),
          );
        },
      ),
    );
  }
}

class _ColorChip extends StatelessWidget {
  const _ColorChip({
    super.key,
    required this.label,
    required this.swatch,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final Color? swatch;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: selected ? theme.colorScheme.primary : theme.colorScheme.secondary,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Material(
        color: Colors.transparent,
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
                      border: Border.all(
                        color: selected
                            ? theme.colorScheme.onPrimary
                            : theme.colorScheme.outline,
                        width: 1,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  label,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: selected
                        ? theme.colorScheme.onPrimary
                        : theme.colorScheme.onSecondary,
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
