// docs/plan.md §8 Phase 2 Хэсэг B, даалгавар #8: Meilisearch-ийн "products"
// индексэд бичигдэх бүтэц. categoryName-г денормалчилсан (Meilisearch
// нь Postgres-тэй JOIN хийж чадахгүй, категорийн нэрээр ч хайлт хийх
// шаардлагатай тул). ⚠️ Category.name өөрчлөгдөхөд энэ талбар автоматаар
// шинэчлэгдэхгүй (энэ даалгаврын хүрээнд шаардлагагүй, ирээдүйд хэрэгцээ
// гарвал CategoryService-д ч мөн адил SearchIndexer холбож болно).
export interface ProductSearchDocument {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
}

export function toProductSearchDocument(
  product: {
    id: string;
    name: string;
    description: string | null;
    brand: string | null;
    categoryId: string;
    isActive: boolean;
  },
  categoryName: string,
): ProductSearchDocument {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    brand: product.brand,
    categoryId: product.categoryId,
    categoryName,
    isActive: product.isActive,
  };
}
