import { Prisma } from '@prisma/client';

// RLS-ийн USING нөхцөл тохирохгүй мөр (жиш: өөр салбарын inventory) update/
// delete хийхээр оролдоход Prisma "0 мөр олдсонгүй" гэж P2025 шидэх ба энэ
// нь эрхийн зөрчил ч, байхгүй мөр ч ялгаагүй адилхан шинжтэй харагддаг тул
// аль алинд нь 404 буцаана (401/403-аас илүү мэдээлэл алдагдуулахгүй).
export function isRecordNotFoundError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

// Давхардсан @@unique (жиш: InventoryItem-ийн variantId+branchId хос) үед
// Postgres 23505 (unique_violation) → Prisma P2002.
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

// Дурын хүснэгтийн холбогдох FK багана (жиш: Product.categoryId) байхгүй
// мөр рүү заавал үед Postgres 23503 (foreign_key_violation) → Prisma
// P2003 шидэх. 400 (буруу оролт) болгож буцаана — 500 биш.
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}

// inventory_items_quantity_nonneg CHECK constraint (migration
// 20260816023418_add_catalog_inventory) зөрчигдвөл Prisma 6.19-д (typed
// .update(), raw биш) АЛЬ Ч P-код (P2004 гэх мэт)-тэй тохирохгүй, харин
// PrismaClientUnknownRequestError шидэх нь бодит Postgres/RLS-тэй
// e2e тестээр батлагдсан (Postgres-ийн 23514 check_violation кодыг
// message-даа дамжуулна) — InventoryService.adjustQuantity үүнийг барьж
// 409 INSUFFICIENT_STOCK болгоно. `$executeRaw`-аар (OrderService-ийн
// SAVEPOINT-той decrement/increment) ижил constraint зөрчвөл Prisma
// "Raw query failed" (P2010, PrismaClientKnownRequestError) хэлбэрээр
// шидэх нь ажиглагдсан тул хоёр класс аль алиныг нь барина.
export function isCheckConstraintViolation(
  error: unknown,
  constraint: string,
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientUnknownRequestError) &&
    !(error instanceof Prisma.PrismaClientKnownRequestError)
  ) {
    return false;
  }
  return error.message.includes('23514') && error.message.includes(constraint);
}
