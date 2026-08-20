import 'availability.dart';
import 'product_image.dart';
import 'product_variant.dart';

/// `GET /catalog/search`/`GET /products/:id`-ийн буцаах хэлбэр
/// (`ProductDetail`, admin-web-ийн `src/lib/api.ts`-тэй тохирно) —
/// variant/зурган мэдээллийг нэгтгэсэн.
class Product {
  const Product({
    required this.id,
    required this.name,
    required this.slug,
    required this.isActive,
    required this.variants,
    required this.images,
    this.description,
    this.brand,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      brand: json['brand'] as String?,
      isActive: json['isActive'] as bool,
      variants: (json['variants'] as List<dynamic>)
          .map((v) => ProductVariant.fromJson(v as Map<String, dynamic>))
          .toList(),
      images: (json['images'] as List<dynamic>)
          .map((i) => ProductImage.fromJson(i as Map<String, dynamic>))
          .toList(),
    );
  }

  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? brand;
  final bool isActive;
  final List<ProductVariant> variants;
  final List<ProductImage> images;

  String? get primaryImageUrl => images.isEmpty ? null : images.first.url;

  /// Хамгийн хямд variant-ийн үнэ — карт/dэлгэрэнгүй дэлгэцийн эхний
  /// (анхдагч сонгогдсон) variant-тай уялдуулна.
  ProductVariant? get cheapestVariant {
    if (variants.isEmpty) return null;
    return variants.reduce(
      (a, b) =>
          (double.tryParse(a.basePrice) ?? 0) <=
              (double.tryParse(b.basePrice) ?? 0)
          ? a
          : b,
    );
  }

  /// Бүх variant-аар "хамгийн сайн" тохиргоог нэгтгэнэ (нэг ч variant
  /// IN_STOCK бол IN_STOCK, эс бөгөөс аль нэг нь PRE_ORDER бол хамгийн
  /// богино хүлээх хугацаатай PRE_ORDER, бусад тохиолдолд OUT_OF_STOCK) —
  /// зөвхөн UI-ийн товч танилцуулга зорилготой, backend-ийн бизнес
  /// логикийг ДАХИН БИЧЭЭГҮЙ (эх сурвалж хэвээр backend).
  AvailabilityResult get aggregateAvailability {
    if (variants.isEmpty) {
      return const AvailabilityResult(status: AvailabilityStatus.outOfStock);
    }
    final inStock = variants.any(
      (v) => v.availability.status == AvailabilityStatus.inStock,
    );
    if (inStock) {
      return const AvailabilityResult(status: AvailabilityStatus.inStock);
    }
    final preOrders = variants
        .where((v) => v.availability.status == AvailabilityStatus.preOrder)
        .toList();
    if (preOrders.isNotEmpty) {
      final leadDays = preOrders
          .map((v) => v.availability.leadDays)
          .whereType<int>()
          .fold<int?>(null, (min, d) => min == null || d < min ? d : min);
      return AvailabilityResult(
        status: AvailabilityStatus.preOrder,
        leadDays: leadDays,
      );
    }
    return const AvailabilityResult(status: AvailabilityStatus.outOfStock);
  }
}
