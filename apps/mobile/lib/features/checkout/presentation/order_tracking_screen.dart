import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../branch/presentation/branch_providers.dart';
import '../data/order_events_client.dart';
import '../domain/order_detail.dart';
import 'checkout_providers.dart';
import 'widgets/order_route_map.dart';
import 'widgets/order_status_timeline.dart';

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

  @override
  void initState() {
    super.initState();
    _eventsClient = OrderEventsClient(
      tokenStorage: ref.read(secureTokenStorageProvider),
    );
    _connect();
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
      setState(() => _liveStatus = payload['newStatus'] as String);
    });
  }

  @override
  void dispose() {
    _eventsClient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final orderAsync = ref.watch(orderDetailProvider(widget.orderId));

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
          return ListView(
            key: const Key('order_tracking_list'),
            padding: const EdgeInsets.all(16),
            children: [
              OrderStatusTimeline(status: status),
              if (order.isDelivery) ...[
                const SizedBox(height: 8),
                _DeliveryRouteSection(order: order),
              ],
            ],
          );
        },
      ),
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
        );
      },
    );
  }
}
