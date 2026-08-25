import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';

// docs/adr/002-jwt-identity-only-authorization-from-db.md-ийн "Инцидент
// (2026-08-25)"-ийг сэргээхгүй байхын тулд `infra/keycloak/setup-realm.sh`-ийн
// коммент дэх 3 алхамт ГАР журмыг (1. Postgres users мөр 2. Keycloak
// local_user_id attribute 3. user_branch_roles) StaffService-ийн НЭГ
// код зам болгож нэгтгэх зорилготой. Энэ service нь ЗӨВХӨН Keycloak
// талыг (алхам 2, мөн шаардлагатай бол алхам-адилтгах хэрэглэгч үүсгэх)
// хариуцна — auth-staff.service.ts-ийн ROPC fetch-ийн загварыг л дахин
// ашигласан (тусдаа HTTP client library шинээр нэмээгүй).
interface KeycloakAdminTokenResponse {
  access_token: string;
}

interface KeycloakUserRepresentation {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  attributes?: Record<string, string[]>;
}

export interface ProvisionedKeycloakUser {
  keycloakUserId: string;
  // StaffService-д rollback хийх эсэхийг шийдэхэд ашиглана: зөвхөн ЭНЭ
  // дуудлагаар ШИНЭЭР үүссэн Keycloak хэрэглэгчийг л устгана (олдож дахин
  // ашигласан хуучин хэрэглэгчийг ХЭЗЭЭ Ч устгахгүй).
  wasCreated: boolean;
  temporaryPassword: string;
}

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`${name} орчны хувьсагч тохируулагдаагүй байна`);
  }
  return value;
}

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    // Keycloak-ийн User Profile-д firstName/lastName ХОЁУЛАА REQUIRED
    // (CLAUDE.md-ийн "Account is not fully set up" gotcha) тул зайгүй
    // ганц үгтэй нэрийг хоёуланд нь адилхан ашиглана.
    return { firstName: trimmed, lastName: trimmed };
  }
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName:
      trimmed.slice(spaceIndex + 1).trim() || trimmed.slice(0, spaceIndex),
  };
}

@Injectable()
export class KeycloakAdminService {
  private readonly keycloakUrl: string;
  private readonly realm: string;

  constructor() {
    this.keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    this.realm = process.env.KEYCLOAK_REALM ?? 'order-system';
  }

