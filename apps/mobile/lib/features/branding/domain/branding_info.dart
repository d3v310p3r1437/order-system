import '../../../core/network/api_base_url.dart';

/// `GET /settings/branding`-ийн хариу — нэвтрэлтгүй нээлттэй endpoint
/// (Login/Register дэлгэц дээр ч дуудагдана). `logoUrl` MinIO-ийн public
/// URL тул `resolveMediaUrl()`-ээр Android emulator дээр `10.0.2.2`-руу
/// хөрвүүлнэ (ProductImage.fromJson-той ижил зарчим).
class BrandingInfo {
  const BrandingInfo({required this.storeName, required this.logoUrl});

  final String storeName;
  final String? logoUrl;

  factory BrandingInfo.fromJson(Map<String, dynamic> json) {
    final rawLogoUrl = json['logoUrl'] as String?;
    return BrandingInfo(
      storeName: json['storeName'] as String,
      logoUrl: rawLogoUrl != null ? resolveMediaUrl(rawLogoUrl) : null,
    );
  }
}
