import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/return_repository.dart';
import '../domain/return_request_record.dart';

final returnRepositoryProvider = Provider<ReturnRepository>((ref) {
  return ReturnRepository(apiClient: ref.watch(apiClientProvider));
});

/// Тухайн orderId-д хамаарах буцаалтын хүсэлтүүд (клиент талд шүүсэн,
/// `ReturnRepository.getReturns()`-ийн толгой тайлбарыг үз) —
/// OrderTrackingScreen (товч/badge шийдвэр) БОЛОН ReturnRequestScreen
/// (аль item аль хэдийн идэвхтэй буцаалттайг харах) хоёуланд ашиглагдана.
final orderReturnsProvider = FutureProvider.autoDispose
    .family<List<ReturnRequestRecord>, String>((ref, orderId) async {
      final all = await ref.watch(returnRepositoryProvider).getReturns();
      return all.where((r) => r.orderId == orderId).toList();
    });
