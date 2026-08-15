import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  type JWTVerifyGetKey,
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
} from 'jose';
import { CUSTOMER_JWT_ISSUER } from './constants.js';

export interface VerifiedIdentity {
  localUserId: string;
}

function getCustomerSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET орчны хувьсагч тохируулагдаагүй байна');
  }
  return new TextEncoder().encode(secret);
}

// §6.2 архитектурын шийдвэр: custom (харилцагч) БОЛОН Keycloak (ажилтан)
// JWT хоёулаа зөвхөн "identity"-г нотолно. Аль эх үүсвэрээс ирснийг `iss`
// claim-аар ялгаж, тохирох аргаар (HS256 secret эсвэл RS256 JWKS)
// баталгаажуулаад, `localUserId`-г (apps/api users.id) буцаана. Role/branch
// ХЭЗЭЭ Ч энд уншигдахгүй — user_branch_roles хүснэгтээс RLS-ээр хамгаалагдсан
// байдлаар л асуух ёстой (docs/adr/002-jwt-identity-only-authorization-from-db.md).
@Injectable()
export class TokenVerifierService {
  private readonly keycloakIssuer: string;
  private readonly keycloakJwks: JWTVerifyGetKey;

  constructor() {
    const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM ?? 'order-system';
    this.keycloakIssuer = `${keycloakUrl}/realms/${realm}`;
    this.keycloakJwks = createRemoteJWKSet(
      new URL(`${this.keycloakIssuer}/protocol/openid-connect/certs`),
    );
  }

  async verify(rawToken: string): Promise<VerifiedIdentity> {
    let iss: string | undefined;
    try {
      iss = decodeJwt(rawToken).iss;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Token задлан унших боломжгүй байна',
      });
    }

    if (iss === CUSTOMER_JWT_ISSUER) {
      return this.verifyCustomerToken(rawToken);
    }
    if (iss === this.keycloakIssuer) {
      return this.verifyKeycloakToken(rawToken);
    }
    throw new UnauthorizedException({
      code: 'UNKNOWN_TOKEN_ISSUER',
      message: 'Танигдаагүй token эх үүсвэр',
    });
  }

  private async verifyCustomerToken(
    rawToken: string,
  ): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(rawToken, getCustomerSecret(), {
        issuer: CUSTOMER_JWT_ISSUER,
      });
      if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
        throw new Error('access token биш');
      }
      return { localUserId: payload.sub };
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Token хүчингүй байна',
      });
    }
  }

  private async verifyKeycloakToken(
    rawToken: string,
  ): Promise<VerifiedIdentity> {
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(rawToken, this.keycloakJwks, {
        issuer: this.keycloakIssuer,
      }));
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Token хүчингүй байна',
      });
    }

    const localUserId = payload.local_user_id;
    if (typeof localUserId !== 'string') {
      throw new UnauthorizedException({
        code: 'MISSING_LOCAL_USER_ID',
        message:
          'Keycloak token дотор local_user_id claim алга байна — admin энэ хэрэглэгчийг DB-тэй холбоогүй байж магадгүй',
      });
    }
    return { localUserId };
  }
}
