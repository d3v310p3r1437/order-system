import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OrderStatus, ReturnStatus } from '@prisma/client';
import { RequestContextService } from '../common/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from './notification-provider.interface.js';
import {
  buildOrderStatusMessage,
  buildReturnStatusMessage,
  type NotificationMessage,
} from './order-notification.util.js';

interface NotifiableCustomer {
  phone: string | null;
  email: string | null;
}

// docs/plan.md §8 Phase 4, Хэсэг B #14: захиалга/буцаалтын статус
// өөрчлөгдөх мөчид харилцагч руу SMS/email мэдэгдэл илгээнэ —
// `SearchIndexer`-тэй (src/search/search-indexer.service.ts) ЯГ ИЖИЛ
// `RequestContextService.onCommit()`-гэйт загвар.
//
// ⚠️ Чухал загварын шийдвэр: `onCommit()`-д бүртгэсэн callback нь
// RlsMiddleware-ийн request-scoped transaction (docs/adr/001) COMMIT
// хийгдсэний ДАРАА л ажилладаг тул тэр үед `this.prisma.tx` ХҮЧИНГҮЙ
// (transaction аль хэдийн хаагдсан). Иймд харилцагчийн `phone`/`email`-г
// **onCommit бүртгэхээс ӨМНӨ, tx хараахан нээлттэй байхад л** уншина —
// зөвхөн бодит sms/email илгээх (сүлжээний) дуудлагыг `onCommit()`-оор
// хойшлуулна. Энэ шалтгаанаас `notifyOrderStatusChanged()`/
// `notifyReturnStatusChanged()` нь ASYNC (дуудагч ЗААВАЛ `await` хийх
// ёстой) — `OrderEventsPublisher`-ийн sync аргуудаас ЯЛГААТАЙ.
@Injectable()
export class NotificationTrigger {
  private readonly logger = new Logger(NotificationTrigger.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}

  async notifyOrderStatusChanged(payload: {
    orderId: string;
    customerId: string;
    newStatus: OrderStatus;
  }): Promise<void> {
    const message = buildOrderStatusMessage(payload.newStatus, payload.orderId);
    if (!message) {
      return;
    }
    await this.scheduleDispatch(payload.customerId, message);
  }

  async notifyReturnStatusChanged(payload: {
    returnRequestId: string;
    customerId: string;
    status: ReturnStatus;
  }): Promise<void> {
    const message = buildReturnStatusMessage(
      payload.status,
      payload.returnRequestId,
    );
    if (!message) {
      return;
    }
    await this.scheduleDispatch(payload.customerId, message);
  }

  private async scheduleDispatch(
    customerId: string,
    message: NotificationMessage,
  ): Promise<void> {
    // ⚠️ User.email нь зөвхөн ажилтан/Keycloak хэрэглэгчид зориулагдсан
    // (auth-customer/dto/register.dto.ts зөвхөн phone цуглуулдаг) — CUSTOMER
    // мөрийн email бараг үргэлж NULL, тиймээс энэ урсгалын email тал
    // практикт ихэвчлэн алгасагдана (санаатай, доорх dispatch()-ийн
    // нөхцөлт шалгалт үүнийг зөв барина, алдаа биш).
    const customer = await this.prisma.tx.user.findUnique({
      where: { id: customerId },
      select: { phone: true, email: true },
    });
    if (!customer) {
      return;
    }

    this.requestContext.onCommit(() => {
      void this.dispatch(customer, message);
    });
  }

  private async dispatch(
    customer: NotifiableCustomer,
    message: NotificationMessage,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];

    if (customer.phone) {
      tasks.push(
        this.provider
          .sendSms(customer.phone, message.smsBody)
          .catch((err: unknown) => {
            this.logger.warn(`SMS илгээхэд алдаа гарлаа: ${String(err)}`);
          }),
      );
    }
    if (customer.email) {
      tasks.push(
        this.provider
          .sendEmail(customer.email, message.subject, message.emailBody)
          .catch((err: unknown) => {
            this.logger.warn(`Email илгээхэд алдаа гарлаа: ${String(err)}`);
          }),
      );
    }

    // afterCommitCallbacks массив reject-ийг барьдаггүй тул (request-context.ts)
    // дээрх .catch()-ууд ЗААВАЛ шаардлагатай — Promise.allSettled нь
    // нэмэлт хамгаалалт төдий (аль хэдийн бүгд .catch()-той).
    await Promise.allSettled(tasks);
  }
}
