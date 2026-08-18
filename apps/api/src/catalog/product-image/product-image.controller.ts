import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Audit } from '../../common/audit.decorator.js';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { UploadProductImageDto } from './dto/upload-product-image.dto.js';
import { ProductImageService } from './product-image.service.js';

// products_insert/products_delete RLS policy-той ЯГ ижил дүрүүд (§8 Phase 2
// Хэсэг A: зураг нь Product-ийн бүтцийн хэсэг, BRANCH_MANAGER-д UPDATE
// эрх (§6.1) байдаг ч зураг дээр "update" endpoint байхгүй тул ороогүй).
const IMAGE_WRITE_ROLES = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

@Controller('products/:productId/images')
@UseGuards(RolesGuard)
export class ProductImageController {
  constructor(private readonly productImageService: ProductImageService) {}

  @Post()
  @Roles(...IMAGE_WRITE_ROLES)
  @Audit('product_images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  upload(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadProductImageDto,
  ) {
    return this.productImageService.upload(productId, file, dto);
  }

  // Route param-ыг ЗОРИУДАА "id" гэж нэрлэсэн (imageId биш) —
  // AuditInterceptor.captureBeforeData()/extractIdField() анхдагчаар
  // req.params.id-г хайдаг тул энэ нэршлээр "before" snapshot (устгагдахаас
  // өмнөх зургийн мөр) автоматаар зөв бичигдэнэ, custom recordId()
  // шаардлагагүй.
  @Delete(':id')
  @Roles(...IMAGE_WRITE_ROLES)
  @Audit('product_images')
  remove(@Param('productId') productId: string, @Param('id') id: string) {
    return this.productImageService.remove(productId, id);
  }
}
