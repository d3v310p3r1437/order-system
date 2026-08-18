import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

// multipart/form-data-ийн текст талбарууд (файл өөрөө @UploadedFile()-ээр
// тусад нь ирнэ) — бүгд string-ээр ирдэг тул displayOrder-д @Type(() =>
// Number) заавал хэрэгтэй.
export class UploadProductImageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;
}
