/// Backend-ийн Decimal→string үнийг (жиш: "45000.00") CLAUDE.md-ийн
/// шаардсан "45,000₮" хэлбэрт хөрвүүлнэ — интернэт хамааралгүй байлгах
/// зорилгоор `intl` багц ашиглалгүй, гараар мянганы тусгаарлагч тавьсан.
String formatTugrik(String rawPrice) {
  final value = double.tryParse(rawPrice) ?? 0;
  final rounded = value.round();
  final digits = rounded.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      buffer.write(',');
    }
    buffer.write(digits[i]);
  }
  final sign = rounded < 0 ? '-' : '';
  return '$sign${buffer.toString()}₮';
}
