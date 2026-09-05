import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

// categoryId/branchId-г UUID байхыг заавал шалгана — MeilisearchService.
// search() дотор filter мөрөнд шууд interpolate хийдэг тул (Meilisearch
// filter syntax) хэрэглэгчийн оролтоос ирсэн санамсаргүй тэмдэгт
// (ялангуяа `"`) орохоос энэ DTO validation-оор сэргийлнэ. color/size нь
// UUID биш чөлөөт текст (ProductVariant.color/size-ийн бодит утгуудаас
// сонгогддог) тул `"` тэмдэгтийг ЗААВАЛ хориглох `@Matches`-аар ижил
// зорилгыг хангана.
export class SearchProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[^"]*$/)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[^"]*$/)
  size?: string;
}
