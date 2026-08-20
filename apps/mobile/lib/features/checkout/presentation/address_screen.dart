import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../domain/geocode_result.dart';
import 'checkout_draft.dart';
import 'checkout_providers.dart';

const _searchDebounce = Duration(milliseconds: 300);
// Улаанбаатар хотын төв — эхний харагдац, `docs/adr/009`-ийн Nominatim/OSM
// сонголттой нийцтэй анхны координат.
const _defaultCenter = LatLng(47.9184, 106.9177);

/// Checkout-ийн 2-р алхам (зөвхөн DELIVERY): газрын зураг дээр төвийн pin
/// чирж координатаа тааруулах, эсвэл Nominatim хайлтаар хаяг олох
/// (`docs/adr/009-flutter-map-nominatim.md`).
class AddressScreen extends ConsumerStatefulWidget {
  const AddressScreen({super.key});

  @override
  ConsumerState<AddressScreen> createState() => _AddressScreenState();
}

class _AddressScreenState extends ConsumerState<AddressScreen> {
  final _mapController = MapController();
  final _searchController = TextEditingController();
  Timer? _debounceTimer;

  LatLng _center = _defaultCenter;
  List<GeocodeResult> _results = [];
  bool _searching = false;
  bool _searchFailed = false;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    // "Баталгаажуулах" товчны идэвхжилт (хоосон эсэх) шууд (debounce-гүй)
    // шинэчлэгдэх ёстой тул тэрхэн даруй setState хийнэ — жинхэнэ хайлтын
    // HTTP дуудлагыг л доор debounce хийнэ.
    setState(() {
      if (query.trim().isEmpty) {
        _results = [];
        _searchFailed = false;
      }
    });
    if (query.trim().isEmpty) {
      return;
    }
    _debounceTimer = Timer(_searchDebounce, () => _runSearch(query));
  }

  Future<void> _runSearch(String query) async {
    setState(() {
      _searching = true;
      _searchFailed = false;
    });
    try {
      final results = await ref
          .read(geocodingRepositoryProvider)
          .search(query);
      if (!mounted) {
        return;
      }
      setState(() {
        _results = results;
        _searching = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _searching = false;
        _searchFailed = true;
      });
    }
  }

  void _selectResult(GeocodeResult result) {
    setState(() {
      _searchController.text = result.displayName;
      _results = [];
    });
    final target = LatLng(result.latitude, result.longitude);
    _mapController.move(target, 16);
    setState(() => _center = target);
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(checkoutDraftProvider);
    if (draft == null) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (context.canPop()) {
          context.pop();
        }
      });
      return const Scaffold(body: SizedBox.shrink());
    }
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Хүргэлтийн хаяг')),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13,
              onPositionChanged: (camera, hasGesture) {
                if (hasGesture) {
                  setState(() => _center = camera.center);
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'mn.order_system.mobile',
              ),
            ],
          ),
          // Газрын зургийн ЯГ төвд тогтмол зогсоо pin — хэрэглэгч газрын
          // зургийг чирэхэд pin төвдөө хэвээр үлдэж, доогуур байгаа
          // координат (`_center`) л өөрчлөгдөнө (түгээмэл "чирж координат
          // тааруулах" UX хэлбэрлэл).
          const IgnorePointer(
            child: Center(
              child: Padding(
                padding: EdgeInsets.only(bottom: 32),
                child: Icon(
                  Icons.location_pin,
                  size: 44,
                  color: Colors.redAccent,
                ),
              ),
            ),
          ),
          Positioned(
            top: 12,
            left: 16,
            right: 16,
            child: Material(
              elevation: 2,
              borderRadius: BorderRadius.circular(12),
              color: theme.colorScheme.surface,
              child: Column(
                children: [
                  TextField(
                    key: const Key('address_search_field'),
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Хаягаар хайх...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searching
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                    onChanged: _onSearchChanged,
                  ),
                  if (_searchFailed)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Хайлт амжилтгүй боллоо — дахин оролдоно уу',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.error,
                          ),
                        ),
                      ),
                    ),
                  if (_results.isNotEmpty)
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 240),
                      child: ListView.separated(
                        key: const Key('address_search_results'),
                        shrinkWrap: true,
                        itemCount: _results.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final result = _results[index];
                          return ListTile(
                            dense: true,
                            leading: const Icon(Icons.place_outlined),
                            title: Text(
                              result.displayName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            onTap: () => _selectResult(result),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  border: Border(top: BorderSide(color: theme.colorScheme.outline)),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: const Key('address_confirm_button'),
                    onPressed: _searchController.text.trim().isEmpty
                        ? null
                        : () {
                            ref
                                .read(checkoutDraftProvider.notifier)
                                .setAddress(
                                  address: _searchController.text.trim(),
                                  latitude: _center.latitude,
                                  longitude: _center.longitude,
                                );
                            context.push('/checkout/review');
                          },
                    child: const Text('Баталгаажуулах'),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
