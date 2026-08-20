import 'package:flutter/material.dart';

import '../../../../core/format/currency.dart';
import '../../domain/order_detail.dart';

/// `OrderTrackingScreen`-ийн дээд хэсэгт харагдах товч мэдээллийн карт —
/// захиалгын дугаар (богино), салбарын нэр, барааны тоо, нийт дүн.
/// Cart/OrderReview дэлгэцийн `Card`-тай ижил дизайны загвар (cobalt-indigo
/// palette, 8pt grid).
class OrderSummaryCard extends StatelessWidget {
  const OrderSummaryCard({
    super.key,
    required this.order,
    required this.branchName,
  });

  final OrderDetail order;
  final String? branchName;

  static String shortOrderId(String id) {
    final compact = id.replaceAll('-', '');
    final tail = compact.length > 8 ? compact.substring(compact.length - 8) : compact;
    return '#${tail.toUpperCase()}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final itemCount = order.items.fold<int>(0, (sum, line) => sum + line.quantity);

    return Card(
      key: const Key('order_summary_card'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  order.isDelivery
                      ? Icons.local_shipping_outlined
                      : Icons.storefront_outlined,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  shortOrderId(order.id),
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                Text(
                  formatTugrik(order.totalAmount),
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
            if (branchName != null) ...[
              const SizedBox(height: 8),
              Text(branchName!, style: theme.textTheme.bodyMedium),
            ],
            const SizedBox(height: 4),
            Text(
              '$itemCount ширхэг бараа',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
