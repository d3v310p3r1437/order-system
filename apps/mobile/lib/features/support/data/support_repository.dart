import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/support_message.dart';
import '../domain/support_ticket.dart';

/// `apps/api/src/support/support-ticket.controller.ts`-руу хандах цэг —
/// `return_repository.dart`-тай ижил загвар.
class SupportRepository {
  SupportRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  /// RLS (`support_tickets_select`) CUSTOMER-д зөвхөн ӨӨРИЙН тасалбарыг
  /// буцаадаг тул filter параметргүй.
  Future<List<SupportTicket>> getTickets() async {
    try {
      final response = await _apiClient.dio.get<List<dynamic>>(
        '/support-tickets',
      );
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(SupportTicket.fromJson)
          .toList();
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<SupportTicket> getTicket(String id) async {
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/support-tickets/$id',
      );
      return SupportTicket.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<SupportTicket> createTicket({
    required String subject,
    required String category,
    String? orderId,
  }) async {
    final data = <String, dynamic>{'subject': subject, 'category': category};
    if (orderId != null) {
      data['orderId'] = orderId;
    }
    try {
      final response = await _apiClient.dio.post<Map<String, dynamic>>(
        '/support-tickets',
        data: data,
      );
      return SupportTicket.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<SupportMessage> addMessage(String ticketId, String body) async {
    try {
      final response = await _apiClient.dio.post<Map<String, dynamic>>(
        '/support-tickets/$ticketId/messages',
        data: {'body': body},
      );
      return SupportMessage.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
