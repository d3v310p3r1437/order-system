// docs/plan.md §8 Phase 2 Хэсэг B, даалгавар #8: Meilisearch-ийн "products"
// индексэд бичигдэх бүтэц. categoryName-г денормалчилсан (Meilisearch
// нь Postgres-тэй JOIN хийж чадахгүй, категорийн нэрээр ч хайлт хийх
// шаардлагатай тул). ⚠️ Category.name өөрчлөгдөхөд энэ талбар автоматаар
// шинэчлэгдэхгүй (энэ даалгаврын хүрээнд шаардлагагүй, ирээдүйд хэрэгцээ
// гарвал CategoryService-д ч мөн адил SearchIndexer холбож болно).
//
// (2026-09-05, §7 модуль #3-ийн UX сайжруулалт): colors/sizes нь
// ProductVariant.color/size-аас денормалчилсан, ДАВХАРДААГҮЙ жагсаалт —
// Meilisearch-ийн facet+шүүлтэд ашиглагдана (variant бүр биш, PRODUCT
// document-ийн түвшинд, учир нь Meilisearch нь Postgres-ийн адил
// хүснэгт хоорондын JOIN хийж чаддаггүй тул variant-level filter хийх
// цорын ганц арга бол эцэг Product document дээр нь denormalize хийх).
export interface ProductSearchDocument {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  colors: string[];
  sizes: string[];
}

interface VariantAttributeSource {
  color: string | null;
  size: string | null;
}

// Variant-уудаас color/size-ийн ДАВХАРДААГҮЙ, эрэмбэлэгдсэн жагсаалт
// гаргана (эрэмбэ нь Meilisearch facet-ийн хариу тогтвортой байхад л
// зориулагдсан, бизнес ач холбогдолгүй).
function distinctSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))].sort();
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
  variants: VariantAttributeSource[] = [],
): ProductSearchDocument {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    brand: product.brand,
    categoryId: product.categoryId,
    categoryName,
    isActive: product.isActive,
    colors: distinctSorted(variants.map((v) => v.color)),
    sizes: distinctSorted(variants.map((v) => v.size)),
  };
}
