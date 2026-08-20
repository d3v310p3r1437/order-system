// Mobile-ийн каталог үзэх/хайх дэлгэцийг (docs/plan.md §7 модуль #3)
// бодит хэрэглээнд ойрхон, Монгол нэртэй өгөгдлөөр screenshot/demo хийхэд
// зориулсан seed script. dev/staging-д зориулагдсан, PROD-д АШИГЛАХГҮЙ.
//
// ⚠️ ЧУХАЛ (RLS bypass): категори/бүтээгдэхүүн/variant/inventory
// хүснэгтүүд FORCE ROW LEVEL SECURITY идэвхтэй (20260815082257_enable_rls_policies,
// 20260816023759_enable_catalog_inventory_rls) тул энгийн `APP_DATABASE_URL`
// (`app_runtime`, NOSUPERUSER NOBYPASSRLS) холболтоор шинэ бүтээгдэхүүн
// шууд INSERT хийх боломжгүй — анхны SUPER_ADMIN хэрэглэгчийг ч RLS-ээр
// хамгаалагдсан INSERT-ээр өөрөө bootstrap хийх боломжгүй (users_insert/
// ubr_insert policy хоёулаа "аль хэдийн global scope-той хэрэглэгч байх"-ыг
// шаарддаг тул эрхгүй анхны хэрэглэгч circular болно). Тиймээс migration-той
// ЯГ ИЖИЛ `DATABASE_URL` (жинхэнэ Postgres superuser "app", initdb-ийн
// анхны POSTGRES_USER — Docker-ийн postgres image-д энэ нь автоматаар
// superuser, `BYPASSRLS` ЗААВАЛ true) холболтоор шууд бичнэ — ADR 001-ийн
// "app_runtime-аар л runtime query бичнэ" зарчмыг ЗӨРЧИХГҮЙ, учир нь энэ
// скрипт HTTP request биш, migration-той ижил "schema/dev-fixture bootstrap"
// зорилготой offline үйлдэл.
//
// ⚠️ Тусгаарлалт: бүх slug/sku "demo-"/"DEMO-" угтвартай, ганц тусдаа
// "Мобайл демо салбар" Branch-д холбогдоно — e2e тестүүд (`test/*.e2e-spec.ts`)
// өөрсдийн random/timestamp-той slug ашигладаг тул ЭНЭ өгөгдөлтэй хэзээ ч
// давхцахгүй, мөн e2e тест ажиллуулах нь энэ seed-ийг устгахгүй (аль аль нь
// зөвхөн ӨӨРИЙН мөрөө CRUD хийдэг). Дахин ажиллуулахад upsert-ээр
// idempotent — давхардуулахгүй.
import 'dotenv/config';
import { deflateSync, crc32 } from 'node:zlib';
import { PrismaClient } from '@prisma/client';
import { Client as MinioClient } from 'minio';
import { MeiliSearch } from 'meilisearch';

const SEED_BRANCH_NAME = 'Мобайл демо салбар';

