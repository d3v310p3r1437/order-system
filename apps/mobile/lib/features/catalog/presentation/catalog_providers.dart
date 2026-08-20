import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/catalog_repository.dart';
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

/// Хайлтын query + сонгосон ангилал — `CatalogSearchNotifier`-ийн дотоод
/// filter төлөв, тестэд шууд харьцуулж болохын тулд тусдаа immutable класс
/// болгосон.
class CatalogFilter {
  const CatalogFilter({this.query = '', this.categoryId});

  final String query;
  final String? categoryId;

  CatalogFilter copyWithQuery(String query) =>
      CatalogFilter(query: query, categoryId: categoryId);

  CatalogFilter copyWithCategory(String? categoryId) =>
      CatalogFilter(query: query, categoryId: categoryId);

  @override
  bool operator ==(Object other) =>
      other is CatalogFilter &&
      other.query == query &&
      other.categoryId == categoryId;

  @override
  int get hashCode => Object.hash(query, categoryId);
}

/// Каталогийн жагсаалт/хайлтын үр дүн — query өөрчлөгдөхөд `_searchDebounce`
/// хугацаагаар хүлээгээд л (300мс) дуудна, ангилал сонгоход ШУУД (debounce-
/// гүй) дуудна — хэрэглэгч ангилал дарахад "хариу удаашрах" мэдрэмж
/// өгөхгүйн тулд.
class CatalogSearchNotifier extends AsyncNotifier<List<Product>> {
  Timer? _debounceTimer;
  CatalogFilter _filter = const CatalogFilter();

  CatalogFilter get filter => _filter;

  @override
  FutureOr<List<Product>> build() {
    ref.onDispose(() {
      _debounceTimer?.cancel();
    });
    return _fetch(_filter);
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

  Future<void> refresh() => _reload(_filter);

  Future<void> _reload(CatalogFilter filter) async {
    state = const AsyncLoading<List<Product>>();
    state = await AsyncValue.guard(() => _fetch(filter));
  }

  Future<List<Product>> _fetch(CatalogFilter filter) {
    return ref
        .read(catalogRepositoryProvider)
        .search(q: filter.query, categoryId: filter.categoryId);
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
