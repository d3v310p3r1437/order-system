import 'package:flutter/material.dart';

import '../../../../core/format/currency.dart';
import '../../../checkout/domain/order_detail.dart';
import '../../../checkout/presentation/widgets/order_summary_card.dart';
import 'order_status_badge.dart';

/// "Кока-Кола 0.5Л ×1 +1 өөр" маягийн товч жагсаалт (OrderListScreen-ийн
/// карт бүрийн доод мөр).
String _itemsSummary(List<OrderItemLine> items) {
  if (items.isEmpty) {
    return '';
  }
  final first = items.first;
  final label = '${first.displayName} ×${first.quantity}';
  if (items.length == 1) {
    return label;
  }
  return '$label +${items.length - 1} өөр';
}

String _formatDate(String iso) {
  final date = DateTime.tryParse(iso);
  if (date == null) {
    return '';
  }
  final local = date.toLocal();
  return '${local.year}.${local.month.toString().padLeft(2, '0')}.${local.day.toString().padLeft(2, '0')}';
}

/// Захиалгын түүхийн жагсаалтын нэг карт — дугаар, огноо, дүн, статус
/// badge, барааны товч жагсаалт. Tap хийхэд `OrderTrackingScreen` рүү
/// шилжинэ (`OrderListScreen`-ийн дуудагч тал `onTap`-аар удирдана).
class OrderListCard extends StatelessWidget {
  const OrderListCard({super.key, required this.order, required this.onTap});

  final OrderDetail order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      key: Key('order_list_card_${order.id}'),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    OrderSummaryCard.shortOrderId(order.id),
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _formatDate(order.createdAt),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const Spacer(),
                  OrderStatusBadge(status: order.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _itemsSummary(order.items),
                style: theme.textTheme.bodyMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Text(
                formatTugrik(order.totalAmount),
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
