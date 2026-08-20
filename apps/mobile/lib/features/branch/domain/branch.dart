/// `GET /branches`-ийн буцаах хэлбэр (`apps/api/src/branch/branch.service.ts`)
/// — RLS-ээр аль хэдийн шүүгдсэн, CUSTOMER бүх идэвхтэй салбарыг харна.
class Branch {
  const Branch({required this.id, required this.name, this.address});

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
    );
  }

  final String id;
  final String name;
  final String? address;
}
