import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/secure_token_storage.dart';

import '../../support/fake_http_client_adapter.dart';
import '../../support/fake_secure_token_storage.dart';

void main() {
  late FakeSecureTokenStorage tokenStorage;
  late int unauthorizedCallCount;

  setUp(() async {
    tokenStorage = FakeSecureTokenStorage();
    unauthorizedCallCount = 0;
    await tokenStorage.saveTokens(
      accessToken: 'old-token',
      refreshToken: 'valid-refresh',
      phone: '+97688112233',
    );
  });

  test('access token хугацаа дуусаж 401 ирвэл автоматаар refresh хийж, анхны хүсэлтийг шинэ token-оор амжилттай давтдаг', () async {
    final adapter = FakeHttpClientAdapter((options) {
      if (options.path == '/auth/customer/refresh') {
        expect(options.data, {'refreshToken': 'valid-refresh'});
        return (
          statusCode: 200,
          body: {
            'accessToken': 'new-token',
            'refreshToken': 'new-refresh-token',
          },
        );
      }
      if (options.path == '/protected') {
        final auth = options.headers['Authorization'];
        if (auth == 'Bearer new-token') {
          return (statusCode: 200, body: {'data': 'ok'});
        }
        return (
          statusCode: 401,
          body: {
            'error': {'code': 'TOKEN_EXPIRED', 'message': 'Хугацаа дууссан'},
          },
        );
      }
      throw StateError('Unexpected path: ${options.path}');
    });

    final client = ApiClient(
      tokenStorage: tokenStorage,
      onUnauthorized: () => unauthorizedCallCount++,
      dioOverride: Dio()..httpClientAdapter = adapter,
      authDioOverride: Dio()..httpClientAdapter = adapter,
    );

    final response = await client.dio.get<Map<String, dynamic>>('/protected');

    expect(response.statusCode, 200);
    expect(response.data, {'data': 'ok'});
    expect(unauthorizedCallCount, 0);
    expect(adapter.countRequestsTo('/auth/customer/refresh'), 1);
    expect(await tokenStorage.readAccessToken(), 'new-token');
    expect(await tokenStorage.readRefreshToken(), 'new-refresh-token');
    // Refresh нь зөвхөн token хосыг сунгадаг тул identity (phone)
    // хэвээрээ үлдэх ёстой.
    expect(await tokenStorage.readPhone(), '+97688112233');
  });

  test('зэрэгцээ хэд хэдэн хүсэлт ижил мөчид 401 авбал refresh endpoint ГАНЦХАН удаа дуудагдана', () async {
    final adapter = FakeHttpClientAdapter((options) {
      if (options.path == '/auth/customer/refresh') {
        return (
          statusCode: 200,
          body: {
            'accessToken': 'new-token',
            'refreshToken': 'new-refresh-token',
          },
        );
      }
      final auth = options.headers['Authorization'];
      if (auth == 'Bearer new-token') {
        return (statusCode: 200, body: {'data': options.path});
      }
      return (
        statusCode: 401,
        body: {
          'error': {'code': 'TOKEN_EXPIRED', 'message': 'Хугацаа дууссан'},
        },
      );
    });

    final client = ApiClient(
      tokenStorage: tokenStorage,
      onUnauthorized: () => unauthorizedCallCount++,
      dioOverride: Dio()..httpClientAdapter = adapter,
      authDioOverride: Dio()..httpClientAdapter = adapter,
    );

    final responses = await Future.wait([
      client.dio.get<Map<String, dynamic>>('/protected-a'),
      client.dio.get<Map<String, dynamic>>('/protected-b'),
      client.dio.get<Map<String, dynamic>>('/protected-c'),
    ]);

    expect(responses.map((r) => r.statusCode), everyElement(200));
    expect(unauthorizedCallCount, 0);
    expect(adapter.countRequestsTo('/auth/customer/refresh'), 1);
  });

  test('refresh token байхгүй бол refresh endpoint огт дуудахгүй, шууд logout болно', () async {
    await tokenStorage.clear();
    await tokenStorage.saveTokens(
      accessToken: 'old-token',
      refreshToken: '',
      phone: '+97688112233',
    );
    // "Байхгүй" гэдгийг `readRefreshToken() == null`-ээр загварчилна.
    final storageWithoutRefresh = _NoRefreshTokenStorage(tokenStorage);

    final adapter = FakeHttpClientAdapter((options) {
      if (options.path == '/auth/customer/refresh') {
        fail('Refresh token байхгүй үед refresh endpoint дуудагдаж болохгүй');
      }
      return (
        statusCode: 401,
        body: {
          'error': {'code': 'TOKEN_EXPIRED', 'message': 'Хугацаа дууссан'},
        },
      );
    });

    final client = ApiClient(
      tokenStorage: storageWithoutRefresh,
      onUnauthorized: () => unauthorizedCallCount++,
      dioOverride: Dio()..httpClientAdapter = adapter,
      authDioOverride: Dio()..httpClientAdapter = adapter,
    );

    await expectLater(
      client.dio.get<Map<String, dynamic>>('/protected'),
      throwsA(isA<DioException>()),
    );

    expect(unauthorizedCallCount, 1);
    expect(adapter.countRequestsTo('/auth/customer/refresh'), 0);
  });

  test('refresh endpoint өөрөө 401 буцаавал (refresh token хүчингүй) token-ыг цэвэрлэж logout callback дуудна', () async {
    final adapter = FakeHttpClientAdapter((options) {
      if (options.path == '/auth/customer/refresh') {
        return (
          statusCode: 401,
          body: {
            'error': {
              'code': 'INVALID_REFRESH_TOKEN',
              'message': 'Дахин нэвтэрнэ үү',
            },
          },
        );
      }
      return (
        statusCode: 401,
        body: {
          'error': {'code': 'TOKEN_EXPIRED', 'message': 'Хугацаа дууссан'},
        },
      );
    });

    final client = ApiClient(
      tokenStorage: tokenStorage,
      onUnauthorized: () => unauthorizedCallCount++,
      dioOverride: Dio()..httpClientAdapter = adapter,
      authDioOverride: Dio()..httpClientAdapter = adapter,
    );

    await expectLater(
      client.dio.get<Map<String, dynamic>>('/protected'),
      throwsA(isA<DioException>()),
    );

    expect(unauthorizedCallCount, 1);
    expect(await tokenStorage.readAccessToken(), isNull);
    expect(await tokenStorage.readRefreshToken(), isNull);
    // Refresh endpoint өөрөө татгалзсаны дараа ЯМАР Ч НӨХЦӨЛД дахин
    // оролдохгүй (retry loop-д орохгүй) гэдгийг тодорхой батлана —
    // `_authDio`-д interceptor огт байхгүй тул архитектурын хувьд давталт
    // үүсэх боломжгүй ч, энэ тестгүйгээр тэр баталгаа далд хэвээр байх байсан.
    expect(adapter.countRequestsTo('/auth/customer/refresh'), 1);
  });

  test('POST хүсэлт 401 авбал ч method, body, header бүгд бүрэн хадгалагдсаар шинэ token-оор дахин илгээгдэнэ', () async {
    final requestedBody = {'orderId': 'order-1', 'quantity': 3};
    final adapter = FakeHttpClientAdapter((options) {
      if (options.path == '/auth/customer/refresh') {
        return (
          statusCode: 200,
          body: {
            'accessToken': 'new-token',
            'refreshToken': 'new-refresh-token',
          },
        );
      }
      final auth = options.headers['Authorization'];
      if (auth == 'Bearer new-token') {
        return (statusCode: 200, body: {'ok': true});
      }
      return (
        statusCode: 401,
        body: {
          'error': {'code': 'TOKEN_EXPIRED', 'message': 'Хугацаа дууссан'},
        },
      );
    });

    final client = ApiClient(
      tokenStorage: tokenStorage,
      onUnauthorized: () => unauthorizedCallCount++,
      dioOverride: Dio()..httpClientAdapter = adapter,
      authDioOverride: Dio()..httpClientAdapter = adapter,
    );

    final response = await client.dio.post<Map<String, dynamic>>(
      '/orders',
      data: requestedBody,
      options: Options(headers: {'X-Custom-Header': 'custom-value'}),
    );

    expect(response.statusCode, 200);
    expect(unauthorizedCallCount, 0);

    final protectedCalls = adapter.requests
        .where((r) => r.path == '/orders')
        .toList();
    expect(protectedCalls, hasLength(2)); // анхны 401 + retry 200

    final initialCall = protectedCalls[0];
    final retryCall = protectedCalls[1];

    // HTTP method хадгалагдсан эсэх.
    expect(initialCall.method, 'POST');
    expect(retryCall.method, 'POST');
    // Body (request data) АЛДАГДААГҮЙ, яг ижил хэвээр дахин илгээгдсэн эсэх.
    expect(retryCall.data, requestedBody);
    // Анхны хүсэлтийн бусад header (Authorization-ээс өөр) ч хадгалагдсан эсэх.
    expect(retryCall.headers['X-Custom-Header'], 'custom-value');
    // Зөвхөн Authorization header нь шинэ token-оор солигдсон эсэх.
    expect(initialCall.headers['Authorization'], 'Bearer old-token');
    expect(retryCall.headers['Authorization'], 'Bearer new-token');
  });

  test('refresh амжилттай ч дахин 401 ирвэл (deadlock-гүйгээр) эцэст нь logout болно', () async {
    final adapter = FakeHttpClientAdapter((options) {
      if (options.path == '/auth/customer/refresh') {
        return (
          statusCode: 200,
          body: {
            'accessToken': 'new-token',
            'refreshToken': 'new-refresh-token',
          },
        );
      }
      // '/protected' ямар ч token-оор ч 401 буцаадаг (сервэр талын өөр
      // шалтгаанаар — жиш: хэрэглэгч блоклогдсон) гэж загварчилна.
      return (
        statusCode: 401,
        body: {
          'error': {'code': 'FORBIDDEN', 'message': 'Хандах эрхгүй'},
        },
      );
    });

    final client = ApiClient(
      tokenStorage: tokenStorage,
      onUnauthorized: () => unauthorizedCallCount++,
      dioOverride: Dio()..httpClientAdapter = adapter,
      authDioOverride: Dio()..httpClientAdapter = adapter,
    );

    await expectLater(
      client.dio.get<Map<String, dynamic>>('/protected'),
      throwsA(isA<DioException>()),
    );

    expect(unauthorizedCallCount, 1);
    expect(adapter.countRequestsTo('/auth/customer/refresh'), 1);
    expect(adapter.countRequestsTo('/protected'), 2); // анхны + 1 retry
  });
}

/// `readRefreshToken()`-ийг ЗОРИУДАА `null` буцаадаг wrapper — "refresh
/// token хадгалагдаагүй" (жиш: хэрэглэгч ямар нэг шалтгаанаар зөвхөн access
/// token-той, эсвэл margin-error state) тохиолдлыг загварчлахын тулд.
class _NoRefreshTokenStorage implements SecureTokenStorage {
  _NoRefreshTokenStorage(this._delegate);

  final FakeSecureTokenStorage _delegate;

  @override
  Future<String?> readRefreshToken() async => null;

  @override
  Future<String?> readAccessToken() => _delegate.readAccessToken();

  @override
  Future<String?> readPhone() => _delegate.readPhone();

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required String phone,
  }) => _delegate.saveTokens(
    accessToken: accessToken,
    refreshToken: refreshToken,
    phone: phone,
  );

  @override
  Future<void> updateTokens({
    required String accessToken,
    required String refreshToken,
  }) => _delegate.updateTokens(
    accessToken: accessToken,
    refreshToken: refreshToken,
  );

  @override
  Future<void> clear() => _delegate.clear();
}
