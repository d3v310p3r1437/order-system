import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SystemSettingService } from './system-setting.service.js';

function buildPrismaMock() {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const tx = { systemSetting: { findUnique, upsert } };
  const prisma = {
    get tx() {
      return tx;
    },
  };
  return { prisma, mocks: { findUnique, upsert } };
}

describe('SystemSettingService', () => {
  it('getReturnFeePercent(): мөр байвал утгыг Decimal болгож буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.findUnique.mockResolvedValue({
      key: 'RETURN_FEE_PERCENT',
      value: '15',
    });

    const service = new SystemSettingService(
      prisma as ConstructorParameters<typeof SystemSettingService>[0],
    );
    const result = await service.getReturnFeePercent();
    expect(result).toBeInstanceOf(Prisma.Decimal);
    expect(result.toNumber()).toBe(15);
  });

  it('getReturnFeePercent(): мөр байхгүй бол анхны утга (10) буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.findUnique.mockResolvedValue(null);

    const service = new SystemSettingService(
      prisma as ConstructorParameters<typeof SystemSettingService>[0],
    );
    const result = await service.getReturnFeePercent();
    expect(result.toNumber()).toBe(10);
  });

  it('updateReturnFeePercent(): 0-100 хооронд байвал upsert хийнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.upsert.mockResolvedValue({
      key: 'RETURN_FEE_PERCENT',
      value: '20',
    });

    const service = new SystemSettingService(
      prisma as ConstructorParameters<typeof SystemSettingService>[0],
    );
    await service.updateReturnFeePercent(20, 'user-1');

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: 'RETURN_FEE_PERCENT' },
      create: {
        key: 'RETURN_FEE_PERCENT',
        value: '20',
        updatedByUserId: 'user-1',
      },
      update: { value: '20', updatedByUserId: 'user-1' },
    });
  });

  it('updateReturnFeePercent(): хязгаараас гадуур утгад BadRequestException шидэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const service = new SystemSettingService(
      prisma as ConstructorParameters<typeof SystemSettingService>[0],
    );

    await expect(service.updateReturnFeePercent(-1, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.updateReturnFeePercent(101, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
