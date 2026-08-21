import 'package:mobile/features/branch/data/branch_repository.dart';
import 'package:mobile/features/branch/domain/branch.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake —
/// `test/support/fake_cart_repository.dart`-ийн загвартай адил.
class FakeBranchRepository implements BranchRepository {
  List<Branch> branches = [];

  @override
  Future<List<Branch>> getBranches() async => branches;
}
