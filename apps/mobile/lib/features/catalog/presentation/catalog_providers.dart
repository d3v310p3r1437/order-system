import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/catalog_repository.dart';
import '../domain/availability.dart';
import '../domain/category.dart';
import '../domain/product.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository(apiClient: ref.watch(apiClientProvider));
});

/// Ангиллын жагсаалтыг кэшлэнэ (chip мөрөнд ашиглана) — session бүрд ховор
/// өөрчлөгддөг тул `FutureProvider` (debounce/refetch логик шаардлагагүй).
final categoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.watch(catalogRepositoryProvider).getCategories();
});

const _searchDebounce = Duration(milliseconds: 300);

/// Хайлтын query + сонгосон ангилал/availability — `CatalogSearchNotifier`-ийн
/// дотоод filter төлөв, тестэд шууд харьцуулж болохын тулд тусдаа immutable
/// класс болгосон. `status` (availability pill) нь backend-ийн Meilisearch
/// индекс дэх ЯМАР Ч талбар БИШ (branchId-аас хамааралтай ДИНАМИК утга тул
/// индекслэгддэггүй) — иймд ЗӨВХӨН клиент талд, сүлжээгээр ирсэн үр дүнг
/// дараа нь шүүхэд ашиглагдана (`CatalogSearchNotifier._applyStatusFilter`).
class CatalogFilter {
  const CatalogFilter({this.query = '', this.categoryId, this.status});

  final String query;
  final String? categoryId;
  final AvailabilityStatus? status;

  CatalogFilter copyWithQuery(String query) =>
      CatalogFilter(query: query, categoryId: categoryId, status: status);

  CatalogFilter copyWithCategory(String? categoryId) =>
      CatalogFilter(query: query, categoryId: categoryId, status: status);

  CatalogFilter copyWithStatus(AvailabilityStatus? status) =>
      CatalogFilter(query: query, categoryId: categoryId, status: status);

  @override
  bool operator ==(Object other) =>
      other is CatalogFilter &&
      other.query == query &&
      other.categoryId == categoryId &&
      other.status == status;

  @override
  int get hashCode => Object.hash(query, categoryId, status);
}

/// Каталогийн жагсаалт/хайлтын үр дүн — query өөрчлөгдөхөд `_searchDebounce`
/// хугацаагаар хүлээгээд л (300мс) дуудна, ангилал сонгоход ШУУД
/// (debounce-гүй) дуудна — хэрэглэгч chip дарахад "хариу удаашрах"
/// мэдрэмж өгөхгүйн тулд. availability (status) chip нь СҮЛЖЭЭГЭЭР дахин
/// ДУУДАХГҮЙ, сүүлд ирсэн raw үр дүнгээс л клиент талд дахин шүүнэ.
class CatalogSearchNotifier extends AsyncNotifier<List<Product>> {
  Timer? _debounceTimer;
  CatalogFilter _filter = const CatalogFilter();
  List<Product>? _lastRawResult;

  CatalogFilter get filter => _filter;

  @override
  FutureOr<List<Product>> build() {
    ref.onDispose(() {
      _debounceTimer?.cancel();
    });
    return _fetchAndApply(_filter);
  }

  void setQuery(String query) {
    _filter = _filter.copyWithQuery(query);
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_searchDebounce, () => _reload(_filter));
  }

  void setCategory(String? categoryId) {
    _debounceTimer?.cancel();
    _filter = _filter.copyWithCategory(categoryId);
    _reload(_filter);
  }

  void setStatus(AvailabilityStatus? status) {
    _debounceTimer?.cancel();
    _filter = _filter.copyWithStatus(status);
    final raw = _lastRawResult;
    if (raw == null) {
      // Сүлжээний анхны үр дүн хараахан ирээгүй (жиш: build() хараахан
      // дуусаагүй) бол дахин дуудна — эс бөгөөс "хоосон" төлөвт зогсоно.
      _reload(_filter);
      return;
    }
    state = AsyncData(_applyStatusFilter(raw, status));
  }

  Future<void> refresh() => _reload(_filter);

  Future<void> _reload(CatalogFilter filter) async {
    state = const AsyncLoading<List<Product>>();
    state = await AsyncValue.guard(() => _fetchAndApply(filter));
  }

  Future<List<Product>> _fetchAndApply(CatalogFilter filter) async {
    final result = await ref
        .read(catalogRepositoryProvider)
        .search(q: filter.query, categoryId: filter.categoryId);
    _lastRawResult = result;
    return _applyStatusFilter(result, filter.status);
  }

  List<Product> _applyStatusFilter(
    List<Product> result,
    AvailabilityStatus? status,
  ) {
    if (status == null) return result;
    return result
        .where((p) => p.aggregateAvailability.status == status)
        .toList();
  }
}

final catalogSearchProvider =
    AsyncNotifierProvider<CatalogSearchNotifier, List<Product>>(
      CatalogSearchNotifier.new,
    );

/// Бүтээгдэхүүний дэлгэрэнгүй — productId бүрд тусдаа, `autoDispose`
/// (дэлгэц хаагдмагц кэш цэвэрлэгдэнэ, каталогийн жагсаалттай адил
/// удаан амьдрах шаардлагагүй).
final productDetailProvider = FutureProvider.autoDispose.family<Product, String>((
  ref,
  productId,
) {
  return ref.watch(catalogRepositoryProvider).getProduct(productId);
});
