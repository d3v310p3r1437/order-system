import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_state.freezed.dart';

/// Нэвтрэлтийн төлөв — `docs/plan.md` §6.2-ийн custom customer-auth
/// (утасны дугаар + нууц үг) урсгалтай тохирно.
@freezed
sealed class AuthState with _$AuthState {
  const factory AuthState.unauthenticated() = AuthUnauthenticated;

  const factory AuthState.authenticated({required String phone}) =
      AuthAuthenticated;
}
