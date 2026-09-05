import 'package:flutter/material.dart';

import '../../domain/availability.dart';

const _allValue = 'ALL';

String _statusToValue(AvailabilityStatus? status) => switch (status) {
  null => _allValue,
  AvailabilityStatus.inStock => 'IN_STOCK',
  AvailabilityStatus.preOrder => 'PRE_ORDER',
  AvailabilityStatus.outOfStock => 'OUT_OF_STOCK',
};

AvailabilityStatus? _valueToStatus(String value) => switch (value) {
  'IN_STOCK' => AvailabilityStatus.inStock,
  'PRE_ORDER' => AvailabilityStatus.preOrder,
  _ => null,
};

/// Хайлтын мөрийн доорх availability pill segmented control (§7 модуль
/// #3-ийн UX сайжруулалт, 2026-09-05) — Бүгд/Бэлэн/Захиалгын. Backend-ийн
/// Meilisearch индекс branchId-аас хамааралтай ДИНАМИК availability-г
/// хадгалдаггүй тул энэ шүүлтийг `CatalogSearchNotifier.setStatus()`
/// ЗӨВХӨН клиент талд, сүлжээгээр дахин дуудалгүй хэрэгжүүлдэг.
class AvailabilityStatusPill extends StatelessWidget {
  const AvailabilityStatusPill({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  final AvailabilityStatus? selected;
  final ValueChanged<AvailabilityStatus?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: SegmentedButton<String>(
        key: const Key('availability_status_pill'),
        segments: const [
          ButtonSegment(value: _allValue, label: Text('Бүгд')),
          ButtonSegment(value: 'IN_STOCK', label: Text('Бэлэн')),
          ButtonSegment(value: 'PRE_ORDER', label: Text('Захиалгын')),
        ],
        selected: {_statusToValue(selected)},
        onSelectionChanged: (selection) =>
            onSelect(_valueToStatus(selection.first)),
      ),
    );
  }
}
