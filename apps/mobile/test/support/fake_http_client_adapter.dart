import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// `fetch()`-ийн үед `RequestOptions`-оос авсан ХӨДЛӨШГҮЙ (immutable)
/// хуулбар. `dio` нь retry хийхдээ ШИНЭ `RequestOptions` объект биш, харин
/// `error.requestOptions`-ийг ШУУД mutate хийж дахин ашигладаг (жиш:
/// `ApiClient`-ийн `Authorization` header-ийг шинэ token-оор дарж бичих) —
/// тул хожим `RequestOptions`-ийн ЛИВ reference-ийг шууд хадгалж авбал (энэ
/// файлын анхны хувилбарт байсан алдаа) хожим бүх snapshot ЯГ СҮҮЛИЙН
/// (retry-ийн дараах) утгыг л харуулах болно. Snapshot нь энэ асуудлаас
/// сэргийлж, `fetch()`-ийг дуудсан МӨЧИЙН state-ийг л баримтжуулна.
class RequestSnapshot {
  RequestSnapshot(RequestOptions options)
    : path = options.path,
      method = options.method,
      data = options.data,
      headers = Map<String, dynamic>.from(options.headers);

  final String path;
  final String method;
  final Object? data;
  final Map<String, dynamic> headers;
}

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

  final List<RequestSnapshot> requests = [];

  int countRequestsTo(String path) =>
      requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(RequestSnapshot(options));
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
