/// `GET /categories`-ийн нэг мөр (apps/api/src/catalog/category).
class Category {
  const Category({
    required this.id,
    required this.name,
    required this.slug,
    required this.displayOrder,
    required this.isActive,
    this.description,
    this.parentId,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      displayOrder: json['displayOrder'] as int,
      isActive: json['isActive'] as bool,
      parentId: json['parentId'] as String?,
    );
  }

  final String id;
  final String name;
  final String slug;
  final String? description;
  final int displayOrder;
  final bool isActive;
  final String? parentId;
}
