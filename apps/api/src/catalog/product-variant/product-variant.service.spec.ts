import { ProductVariantService } from './product-variant.service.js';

function buildPrismaMock() {
  const create = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();

  const tx = {
    productVariant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create,
      update,
      delete: remove,
    },
  };

  const prisma = {
    get tx() {
      return tx;
    },
  };

  return { prisma, mocks: { create, update, remove } };
}

function newService(prisma: unknown) {
  return new ProductVariantService(
    prisma as ConstructorParameters<typeof ProductVariantService>[0],
  );
}

describe('ProductVariantService — бүтэцтэй шинж чанар (2026-09-05)', () => {
  it('create() color/size/attributes-ийг DB рүү дамжуулна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.create.mockResolvedValue({
      id: 'v-1',
      productId: 'p-1',
      color: 'улаан',
      size: 'M',
      attributes: { марк: 'Ariel' },
    });
    const service = newService(prisma);

    const result = await service.create({
      productId: 'p-1',
      name: 'Улаан, M',
      sku: 'SKU-1',
      basePrice: 1000,
      color: 'улаан',
      size: 'M',
      attributes: { марк: 'Ariel' },
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        productId: 'p-1',
        name: 'Улаан, M',
        sku: 'SKU-1',
        unit: undefined,
        basePrice: 1000,
        costPrice: undefined,
        barcode: undefined,
        isActive: undefined,
        defaultPreOrderEnabled: undefined,
        defaultPreOrderLeadDays: undefined,
        color: 'улаан',
        size: 'M',
        attributes: { марк: 'Ariel' },
      },
    });
    expect(result.color).toBe('улаан');
  });

  it('update() color/size-ийг DB рүү дамжуулна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.update.mockResolvedValue({
      id: 'v-1',
      productId: 'p-1',
      color: 'хөх',
      size: 'L',
    });
    const service = newService(prisma);

    await service.update('v-1', { color: 'хөх', size: 'L' });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'v-1' },
      data: {
        name: undefined,
        sku: undefined,
        unit: undefined,
        basePrice: undefined,
        costPrice: undefined,
        barcode: undefined,
        isActive: undefined,
        defaultPreOrderEnabled: undefined,
        defaultPreOrderLeadDays: undefined,
        color: 'хөх',
        size: 'L',
        attributes: undefined,
      },
    });
  });

  it('remove() variant-ийг устгана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.remove.mockResolvedValue({ id: 'v-1', productId: 'p-1' });
    const service = newService(prisma);

    const result = await service.remove('v-1');

    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 'v-1' } });
    expect(result.id).toBe('v-1');
  });
});
