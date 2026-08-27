import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/format/relative_time.dart';
import '../../branch/presentation/branch_providers.dart';
import '../../returns/presentation/return_providers.dart';
import '../../returns/presentation/widgets/return_status_badge.dart';
import '../data/order_events_client.dart';
import '../domain/order_detail.dart';
import 'checkout_providers.dart';
import 'widgets/order_route_map.dart';
import 'widgets/order_status_timeline.dart';
import 'widgets/order_summary_card.dart';

const _relativeTimeTick = Duration(seconds: 30);

/// Захиалгын явцын дэлгэц (route: `/orders/:id`) — статусын timeline
/// `order.status_changed` WebSocket event-ээр бодит цагт шинэчлэгдэнэ.
/// DELIVERY захиалганд admin-web-ийн `DeliveryRouteMap`-тай ижил зарчмаар
/// зам зурна.
class OrderTrackingScreen extends ConsumerStatefulWidget {
  const OrderTrackingScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderTrackingScreen> createState() =>
      _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends ConsumerState<OrderTrackingScreen> {
  late final OrderEventsClient _eventsClient;
  String? _liveStatus;
  DateTime _lastUpdatedAt = DateTime.now();
  late final Timer _relativeTimeTimer;

  @override
  void initState() {
    super.initState();
    _eventsClient = OrderEventsClient(
      tokenStorage: ref.read(secureTokenStorageProvider),
    );
    _connect();
    // Харагдаж буй "N минутын өмнө" текстийг тогтмол шинэчлэхийн тулд —
    // өөрөө шинэ өгөгдөл татахгүй, зөвхөн харьцангуй цагийн бичвэрийг
    // дахин тооцоолуулахаар setState (no-op) дуудна.
    _relativeTimeTimer = Timer.periodic(_relativeTimeTick, (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  Future<void> _connect() async {
    final socket = await _eventsClient.connect();
    socket.on(
      'connect',
      (_) => _eventsClient.subscribeToOrder(widget.orderId),
    );
    socket.on('order.status_changed', (data) {
      if (!mounted) {
        return;
      }
      final payload = (data as Map).cast<String, dynamic>();
      if (payload['orderId'] != widget.orderId) {
        return;
      }
      setState(() {
        _liveStatus = payload['newStatus'] as String;
        _lastUpdatedAt = DateTime.now();
      });
    });
    // Staff энэ захиалгын буцаалтыг зөвшөөрөх/татгалзах бүрд (§7 модуль #9)
    // badge-ийг бодит цагт шинэчлэх — `subscribeToOrder`-ийн ижил
    // `order:${orderId}` room-д `return.status_changed` ч нийтлэгддэг
    // (order-events.types.ts-ийн ORDER_ITEM_INCLUDE-ийн тайлбарыг үз).
    socket.on('return.status_changed', (data) {
      if (!mounted) {
        return;
      }
      final payload = (data as Map).cast<String, dynamic>();
      if (payload['orderId'] != widget.orderId) {
        return;
      }
      ref.invalidate(orderReturnsProvider(widget.orderId));
    });
  }

  @override
  void dispose() {
    _relativeTimeTimer.cancel();
    _eventsClient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final orderAsync = ref.watch(orderDetailProvider(widget.orderId));
    final branchesAsync = ref.watch(branchesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Захиалгын явц')),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            'Захиалга ачаалахад алдаа гарлаа',
            style: theme.textTheme.bodyMedium,
          ),
        ),
        data: (order) {
          final status = _liveStatus ?? order.status;
          final branchName = branchesAsync.maybeWhen(
            data: (branches) {
              for (final branch in branches) {
                if (branch.id == order.branchId) {
                  return branch.name;
                }
              }
              return null;
            },
            orElse: () => null,
          );
          return ListView(
            key: const Key('order_tracking_list'),
            padding: const EdgeInsets.all(16),
            children: [
              OrderSummaryCard(order: order, branchName: branchName),
              const SizedBox(height: 8),
              Text(
                'Сүүлд шинэчлэгдсэн: ${formatRelativeTime(_lastUpdatedAt)}',
                key: const Key('order_last_updated_text'),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              OrderStatusTimeline(status: status),
              if (order.isDelivery) ...[
                const SizedBox(height: 8),
                _DeliveryRouteSection(order: order),
              ],
              if (order.status == 'COMPLETED') ...[
                const SizedBox(height: 16),
                _ReturnSection(order: order),
              ],
              const SizedBox(height: 16),
              _SupportSection(orderId: order.id),
            ],
          );
        },
      ),
    );
  }
}

/// §7 модуль #13, 11: захиалгын АЛЬ Ч төлөвт (COMPLETED-ээс ХЯЗГААРЛАГДАХГҮЙ
/// — буцаалтаас ЯЛГААТАЙ, харилцагч захиалга хүлээж байх үедээ ч тусламж
/// хэрэгтэй байж болно) харагдана. `/support/new` рүү orderId+
/// category=ORDER_ISSUE-г урьдчилан бөглөж дамжуулна.
class _SupportSection extends StatelessWidget {
  const _SupportSection({required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        key: const Key('request_support_button'),
        onPressed: () => context.push(
          '/support/new',
          extra: {'orderId': orderId, 'category': 'ORDER_ISSUE'},
        ),
        icon: const Icon(Icons.support_agent_outlined),
        label: const Text('Тусламж хүсэх'),
      ),
    );
  }
}

/// COMPLETED захиалганд харагдана (§7 модуль #9): аль хэдийн буцаалт
/// хүссэн бол (хамгийн сүүлд хүссэн item-ийн) статус badge, эс бөгөөс
/// completedAt-аас хойш 7 хоногийн дотор бол "Буцаалт хүсэх" товч.
class _ReturnSection extends ConsumerWidget {
  const _ReturnSection({required this.order});

