import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';

const DEFAULT_BUCKET = 'product-images';

// docs/plan.md §8 Phase 2 Хэсэг A, даалгавар #2: presigned URL биш, шууд
// public-read bucket policy — бүтээгдэхүүний зураг нийтэд харагдах ёстой
// тул (admin-web/mobile <img src> шууд MinIO руу хандана).
function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

// MinIO client-ийг ЭНД, ганц газар багцалсан — objectKey (PostgreSQL,
// ProductImage.objectKey) БОЛОН бодит файл (MinIO)-ийн хооронд ямар ч
// бизнес логик агуулаагүй, зөвхөн upload/remove/public URL үүсгэлт.
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? DEFAULT_BUCKET;
    const endpoint = new URL(process.env.MINIO_URL ?? 'http://localhost:9000');
    this.client = new MinioClient({
      endPoint: endpoint.hostname,
      port:
        Number(endpoint.port) || (endpoint.protocol === 'https:' ? 443 : 80),
      useSSL: endpoint.protocol === 'https:',
      accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'changeme123',
    });
    // Prod-д MINIO_URL дотоод сүлжээний хаяг байж болзошгүй тул
    // хэрэглэгчийн browser хандах нийтийн хаягийг тусад нь заах боломж
    // (dev/CI-д ижил байх тул анхдагч нь MINIO_URL-ээ ашиглана).
    this.publicBaseUrl = process.env.MINIO_PUBLIC_URL ?? endpoint.toString();
  }

  // App эхлэх бүрт bucket байгаа эсэхийг шалгаж, байхгүй бол үүсгээд
  // public-read policy тавина — idempotent (dev/CI-д давхар аюулгүй).
  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
      }
      await this.client.setBucketPolicy(
        this.bucket,
        publicReadPolicy(this.bucket),
      );
    } catch (err) {
      this.logger.warn(
        `MinIO bucket "${this.bucket}" бэлтгэхэд алдаа гарлаа (зураг upload/эргэн харах API ажиллахгүй байж болзошгүй): ${String(err)}`,
      );
    }
  }

  async upload(
    objectKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async remove(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  getPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${this.bucket}/${objectKey}`;
  }
}
