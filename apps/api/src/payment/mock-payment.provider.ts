import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CheckPaymentResult,
  CreateInvoiceResult,
  PaymentProvider,
  PaymentStatus,
  RefundPaymentResult,
} from './payment-provider.interface.js';

// docs/plan.md §8 Phase 3b, Хэсэг B #7: QPay sandbox credential ХАРААХАН
// БАЙХГҮЙ үед бүрэн урсгал (checkout→invoice→"төлбөр төлөгдлөө" simulate→
// webhook→Order.paidAt) турших боломжтой болгох mock provider.
//
// Санамсаргүй invoiceId бүрийн статусыг зөвхөн ЭНЭ process-ийн санах ойд
// (singleton service, dev/тест зориулалттай, prod-д ч алдаа биш ч
// horizontal scale-д instance хооронд хуваалцагдахгүй) хадгална —
// prod-д QPayProvider ашиглах тул давуу тал/дутагдал холбогдохгүй.
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly invoices = new Map<string, PaymentStatus>();

  // orderId/amount-г mock-д ашигладаггүй (санамсаргүй ID л үүсгэдэг) —
  // PaymentProvider interface-ийн бусад параметртэй functiontype-той
  // структурын хувьд нийцтэй тул зарлахгүй орхив.
  createInvoice(): Promise<CreateInvoiceResult> {
    const providerInvoiceId = `mock_${randomUUID()}`;
    this.invoices.set(providerInvoiceId, 'PENDING');
    return Promise.resolve({
      providerInvoiceId,
      payUrl: `mock://pay/${providerInvoiceId}`,
    });
  }

  checkPayment(providerPaymentId: string): Promise<CheckPaymentResult> {
    return Promise.resolve({
      status: this.invoices.get(providerPaymentId) ?? 'FAILED',
    });
  }

  // docs/plan.md §8 Phase 3c (буцаалт): жинхэнэ QPay-тай адил зөвхөн PAID
  // invoice-ийг буцаах боломжтой гэдгийг simulate хийнэ — өмнө нь
  // аргумент үл тоомсорлож үргэлж амжилттай буцдаг байсан тул
  // ReturnRequestService-ийн REFUND_FAILED замыг (§7 модуль #9-ийн
  // "refund API алдаа өгвөл status=REFUND_FAILED") e2e/нэгж тестээр
  // детерминистикээр (тусгай simulate-endpoint шаардлагагүйгээр) турших
  // боломжгүй байсан. Promise.reject (throw биш) ашиглав — эс бөгөөс
  // энэ функц async биш тул алдаа promise-ийн rejection БИШ, шууд
  // синхрон throw болж дуудагчийн `await ...rejects` шалгалттай
  // нийцэхгүй байх байсан.
  refundPayment(providerPaymentId: string): Promise<RefundPaymentResult> {
    if (this.invoices.get(providerPaymentId) !== 'PAID') {
      return Promise.reject(
        new Error(
          `MockPaymentProvider: буцаалт хийх боломжгүй — invoice "${providerPaymentId}" PAID төлөвт байхгүй`,
        ),
      );
    }
    return Promise.resolve({ providerRefundId: `mock_refund_${randomUUID()}` });
  }

  // POST /payment/mock/simulate-paid/:providerInvoiceId (зөвхөн
  // NODE_ENV !== 'production') дуудагдана — "хэрэглэгч төлбөр төлсөн"
  // гэдгийг гараар simulate хийнэ. Танигдаагүй invoiceId бол false буцаана.
  simulatePaid(providerInvoiceId: string): boolean {
    if (!this.invoices.has(providerInvoiceId)) {
      return false;
    }
    this.invoices.set(providerInvoiceId, 'PAID');
    return true;
  }
}
