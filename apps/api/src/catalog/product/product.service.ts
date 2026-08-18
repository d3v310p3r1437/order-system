import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Product, ProductVariant } from '@prisma/client';
import {
  isForeignKeyViolation,
  isRecordNotFoundError,
  isUniqueConstraintViolation,
} from '../../common/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SearchIndexer } from '../../search/search-indexer.service.js';
import { toProductSearchDocument } from '../../search/product-search-document.js';
import { MinioService } from '../../storage/minio.service.js';
import {
  computeAvailabilityStatus,
  type AvailabilityResult,
} from '../inventory-effective.util.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';

const SLUG_TAKEN = {
  code: 'PRODUCT_SLUG_TAKEN',
  message: 'Энэ slug өөр бүтээгдэхүүнд аль хэдийн ашиглагдсан байна',
};

// app_inventory_snapshot_for_variant() SQL функцийн буцаах мөр (§8 Phase 2,
// 20260816031625 migration) — quantity/override зөвхөн ЭНД, серверийн
// санах ойд л ашиглагдана, HTTP хариунд ХЭЗЭЭ Ч шууд сериалайзлагдахгүй.
interface InventorySnapshotRow {
  branchId: string;
  quantity: number;
  preOrderEnabledOverride: boolean | null;
  preOrderLeadDaysOverride: number | null;
}

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndexer: SearchIndexer,
    private readonly minio: MinioService,
  ) {}

  findAll(categoryId?: string) {
    return this.prisma.tx.product.findMany({
      where: categoryId === undefined ? {} : { categoryId },
      orderBy: { name: 'asc' },
    });
  }

  // "Нийтэд харагдах" endpoint (docs/plan.md §8 Phase 2, 2-р хэсэг):
  // Product + бүх ProductVariant + тооцоолсон availability status-ийг
  // нэгтгэж буцаана. branchId өгөгдвөл тухайн салбарын, өгөгдөөгүй бол
  // бүх салбараар аггрегатласан ("аль нэг салбарт байвал IN_STOCK") утга.
  // InventoryItem-ийн бодит мөр (quantity, branchId-ийн жагсаалт) ХЭЗЭЭ Ч
  // хариунд гарахгүй — зөвхөн computeAvailabilityStatus()-ийн тооцоолсон
  // { status, leadDays } (CUSTOMER дүр ч аюулгүй дуудна, RLS-д мөргөлдөхгүй,
  // учир нь inventory_items хүснэгтийг шууд бус, зөвхөн SECURITY DEFINER
  // snapshot функцээр л уншина).
  async findOne(id: string, branchId?: string) {
    const product = await this.prisma.tx.product.findUnique({
      where: { id },
      include: {
        variants: true,
        images: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Бүтээгдэхүүн олдсонгүй',
      });
    }
    return this.hydrateProduct(product, branchId);
  }

  // §8 Phase 2 Хэсэг B, даалгавар #9: Meilisearch-ээс ирсэн (эрэмбэлэгдсэн)
  // id жагсаалтаар Product-уудыг availability-тэй хамт буцаана —
  // findOne()-той ЯГ ижил hydrateProduct()-г дахин ашиглав (логик
  // давхардуулахгүй байх зарчим). Meilisearch-ийн эрэмбэ (relevance)
  // хадгалагдах ёстой тул findMany()-ийн үр дүнг дахин id жагсаалтаар эрэмбэлнэ.
  async findManyWithAvailability(ids: string[], branchId?: string) {
    if (ids.length === 0) {
      return [];
    }
    const products = await this.prisma.tx.product.findMany({
      where: { id: { in: ids } },
      include: {
        variants: true,
        images: { orderBy: { displayOrder: 'asc' } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((p): p is (typeof products)[number] => p !== undefined);
    return Promise.all(
      ordered.map((product) => this.hydrateProduct(product, branchId)),
    );
  }

  private async hydrateProduct<
    T extends {
      variants: ProductVariant[];
      images: { objectKey: string }[];
    },
  >(product: T, branchId: string | undefined) {
    const variants = await Promise.all(
      product.variants.map(async (variant) => ({
        ...variant,
        availability: await this.computeVariantAvailability(variant, branchId),
      })),
    );
    const images = product.images.map((image) => ({
      ...image,
      url: this.minio.getPublicUrl(image.objectKey),
    }));
    return { ...product, variants, images };
  }

  private async computeVariantAvailability(
    variant: ProductVariant,
    branchId: string | undefined,
  ): Promise<AvailabilityResult> {
    const rows = await this.prisma.tx.$queryRaw<InventorySnapshotRow[]>`
      SELECT * FROM app_inventory_snapshot_for_variant(${variant.id}, ${branchId ?? null})
    `;
    // Мөр байхгүй ("энэ салбар/аль ч салбар энэ variant-ийг огт
    // захиалаагүй") тохиолдлыг computeAvailabilityStatus(null, variant)
    // өөрөө OUT_OF_STOCK болгож шийддэг тул энд тусад нь шалгахгүй —
    // ганц эх сурвалж (inventory-effective.util.ts).
    const entries: (InventorySnapshotRow | null)[] =
      rows.length > 0 ? rows : [null];
    const computed = entries.map((row) =>
      computeAvailabilityStatus(row, variant),
    );
    const inStock = computed.find((c) => c.status === 'IN_STOCK');
    if (inStock) {
      return inStock;
    }
    const preOrder = computed.find((c) => c.status === 'PRE_ORDER');
    if (preOrder) {
      return preOrder;
    }
    return { status: 'OUT_OF_STOCK', leadDays: null };
  }

  async create(dto: CreateProductDto) {
    try {
      const product = await this.prisma.tx.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          brand: dto.brand,
          categoryId: dto.categoryId,
          isActive: dto.isActive,
        },
      });
      await this.indexProduct(product);
      return product;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SLUG_TAKEN);
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Заасан ангилал олдсонгүй',
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      const product = await this.prisma.tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          brand: dto.brand,
          categoryId: dto.categoryId,
          isActive: dto.isActive,
        },
      });
      await this.indexProduct(product);
      return product;
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Бүтээгдэхүүн олдсонгүй',
        });
      }
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SLUG_TAKEN);
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Заасан ангилал олдсонгүй',
        });
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const product = await this.prisma.tx.product.delete({ where: { id } });
      this.searchIndexer.deleteProduct(product.id);
      return product;
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Бүтээгдэхүүн олдсонгүй',
        });
      }
      throw error;
    }
  }

  // create()/update() хоёуланд нь ашиглагдана — categoryName-г
  // денормалчлахын тулд category мөрийг тусад нь уншина (Product.create/
  // update-ийн буцаах утга categoryId-г л агуулдаг, category.name биш).
  private async indexProduct(product: Product): Promise<void> {
    const category = await this.prisma.tx.category.findUnique({
      where: { id: product.categoryId },
    });
    this.searchIndexer.indexProduct(
      toProductSearchDocument(product, category?.name ?? ''),
    );
  }

  // Bulk reindex (§8 Phase 2, даалгавар #10) — одоо байгаа бүх Product-ыг
  // Meilisearch рүү дахин бичнэ (жиш: индекс алдагдсан/анх удаа бэлдэх үед).
  async reindexAll(): Promise<number> {
    const products = await this.prisma.tx.product.findMany({
      include: { category: true },
    });
    const docs = products.map((product) =>
      toProductSearchDocument(product, product.category.name),
    );
    await this.searchIndexer.reindexAll(docs);
    return docs.length;
  }
}
