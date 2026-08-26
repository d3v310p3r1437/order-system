import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/review.dart';

/// `apps/api/src/reviews`-руу хандах цэг (`return_repository.dart`-тай
/// ижил загвар) — §7 модуль #11.
class ReviewRepository {
  ReviewRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<ProductReviews> getForProduct(String productId) async {
    try {
      final response = await _apiClient.dio.get<Map<String, dynamic>>(
        '/products/$productId/reviews',
      );
      return ProductReviews.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<Review> create({
    required String productId,
    required int rating,
    String? comment,
  }) async {
    try {
      final response = await _apiClient.dio.post<Map<String, dynamic>>(
        '/products/$productId/reviews',
        data: {
          'rating': rating,
          if (comment != null && comment.isNotEmpty) 'comment': comment,
        },
      );
      return Review.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<Review> update({
    required String reviewId,
    required int rating,
    String? comment,
  }) async {
    try {
      final response = await _apiClient.dio.patch<Map<String, dynamic>>(
        '/reviews/$reviewId',
        data: {
          'rating': rating,
          if (comment != null && comment.isNotEmpty) 'comment': comment,
        },
      );
      return Review.fromJson(response.data!);
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }
}
