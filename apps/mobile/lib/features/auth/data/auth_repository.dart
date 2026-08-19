import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_token_storage.dart';

/// `apps/api/src/auth-customer` (`POST /auth/customer/register`,
/// `/login`) руу хандах цэг. Хариу нь `{ accessToken, refreshToken }`
/// (`CustomerTokenPair`) — амжилттай бол шууд secure storage-д бичнэ.
class AuthRepository {
  AuthRepository({
    required ApiClient apiClient,
    required SecureTokenStorage tokenStorage,
  }) : _apiClient = apiClient,
       _tokenStorage = tokenStorage;

  final ApiClient _apiClient;
  final SecureTokenStorage _tokenStorage;

  Future<void> register({required String phone, required String password}) =>
      _authenticate('/auth/customer/register', phone: phone, password: password);

  Future<void> login({required String phone, required String password}) =>
      _authenticate('/auth/customer/login', phone: phone, password: password);

  Future<void> _authenticate(
    String path, {
    required String phone,
    required String password,
  }) async {
    try {
      final response = await _apiClient.dio.post<Map<String, dynamic>>(
        path,
        data: {'phone': phone, 'password': password},
      );
      final data = response.data!;
      await _tokenStorage.saveTokens(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
        phone: phone,
      );
    } on DioException catch (error) {
      _apiClient.throwAsApiException(error);
    }
  }

  Future<void> logout() => _tokenStorage.clear();

  /// Апп эхлэхэд хадгалагдсан session байгаа эсэхийг шалгана.
  Future<String?> restoreSessionPhone() async {
    final accessToken = await _tokenStorage.readAccessToken();
    if (accessToken == null) {
      return null;
    }
    return _tokenStorage.readPhone();
  }
}
