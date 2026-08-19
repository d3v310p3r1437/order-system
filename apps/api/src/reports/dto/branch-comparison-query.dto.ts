import { IsDateString } from 'class-validator';

// branchId параметргүй (§Даалгавар #4: БҮХ салбарыг харьцуулна) —
// ReportController-ийн BRANCH_COMPARISON_ROLES (зөвхөн global scope)-оор
// хязгаарлагдана.
export class BranchComparisonQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
