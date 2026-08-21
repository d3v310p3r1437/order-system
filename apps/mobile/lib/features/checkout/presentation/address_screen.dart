import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../branch/presentation/branch_providers.dart';
import '../domain/geocode_result.dart';
import 'checkout_draft.dart';
import 'checkout_providers.dart';

const _searchDebounce = Duration(milliseconds: 300);
const _selectAnimationDuration = Duration(milliseconds: 500);
// Улаанбаатар хотын төв — салбарын байршил тодорхойгүй үед анхны
// харагдац, `docs/adr/009`-ийн Nominatim/OSM сонголттой нийцтэй анхны
// координат.
const _defaultCenter = LatLng(47.9184, 106.9177);

/// Checkout-ийн 2-р алхам (зөвхөн DELIVERY): газрын зураг дээр төвийн pin
/// чирж/товшиж координатаа тааруулах, эсвэл Nominatim хайлтаар хаяг олох
/// (`docs/adr/009-flutter-map-nominatim.md`). ⚠️ "Баталгаажуулах" товч
/// зөвхөн сонгосон координат (`_center`, эхнээсээ анхны байрлалтай тул
/// ЭХНЭЭСЭЭ идэвхтэй) байгаа эсэхээс хамаарна — хайлтын текстийн
/// хоосон/хоосон биш байдалтай ХОЛБООГҮЙ.
class AddressScreen extends ConsumerStatefulWidget {
  const AddressScreen({super.key});

  @override
  ConsumerState<AddressScreen> createState() => _AddressScreenState();
}

