import 'package:flutter/material.dart';

// `apps/api/src/orders/order-state-machine.ts`-ийн ALLOWED_TRANSITIONS-тай
// нийцсэн үндсэн дараалал (CANCELLED тусад нь, дараалалд ороогүй).
const _statusFlow = ['CREATED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
const _statusLabels = {
  'CREATED': 'Захиалга үүслээ',
  'CONFIRMED': 'Баталгаажлаа',
  'PREPARING': 'Бэлтгэж байна',
  'READY': 'Бэлэн боллоо',
  'COMPLETED': 'Хүлээлгэн өглөө',
};

/// `OrderTrackingScreen`-ийн статусын timeline — одоогийн алхмыг тод
/// (өнгө+тэмдэглэгээгээр) харуулна, WebSocket `order.status_changed` event
/// ирэх бүрд дуудагч тал (OrderTrackingScreen) шинэ `status`-аар дахин зурна.
class OrderStatusTimeline extends StatelessWidget {
  const OrderStatusTimeline({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (status == 'CANCELLED') {
      return Row(
        key: const Key('order_status_cancelled'),
        children: [
          Icon(Icons.cancel_outlined, color: theme.colorScheme.error),
          const SizedBox(width: 8),
          Text(
            'Захиалга цуцлагдсан',
            style: theme.textTheme.titleSmall?.copyWith(
              color: theme.colorScheme.error,
            ),
          ),
        ],
      );
    }

    final currentIndex = _statusFlow.indexOf(status);
    return Column(
      key: const Key('order_status_timeline'),
      children: [
        for (var i = 0; i < _statusFlow.length; i++)
          _TimelineStep(
            label: _statusLabels[_statusFlow[i]]!,
            reached: currentIndex >= 0 && i <= currentIndex,
            current: i == currentIndex,
            isLast: i == _statusFlow.length - 1,
          ),
      ],
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.label,
    required this.reached,
    required this.current,
    required this.isLast,
  });

  final String label;
  final bool reached;
  final bool current;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = reached
        ? theme.colorScheme.primary
        : theme.colorScheme.outline;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: reached ? color : theme.colorScheme.surface,
                  border: Border.all(color: color, width: 2),
                ),
                child: current
                    ? Icon(Icons.circle, size: 8, color: theme.colorScheme.onPrimary)
                    : null,
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: color.withValues(alpha: reached ? 1 : 0.4)),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Text(
              label,
              style: current
                  ? theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.primary,
                    )
                  : theme.textTheme.bodyMedium?.copyWith(
                      color: reached
                          ? theme.colorScheme.onSurface
                          : theme.colorScheme.onSurfaceVariant,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
