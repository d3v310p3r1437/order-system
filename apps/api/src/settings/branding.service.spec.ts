import { BadRequestException } from '@nestjs/common';
import { BrandingService } from './branding.service.js';

function buildPrismaMock() {
  const queryRaw = jest.fn();
  const upsert = jest.fn();
  const tx = { $queryRaw: queryRaw, systemSetting: { upsert } };
  const prisma = {
    get tx() {
      return tx;
    },
  };
  return { prisma, mocks: { queryRaw, upsert } };
}

function buildMinioMock() {
  return {
    upload: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn((key: string) => `http://minio.local/product-images/${key}`),
  };
}

function newService(prisma: unknown, minio = buildMinioMock()) {
  return {
    service: new BrandingService(
      prisma as ConstructorParameters<typeof BrandingService>[0],
      minio as ConstructorParameters<typeof BrandingService>[1],
    ),
    minio,
  };
}

function buildFile(overrides: Partial<{ mimetype: string; size: number }> = {}) {
  return {
    buffer: Buffer.from('fake-logo-bytes'),
    mimetype: overrides.mimetype ?? 'image/png',
    size: overrides.size ?? 1024,
  };
}

describe('BrandingService.getBranding()', () => {
  it('хоёр key-ийн мөр бүгд байвал storeName/logoUrl-г буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([
      { key: 'STORE_NAME', value: 'ЧАНАР' },
      { key: 'STORE_LOGO_URL', value: 'http://minio.local/logo.png' },
    ]);
    const { service } = newService(prisma);

    await expect(service.getBranding()).resolves.toEqual({
      storeName: 'ЧАНАР',
      logoUrl: 'http://minio.local/logo.png',
    });
  });

  it('ямар ч мөр байхгүй бол анхны утга (ЧАНАР) + logoUrl=null буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([]);
    const { service } = newService(prisma);

    await expect(service.getBranding()).resolves.toEqual({
      storeName: 'ЧАНАР',
      logoUrl: null,
    });
  });
});

describe('BrandingService.updateBranding()', () => {
  it('storeName болон файл хоёул байхгүй бол NOTHING_TO_UPDATE 400 шидэнэ', async () => {
    const { prisma } = buildPrismaMock();
    const { service } = newService(prisma);

    await expect(
      service.updateBranding(undefined, undefined, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('зөвшөөрөгдөөгүй mimetype бол INVALID_FILE_TYPE 400 шидэнэ', async () => {
    const { prisma } = buildPrismaMock();
    const { service } = newService(prisma);

    await expect(
      service.updateBranding(
        undefined,
        buildFile({ mimetype: 'application/pdf' }),
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5MB-с том файл бол FILE_TOO_LARGE 400 шидэнэ', async () => {
    const { prisma } = buildPrismaMock();
    const { service } = newService(prisma);

    await expect(
      service.updateBranding(
        undefined,
        buildFile({ size: 6 * 1024 * 1024 }),
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('зөвхөн storeName өгвөл MinIO-руу upload хийхгүй, STORE_NAME-г л upsert хийнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([{ key: 'STORE_NAME', value: 'Шинэ нэр' }]);
    const { service, minio } = newService(prisma);

    const result = await service.updateBranding('Шинэ нэр', undefined, 'user-1');

    expect(minio.upload).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: 'STORE_NAME' },
      create: { key: 'STORE_NAME', value: 'Шинэ нэр', updatedByUserId: 'user-1' },
      update: { value: 'Шинэ нэр', updatedByUserId: 'user-1' },
    });
    expect(result.storeName).toBe('Шинэ нэр');
  });

  it('файл өгвөл MinIO-руу upload хийж, STORE_LOGO_URL-г public URL-ээр upsert хийнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([
      { key: 'STORE_LOGO_URL', value: 'http://minio.local/product-images/branding/x.png' },
    ]);
    const { service, minio } = newService(prisma);

    const result = await service.updateBranding(undefined, buildFile(), 'user-1');

    expect(minio.upload).toHaveBeenCalledTimes(1);
    const [objectKey] = minio.upload.mock.calls[0] as [string, Buffer, string];
    expect(objectKey).toMatch(/^branding\/.+\.png$/);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: 'STORE_LOGO_URL' },
      create: expect.objectContaining({ key: 'STORE_LOGO_URL' }),
      update: expect.any(Object),
    });
    expect(result.logoUrl).toContain('branding/');
  });

  it('storeName БОЛОН файл хоёул өгвөл хоёуланг нь upsert хийнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([]);
    const { service } = newService(prisma);

    await service.updateBranding('Шинэ нэр', buildFile(), 'user-1');

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });
});