class _AddressScreenState extends ConsumerState<AddressScreen>
    with SingleTickerProviderStateMixin {
  final _mapController = MapController();
  final _searchController = TextEditingController();
  late final AnimationController _animController;
  Timer? _debounceTimer;

  LatLng _center = _defaultCenter;
  List<GeocodeResult> _results = [];
  bool _searching = false;
  bool _searchFailed = false;
  bool _centerInitializedFromBranch = false;
  // GPS-ийн анхны хайлт хараахан дуусаагүй (screen нээгдмэгц эхэлдэг тул
  // анхны утга нь ЗААВАЛ `true` — initState-ийн синхрон хэсэгт setState
  // дуудахаас зайлсхийхийн тулд field-ийн анхны утгаар шууд илэрхийлсэн).
  bool _locationResolving = true;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: _selectAnimationDuration,
    );
    _resolveGpsLocation();
  }

  /// Захиалагчийн бодит GPS байршлыг ав (зөвшөөрөгдсөн бол pin-ийг тэр
  /// байршилд шилжүүлнэ) — татгалзсан/алдаа гарсан бол ХЭЗЭЭ Ч апп-ыг
  /// блокдохгүй, `build()`-ийн доорх сонгосон салбар/хотын төв fallback
  /// логик хэвээрээ ажиллана. `announceErrors: true` (FAB-аас дахин
  /// дуудахад) үед л алдааны SnackBar харуулна — анхны чимээгүй оролдлого
  /// (initState) алдаа гарсан ч хэрэглэгчид юу ч харуулахгүй.
  Future<void> _resolveGpsLocation({bool announceErrors = false}) async {
    try {
      final coords = await ref.read(locationServiceProvider).getCurrentLocation();
      if (!mounted) {
        return;
      }
      final target = LatLng(coords.latitude, coords.longitude);
      // Салбарын fallback centering-ийг (build()-ийн дотор) цаашид дахин
      // ажиллуулахгүй байхын тулд — GPS амжилттай бол ЭНЭ л эцсийн үг.
      _centerInitializedFromBranch = true;
      setState(() {
        _center = target;
        _locationResolving = false;
      });
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _mapController.move(target, 16);
        }
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _locationResolving = false);
      if (announceErrors) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Байршил тодорхойлж чадсангүй')),
        );
      }
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _animController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
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

  /// Газрын зургийг (2-р шаардлагын дагуу товшсон, 4-р шаардлагын дагуу
  /// хайлтын үр дүн сонгосон) `target`-ийн ЯГ төвд байрлуулахаар аяндаа
  /// гөлгөр (400-600мс) шилжинэ — `flutter_map_animations` гэсэн шинэ
  /// dependency нэмэлгүйгээр `AnimationController`+`Tween`-ээр гараар.
  void _animateTo(LatLng target, {double zoom = 16}) {
    final camera = _mapController.camera;
    final latTween = Tween<double>(
      begin: camera.center.latitude,
      end: target.latitude,
    );
    final lngTween = Tween<double>(
      begin: camera.center.longitude,
      end: target.longitude,
    );
    final zoomTween = Tween<double>(begin: camera.zoom, end: zoom);

    void listener() {
      final t = Curves.easeInOut.transform(_animController.value);
      _mapController.move(
        LatLng(latTween.transform(t), lngTween.transform(t)),
        zoomTween.transform(t),
      );
    }

    _animController
      ..removeListener(listener)
      ..addListener(listener)
      ..reset();
    _animController.forward().whenCompleteOrCancel(() {
      _animController.removeListener(listener);
    });
    setState(() => _center = target);
  }

  void _selectResult(GeocodeResult result) {
    setState(() {
      _searchController.text = result.displayName;
      _results = [];
    });
    _animateTo(LatLng(result.latitude, result.longitude));
    FocusScope.of(context).unfocus();
  }

  void _onMapTap(LatLng point) {
    _animateTo(point);
  }

  void _confirm() {
    final address = _searchController.text.trim().isNotEmpty
        ? _searchController.text.trim()
        : 'Сонгосон байршил (${_center.latitude.toStringAsFixed(5)}, '
              '${_center.longitude.toStringAsFixed(5)})';
    ref
        .read(checkoutDraftProvider.notifier)
        .setAddress(
          address: address,
          latitude: _center.latitude,
          longitude: _center.longitude,
        );
    context.push('/checkout/review');
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

    // Анхны нээхэд боломжтой бол сонгосон салбарын байршлаар (тодорхойгүй
    // бол хотын төвөөр) pin эхлүүлнэ — GPS байршил ХЭЗЭЭ Ч ирэхгүй
    // (татгалзсан/алдаа) тохиолдлын fallback. Ганц удаа л ажиллана
    // (`_centerInitializedFromBranch` flag), branchesProvider дахин
    // ачаалагдах/rebuild болох бүрд давтагдахгүй. ⚠️ `_locationResolving`
    // хараахан true байхад (GPS хайлт явж байхад) ЭНЭ блок огт ажиллахгүй
    // — эс бөгөөс GPS амжилттай ирэхээс өмнө салбарын байршил түр зуур
    // "анивчиж" харагдах эрсдэлтэй.
    if (!_locationResolving && !_centerInitializedFromBranch) {
      ref.watch(branchesProvider).whenData((branches) {
        if (_centerInitializedFromBranch) {
          return;
        }
        for (final branch in branches) {
          if (branch.id == draft.branchId &&
              branch.latitude != null &&
              branch.longitude != null) {
            _centerInitializedFromBranch = true;
            final target = LatLng(branch.latitude!, branch.longitude!);
            SchedulerBinding.instance.addPostFrameCallback((_) {
              if (!mounted) {
                return;
              }
              _mapController.move(target, 15);
              setState(() => _center = target);
            });
            break;
          }
        }
      });
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Хүргэлтийн хаяг')),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13,
              onTap: (tapPosition, point) => _onMapTap(point),
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
          // зургийг чирэхэд (эсвэл товшихад, `onTap`-аар тэр цэг рүү
          // `_animateTo`-гоор шилжихэд) pin төвдөө хэвээр үлдэж, доогуур
          // байгаа координат (`_center`) л өөрчлөгдөнө.
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
                      hintText: 'Хаягаар хайх (заавал биш)...',
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
          // "Миний байршил руу очих" — газрын зургийн буланд, GPS хайлт
          // (анхны автомат оролдлого эсвэл энэ товчийг дахин дарсны)
          // явцад spinner-оор орлуулагдана (шаардлага #3-ийн "жижиг,
          // анзаарамгүй ачааллын indicator" — тусдаа overlay нэмэлгүйгээр,
          // яг ЭНЭ товч дотроо харуулав).
          Positioned(
            right: 16,
            bottom: 96,
            child: FloatingActionButton.small(
              key: const Key('my_location_button'),
              heroTag: 'address_my_location_button',
              onPressed: () {
                setState(() => _locationResolving = true);
                _resolveGpsLocation(announceErrors: true);
              },
              child: _locationResolving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location),
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
                    onPressed: _confirm,
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
