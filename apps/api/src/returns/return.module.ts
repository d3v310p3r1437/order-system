import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { NotificationModule } from '../notification/notification.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ReturnRequestController } from './return-request.controller.js';
import { ReturnRequestService } from './return-request.service.js';

// docs/plan.md §7 модуль #9 (Буцаалт ба нөхөн төлбөр), §8 Phase 3c.
// PaymentModule (PAYMENT_PROVIDER — refundPayment), RealtimeModule
// (return.status_changed event), SettingsModule (RETURN_FEE_PERCENT)
// OrderModule-той ижил зарчмаар дахин ашиглав. Phase 4: NotificationModule
// (зөвшөөрөх/татгалзах бүрт SMS/email мэдэгдэл).
@Module({
  imports: [PaymentModule, RealtimeModule, SettingsModule, NotificationModule],
  controllers: [ReturnRequestController],
  providers: [ReturnRequestService, RolesGuard],
})
export class ReturnModule {}
