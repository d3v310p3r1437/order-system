import type { Prisma } from '@prisma/client';

// docs/adr/001, orders/order.service.ts-ийн анхны тайлбар: RlsMiddleware
// хэдийн бүх хүсэлтийг нэг interactive transaction-д ороосон байдаг тул
// (`tx.$transaction` метод deny-list-д орсон) олон мөрийн mutation
// (жиш: Order+OrderItem+inventory decrement, эсвэл ReturnRequest+inventory
// restock) хэсэгчлэн буцаах (rollback) шаардлагатай үед SAVEPOINT ашиглана.
// Анх OrderService дотор бичигдсэн, ReturnRequestService-д мөн адил
// хэрэгцээ гарсан тул нийтлэг util болгож зөөв (ADR 005-ийн "давхардуулж
// бичихгүй" зарчим WRITE SQL-ээс гадна энгийн TS туслах логикт ч хамаарна).
//
// ⚠️ Postgres-ийн "0 мөр олдсонгүй" (жиш: InventoryItem мөр байхгүй) нь
// ЖИНХЭНЭ Postgres алдаа БИШ (statement амжилттай, зүгээр 0 мөр өөрчилсөн)
// тул CHECK constraint зөрчил шиг транзакцыг автоматаар "aborted" болгодоггүй
// — аль ч төрлийн алдаа (JS-level throw эсвэл Postgres constraint violation)
// гарсан ч ROLLBACK TO SAVEPOINT-ыг ЗААВАЛ дуудна.
let savepointCounter = 0;

export async function withSavepoint<T>(
  tx: Prisma.TransactionClient,
  fn: () => Promise<T>,
): Promise<T> {
  // Нэг хүсэлтийн туршид (жиш: checkout доторх олон item) withSavepoint
  // хэд хэдэн удаа дуудагдаж болох тул SAVEPOINT нэр давхцахгүйн тулд
  // тоолуур залгав (Postgres-д ижил нэртэй SAVEPOINT дахин нээх нь өмнөхийг
  // "нуух" боловч алдаа биш ч, RELEASE/ROLLBACK-ийн зорилтот SAVEPOINT-ыг
  // тодорхойгүй болгохоос сэргийлж давхцалгүй нэр ашиглав).
  const name = `sp_${++savepointCounter}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
  try {
    const result = await fn();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
    throw error;
  }
}
