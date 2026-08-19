import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../app/providers.dart';
import '../data/auth_repository.dart';
import '../domain/auth_state.dart';

part 'auth_provider.g.dart';

@riverpod
AuthRepository authRepository(Ref ref) {
  return AuthRepository(
    apiClient: ref.watch(apiClientProvider),
    tokenStorage: ref.watch(secureTokenStorageProvider),
  );
}

@riverpod
class AuthNotifier extends _$AuthNotifier {
  @override
  Future<AuthState> build() async {
    final phone = await ref.watch(authRepositoryProvider).restoreSessionPhone();
    return phone == null
        ? const AuthState.unauthenticated()
        : AuthState.authenticated(phone: phone);
  }

  Future<void> login({required String phone, required String password}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref
          .read(authRepositoryProvider)
          .login(phone: phone, password: password);
      return AuthState.authenticated(phone: phone);
    });
  }

  Future<void> register({
    required String phone,
    required String password,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref
          .read(authRepositoryProvider)
          .register(phone: phone, password: password);
      return AuthState.authenticated(phone: phone);
    });
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthState.unauthenticated());
  }
}
