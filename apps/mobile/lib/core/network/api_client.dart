import 'package:dio/dio.dart';

import '../storage/secure_token_storage.dart';
import 'api_base_url.dart';
import 'api_exception.dart';

/// `/auth/customer/*`-ийн request-үүдэд Authorization header хэрэггүй бөгөөд
/// эдгээрийн 401 хариу (жиш: буруу нууц үг) "нэвтрэлт дуусгавар болсон"
/// гэсэн утгагүй тул автомат refresh/logout урсгал ЗОРИУДАА дуудагдахгүй.
const _authEndpointPaths = ['/auth/customer/login', '/auth/customer/register'];

/// Backend руу хийх бүх HTTP хүсэлтийн нэгдсэн цэг — token автоматаар
/// хавсаргаж, access token хугацаа дуусаж 401 ирвэл `POST /auth/customer/
/// refresh`-ээр АВТОМАТААР шинэ token авч анхны хүсэлтийг дахин илгээнэ.
/// Refresh ч амжилтгүй болсон тохиолдолд л `onUnauthorized`-оор гарах
/// (logout) урсгал руу чиглүүлнэ.
class ApiClient {
  /// `dio`/`authDio`-г ЗОРИУДАА тус тусад нь inject хийх боломжтой болгосон
  /// (унит тестэд `MockDio`/fake adapter-аар орлуулах, бодит сүлжээ огт
  /// хөндөхгүйн тулд) — өгөгдөөгүй бол backend рүү бодитоор хандах Dio
  /// instance-уудыг өөрөө үүсгэнэ.
  ApiClient({
    required SecureTokenStorage tokenStorage,
    void Function()? onUnauthorized,
    Dio? dioOverride,
    Dio? authDioOverride,
  }) : _tokenStorage = tokenStorage,
       _onUnauthorized = onUnauthorized,
       // ignore: prefer_initializing_formals — `dio` талбарыг optional
       // override-той нэгтгэж тооцоолох тул initializing formal ашиглах
       // боломжгүй.
       dio = dioOverride ?? _buildDio(),
       _authDio = authDioOverride ?? _buildDio() {
    dio.interceptors.add(
      // QueuedInterceptor: зэрэгцээ хэд хэдэн хүсэлт ижил мөчид 401 авбал
      // тэдгээрийн onError callback-ууд дараалан (нэг нэгээрээ, ХАМТДАА
      // БИШ) ажиллана — 2 дахь/3 дахь callback эхлэхэд 1-р callback-ийн
      // refresh АЛЬ ХЭДИЙН дуусчихсан байдаг тул "in-flight Future кэш"
      // энд юу ч дедупликат хийхгүй (доорх `_ensureFreshAccessToken`-ийн
      // токен-харьцуулах аргыг үз — цорын ганц найдвартай арга нь storage
      // дахь ОДООГИЙН token нь МИНИЙ хүсэлтийг унагаасан хуучин token-той
      // адил эсэхийг шалгах явдал). Энэ нь backend талын
      // `WebhookGuardService`-ийн "зэрэгцээ дуудлагаас сэргийлэх" зарчимтай
      // ижил зорилготой (docs/adr/006-ийн 2026-08-17 нэмэлт), гэхдээ АРГА
      // (Redis lock биш, storage дахь "хамгийн сүүлийн амжилттай token"-той
      // харьцуулах) өөр.
      QueuedInterceptorsWrapper(
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
          if (error.response?.statusCode != 401 || isAuthEndpoint) {
            handler.next(error);
            return;
          }

          try {
            final staleAuthHeader =
                error.requestOptions.headers['Authorization'] as String?;
            final newAccessToken = await _ensureFreshAccessToken(
              staleAuthHeader: staleAuthHeader,
            );
            // ⚠️ ЧУХАЛ: retry хүсэлтийг `dio.fetch()` (interceptor бүхий,
            // QueuedInterceptor-той ЭНЭ ижил `dio`) БИШ, харин
            // interceptor-гүй `_authDio.fetch()`-ээр явуулна. `dio.fetch()`
            // ашигласан бол — хэрэв retry ДАХИН 401 авбал түүний алдааг мөн
            // ЯГ ЭНЭ QueuedInterceptor-ийн error queue-гээр дамжуулах
            // шаардлагатай болно, гэвч тэр queue яг одоо ЭНЭ (хараахан
            // handler.next/resolve дуудаагүй, идэвхтэй) onError task-аар
            // "эзэлэгдсэн" хэвээр байгаа тул — мөнхийн deadlock (энэ
            // task chain-ийн `await` хэзээ ч биелэхгүй) үүснэ.
            final retryOptions = error.requestOptions
              ..headers['Authorization'] = 'Bearer $newAccessToken';
            final response = await _authDio.fetch<dynamic>(retryOptions);
            handler.resolve(response);
          } catch (_) {
            // Refresh өөрөө амжилтгүй (хугацаа дууссан/цуцлагдсан refresh
            // token) эсвэл шинэ token-оор ч дахин 401 ирсэн бол л эцсийн
            // байдлаар logout урсгал руу шилжинэ.
            await _tokenStorage.clear();
            _onUnauthorized?.call();
            handler.next(error);
          }
        },
      ),
    );
  }

  static Dio _buildDio() => Dio(
    BaseOptions(
      baseUrl: resolveApiBaseUrl(),
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ),
  );

  final Dio dio;

  /// Refresh дуудлага БОЛОН refresh-ийн дараах retry хүсэлтэд ашигладаг,
  /// `dio`-гийн QueuedInterceptor-ыг ЗОРИУДАА тойрсон тусдаа клиент (дээрх
  /// `onError`-ийн тайлбарыг үз — deadlock-оос сэргийлнэ).
  final Dio _authDio;

  final SecureTokenStorage _tokenStorage;
  final void Function()? _onUnauthorized;

  /// `staleAuthHeader`-тай (МИНИЙ хүсэлтийг унагаасан хуучин header)
  /// ТААРЧ байгаа үед л жинхэнэ `/auth/customer/refresh` дуудна. Учир нь
  /// QueuedInterceptor-ийн `onError` callback-ууд дараалан ажилладаг тул
  /// 2 дахь/3 дахь callback эхлэхэд storage дахь access token аль хэдийн
  /// (1-р callback-ийн refresh-ээр) шинэчлэгдсэн байж болно — тэгвэл шинэ
  /// token нь МИНИЙ (хуучин) header-тэй ялгаатай тул дахин refresh
  /// дуудахгүйгээр шууд шинэ token-ыг дахин ашиглана.
  Future<String> _ensureFreshAccessToken({
    required String? staleAuthHeader,
  }) async {
    final currentAccessToken = await _tokenStorage.readAccessToken();
    final currentAuthHeader = currentAccessToken != null
        ? 'Bearer $currentAccessToken'
        : null;
    if (currentAuthHeader != null && currentAuthHeader != staleAuthHeader) {
      return currentAccessToken!;
    }
    return _performRefresh();
  }

  Future<String> _performRefresh() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null) {
      throw const ApiException(
        code: 'NO_REFRESH_TOKEN',
        message: 'Дахин нэвтрэх шаардлагатай',
      );
    }
    final response = await _authDio.post<Map<String, dynamic>>(
      '/auth/customer/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = response.data!;
    final newAccessToken = data['accessToken'] as String;
    final newRefreshToken = data['refreshToken'] as String;
    await _tokenStorage.updateTokens(
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    );
    return newAccessToken;
  }

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
