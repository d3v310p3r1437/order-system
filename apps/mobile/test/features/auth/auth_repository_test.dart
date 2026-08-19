import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/fake_secure_token_storage.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio mockDio;
  late ApiClient apiClient;
  late FakeSecureTokenStorage tokenStorage;
  late AuthRepository repository;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: '/'));
  });

  setUp(() {
    mockDio = MockDio();
    // ApiClient-ийн constructor `dio.interceptors.add(...)`-г дуудна тул
    // stub хийхгүй бол Mock-ийн анхдагч `null` буцаалт дээр NoSuchMethodError гарна.
    when(() => mockDio.interceptors).thenReturn(Interceptors());
    tokenStorage = FakeSecureTokenStorage();
    apiClient = ApiClient(tokenStorage: tokenStorage, dioOverride: mockDio);
    repository = AuthRepository(
      apiClient: apiClient,
      tokenStorage: tokenStorage,
    );
  });

  test('login амжилттай бол token хосыг secure storage-д хадгална', () async {
    when(
      () => mockDio.post<Map<String, dynamic>>(
        '/auth/customer/login',
        data: any(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/auth/customer/login'),
        statusCode: 200,
        data: {'accessToken': 'access-123', 'refreshToken': 'refresh-456'},
      ),
    );

    await repository.login(phone: '+97688112233', password: 'password123');

    expect(await tokenStorage.readAccessToken(), 'access-123');
    expect(await tokenStorage.readRefreshToken(), 'refresh-456');
    expect(await tokenStorage.readPhone(), '+97688112233');
  });

  test('login амжилтгүй (401) бол backend-ийн { error: {...} } бүтцийг ApiException болгож шиднэ', () async {
    when(
      () => mockDio.post<Map<String, dynamic>>(
        '/auth/customer/login',
        data: any(named: 'data'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/auth/customer/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/auth/customer/login'),
          statusCode: 401,
          data: {
            'error': {
              'code': 'INVALID_CREDENTIALS',
              'message': 'Утасны дугаар эсвэл нууц үг буруу байна',
              'details': null,
            },
          },
        ),
      ),
    );

    await expectLater(
      repository.login(phone: '+97688112233', password: 'wrong-password'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'INVALID_CREDENTIALS',
        ),
      ),
    );
    expect(await tokenStorage.readAccessToken(), isNull);
  });

  test('restoreSessionPhone — token байхгүй бол null буцаана', () async {
    expect(await repository.restoreSessionPhone(), isNull);
  });

  test(
    'restoreSessionPhone — token байвал хадгалсан утасны дугаарыг буцаана',
    () async {
      await tokenStorage.saveTokens(
        accessToken: 'a',
        refreshToken: 'r',
        phone: '+97699112233',
      );
      expect(await repository.restoreSessionPhone(), '+97699112233');
    },
  );
}
