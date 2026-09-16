import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// multipart/form-data-ийн текст талбар (лого файл өөрөө @UploadedFile()-ээр
// тусад нь ирнэ, upload-product-image.dto.ts-тэй ижил зарчим). storeName/
// файл хоёулаа сонголтот — service талд "хоосон бол ямар ч зүйл
// шинэчлэгдээгүй" гэдгийг NOTHING_TO_UPDATE-ээр шалгана.
export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  storeName?: string;
}
