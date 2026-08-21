import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/return_request_record.dart';

/// `apps/api/src/returns/return-request.controller.ts`-руу хандах цэг —
/// `checkout_repository.dart`-тай ижил загвар.
class ReturnRepository {
  ReturnRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  /// RLS (`return_requests_select`) CUSTOMER-д зөвхөн ӨӨРИЙН хүсэлтийг
  /// буцаадаг тул filter параметргүй ч аюулгүй — дуудагч тал (жиш:
  /// `orderReturnsProvider`) тодорхой orderId-аар клиент талд шүүнэ
  /// (backend-ийн `GET /returns` orderId-аар шүүх параметр дэмждэггүй).
  Future<List<ReturnRequestRecord>> getReturns() async {
    try {
      final response = await _apiClient.dio.get<List<dynamic>>('/returns');
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(ReturnRequestRecord.fromJson)
          .toList();
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<ReturnRequestRecord> create({
    required String orderItemId,
    required String reason,
  }) async {
    try {
      final response = await _apiClient.dio.post<Map<String, dynamic>>(
        '/returns',
        data: {'orderItemId': orderItemId, 'reason': reason},
      );
      return ReturnRequestRecord.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
