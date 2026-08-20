import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../domain/order_route.dart';

/// `admin-web`-ийн `DeliveryRouteMap.tsx`-тэй ижил зарчим (Flutter
/// хувилбар) — DELIVERY захиалгад л ашиглагдана. `OrderRoute.geometry` нь
/// backend-ийн [lng, lat] дараалалтай тул `flutter_map`-ийн `LatLng`
/// ([lat, lng])-рүү ЗААВАЛ эргүүлж хөрвүүлнэ.
class OrderRouteMap extends StatelessWidget {
  const OrderRouteMap({
    super.key,
    required this.branchLat,
    required this.branchLng,
    required this.deliveryLat,
    required this.deliveryLng,
    this.route,
    this.height = 220,
    this.interactive = true,
  });

  final double branchLat;
  final double branchLng;
  final double deliveryLat;
  final double deliveryLng;
  final OrderRoute? route;
  final double height;
  final bool interactive;

  @override
  Widget build(BuildContext context) {
    final center = LatLng(
      (branchLat + deliveryLat) / 2,
      (branchLng + deliveryLng) / 2,
    );
    final polylinePoints = (route?.geometry ?? const [])
        .map((point) => LatLng(point[1], point[0]))
        .toList();

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: height,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: center,
            initialZoom: 13,
            interactionOptions: InteractionOptions(
              flags: interactive
                  ? InteractiveFlag.pinchZoom | InteractiveFlag.drag
                  : InteractiveFlag.none,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'mn.order_system.mobile',
            ),
            if (polylinePoints.isNotEmpty)
              PolylineLayer(
                polylines: [
                  Polyline(points: polylinePoints, strokeWidth: 4, color: Colors.blueAccent),
                ],
              ),
            MarkerLayer(
              markers: [
                Marker(
                  point: LatLng(branchLat, branchLng),
                  width: 36,
                  height: 36,
                  child: const Icon(Icons.storefront, color: Colors.indigo, size: 32),
                ),
                Marker(
                  point: LatLng(deliveryLat, deliveryLng),
                  width: 36,
                  height: 36,
                  child: const Icon(Icons.location_pin, color: Colors.redAccent, size: 36),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
