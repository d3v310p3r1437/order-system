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
const _statusIcons = {
  'CREATED': Icons.shopping_cart_outlined,
  'CONFIRMED': Icons.check_circle_outline,
  'PREPARING': Icons.inventory_2_outlined,
  'READY': Icons.local_shipping_outlined,
  'COMPLETED': Icons.flag_outlined,
};
const _stepAnimationDuration = Duration(milliseconds: 500);

/// `OrderTrackingScreen`-ийн статусын timeline — алхам бүрийг тэмдэглэсэн
/// icon-той дугуй (3 өнгөний төлөв: дууссан/идэвхтэй/ирээгүй) + явц ахих
/// тусам дүүрдэг шугамаар зурна. WebSocket `order.status_changed` event
/// ирэх бүрд дуудагч тал (OrderTrackingScreen) шинэ `status`-аар дахин
/// зурж, `AnimatedContainer`-ууд шинэ өнгө рүү аяндаа гөлгөр шилждэг.
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
            statusKey: _statusFlow[i],
            label: _statusLabels[_statusFlow[i]]!,
            icon: _statusIcons[_statusFlow[i]]!,
            done: currentIndex >= 0 && i < currentIndex,
            current: i == currentIndex,
            isLast: i == _statusFlow.length - 1,
          ),
      ],
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.statusKey,
    required this.label,
    required this.icon,
    required this.done,
    required this.current,
    required this.isLast,
  });

  final String statusKey;
  final String label;
  final IconData icon;
  final bool done;
  final bool current;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final reached = done || current;
    final lineColor = reached
        ? theme.colorScheme.primary
        : theme.colorScheme.outlineVariant;

    return IntrinsicHeight(
      key: Key('order_status_step_$statusKey'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              SizedBox(
                width: 36,
                height: 36,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    if (current) _PulsingRing(color: theme.colorScheme.primary),
                    _StepCircle(
                      icon: icon,
                      done: done,
                      current: current,
                      theme: theme,
                    ),
                  ],
                ),
              ),
              if (!isLast)
                Expanded(
                  child: AnimatedContainer(
                    duration: _stepAnimationDuration,
                    curve: Curves.easeInOut,
                    width: 2,
                    color: lineColor,
                  ),
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

class _StepCircle extends StatelessWidget {
  const _StepCircle({
    required this.icon,
    required this.done,
    required this.current,
    required this.theme,
  });

  final IconData icon;
  final bool done;
  final bool current;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    final Color background;
    final Color foreground;
    final Color border;
    if (done) {
      background = theme.colorScheme.primary;
      foreground = theme.colorScheme.onPrimary;
      border = theme.colorScheme.primary;
    } else if (current) {
      background = theme.colorScheme.primaryContainer;
      foreground = theme.colorScheme.primary;
      border = theme.colorScheme.primary;
    } else {
      background = theme.colorScheme.surface;
      foreground = theme.colorScheme.outline;
      border = theme.colorScheme.outlineVariant;
    }

    return AnimatedContainer(
      duration: _stepAnimationDuration,
      curve: Curves.easeInOut,
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: background,
        border: Border.all(color: border, width: 2),
      ),
      child: Icon(done ? Icons.check : icon, size: 16, color: foreground),
    );
  }
}

/// Идэвхтэй (одоогийн) алхмын дугуйн ард аажмаар томорч бүдгэрдэг
/// "pulse" цагираг — захиалга яг ЭНЭ алхамд байгааг анхаарал татахуйц
/// (гэхдээ тайван, яаруу бус) байдлаар онцолно.
class _PulsingRing extends StatefulWidget {
  const _PulsingRing({required this.color});

  final Color color;

  @override
  State<_PulsingRing> createState() => _PulsingRingState();
}

class _PulsingRingState extends State<_PulsingRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        return Opacity(
          opacity: (1 - t).clamp(0.0, 1.0) * 0.5,
          child: Transform.scale(
            scale: 1 + t * 0.6,
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color,
              ),
            ),
          ),
        );
      },
    );
  }
}
