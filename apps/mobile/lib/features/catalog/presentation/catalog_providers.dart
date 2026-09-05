import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/catalog_repository.dart';
import '../domain/availability.dart';
import '../domain/category.dart';
import '../domain/product.dart';
import '../domain/search_facets.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository(apiClient: ref.watch(apiClientProvider));
});

/// Ангиллын жагсаалтыг кэшлэнэ (chip мөрөнд ашиглана) — session бүрд ховор
/// өөрчлөгддөг тул `FutureProvider` (debounce/refetch логик шаардлагагүй).
final categoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.watch(catalogRepositoryProvider).getCategories();
});

const _searchDebounce = Duration(milliseconds: 300);

/// Хайлтын query + сонгосон ангилал/өнгө/хэмжээ/availability — `CatalogSearchNotifier`-ийн
/// дотоод filter төлөв, тестэд шууд харьцуулж болохын тулд тусдаа immutable
/// класс болгосон. `status` (availability pill) нь backend-ийн Meilisearch
/// индекс дэх ЯМАР Ч талбар БИШ (branchId-аас хамааралтай ДИНАМИК утга тул
/// индекслэгддэггүй) — иймд ЗӨВХӨН клиент талд, сүлжээгээр ирсэн үр дүнг
/// дараа нь шүүхэд ашиглагдана (`CatalogSearchNotifier._applyStatusFilter`).
class CatalogFilter {
  const CatalogFilter({
    this.query = '',
    this.categoryId,
    this.color,
    this.size,
    this.status,
  });

  final String query;
  final String? categoryId;
  final String? color;
  final String? size;
  final AvailabilityStatus? status;

  CatalogFilter copyWithQuery(String query) => CatalogFilter(
    query: query,
    categoryId: categoryId,
    color: color,
    size: size,
    status: status,
  );

  CatalogFilter copyWithCategory(String? categoryId) => CatalogFilter(
    query: query,
    categoryId: categoryId,
    color: color,
    size: size,
    status: status,
  );

  CatalogFilter copyWithColor(String? color) => CatalogFilter(
    query: query,
    categoryId: categoryId,
    color: color,
    size: size,
    status: status,
  );

  CatalogFilter copyWithSize(String? size) => CatalogFilter(
    query: query,
    categoryId: categoryId,
    color: color,
    size: size,
    status: status,
  );

  CatalogFilter copyWithStatus(AvailabilityStatus? status) => CatalogFilter(
    query: query,
    categoryId: categoryId,
    color: color,
    size: size,
    status: status,
  );

  @override
  bool operator ==(Object other) =>
      other is CatalogFilter &&
      other.query == query &&
      other.categoryId == categoryId &&
      other.color == color &&
      other.size == size &&
      other.status == status;

  @override
  int get hashCode => Object.hash(query, categoryId, color, size, status);
}

/// Каталогийн жагсаалт/хайлтын үр дүн — `products` (availability pill-ээр
/// клиент талд шүүгдсэн) + `facets` (сүлжээнээс ирсэн, status filter-ээс
/// ХАМААРАЛГҮЙ — `MeilisearchService.search()`-ийн "facets нь color/size
/// сонголтоос хамааралгүй" зарчмыг Flutter талд ч мөн дагав).
class CatalogSearchState {
  const CatalogSearchState({required this.products, required this.facets});

  static const empty = CatalogSearchState(
    products: [],
    facets: SearchFacets.empty,
  );

  final List<Product> products;
  final SearchFacets facets;
}

/// Каталогийн жагсаалт/хайлтын үр дүн — query өөрчлөгдөхөд `_searchDebounce`
/// хугацаагаар хүлээгээд л (300мс) дуудна, ангилал/өнгө/хэмжээ сонгоход
/// ШУУД (debounce-гүй) дуудна — хэрэглэгч chip дарахад "хариу удаашрах"
/// мэдрэмж өгөхгүйн тулд. availability (status) chip нь СҮЛЖЭЭГЭЭР дахин
/// ДУУДАХГҮЙ, сүүлд ирсэн raw үр дүнгээс л клиент талд дахин шүүнэ.
class CatalogSearchNotifier extends AsyncNotifier<CatalogSearchState> {
  Timer? _debounceTimer;
  CatalogFilter _filter = const CatalogFilter();
  CatalogSearchResult? _lastRawResult;

  CatalogFilter get filter => _filter;

  @override
  FutureOr<CatalogSearchState> build() {
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

  void setColor(String? color) {
    _debounceTimer?.cancel();
    _filter = _filter.copyWithColor(color);
    _reload(_filter);
  }

  void setSize(String? size) {
    _debounceTimer?.cancel();
    _filter = _filter.copyWithSize(size);
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
    state = const AsyncLoading<CatalogSearchState>();
    state = await AsyncValue.guard(() => _fetchAndApply(filter));
  }

  Future<CatalogSearchState> _fetchAndApply(CatalogFilter filter) async {
    final result = await ref
        .read(catalogRepositoryProvider)
        .search(
          q: filter.query,
          categoryId: filter.categoryId,
          color: filter.color,
          size: filter.size,
        );
    _lastRawResult = result;
    return _applyStatusFilter(result, filter.status);
  }

  CatalogSearchState _applyStatusFilter(
    CatalogSearchResult result,
    AvailabilityStatus? status,
  ) {
    final products = status == null
        ? result.products
        : result.products
              .where((p) => p.aggregateAvailability.status == status)
              .toList();
    return CatalogSearchState(products: products, facets: result.facets);
  }
}

final catalogSearchProvider =
    AsyncNotifierProvider<CatalogSearchNotifier, CatalogSearchState>(
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
