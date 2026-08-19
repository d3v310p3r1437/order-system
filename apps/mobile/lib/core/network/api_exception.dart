/// Backend-ийн нэгдсэн алдааны бүтэц (CLAUDE.md: `{ "error": { "code",
/// "message", "details" } }`) — `apps/api/src/common/http-exception.filter.ts`.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.details,
    this.statusCode,
  });

  factory ApiException.fromResponseData(Object? data, {int? statusCode}) {
    if (data is Map && data['error'] is Map) {
      final error = (data['error'] as Map).cast<String, dynamic>();
      return ApiException(
        code: (error['code'] as String?) ?? 'UNKNOWN_ERROR',
        message: (error['message'] as String?) ?? 'Тодорхойгүй алдаа гарлаа',
        details: error['details'],
        statusCode: statusCode,
      );
    }
    return ApiException(
      code: 'NETWORK_ERROR',
      message: 'Сервертэй холбогдоход алдаа гарлаа',
      statusCode: statusCode,
    );
  }

  final String code;
  final String message;
  final Object? details;
  final int? statusCode;

  @override
  String toString() => 'ApiException($code): $message';
}
