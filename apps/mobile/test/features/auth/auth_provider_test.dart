import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_exception.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_state.dart';
import 'package:mobile/features/auth/presentation/auth_provider.dart';

class _FakeAuthRepository implements AuthRepository {
  String? sessionPhone;
  bool shouldFailLogin = false;
  bool shouldFailRegister = false;
  bool loginCalled = false;
  bool registerCalled = false;
  bool logoutCalled = false;

  @override
  Future<void> login({required String phone, required String password}) async {
    loginCalled = true;
    if (shouldFailLogin) {
      throw const ApiException(code: 'INVALID_CREDENTIALS', message: 'Буруу нэвтрэлт');
    }
  }

  @override
  Future<void> register({required String phone, required String password}) async {
    registerCalled = true;
    if (shouldFailRegister) {
      throw const ApiException(code: 'CONFLICT', message: 'Бүртгэлтэй дугаар');
    }
  }

  @override
  Future<void> logout() async {
    logoutCalled = true;
  }

  @override
  Future<String?> restoreSessionPhone() async => sessionPhone;
}

void main() {
  late _FakeAuthRepository fakeRepository;
  late ProviderContainer container;

  setUp(() {
    fakeRepository = _FakeAuthRepository();
    container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepository)],
    );
    addTearDown(container.dispose);
  });

  test('session хадгалагдаагүй бол build() unauthenticated буцаана', () async {
    final state = await container.read(authProvider.future);
    expect(state, const AuthState.unauthenticated());
  });

  test('session хадгалагдсан бол build() authenticated буцаана', () async {
    fakeRepository.sessionPhone = '+97688112233';
    container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepository)],
    );
    final state = await container.read(authProvider.future);
    expect(state, const AuthState.authenticated(phone: '+97688112233'));
  });

  test('login амжилттай бол authenticated төлөвт шилжинэ', () async {
    await container.read(authProvider.future); // initial build дуустал хүлээнэ

    await container
        .read(authProvider.notifier)
        .login(phone: '+97688112233', password: 'password123');

    expect(fakeRepository.loginCalled, isTrue);
    expect(
      container.read(authProvider).value,
      const AuthState.authenticated(phone: '+97688112233'),
    );
  });

  test('login амжилтгүй бол AsyncError-т ApiException агуулна', () async {
    await container.read(authProvider.future);
    fakeRepository.shouldFailLogin = true;

    await container
        .read(authProvider.notifier)
        .login(phone: '+97688112233', password: 'wrong');

    final state = container.read(authProvider);
    expect(state.hasError, isTrue);
    expect(state.error, isA<ApiException>());
  });

  test('logout дуудагдвал unauthenticated төлөвт буцна', () async {
    fakeRepository.sessionPhone = '+97688112233';
    container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepository)],
    );
    await container.read(authProvider.future);

    await container.read(authProvider.notifier).logout();

    expect(fakeRepository.logoutCalled, isTrue);
    expect(
      container.read(authProvider).value,
      const AuthState.unauthenticated(),
    );
  });
}
