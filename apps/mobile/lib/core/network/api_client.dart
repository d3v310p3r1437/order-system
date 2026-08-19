import 'package:dio/dio.dart';

import '../storage/secure_token_storage.dart';
import 'api_base_url.dart';
import 'api_exception.dart';

/// `/auth/customer/*`-ийн request-үүдэд Authorization header хэрэггүй бөгөөд
/// эдгээрийн 401 хариу (жиш: буруу нууц үг) "нэвтрэлт дуусгавар болсон"
/// гэсэн утгагүй тул `onUnauthorized` callback-ийг ЗОРИУДАА дуудахгүй.
const _authEndpointPaths = ['/auth/customer/login', '/auth/customer/register'];

/// Backend руу хийх бүх HTTP хүсэлтийн нэгдсэн цэг — token автоматаар
/// хавсаргаж, 401 үед `onUnauthorized`-оор гарах (logout) урсгал руу
/// чиглүүлнэ.
class ApiClient {
  /// `dio`-г ЗОРИУДАА inject хийх боломжтой болгосон (унит тестэд
  /// `MockDio`-оор орлуулах, бодит сүлжээ огт хөндөхгүйн тулд) — өгөгдөөгүй
  /// бол backend рүү бодитоор хандах Dio instance өөрөө үүсгэнэ.
  ApiClient({
    required SecureTokenStorage tokenStorage,
    void Function()? onUnauthorized,
    Dio? dioOverride,
  }) : _tokenStorage = tokenStorage,
       _onUnauthorized = onUnauthorized,
       // ignore: prefer_initializing_formals — `dio` талбарыг optional
       // override-той нэгтгэж тооцоолох тул initializing formal ашиглах
       // боломжгүй.
       dio =
           dioOverride ??
           Dio(
             BaseOptions(
               baseUrl: resolveApiBaseUrl(),
               connectTimeout: const Duration(seconds: 10),
               receiveTimeout: const Duration(seconds: 10),
             ),
           ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.readAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isAuthEndpoint = _authEndpointPaths.any(
            (path) => error.requestOptions.path.startsWith(path),
          );
          if (error.response?.statusCode == 401 && !isAuthEndpoint) {
            await _tokenStorage.clear();
            _onUnauthorized?.call();
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio dio;
  final SecureTokenStorage _tokenStorage;
  final void Function()? _onUnauthorized;

  /// dio-ийн `DioException`-ыг backend-ийн `{ error: {...} }` бүтэцтэй
  /// `ApiException` болгож хөрвүүлнэ — дуудагч тал (repository) бүрд
  /// try/catch давхардуулахгүйн тулд.
  Never throwAsApiException(DioException error) {
    if (error.response != null) {
      throw ApiException.fromResponseData(
        error.response!.data,
        statusCode: error.response!.statusCode,
      );
    }
    throw const ApiException(
      code: 'NETWORK_ERROR',
      message: 'Сүлжээний холболт амжилтгүй боллоо',
    );
  }
}
