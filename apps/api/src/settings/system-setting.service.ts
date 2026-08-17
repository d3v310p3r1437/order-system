import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export const RETURN_FEE_PERCENT_KEY = 'RETURN_FEE_PERCENT';
// Migration 20260817130000_add_returns_and_settings-ийн seed мөртэй адил
// анхны утга — DB мөр ямар нэг шалтгаанаар алга болсон ч (жиш: гараар
// устгасан) энэ функц алдаа шидэхгүй эелдэг fallback байлгах зорилготой.
const DEFAULT_RETURN_FEE_PERCENT = new Prisma.Decimal(10);

const INVALID_RETURN_FEE_PERCENT = {
  code: 'INVALID_RETURN_FEE_PERCENT',
  message: 'Шимтгэлийн хувь 0-100 хооронд байх ёстой',
};

// §7 модуль #9 6-р зүйл: "Тохиргооны API". RETURN_FEE_PERCENT-ээс өөр
// SystemSetting түлхүүр одоогоор алга ч, ирээдүйд нэмэгдэх боломжтой
// ерөнхий key-value загвар тул (§Даалгавар) энэ service-ийг
// return-request.service.ts-ээс тусад нь (settings модуль) байрлуулав.
@Injectable()
export class SystemSettingService {
  constructor(private readonly prisma: PrismaService) {}

  async getReturnFeePercent(): Promise<Prisma.Decimal> {
    const row = await this.prisma.tx.systemSetting.findUnique({
      where: { key: RETURN_FEE_PERCENT_KEY },
    });
    return row ? new Prisma.Decimal(row.value) : DEFAULT_RETURN_FEE_PERCENT;
  }

  async getReturnFeePercentSetting() {
    const row = await this.prisma.tx.systemSetting.findUnique({
      where: { key: RETURN_FEE_PERCENT_KEY },
    });
    return (
      row ?? {
        key: RETURN_FEE_PERCENT_KEY,
        value: DEFAULT_RETURN_FEE_PERCENT.toString(),
        updatedByUserId: null,
        updatedAt: null,
      }
    );
  }

  // system_settings_update RLS policy (app_has_global_scope()) — RolesGuard
  // (@Roles) давхар мөн адил хамгаалалттай тохирно (controller-ийг үз).
  async updateReturnFeePercent(value: number, updatedByUserId: string) {
    if (value < 0 || value > 100) {
      throw new BadRequestException(INVALID_RETURN_FEE_PERCENT);
    }
    return this.prisma.tx.systemSetting.upsert({
      where: { key: RETURN_FEE_PERCENT_KEY },
      create: {
        key: RETURN_FEE_PERCENT_KEY,
        value: String(value),
        updatedByUserId,
      },
      update: { value: String(value), updatedByUserId },
    });
  }
}
