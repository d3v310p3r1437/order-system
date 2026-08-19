import 'availability.dart';

/// `ProductVariantWithAvailability` (apps/api/src/catalog/product/
/// product.service.ts-ийн `hydrateProduct()`) — `basePrice`/`costPrice` нь
/// Prisma Decimal тул JSON-д string болж ирдэг (admin-web-ийн
/// `src/lib/api.ts`-тэй адил зарчим).
class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.productId,
    required this.name,
    required this.sku,
    required this.unit,
    required this.basePrice,
    required this.isActive,
    required this.defaultPreOrderEnabled,
    required this.availability,
    this.defaultPreOrderLeadDays,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      id: json['id'] as String,
      productId: json['productId'] as String,
      name: json['name'] as String,
      sku: json['sku'] as String,
      unit: json['unit'] as String,
      basePrice: json['basePrice'] as String,
      isActive: json['isActive'] as bool,
      defaultPreOrderEnabled: json['defaultPreOrderEnabled'] as bool,
      defaultPreOrderLeadDays: json['defaultPreOrderLeadDays'] as int?,
      availability: AvailabilityResult.fromJson(
        json['availability'] as Map<String, dynamic>,
      ),
    );
  }

  final String id;
  final String productId;
  final String name;
  final String sku;
  final String unit;
  final String basePrice;
  final bool isActive;
  final bool defaultPreOrderEnabled;
  final int? defaultPreOrderLeadDays;
  final AvailabilityResult availability;
}
