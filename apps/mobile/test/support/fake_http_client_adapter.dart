import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// `dio.HttpClientAdapter`-ийн fake хэрэгжилт — бодит сүлжээ огт хөндөхгүйгээр
/// REAL `Dio`/interceptor pipeline-ыг (жиш: `ApiClient`-ийн refresh/retry
/// логик) төгс шалгах боломж олгодог. `MockDio` (mocktail) ашиглавал
/// interceptor-ууд ер нь ажиллахгүй (бүх метод mock хийгддэг тул) —
/// interceptor-ийн БОДИТ ажиллагааг шалгахын тулд ЗААВАЛ энэ түвшинд
/// (adapter) орлуулах шаардлагатай.
class FakeHttpClientAdapter implements HttpClientAdapter {
  FakeHttpClientAdapter(this._responder);

  final ({int statusCode, Map<String, dynamic> body}) Function(
    RequestOptions options,
  )
  _responder;

  final List<RequestOptions> requests = [];

  int countRequestsTo(String path) =>
      requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final result = _responder(options);
    return ResponseBody.fromString(
      jsonEncode(result.body),
      result.statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
