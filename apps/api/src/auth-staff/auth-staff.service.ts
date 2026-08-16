import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginThrottleService } from '../common/login-throttle.service.js';

const THROTTLE_NAMESPACE = 'auth-staff';

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
}

export interface StaffTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: string;
}

function getClientSecret(): string {
  const secret = process.env.KEYCLOAK_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      'KEYCLOAK_CLIENT_SECRET орчны хувьсагч тохируулагдаагүй байна',
    );
  }
  return secret;
}

// §6.2: ажилтны (и-мэйл) нэвтрэлт — admin-web Keycloak руу ШУУД хандахгүй
// (client secret browser-т задрахаас сэргийлнэ), оронд нь энэ backend
// service нь Keycloak-ийн Resource Owner Password Credentials grant-аар
// server-to-server нэвтэрч, буцаасан token хосыг camelCase болгож дамжуулна.
@Injectable()
export class AuthStaffService {
  private readonly tokenEndpoint: string;
  private readonly clientId: string;

  constructor(private readonly loginThrottle: LoginThrottleService) {
    const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM ?? 'order-system';
    this.tokenEndpoint = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
    // infra/keycloak/setup-realm.sh-ийн CLIENT_ID-тай ижил өгөгдмөл утга.
    this.clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'api-client';
  }

  async login(email: string, password: string): Promise<StaffTokenPair> {
    if (await this.loginThrottle.isBlocked(THROTTLE_NAMESPACE, email)) {
      throw new HttpException(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message:
            'Оролдлого хэт олон удаа амжилтгүй боллоо. 15 минутын дараа дахин оролдоно уу.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const res = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.clientId,
        client_secret: getClientSecret(),
        username: email,
        password,
      }),
    });

    // Keycloak буруу нэвтрэлтэд 400 (invalid_grant) буцаадаг, 401 биш —
    // тиймээс аль ч 2xx биш статусыг нэгдсэн INVALID_CREDENTIALS болгоно.
    if (!res.ok) {
      await this.loginThrottle.recordFailure(THROTTLE_NAMESPACE, email);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'И-мэйл эсвэл нууц үг буруу байна',
      });
    }

    const body = (await res.json()) as KeycloakTokenResponse;
    await this.loginThrottle.reset(THROTTLE_NAMESPACE, email);

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in,
      refreshExpiresIn: body.refresh_expires_in,
      tokenType: body.token_type,
    };
  }
}
