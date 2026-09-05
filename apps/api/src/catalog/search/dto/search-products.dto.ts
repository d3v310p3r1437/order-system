import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// categoryId/branchId-г UUID байхыг заавал шалгана — MeilisearchService.
// search() дотор filter мөрөнд шууд interpolate хийдэг тул (Meilisearch
// filter syntax) хэрэглэгчийн оролтоос ирсэн санамсаргүй тэмдэгт
// (ялангуяа `"`) орохоос энэ DTO validation-оор сэргийлнэ.
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
}
