import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';

function mockHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('code бүхий HttpException-ыг шууд дамжуулна (жиш: манай custom auth алдаа)', () => {
    const { host, status, json } = mockHost();
    filter.catch(
      new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'буруу',
      }),
      host,
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INVALID_CREDENTIALS', message: 'буруу', details: null },
    });
  });

  it('ValidationPipe-ийн message[]-ийг VALIDATION_ERROR болгож details-д массивыг хийнэ', () => {
    const { host, status, json } = mockHost();
    filter.catch(
      new BadRequestException(['phone буруу', 'password богино']),
      host,
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Оролтын мэдээлэл буруу байна',
        details: ['phone буруу', 'password богино'],
      },
    });
  });

  it('code-гүй, зөвхөн message string-тэй HttpException-ыг статусын нэрээр code болгоно', () => {
    const { host, status, json } = mockHost();
    filter.catch(new ConflictException('давхцаж байна'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'давхцаж байна', details: null },
    });
  });

  it('HttpException биш танихгүй алдааг 500 INTERNAL_ERROR болгоно', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('гэнэтийн алдаа'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: null,
      },
    });
  });

  it('string response бүхий HttpException-ыг зохих статусын code-оор боож өгнө', () => {
    const { host, status, json } = mockHost();
    filter.catch(new HttpException('зөвшөөрөлгүй', HttpStatus.FORBIDDEN), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'зөвшөөрөлгүй', details: null },
    });
  });
});
