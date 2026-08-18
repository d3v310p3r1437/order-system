import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductImageService } from './product-image.service.js';

interface CreateProductImageArgs {
  data: {
    productId: string;
    objectKey: string;
    displayOrder: number;
    altText: string | null;
  };
}

function buildPrismaMock() {
  const productFindUnique = jest.fn();
  const productImageFindFirst = jest.fn();
  const productImageCreate = jest.fn<
    Promise<{ id: string } & CreateProductImageArgs['data']>,
    [CreateProductImageArgs]
  >();
  const productImageDelete = jest.fn();

  const tx = {
    product: { findUnique: productFindUnique },
    productImage: {
      findFirst: productImageFindFirst,
      create: productImageCreate,
      delete: productImageDelete,
    },
  };
  const prisma = {
    get tx() {
      return tx;
    },
  };
  return {
    prisma,
    mocks: {
      productFindUnique,
      productImageFindFirst,
      productImageCreate,
      productImageDelete,
    },
  };
}

function buildMinioMock() {
  return {
    upload: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn(
      (key: string) => `http://minio.local/product-images/${key}`,
    ),
  };
}

function newService(prisma: unknown, minio = buildMinioMock()) {
  return {
    service: new ProductImageService(
      prisma as ConstructorParameters<typeof ProductImageService>[0],
      minio as ConstructorParameters<typeof ProductImageService>[1],
    ),
    minio,
  };
}

function buildFile(
  overrides: Partial<{ mimetype: string; size: number }> = {},
) {
  return {
    buffer: Buffer.from('fake-image-bytes'),
    mimetype: overrides.mimetype ?? 'image/jpeg',
    size: overrides.size ?? 1024,
  };
}

describe('ProductImageService.upload()', () => {
  it('файл дамжуулаагүй бол FILE_REQUIRED 400 шидэнэ', async () => {
    const { prisma } = buildPrismaMock();
    const { service } = newService(prisma);

    await expect(service.upload('p-1', undefined, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('зөвшөөрөгдөөгүй mimetype (жиш: PDF) бол INVALID_FILE_TYPE 400 шидэнэ', async () => {
    const { prisma } = buildPrismaMock();
    const { service } = newService(prisma);

    await expect(
      service.upload('p-1', buildFile({ mimetype: 'application/pdf' }), {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('5MB-с том файл бол FILE_TOO_LARGE 400 шидэнэ', async () => {
    const { prisma } = buildPrismaMock();
    const { service } = newService(prisma);

    await expect(
      service.upload('p-1', buildFile({ size: 6 * 1024 * 1024 }), {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('бүтээгдэхүүн олдохгүй бол PRODUCT_NOT_FOUND 404 шидэнэ, MinIO рүү upload хийхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productFindUnique.mockResolvedValue(null);
    const { service, minio } = newService(prisma);

    await expect(service.upload('p-1', buildFile(), {})).rejects.toThrow(
      NotFoundException,
    );
    expect(minio.upload).not.toHaveBeenCalled();
  });

  it('амжилттай бол MinIO-руу upload хийж, DB мөр үүсгээд public URL-тэй буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productFindUnique.mockResolvedValue({ id: 'p-1' });
    mocks.productImageCreate.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'img-1', ...data }),
    );
    const { service, minio } = newService(prisma);

    const result = await service.upload('p-1', buildFile(), {
      displayOrder: 2,
      altText: 'зураг',
    });

    expect(minio.upload).toHaveBeenCalledTimes(1);
    const [objectKey] = minio.upload.mock.calls[0] as [string, Buffer, string];
    expect(objectKey).toMatch(/^products\/p-1\/.+\.jpg$/);
    expect(mocks.productImageCreate).toHaveBeenCalledTimes(1);
    const createArgs = mocks.productImageCreate.mock.calls[0][0];
    expect(createArgs.data.productId).toBe('p-1');
    expect(createArgs.data.displayOrder).toBe(2);
    expect(createArgs.data.altText).toBe('зураг');
    expect(result.url).toContain(
      'http://minio.local/product-images/products/p-1/',
    );
  });
});

describe('ProductImageService.remove()', () => {
  it('зураг олдохгүй (эсвэл өөр бүтээгдэхүүнд харьяалагдах) бол PRODUCT_IMAGE_NOT_FOUND 404 шидэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productImageFindFirst.mockResolvedValue(null);
    const { service, minio } = newService(prisma);

    await expect(service.remove('p-1', 'img-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(minio.remove).not.toHaveBeenCalled();
  });

  it('амжилттай бол ЭХЛЭЭД DB мөрийг устгаад, дараа нь MinIO объектыг устгана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const image = {
      id: 'img-1',
      productId: 'p-1',
      objectKey: 'products/p-1/a.jpg',
    };
    mocks.productImageFindFirst.mockResolvedValue(image);
    const { service, minio } = newService(prisma);

    const callOrder: string[] = [];
    mocks.productImageDelete.mockImplementation(() => {
      callOrder.push('db');
      return Promise.resolve(image);
    });
    minio.remove.mockImplementation(() => {
      callOrder.push('minio');
      return Promise.resolve();
    });

    await service.remove('p-1', 'img-1');

    expect(callOrder).toEqual(['db', 'minio']);
    expect(minio.remove).toHaveBeenCalledWith('products/p-1/a.jpg');
  });

  it('MinIO устгах алдаа гаргасан ч (объект аль хэдийн байхгүй гэх мэт) DB мөр аль хэдийн устсан тул алдаа дээшлүүлэхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const image = {
      id: 'img-1',
      productId: 'p-1',
      objectKey: 'products/p-1/a.jpg',
    };
    mocks.productImageFindFirst.mockResolvedValue(image);
    mocks.productImageDelete.mockResolvedValue(image);
    const { service, minio } = newService(prisma);
    minio.remove.mockRejectedValue(new Error('NoSuchKey'));

    await expect(service.remove('p-1', 'img-1')).resolves.toEqual(image);
  });
});
