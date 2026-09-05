import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MinioService } from '../storage/minio.service.js';

export const STORE_NAME_KEY = 'STORE_NAME';
export const STORE_LOGO_URL_KEY = 'STORE_LOGO_URL';
// 20260905090500_seed_store_name_setting-ийн seed утгатай адил — мөр ямар
// нэг шалтгаанаар алга болсон ч (system-setting.service.ts-ийн
// DEFAULT_RETURN_FEE_PERCENT-тэй ижил зарчим) эелдэг fallback.
const DEFAULT_STORE_NAME = 'ЧАНАР';

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

export interface BrandingSnapshot {
  storeName: string;
  logoUrl: string | null;
}

// app_public_branding() (SECURITY DEFINER, 20260905090000 migration)
// зөвхөн ЭНЭ 2 key-г л буцаадаг тул shape нь хатуу тогтмол.
@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  // Нэвтрэлтгүй (anon) дуудагдана — BrandingController.getBranding()-д
  // @UseGuards(RolesGuard) ЗОРИУДАА байхгүй тул `this.prisma.tx`-ийн
  // session variable `app.user_id` хоосон байж болно, гэвч SECURITY
  // DEFINER функц RLS-ийг тойрдог тул асуудалгүй.
  async getBranding(): Promise<BrandingSnapshot> {
    const rows = await this.prisma.tx.$queryRaw<
      Array<{ key: string; value: string }>
    >`SELECT * FROM app_public_branding()`;
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    return {
      storeName: byKey.get(STORE_NAME_KEY) ?? DEFAULT_STORE_NAME,
      logoUrl: byKey.get(STORE_LOGO_URL_KEY) ?? null,
    };
  }

  // Зөвхөн SUPER_ADMIN/OWNER (BrandingController-ийн @Roles()) дуудна —
  // typed Prisma upsert ашигладаг тул system_settings_insert/update RLS
  // (app_has_global_scope(), ADR 005-ийн шинэ функц шаардлагагүй тохиолдол)
  // л хангагдана.
  async updateBranding(
    storeName: string | undefined,
    file: UploadedFileLike | undefined,
    updatedByUserId: string,
  ): Promise<BrandingSnapshot> {
    if (!storeName && !file) {
      throw new BadRequestException({
        code: 'NOTHING_TO_UPDATE',
        message: 'Дэлгүүрийн нэр эсвэл лого зургийн аль нэгийг заавал өгнө үү',
      });
    }

    if (file) {
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
      const objectKey = `branding/${randomUUID()}.${EXTENSION_BY_MIME[file.mimetype]}`;
      await this.minio.upload(objectKey, file.buffer, file.mimetype);
      await this.upsertSetting(
        STORE_LOGO_URL_KEY,
        this.minio.getPublicUrl(objectKey),
        updatedByUserId,
      );
    }

    if (storeName) {
      await this.upsertSetting(STORE_NAME_KEY, storeName, updatedByUserId);
    }

    return this.getBranding();
  }

  private async upsertSetting(
    key: string,
    value: string,
    updatedByUserId: string,
  ) {
    await this.prisma.tx.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedByUserId },
      update: { value, updatedByUserId },
    });
  }
}
