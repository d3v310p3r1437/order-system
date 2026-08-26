import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/format/currency.dart';
import '../../../catalog/presentation/widgets/product_image_placeholder.dart';
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

/// Захиалгын түүхийн жагсаалтын нэг карт — эхний барааны зураг, дугаар,
/// огноо, дүн, статус badge, барааны товч жагсаалт. Tap хийхэд
/// `OrderTrackingScreen` рүү шилжинэ (`OrderListScreen`-ийн дуудагч тал
/// `onTap`-аар удирдана). (2026-08-26) COMPLETED захиалгад бараа бүрийн
/// доор сэтгэгдэл өгөх/харах мөр нэмэгдэв — `onReviewTap` өгөгдсөн бол
/// (Түүх таб) тухайн item-ийг дамжуулна.
class OrderListCard extends StatelessWidget {
  const OrderListCard({
    super.key,
    required this.order,
    required this.onTap,
    this.onReviewTap,
  });

  final OrderDetail order;
  final VoidCallback onTap;
  final ValueChanged<OrderItemLine>? onReviewTap;

  bool get _showReviewRows => onReviewTap != null && order.status == 'COMPLETED';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final firstImageUrl = order.items.isNotEmpty
        ? order.items.first.productImageUrl
        : null;

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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 56,
                      height: 56,
                      child: firstImageUrl != null
                          ? CachedNetworkImage(
                              imageUrl: firstImageUrl,
                              fit: BoxFit.cover,
                              errorWidget: (_, _, _) =>
                                  const ProductImagePlaceholder(iconSize: 20),
                            )
                          : const ProductImagePlaceholder(iconSize: 20),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
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
                ],
              ),
              if (_showReviewRows && order.items.isNotEmpty) ...[
                const SizedBox(height: 12),
                Divider(height: 1, color: theme.colorScheme.outlineVariant),
                const SizedBox(height: 4),
                for (final item in order.items)
                  _ItemReviewRow(
                    item: item,
                    onTap: () => onReviewTap!(item),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// COMPLETED захиалгын карт доторх бараа бүрийн сэтгэгдлийн мөр —
/// `myReview` байвал одны тоог шууд, байхгүй бол "★ Үнэлэх" текст товч
/// харуулна (хоёулаа `QuickReviewBottomSheet` нээхэд ашиглагдана).
class _ItemReviewRow extends StatelessWidget {
  const _ItemReviewRow({required this.item, required this.onTap});

  final OrderItemLine item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final review = item.myReview;

    return InkWell(
      key: Key('item_review_row_${item.id}'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(
                item.displayName,
                style: theme.textTheme.bodySmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            if (review != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  5,
                  (i) => Icon(
                    i < review.rating
                        ? Icons.star_rounded
                        : Icons.star_border_rounded,
                    size: 14,
                    color: Colors.amber.shade600,
                  ),
                ),
              )
            else
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.star_border_rounded,
                    size: 14,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: 2),
                  Text(
                    'Үнэлэх',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
