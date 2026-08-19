import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// Тайлангийн бүх endpoint-д нийтлэг: [from, to] хугацааны хүрээ (to
// өдрийн эцэс хүртэл багтаана — report.service.ts-ийн endOfRange()-г үз)
// + сонголтоор branchId (өгөөгүй бол RLS-ээр харагдах бүх салбараар
// аггрегатлана). branchId-г тухайн хэрэглэгч хандах эрхгүй бол RLS
// (orders_select гэх мэт) 0 мөр буцаана — энд нэмэлт эрхийн шалгалт
// шаардлагагүй (CLAUDE.md: "RLS автоматаар хамгаална").
export class ReportDateRangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
