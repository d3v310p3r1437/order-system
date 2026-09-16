// Дэлгүүрийн бодит лого (docs/assets/store_logo_square_1024.png)-г MinIO-руу
// (ProductImageService-тэй ижил "product-images" bucket, зөвхөн "branding/"
// объект prefix ялгаатай) upload хийж, STORE_NAME/STORE_LOGO_URL
// SystemSetting мөрүүдийг тавьдаг НЭГ УДААГИЙН dev/prod bootstrap script
// — seed-catalog-demo.ts-тэй ЯГ ижил зарчим (§7 "Дэлгүүрийн нэр/лого"
// даалгавар).
//
// ⚠️ ЧУХАЛ (RLS bypass): `system_settings` FORCE ROW LEVEL SECURITY
// идэвхтэй тул seed-catalog-demo.ts/cleanup-debris.ts-тэй ЯГ ИЖИЛ
// шалтгаанаар жинхэнэ Postgres superuser `DATABASE_URL`-ээр шууд
// холбогдоно (`APP_DATABASE_URL`/app_runtime БИШ).
//
// Дахин ажиллуулахад upsert-ээр idempotent — давхардуулахгүй.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Client as MinioClient } from 'minio';

const STORE_NAME = 'ЧАНАР';
const LOGO_PATH = resolve(
  __dirname,
  '../../../docs/assets/store_logo_square_1024.png',
);

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  const minioEndpoint = new URL(process.env.MINIO_URL ?? 'http://localhost:9000');
  const minio = new MinioClient({
    endPoint: minioEndpoint.hostname,
    port:
      Number(minioEndpoint.port) ||
      (minioEndpoint.protocol === 'https:' ? 443 : 80),
    useSSL: minioEndpoint.protocol === 'https:',
    accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'changeme123',
  });
  const bucket = process.env.MINIO_BUCKET ?? 'product-images';
  const publicBaseUrl = process.env.MINIO_PUBLIC_URL ?? minioEndpoint.toString();

  const logoBuffer = readFileSync(LOGO_PATH);
  const objectKey = `branding/logo-${randomUUID()}.png`;
  await minio.putObject(bucket, objectKey, logoBuffer, logoBuffer.length, {
    'Content-Type': 'image/png',
  });
  const logoUrl = `${publicBaseUrl.replace(/\/$/, '')}/${bucket}/${objectKey}`;

  await prisma.systemSetting.upsert({
    where: { key: 'STORE_NAME' },
    create: { key: 'STORE_NAME', value: STORE_NAME },
    update: { value: STORE_NAME },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'STORE_LOGO_URL' },
    create: { key: 'STORE_LOGO_URL', value: logoUrl },
    update: { value: logoUrl },
  });

  console.log(`STORE_NAME = ${STORE_NAME}`);
  console.log(`STORE_LOGO_URL = ${logoUrl}`);

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
