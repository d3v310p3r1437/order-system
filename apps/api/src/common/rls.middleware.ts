import {
  Injectable,
  Logger,
  type NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TokenVerifierService } from '../auth/token-verifier.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestContextService } from './request-context.js';

// §6.3 ADR: хүсэлт бүрийг RLS-д хамрагдсан interactive transaction-д ороож,
// дараа нь дараагийн middleware/controller-уудыг тухайн transaction-ы
// AsyncLocalStorage контекст дотор ажиллуулна.
//
// §6.2: identity-г `Authorization: Bearer <token>` header-ээс
// TokenVerifierService-ээр баталгаажуулж олно (custom customer JWT эсвэл
// Keycloak JWT аль аль нь адилхан замаар). Token байхгүй үед л (мөн зөвхөн
// NODE_ENV !== 'production' орчинд) хуучин `x-debug-user-id` debug header
// fallback хэвээр үлдсэн.
@Injectable()
export class RlsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RlsMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly tokenVerifier: TokenVerifierService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let userId: string | null;
    try {
      userId = await this.resolveUserId(req);
    } catch (err) {
      next(err);
      return;
    }

    let finishResponse: () => void;
    const responseFinished = new Promise<void>((resolve) => {
      finishResponse = resolve;
    });
    res.once('finish', () => finishResponse());
    res.once('close', () => finishResponse());

    this.prisma
      .runRequestTransaction(userId, (tx) =>
        this.requestContext.run({ tx, userId }, async () => {
          next();
          await responseFinished;
        }),
      )
      .catch((err: unknown) => {
        this.logger.error(
          'RLS transaction алдаа гарлаа',
          err instanceof Error ? err.stack : err,
        );
        if (!res.headersSent) {
          next(err);
        }
      });
  }

  private async resolveUserId(req: Request): Promise<string | null> {
    const authHeader = req.header('authorization');
    if (authHeader) {
      const [scheme, token] = authHeader.split(' ');
      if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw new UnauthorizedException({
          code: 'INVALID_AUTH_HEADER',
          message:
            'Authorization header буруу форматтай (Bearer <token> байх ёстой)',
        });
      }
      const { localUserId } = await this.tokenVerifier.verify(token);
      return localUserId;
    }

    // prod-д header-ийг огт үл тоомсорлоно — зөвхөн dev/spike орчинд ашиглана.
    if (process.env.NODE_ENV !== 'production') {
      return req.header('x-debug-user-id')?.trim() || null;
    }
    return null;
  }
}
