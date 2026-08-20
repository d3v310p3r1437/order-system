import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../cart/domain/cart_branch_validation.dart';
import '../../cart/presentation/cart_providers.dart';
import '../data/branch_repository.dart';
import '../domain/branch.dart';

final branchRepositoryProvider = Provider<BranchRepository>((ref) {
  return BranchRepository(apiClient: ref.watch(apiClientProvider));
});

final branchesProvider = FutureProvider<List<Branch>>((ref) {
  return ref.watch(branchRepositoryProvider).getBranches();
});

/// Сонгосон салбарт одоогийн сагсны бэлэн байдал шалгах — branchId бүрд
/// тусдаа (autoDispose, дэлгэц хаагдмагц эсвэл өөр салбар сонгомогц хуучин
/// кэш цэвэрлэгдэнэ).
final cartBranchValidationProvider = FutureProvider.autoDispose
    .family<CartBranchValidation, String>((ref, branchId) {
      return ref.watch(cartRepositoryProvider).validateBranch(branchId);
    });
