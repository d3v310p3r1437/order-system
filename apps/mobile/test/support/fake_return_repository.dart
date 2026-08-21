import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/returns/data/return_repository.dart';
import 'package:mobile/features/returns/domain/return_request_record.dart';

/// `Dio`/HTTP давхарга огт хөндөхгүй fake — `FakeCartRepository`-тэй ижил
/// загвар.
class FakeReturnRepository implements ReturnRepository {
  List<ReturnRequestRecord> returns = [];
  ApiException? getReturnsError;
  ApiException? createError;

  final List<({String orderItemId, String reason})> createCalls = [];

  @override
  Future<List<ReturnRequestRecord>> getReturns() async {
    if (getReturnsError != null) {
      throw getReturnsError!;
    }
    return returns;
  }

  @override
  Future<ReturnRequestRecord> create({
    required String orderItemId,
    required String reason,
  }) async {
    createCalls.add((orderItemId: orderItemId, reason: reason));
    if (createError != null) {
      throw createError!;
    }
    final record = ReturnRequestRecord(
      id: 'return-${createCalls.length}',
      orderItemId: orderItemId,
      orderId: 'order-1',
      status: 'REQUESTED',
      reason: reason,
      requestedAt: DateTime(2026, 8, 21).toIso8601String(),
    );
    returns = [...returns, record];
    return record;
  }
}
