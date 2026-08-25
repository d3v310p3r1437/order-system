import { ConflictException } from '@nestjs/common';
import { KeycloakAdminService } from './keycloak-admin.service.js';

// osrm-routing.provider.spec.ts/qpay.provider.spec.ts-тэй ижил зарчим:
// бодит Keycloak рүү хэзээ ч хандахгүй, зөвхөн HTTP давхаргыг (global
// fetch) mock хийж URL/дараалал/хариу задлах логикийг л шалгана.
function mockFetch(
  handler: (
    url: string,
    init?: RequestInit,
  ) => { status: number; body?: unknown; headers?: Record<string, string> },
) {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    const { status, body, headers } = handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body ?? {}),
      headers: { get: (name: string) => headers?.[name] ?? null },
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  process.env.KEYCLOAK_URL = 'http://kc-test:8080';
  process.env.KEYCLOAK_REALM = 'order-system';
  process.env.KEYCLOAK_ADMIN = 'admin';
  process.env.KEYCLOAK_ADMIN_PASSWORD = 'admin-pass';
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('KeycloakAdminService.provisionUser', () => {
  it('и-мэйлээр ОЛДООГҮЙ бол шинээр үүсгэж, local_user_id + нууц үг тохируулна', async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url.includes('/protocol/openid-connect/token')) {
        return { status: 200, body: { access_token: 'admin-token' } };
      }
      if (url.includes('/users?email=')) {
        return { status: 200, body: [] };
      }
      if (init?.method === 'POST' && url.endsWith('/users')) {
        return {
          status: 201,
          headers: { Location: `${url}/kc-new-id` },
        };
      }
      if (init?.method === 'PUT' && url.endsWith('/kc-new-id')) {
        return { status: 204 };
      }
      if (init?.method === 'PUT' && url.endsWith('/reset-password')) {
        return { status: 204 };
      }
      throw new Error(`Тохирохгүй дуудлага: ${init?.method} ${url}`);
    });

    const service = new KeycloakAdminService();
    const result = await service.provisionUser({
      email: 'new.staff@order-system.mn',
      fullName: 'Шинэ Ажилтан',
      localUserId: 'new-user-id',
    });

    expect(result.wasCreated).toBe(true);
    expect(result.keycloakUserId).toBe('kc-new-id');
    expect(result.temporaryPassword).toHaveLength(16);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('и-мэйлээр ОЛДСОН (local_user_id-гүй) бол ДАХИН АШИГЛАНА, шинээр үүсгэхгүй', async () => {
    mockFetch((url, init) => {
      if (url.includes('/protocol/openid-connect/token')) {
        return { status: 200, body: { access_token: 'admin-token' } };
      }
      if (url.includes('/users?email=')) {
        return {
          status: 200,
          body: [{ id: 'kc-existing-id', email: 'existing@order-system.mn' }],
        };
      }
      if (init?.method === 'POST' && url.endsWith('/users')) {
        throw new Error(
          'Шинээр үүсгэх ЁСГҮЙ (олдсон хэрэглэгчийг дахин ашиглах ёстой)',
        );
      }
      if (init?.method === 'PUT') {
        return { status: 204 };
      }
      throw new Error(`Тохирохгүй дуудлага: ${init?.method} ${url}`);
    });

    const service = new KeycloakAdminService();
    const result = await service.provisionUser({
      email: 'existing@order-system.mn',
      fullName: 'Хуучин Ажилтан',
      localUserId: 'new-user-id',
    });

    expect(result.wasCreated).toBe(false);
    expect(result.keycloakUserId).toBe('kc-existing-id');
  });

  it('ӨӨР local_user_id-тай (аль хэдийн ХОЛБОГДСОН) хэрэглэгч олдвол ConflictException шиднэ', async () => {
    mockFetch((url) => {
      if (url.includes('/protocol/openid-connect/token')) {
        return { status: 200, body: { access_token: 'admin-token' } };
      }
      if (url.includes('/users?email=')) {
        return {
          status: 200,
          body: [
            {
              id: 'kc-linked-id',
              email: 'linked@order-system.mn',
              attributes: { local_user_id: ['already-linked-user-id'] },
            },
          ],
        };
      }
      throw new Error('Энэ тохиолдолд цааш дуудагдах ёсгүй');
    });

    const service = new KeycloakAdminService();
    await expect(
      service.provisionUser({
        email: 'linked@order-system.mn',
        fullName: 'Холбогдсон Хэрэглэгч',
        localUserId: 'brand-new-user-id',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('KeycloakAdminService.deleteUser', () => {
  it('DELETE хүсэлт зөв URL-руу явуулна', async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url.includes('/protocol/openid-connect/token')) {
        return { status: 200, body: { access_token: 'admin-token' } };
      }
      if (init?.method === 'DELETE') {
        return { status: 204 };
      }
      throw new Error(`Тохирохгүй дуудлага: ${init?.method} ${url}`);
    });

    const service = new KeycloakAdminService();
    await service.deleteUser('kc-to-delete');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users/kc-to-delete'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
