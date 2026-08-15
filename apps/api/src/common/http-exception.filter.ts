import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

// CLAUDE.md: "API алдааны бүтэц: { "error": { "code", "message", "details" } }"
// Endpoint бүрийг тус тусад нь энэ бүтцээр буцаах шаардлагагүй болгож,
// нэг дор энд normalize хийнэ.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const { code, message, details } = normalize(exception, status);

    if (status >= 500) {
      this.logger.error(
        message,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json({ error: { code, message, details } });
  }
}

function normalize(
  exception: unknown,
  status: number,
): { code: string; message: string; details: unknown } {
  if (exception instanceof HttpException) {
    const body = exception.getResponse();

    if (typeof body === 'object' && body !== null) {
      const b = body as Record<string, unknown>;

      // Манай өөрийн HttpException-үүд (жиш: throw new UnauthorizedException({
      // code: 'INVALID_CREDENTIALS', message: '...' })) — code-ыг шууд ашиглана.
      if (typeof b.code === 'string') {
        return {
          code: b.code,
          message: (b.message as string) ?? exception.message,
          details: b.details ?? null,
        };
      }

      // class-validator ValidationPipe-ийн өгөгдмөл хариу: { message: string[] }
      if (Array.isArray(b.message)) {
        return {
          code: 'VALIDATION_ERROR',
          message: 'Оролтын мэдээлэл буруу байна',
          details: b.message,
        };
      }

      if (typeof b.message === 'string') {
        return {
          code: statusToCode(status),
          message: b.message,
          details: null,
        };
      }
    }

    if (typeof body === 'string') {
      return { code: statusToCode(status), message: body, details: null };
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    details: null,
  };
}

function statusToCode(status: number): string {
  return (HttpStatus as unknown as Record<number, string>)[status] ?? 'ERROR';
}
