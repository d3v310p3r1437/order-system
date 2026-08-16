import { IsString, MinLength } from 'class-validator';

// docs/adr/006-qpay-verify-dont-trust.md: QPay-ийн бодит webhook payload-ийн
// талбарын нэрийг (`payment_id`) credential ирээгүй тул эх сурвалжаас
// (developer.qpay.mn) л баталгаажуулсан — бодит sandbox дээр давхар
// шалгах ёстой зүйлсийн жагсаалт ADR 006-д бий. MockPaymentProvider ч
// ижил талбарын нэрээр л (providerInvoiceId-гээ) явуулна.
export class PaymentWebhookDto {
  @IsString()
  @MinLength(1)
  payment_id!: string;
}
