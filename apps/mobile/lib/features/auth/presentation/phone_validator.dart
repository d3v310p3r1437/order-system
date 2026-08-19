// Backend-ийн PHONE_E164_REGEX-тэй тохирсон (apps/api/src/auth-customer/phone.ts).
final RegExp phoneE164Regex = RegExp(r'^\+?[1-9]\d{7,14}$');

String? validatePhone(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'Утасны дугаараа оруулна уу';
  }
  if (!phoneE164Regex.hasMatch(value.trim())) {
    return 'Утасны дугаар E.164 форматтай байх ёстой (жиш: +97688112233)';
  }
  return null;
}

String? validatePassword(String? value) {
  if (value == null || value.isEmpty) {
    return 'Нууц үгээ оруулна уу';
  }
  if (value.length < 8) {
    return 'Нууц үг хамгийн багадаа 8 тэмдэгттэй байх ёстой';
  }
  return null;
}
