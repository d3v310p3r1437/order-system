import 'product.dart';

/// `GET /catalog/search`-ийн `facets` хэсэг (2026-09-05, §7 модуль #3-ийн
/// UX сайжруулалт) — боломжит өнгө/хэмжээний жагсаалт, chip-үүдийг
/// динамикаар үүсгэхэд ашиглагдана. Backend талд аль хэдийн эрэмбэлэгдсэн
/// (`MeilisearchService.search()`-ийг үз) тул энд дахин эрэмбэлэхгүй.
class SearchFacets {
  const SearchFacets({required this.colors, required this.sizes});

  factory SearchFacets.fromJson(Map<String, dynamic> json) {
    return SearchFacets(
      colors: (json['colors'] as List<dynamic>).cast<String>(),
      sizes: (json['sizes'] as List<dynamic>).cast<String>(),
    );
  }

  static const empty = SearchFacets(colors: [], sizes: []);

  final List<String> colors;
  final List<String> sizes;
}

/// `GET /catalog/search`-ийн бүрэн хариу (`{products, facets}`) — өмнө нь
/// backend зөвхөн массив буцаадаг байсныг facets-тэй хамт буцаах болгож
/// өргөтгөсөн тул `CatalogRepository.search()`-ийн буцаах утга ч мөн
/// адил өргөтгөв (`List<Product>` биш).
class CatalogSearchResult {
  const CatalogSearchResult({required this.products, required this.facets});

  final List<Product> products;
  final SearchFacets facets;
}
