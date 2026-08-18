import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MinioService } from '../../storage/minio.service.js';
import type { UploadProductImageDto } from './dto/upload-product-image.dto.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async upload(
    productId: string,
    file: UploadedFileLike | undefined,
    dto: UploadProductImageDto,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Зураг файл оруулаагүй байна',
      });
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Зөвхөн jpg/png/webp өргөтгөлтэй зураг оруулна уу',
      });
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Зургийн хэмжээ 5MB-с хэтрэхгүй байх ёстой',
      });
    }

    const product = await this.prisma.tx.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Бүтээгдэхүүн олдсонгүй',
      });
    }

    const objectKey = `products/${productId}/${randomUUID()}.${EXTENSION_BY_MIME[file.mimetype]}`;
    await this.minio.upload(objectKey, file.buffer, file.mimetype);

    const image = await this.prisma.tx.productImage.create({
      data: {
        productId,
        objectKey,
        displayOrder: dto.displayOrder ?? 0,
        altText: dto.altText ?? null,
      },
    });
    return { ...image, url: this.minio.getPublicUrl(image.objectKey) };
  }

  async remove(productId: string, imageId: string) {
    const image = await this.prisma.tx.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException({
        code: 'PRODUCT_IMAGE_NOT_FOUND',
        message: 'Зураг олдсонгүй',
      });
    }

    // DB мөрийг ЭХЛЭЭД устгана — MinIO объект устгах амжилтгүй болсон ч
    // (жиш: аль хэдийн устсан) DB-д "unremovable" мөр үлдэхгүй. MinIO
    // объект үлдэх (orphan) нь эсрэгээр DB-д байхгүй зургийг харуулах
    // (broken image) эрсдэлээс арай бага хор хөнөөлтэй trade-off.
    await this.prisma.tx.productImage.delete({ where: { id: imageId } });
    try {
      await this.minio.remove(image.objectKey);
    } catch (err) {
      this.logger.warn(
        `MinIO-ээс объект устгахад алдаа гарлаа (${image.objectKey}): ${String(err)}`,
      );
    }
    return image;
  }
}
