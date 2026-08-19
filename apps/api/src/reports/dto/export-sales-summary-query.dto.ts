import { IsIn } from 'class-validator';
import { ReportDateRangeQueryDto } from './report-date-range-query.dto.js';

// §Даалгавар #5: "format=csv (эсвэл xlsx...чи сонго аль хялбарыг эхлээд
// хэрэгжүүлэхээ)" — CSV-г сонгов (нэмэлт dependency (жиш: exceljs)
// шаардахгүй, report-csv.util.ts-ийн бичсэн serializer хангалттай).
const EXPORT_FORMATS = ['csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export class ExportSalesSummaryQueryDto extends ReportDateRangeQueryDto {
  @IsIn(EXPORT_FORMATS)
  format!: ExportFormat;
}
