import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const AUDIT_METADATA_KEY = 'audit:config';

export interface AuditMetadata {
  tableName: string;
  action?: string;
  // Хариу (responseBody)-с эсвэл route param-аас recordId-г хэрхэн олохыг
  // тодорхойлно. Өгөгдөөгүй бол AuditInterceptor req.params.id, дараа нь
  // responseBody.id-г эрэлхийлнэ.
  recordId?: (req: Request, responseBody: unknown) => string | undefined;
}

// §7 модуль #15, §4.4, docs/plan.md Phase1 checklist: мэдээлэл өөрчилдөг
// (create/update/delete) endpoint бүрт заавал тавина. `tableName` нь
// audit_logs.tableName баганад шууд бичигдэх БОЛОН AuditInterceptor дотор
// "SELECT * FROM <tableName>" raw SQL-д хүснэгтийн нэр болгон ашиглагддаг
// тул зөвхөн код дотроос хатуу бичигдсэн (hardcoded) утгаар дуудагдах ёстой
// — хэрэглэгчийн оролтоос ХЭЗЭЭ Ч биш.
export function Audit(
  tableName: string,
  options: Omit<AuditMetadata, 'tableName'> = {},
): MethodDecorator {
  return SetMetadata<string, AuditMetadata>(AUDIT_METADATA_KEY, {
    tableName,
    ...options,
  });
}
