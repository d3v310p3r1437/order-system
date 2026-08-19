import '../../../core/network/api_base_url.dart';

/// `apps/api/src/catalog/product-image/product-image.service.ts`-ийн
/// буцаах хариу — `url` нь `MinioService.getPublicUrl()`-ээр бэлтгэсэн,
/// нэвтрэлт шаардахгүй нийтэд ил URL.
class ProductImage {
  const ProductImage({
    required this.id,
    required this.productId,
    required this.displayOrder,
    required this.url,
    this.altText,
  });

  factory ProductImage.fromJson(Map<String, dynamic> json) {
    return ProductImage(
      id: json['id'] as String,
      productId: json['productId'] as String,
      displayOrder: json['displayOrder'] as int,
      url: resolveMediaUrl(json['url'] as String),
      altText: json['altText'] as String?,
    );
  }

  final String id;
  final String productId;
  final int displayOrder;
  final String url;
  final String? altText;
}
