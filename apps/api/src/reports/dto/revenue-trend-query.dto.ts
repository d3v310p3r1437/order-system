import { IsIn, IsOptional } from 'class-validator';
import { ReportDateRangeQueryDto } from './report-date-range-query.dto.js';

// Одоогоор зөвхөн "day" (§Даалгавар #3: "өдөр тутмын... цуваа") —
// 7/30 хоногийн цонх нь granularity биш, from/to-ийн хүрээгээр л
// тохируулагдана (жиш: сүүлийн 7 хоногийг харахыг хүсвэл from=7 хоногийн
// өмнөх огноо илгээнэ). Параметрийг ирээдүйд "week"/"month" нэмэгдэх
// боломжтой байлгахын тулд л (backward-compatible) заавал биш болгов.
const GRANULARITIES = ['day'] as const;
export type ReportGranularity = (typeof GRANULARITIES)[number];

export class RevenueTrendQueryDto extends ReportDateRangeQueryDto {
  @IsOptional()
  @IsIn(GRANULARITIES)
  granularity?: ReportGranularity;
}
