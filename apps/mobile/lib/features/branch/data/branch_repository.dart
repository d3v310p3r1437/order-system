import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/branch.dart';

/// `apps/api/src/branch/branch.controller.ts`-руу хандах цэг — @Roles()-гүй
/// (зөвхөн нэвтэрсэн байхыг шаарддаг) эндпойнт тул CUSTOMER шууд дуудаж болно.
class BranchRepository {
  BranchRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<Branch>> getBranches() async {
    try {
      final response = await _apiClient.dio.get<List<dynamic>>('/branches');
      return response.data!
          .cast<Map<String, dynamic>>()
          .map(Branch.fromJson)
          .toList();
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
