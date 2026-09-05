import 'package:mobile/features/catalog/data/catalog_repository.dart';
import 'package:mobile/features/catalog/domain/availability.dart';
import 'package:mobile/features/catalog/domain/category.dart';
import 'package:mobile/features/catalog/domain/product.dart';
import 'package:mobile/features/catalog/domain/product_image.dart';
import 'package:mobile/features/catalog/domain/product_variant.dart';
import 'package:mobile/features/catalog/domain/search_facets.dart';
import 'package:mobile/features/reviews/domain/review.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake — `CatalogSearchNotifier`/
/// `CatalogScreen`-ийн логикийг (debounce, filter, 3 UI төлөв) тусад нь
/// шалгахын тулд `catalogRepositoryProvider`-ийг ЭНЭ-ээр orlуулна
/// (`test/features/auth/auth_provider_test.dart`-ийн `_FakeAuthRepository`
/// загвартай адил).
class FakeCatalogRepository implements CatalogRepository {
  List<Category> categories = [];
  List<Product> Function(String q, String? categoryId)? searchHandler;
  Object? searchError;
  Product Function(String id)? getProductHandler;

  /// Хайлт бүрд буцаах facets — `color`/`size` query параметрээс
  /// ХАМААРАЛГҮЙ (бодит backend-ийн `MeilisearchService.search()`-тэй ижил
  /// зарчим), тест бүрд шаардлагатай бол шууд тохируулна.
  SearchFacets facets = SearchFacets.empty;

  /// Тестэд "ачаалж байгаа" төлөвийг (нэг frame-ийн турш ч) баримтжуулах
  /// боломж олгодог — жинхэнэ HTTP хүсэлт шиг микротаск дунд шууд
  /// биелэхгүй, `await tester.pump()`-ийн дараа ажиглагдахуйц зайтай болно.
  Duration delay = Duration.zero;

  int searchCallCount = 0;
  final List<({String q, String? categoryId, String? color, String? size})>
  searchCalls = [];

  @override
  Future<List<Category>> getCategories() async => categories;

  @override
  Future<CatalogSearchResult> search({
    String? q,
    String? categoryId,
    String? color,
    String? size,
  }) async {
    searchCallCount++;
    searchCalls.add((q: q ?? '', categoryId: categoryId, color: color, size: size));
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    if (searchError != null) {
      throw searchError!;
    }
    return CatalogSearchResult(
      products: searchHandler?.call(q ?? '', categoryId) ?? [],
      facets: facets,
    );
  }

  @override
  Future<Product> getProduct(String id) async {
    final handler = getProductHandler;
    if (handler == null) throw UnimplementedError();
    return handler(id);
  }
}

Product buildTestProduct({
  required String id,
  String name = 'Тест бүтээгдэхүүн',
  String price = '45000.00',
  AvailabilityStatus status = AvailabilityStatus.inStock,
  int? leadDays,
  String? imageUrl,
  bool? canReview,
  Review? myReview,
}) {
  return Product(
    id: id,
    name: name,
    slug: 'test-$id',
    isActive: true,
    canReview: canReview,
    myReview: myReview,
    images: imageUrl == null
        ? []
        : [
            ProductImage(
              id: 'img-$id',
              productId: id,
              displayOrder: 0,
              url: imageUrl,
            ),
          ],
    variants: [
      ProductVariant(
        id: 'variant-$id',
        productId: id,
        name: 'Стандарт',
        sku: 'SKU-$id',
        unit: 'ширхэг',
        basePrice: price,
        isActive: true,
        defaultPreOrderEnabled: false,
        availability: AvailabilityResult(status: status, leadDays: leadDays),
      ),
    ],
  );
}