  // setup-realm.sh-ийн `kcadm config credentials --realm master`-тэй ижил:
  // master realm-ийн admin-cli client (public) руу ROPC grant-аар
  // KEYCLOAK_ADMIN/KEYCLOAK_ADMIN_PASSWORD-оор нэвтэрч admin token авна.
  private async getAdminToken(): Promise<string> {
    const res = await fetch(
      `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: getEnv('KEYCLOAK_ADMIN', 'admin'),
          password: getEnv('KEYCLOAK_ADMIN_PASSWORD'),
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Keycloak admin token авахад амжилтгүй боллоо (HTTP ${res.status})`,
      );
    }
    const body = (await res.json()) as KeycloakAdminTokenResponse;
    return body.access_token;
  }

  private async findUserByEmail(
    token: string,
    email: string,
  ): Promise<KeycloakUserRepresentation | null> {
    const res = await fetch(
      `${this.keycloakUrl}/admin/realms/${this.realm}/users?email=${encodeURIComponent(email)}&exact=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new Error(
        `Keycloak хэрэглэгч хайхад амжилтгүй боллоо (HTTP ${res.status})`,
      );
    }
    const users = (await res.json()) as KeycloakUserRepresentation[];
    return users[0] ?? null;
  }

  private async createUser(
    token: string,
    email: string,
    fullName: string,
  ): Promise<string> {
    const { firstName, lastName } = splitFullName(fullName);
    const res = await fetch(
      `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: email,
          email,
          firstName,
          lastName,
          enabled: true,
          emailVerified: true,
        }),
      },
    );
    if (res.status !== 201) {
      throw new Error(
        `Keycloak хэрэглэгч үүсгэхэд амжилтгүй боллоо (HTTP ${res.status})`,
      );
    }
    const location = res.headers.get('Location');
    const keycloakUserId = location?.split('/').pop();
    if (!keycloakUserId) {
      throw new Error(
        'Keycloak-ийн шинэ хэрэглэгчийн ID Location header-ээс олдсонгүй',
      );
    }
    return keycloakUserId;
  }

  // ⚠️ Keycloak admin API-ийн PUT /users/:id бол ФУЛЛ REPLACE (docs/plan.md
  // Phase 5-ийн "PATCH БИШ" gotcha) — тул `attributes`-аас гадна email/
  // firstName/lastName-ийг ЗААВАЛ дахин дамжуулна, эс бөгөөс тэдгээр нь
  // хоосроод "Account is not fully set up" алдаа өгнө.
  private async setLocalUserIdAttribute(
    token: string,
    keycloakUserId: string,
    localUserId: string,
    email: string,
    fullName: string,
  ): Promise<void> {
    const { firstName, lastName } = splitFullName(fullName);
    const res = await fetch(
      `${this.keycloakUrl}/admin/realms/${this.realm}/users/${keycloakUserId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          enabled: true,
          attributes: { local_user_id: [localUserId] },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Keycloak local_user_id attribute тохируулахад амжилтгүй боллоо (HTTP ${res.status})`,
      );
    }
  }

  private async setPassword(
    token: string,
    keycloakUserId: string,
    password: string,
  ): Promise<void> {
    const res = await fetch(
      `${this.keycloakUrl}/admin/realms/${this.realm}/users/${keycloakUserId}/reset-password`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // temporary: false — ROPC (Resource Owner Password Credentials,
        // auth-staff.service.ts-ийн ганц нэвтрэлтийн зам) нь Keycloak-ийн
        // "required actions"-ыг (жиш: UPDATE_PASSWORD) бөглүүлэх browser
        // урсгал ОГТ дэмждэггүй тул temporary=true тавивал шинэ ажилтан
        // ЯГ ижил "Account is not fully set up" алдаагаар түгжигдэнэ.
        // Тиймээс түр нууц үгийг шууд байнгын (temporary=false) нууц үг
        // болгож тавьж, StaffController-ийн хариунд НЭГ Л УДАА буцаана —
        // ажилтан үүнийг өөрчлөх нь Keycloak admin console-оор хийгдэх
        // ёстой гар үйлдэл хэвээр байна (энэ Phase-ийн хамрах хүрээнд
        // орсонгүй, доор StaffController-ийн коммент/report-д тэмдэглэсэн).
        body: JSON.stringify({
          type: 'password',
          value: password,
          temporary: false,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Keycloak нууц үг тохируулахад амжилтгүй боллоо (HTTP ${res.status})`,
      );
    }
  }

  async deleteUser(keycloakUserId: string): Promise<void> {
    const token = await this.getAdminToken();
    await fetch(
      `${this.keycloakUrl}/admin/realms/${this.realm}/users/${keycloakUserId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
  }

  // StaffService.create()-ийн ЦОРЫН ГАНЦ Keycloak-руу хандах цэг: олдвол
  // дахин ашиглаж, олдоогүй бол шинээр үүсгээд, аль ч тохиолдолд
  // local_user_id attribute-ыг (дахин) тохируулж, шинэ түр нууц үг тавина.
  async provisionUser(params: {
    email: string;
    fullName: string;
    localUserId: string;
  }): Promise<ProvisionedKeycloakUser> {
    const token = await this.getAdminToken();
    const existing = await this.findUserByEmail(token, params.email);

    if (existing?.attributes?.local_user_id?.[0]) {
      const existingLocalUserId = existing.attributes.local_user_id[0];
      if (existingLocalUserId !== params.localUserId) {
        throw new ConflictException({
          code: 'KEYCLOAK_USER_ALREADY_LINKED',
          message:
            'Энэ и-мэйлтэй Keycloak хэрэглэгч аль хэдийн өөр DB бүртгэлтэй холбогдсон байна',
        });
      }
    }

    const keycloakUserId =
      existing?.id ??
      (await this.createUser(token, params.email, params.fullName));
    const wasCreated = !existing;
    const temporaryPassword = randomBytes(12).toString('base64url');

    await this.setLocalUserIdAttribute(
      token,
      keycloakUserId,
      params.localUserId,
      params.email,
      params.fullName,
    );
    await this.setPassword(token, keycloakUserId, temporaryPassword);

    return { keycloakUserId, wasCreated, temporaryPassword };
  }
}
