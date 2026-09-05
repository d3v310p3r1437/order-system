import 'package:flutter/material.dart';

/// Хэвтээ гүйлгэдэг хэмжээний chip мөр — `CategoryChipRow`-той ЯГ ижил
/// (`_CategoryChip`-ийн хэв маягийг дахин ашигласан) зөвхөн эх сурвалж нь
/// `facets.sizes` (боломжит хэмжээ, `GET /catalog/search`-ийн хариунаас,
/// §7 модуль #3-ийн UX сайжруулалт). Хоосон бол ОГТ рендерлэгдэхгүй
/// (дуудагч тал `sizes.isEmpty`-г шалгана).
class SizeChipRow extends StatelessWidget {
  const SizeChipRow({
    super.key,
    required this.sizes,
    required this.selectedSize,
    required this.onSelect,
  });

  final List<String> sizes;
  final String? selectedSize;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        key: const Key('size_chip_row'),
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: sizes.length + 1,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _SizeChip(
              label: 'Бүгд',
              selected: selectedSize == null,
              onTap: () => onSelect(null),
            );
          }
          final size = sizes[index - 1];
          return _SizeChip(
            key: Key('size_chip_$size'),
            label: size,
            selected: selectedSize == size,
            onTap: () => onSelect(size),
          );
        },
      ),
    );
  }
}

class _SizeChip extends StatelessWidget {
  const _SizeChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
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
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: selected
                    ? theme.colorScheme.onPrimary
                    : theme.colorScheme.onSecondary,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