  final OrderDetail order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final returnsAsync = ref.watch(orderReturnsProvider(order.id));

    return returnsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (returns) {
        if (returns.isNotEmpty) {
          final latest = returns.reduce(
            (a, b) => a.requestedAt.compareTo(b.requestedAt) >= 0 ? a : b,
          );
          return Row(
            key: const Key('return_status_row'),
            children: [
              Text(
                'Буцаалтын хүсэлт:',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(width: 8),
              ReturnStatusBadge(status: latest.status),
            ],
          );
        }
        if (!order.canRequestReturn) {
          return const SizedBox.shrink();
        }
        return SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            key: const Key('request_return_button'),
            onPressed: () => context.push('/orders/${order.id}/return'),
            icon: const Icon(Icons.assignment_return_outlined),
            label: const Text('Буцаалт хүсэх'),
          ),
        );
      },
    );
  }
}

class _DeliveryRouteSection extends ConsumerWidget {
  const _DeliveryRouteSection({required this.order});

  final OrderDetail order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (order.deliveryLatitude == null || order.deliveryLongitude == null) {
      return const SizedBox.shrink();
    }
    final branchesAsync = ref.watch(branchesProvider);
    final routeAsync = ref.watch(orderRouteProvider(order.id));

    return branchesAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (branches) {
        double? branchLat;
        double? branchLng;
        for (final branch in branches) {
          if (branch.id == order.branchId) {
            branchLat = branch.latitude;
            branchLng = branch.longitude;
            break;
          }
        }
        if (branchLat == null || branchLng == null) {
          return const SizedBox.shrink();
        }
        return OrderRouteMap(
          branchLat: branchLat,
          branchLng: branchLng,
          deliveryLat: order.deliveryLatitude!,
          deliveryLng: order.deliveryLongitude!,
          route: routeAsync.value,
          height: 200,
          interactive: false,
        );
      },
    );
  }
}
