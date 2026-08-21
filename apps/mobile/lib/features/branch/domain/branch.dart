/// `GET /branches`-ийн буцаах хэлбэр (`apps/api/src/branch/branch.service.ts`)
/// — RLS-ээр аль хэдийн шүүгдсэн, CUSTOMER бүх идэвхтэй салбарыг харна.
class Branch {
  const Branch({
    required this.id,
    required this.name,
    this.address,
    this.latitude,
    this.longitude,
  });

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }

  final String id;
  final String name;
  final String? address;
  final double? latitude;
  final double? longitude;
}