// ─────────────────────────────────────────────────────────
// Минимал PNG encoder — гадаад зурган файл шаардахгүйгээр (network/asset
// хамааралгүй, CI-д ч ажиллах боломжтой) нэг өнгийн жижиг зураг үүсгэнэ.
// Zlib-ийн built-in crc32()-г ашигласан (Node 20.12+/22 — гар CRC хүснэгт
// бичих шаардлагагүй болгосон).
// ─────────────────────────────────────────────────────────
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput) >>> 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makeSolidColorPng(
  width: number,
  height: number,
  [r, g, b]: [number, number, number],
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB truecolor
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk('IHDR', ihdrData);

  const rowBytes = 1 + width * 3; // filter byte + RGB
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = pngChunk('IDAT', deflateSync(raw));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─────────────────────────────────────────────────────────
// Демо каталогийн өгөгдөл
// ─────────────────────────────────────────────────────────
interface DemoVariant {
  name: string;
  sku: string;
  unit: string;
  basePrice: string;
  quantity: number;
  defaultPreOrderEnabled?: boolean;
  defaultPreOrderLeadDays?: number;
}

interface DemoProduct {
  slug: string;
  name: string;
  brand?: string;
  description: string;
  categorySlug: string;
  imageColor?: [number, number, number]; // undefined = зураггүй (placeholder-ийг турших)
  variants: DemoVariant[];
}

const CATEGORIES = [
  { slug: 'demo-undaa', name: 'Ундаа', displayOrder: 1 },
  {
    slug: 'demo-hunsnii-buteegdehuun',
    name: 'Хүнсний бүтээгдэхүүн',
    displayOrder: 2,
  },
  { slug: 'demo-ger-akhuin-baraa', name: 'Гэр ахуйн бараа', displayOrder: 3 },
];

const PRODUCTS: DemoProduct[] = [
  {
    slug: 'demo-coca-cola-500ml',
    name: 'Кока-Кола 0.5Л',
    brand: 'Coca-Cola',
    description: 'Сэрүүн ундаа, 500мл шилэн лонх.',
    categorySlug: 'demo-undaa',
    imageColor: [220, 38, 38],
    variants: [
      {
        name: '0.5Л',
        sku: 'DEMO-COKE-500',
        unit: 'шил',
        basePrice: '2500.00',
        quantity: 40,
      },
    ],
  },
  {
    slug: 'demo-baigaliin-us-1-5l',
    name: 'Байгалийн ус 1.5Л',
    brand: 'Ноён',
    description: 'Цэвэр рашаан ус, 1.5 литрийн сав.',
    categorySlug: 'demo-undaa',
    variants: [
      {
        name: '1.5Л',
        sku: 'DEMO-WATER-1500',
        unit: 'шил',
        basePrice: '1800.00',
        quantity: 60,
      },
    ],
  },
  {
    slug: 'demo-ulaan-tsai',
    name: 'Улаан цай',
    brand: 'Tess',
    description: 'Цейлоны улаан цай, 25 уут.',
    categorySlug: 'demo-undaa',
    variants: [
      {
        name: 'Стандарт',
        sku: 'DEMO-TEA-STD',
        unit: 'хайрцаг',
        basePrice: '6500.00',
        quantity: 0,
        defaultPreOrderEnabled: true,
        defaultPreOrderLeadDays: 5,
      },
    ],
  },
  {
    slug: 'demo-kofe-3in1',
    name: 'Кофе 3in1',
    brand: 'Nescafe',
    description: 'Сүү, элсэн чихэртэй шуурхай кофе.',
    categorySlug: 'demo-undaa',
    variants: [
      {
        name: '10ш багц',
        sku: 'DEMO-COFFEE-10',
        unit: 'багц',
        basePrice: '4200.00',
        quantity: 0,
        defaultPreOrderEnabled: true,
        defaultPreOrderLeadDays: 3,
      },
      {
        name: '20ш багц',
        sku: 'DEMO-COFFEE-20',
        unit: 'багц',
        basePrice: '7800.00',
        quantity: 0,
        defaultPreOrderEnabled: true,
        defaultPreOrderLeadDays: 3,
      },
    ],
  },
  {
    slug: 'demo-talh-tsagaan',
    name: 'Талх цагаан',
    brand: 'Наран талх',
    description: 'Өдөр бүр шинээр жигнэсэн цагаан талх.',
    categorySlug: 'demo-hunsnii-buteegdehuun',
    imageColor: [217, 168, 91],
    variants: [
      {
        name: 'Стандарт',
        sku: 'DEMO-BREAD-STD',
        unit: 'ширхэг',
        basePrice: '1500.00',
        quantity: 25,
      },
    ],
  },
  {
    slug: 'demo-guril-1kg',
    name: 'Гурил 1кг',
    description: 'Улаанбаатарын гурилын үйлдвэрийн стандарт гурил.',
    categorySlug: 'demo-hunsnii-buteegdehuun',
    variants: [
      {
        name: '1кг',
        sku: 'DEMO-FLOUR-1KG',
        unit: 'уут',
        basePrice: '3200.00',
        quantity: 0,
      },
    ],
  },
  {
    slug: 'demo-ondog-10sh',
    name: 'Өндөг 10ш',
    description: 'Дундаж хэмжээний өндөг, 10 ширхэгийн сав.',
    categorySlug: 'demo-hunsnii-buteegdehuun',
    variants: [
      {
        name: '10ш',
        sku: 'DEMO-EGG-10',
        unit: 'сав',
        basePrice: '5200.00',
        quantity: 15,
      },
    ],
  },
  {
    slug: 'demo-ariel-nuntag',
    name: 'Ariel угаалгын нунтаг',
    brand: 'Ariel',
    description: 'Автомат угаалгын машинд зориулсан нунтаг.',
    categorySlug: 'demo-ger-akhuin-baraa',
    imageColor: [37, 99, 235],
    variants: [
      {
        name: '3кг',
        sku: 'DEMO-ARIEL-3KG',
        unit: 'уут',
        basePrice: '24900.00',
        quantity: 12,
      },
      {
        name: '6кг',
        sku: 'DEMO-ARIEL-6KG',
        unit: 'уут',
        basePrice: '42900.00',
        quantity: 0,
      },
    ],
  },
  {
    slug: 'demo-tavag-ugaah-shingen',
    name: 'Таваг угаах шингэн',
    brand: 'Fairy',
    description: 'Өөх тос сайн арилгадаг таваг угаах шингэн.',
    categorySlug: 'demo-ger-akhuin-baraa',
    variants: [
      {
        name: 'Стандарт',
        sku: 'DEMO-DISH-STD',
        unit: 'шил',
        basePrice: '8900.00',
        quantity: 0,
        defaultPreOrderEnabled: true,
        defaultPreOrderLeadDays: 7,
      },
    ],
  },
  {
    slug: 'demo-gar-ariutgagch',
    name: 'Гар ариутгагч',
    description: 'Спирт агуулсан гар ариутгах шингэн, 100мл.',
    categorySlug: 'demo-ger-akhuin-baraa',
    variants: [
      {
        name: 'Стандарт',
        sku: 'DEMO-SANITIZER-STD',
        unit: 'шил',
        basePrice: '3500.00',
        quantity: 0,
      },
    ],
  },
];

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  const minio = new MinioClient({
    endPoint: new URL(process.env.MINIO_URL ?? 'http://localhost:9000')
      .hostname,
    port: Number(
      new URL(process.env.MINIO_URL ?? 'http://localhost:9000').port,
    ),
    useSSL: false,
    accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'changeme123',
  });
  const bucket = process.env.MINIO_BUCKET ?? 'product-images';
  const meili = new MeiliSearch({
    host: process.env.MEILI_URL ?? 'http://localhost:7700',
    apiKey: process.env.MEILI_MASTER_KEY,
  });

  console.log('==> MinIO bucket бэлдэж байна...');
  if (!(await minio.bucketExists(bucket))) {
    await minio.makeBucket(bucket);
  }
  await minio.setBucketPolicy(
    bucket,
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    }),
  );

  console.log('==> Meilisearch индекс бэлдэж байна...');
  try {
    await meili.createIndex('products', { primaryKey: 'id' }).waitTask();
  } catch {
    // индекс аль хэдийн байгаа бол алгасна (MeilisearchService.onModuleInit-тэй ижил зарчим)
  }
  const productsIndex = meili.index('products');
  await productsIndex
    .updateSearchableAttributes(['name', 'description', 'brand', 'categoryName'])
    .waitTask();
  await productsIndex
    .updateFilterableAttributes(['categoryId', 'isActive'])
    .waitTask();

  console.log('==> Салбар бэлдэж байна...');
  let branch = await prisma.branch.findFirst({
    where: { name: SEED_BRANCH_NAME },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: SEED_BRANCH_NAME,
        address: 'Улаанбаатар хот, Сүхбаатар дүүрэг',
        district: 'Сүхбаатар',
        isActive: true,
      },
    });
  }

  console.log('==> Ангилал бэлдэж байна...');
  const categoryBySlug = new Map<string, { id: string; name: string }>();
  for (const cat of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, displayOrder: cat.displayOrder },
      create: {
        slug: cat.slug,
        name: cat.name,
        displayOrder: cat.displayOrder,
        isActive: true,
      },
    });
    categoryBySlug.set(cat.slug, row);
  }

  console.log('==> Бүтээгдэхүүн/variant/агуулах бэлдэж байна...');
  const searchDocs: {
    id: string;
    name: string;
    description: string | null;
    brand: string | null;
    categoryId: string;
    categoryName: string;
    isActive: boolean;
  }[] = [];

  for (const demoProduct of PRODUCTS) {
    const category = categoryBySlug.get(demoProduct.categorySlug);
    if (!category) {
      throw new Error(`Тодорхойгүй ангилал: ${demoProduct.categorySlug}`);
    }

    const product = await prisma.product.upsert({
      where: { slug: demoProduct.slug },
      update: {
        name: demoProduct.name,
        brand: demoProduct.brand,
        description: demoProduct.description,
        categoryId: category.id,
        isActive: true,
      },
      create: {
        slug: demoProduct.slug,
        name: demoProduct.name,
        brand: demoProduct.brand,
        description: demoProduct.description,
        categoryId: category.id,
        isActive: true,
      },
    });

    for (const v of demoProduct.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          name: v.name,
          unit: v.unit,
          basePrice: v.basePrice,
          defaultPreOrderEnabled: v.defaultPreOrderEnabled ?? false,
          defaultPreOrderLeadDays: v.defaultPreOrderLeadDays,
          isActive: true,
        },
        create: {
          productId: product.id,
          name: v.name,
          sku: v.sku,
          unit: v.unit,
          basePrice: v.basePrice,
          defaultPreOrderEnabled: v.defaultPreOrderEnabled ?? false,
          defaultPreOrderLeadDays: v.defaultPreOrderLeadDays,
          isActive: true,
        },
      });

      await prisma.inventoryItem.upsert({
        where: {
          variantId_branchId: { variantId: variant.id, branchId: branch.id },
        },
        update: { quantity: v.quantity },
        create: {
          variantId: variant.id,
          branchId: branch.id,
          quantity: v.quantity,
        },
      });
    }

    if (demoProduct.imageColor) {
      // objectKey slug-аас детерминистик тул дахин ажиллуулахад давхардахгүй.
      const objectKey = `demo-seed/${demoProduct.slug}.png`;
      const existingImage = await prisma.productImage.findFirst({
        where: { productId: product.id, objectKey },
      });
      if (!existingImage) {
        const png = makeSolidColorPng(480, 480, demoProduct.imageColor);
        await minio.putObject(bucket, objectKey, png, png.length, {
          'Content-Type': 'image/png',
        });
        await prisma.productImage.create({
          data: { productId: product.id, objectKey, displayOrder: 0 },
        });
      }
    }

    searchDocs.push({
      id: product.id,
      name: product.name,
      description: product.description,
      brand: product.brand,
      categoryId: product.categoryId,
      categoryName: category.name,
      isActive: product.isActive,
    });
  }

  console.log('==> Meilisearch индекслэж байна...');
  await productsIndex.addDocuments(searchDocs).waitTask();

  console.log(
    `✅ Демо каталог бэлэн: ${CATEGORIES.length} ангилал, ${PRODUCTS.length} бүтээгдэхүүн, салбар "${branch.name}" (id=${branch.id}).`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Демо seed script амжилтгүй боллоо:', err);
  process.exit(1);
});
