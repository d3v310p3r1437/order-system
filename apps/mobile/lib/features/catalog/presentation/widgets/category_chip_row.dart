import 'package:flutter/material.dart';

import '../../domain/category.dart';

/// Хэвтээ гүйлгэдэг ангиллын chip мөр — эхэнд "Бүгд" (categoryId=null)
/// сонголт, идэвхтэй chip нь primary өнгөөр тодорхой ялгарна.
class CategoryChipRow extends StatelessWidget {
  const CategoryChipRow({
    super.key,
    required this.categories,
    required this.selectedCategoryId,
    required this.onSelect,
  });

  final List<Category> categories;
  final String? selectedCategoryId;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length + 1,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _CategoryChip(
              label: 'Бүгд',
              selected: selectedCategoryId == null,
              onTap: () => onSelect(null),
            );
          }
          final category = categories[index - 1];
          return _CategoryChip(
            label: category.name,
            selected: selectedCategoryId == category.id,
            onTap: () => onSelect(category.id),
          );
        },
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
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
