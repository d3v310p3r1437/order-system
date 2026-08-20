import { IsUUID } from 'class-validator';

export class ValidateBranchDto {
  @IsUUID()
  branchId!: string;
}
