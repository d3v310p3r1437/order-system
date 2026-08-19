import 'package:flutter/material.dart';

/// admin-web-ийн `src/index.css`-ийн cobalt-indigo палеттай тохирсон
/// Material 3 theme (`--primary`/`--background`/... тэмдэгтүүдийг шууд
/// хөрвүүлсэн — admin-web-тэй ижил brand identity Flutter талд давхарлана).
class AppTheme {
  AppTheme._();

  static const _lightPrimary = Color(0xFF2946D9);
  static const _lightOnPrimary = Color(0xFFFFFFFF);
  static const _lightBackground = Color(0xFFF4F5F8);
  static const _lightSurface = Color(0xFFFFFFFF);
  static const _lightOnSurface = Color(0xFF14161F);
  static const _lightSecondary = Color(0xFFEAEEFB);
  static const _lightOnSecondary = Color(0xFF1C2C72);
  static const _lightMuted = Color(0xFF676C7C);
  static const _lightBorder = Color(0xFFE1E3EA);
  static const _lightDestructive = Color(0xFFDC2626);

  static const _darkPrimary = Color(0xFF6478F0);
  static const _darkOnPrimary = Color(0xFF0B0D13);
  static const _darkBackground = Color(0xFF0B0D13);
  static const _darkSurface = Color(0xFF12141D);
  static const _darkOnSurface = Color(0xFFE8E9F0);
  static const _darkSecondary = Color(0xFF1A2148);
  static const _darkOnSecondary = Color(0xFFC7D0FB);
  static const _darkMuted = Color(0xFF9198AB);
  static const _darkBorder = Color(0x1AFFFFFF);
  static const _darkDestructive = Color(0xFFF87171);

  static ThemeData get light => _build(
    brightness: Brightness.light,
    primary: _lightPrimary,
    onPrimary: _lightOnPrimary,
    background: _lightBackground,
    surface: _lightSurface,
    onSurface: _lightOnSurface,
    secondary: _lightSecondary,
    onSecondary: _lightOnSecondary,
    muted: _lightMuted,
    border: _lightBorder,
    destructive: _lightDestructive,
  );

  static ThemeData get dark => _build(
    brightness: Brightness.dark,
    primary: _darkPrimary,
    onPrimary: _darkOnPrimary,
    background: _darkBackground,
    surface: _darkSurface,
    onSurface: _darkOnSurface,
    secondary: _darkSecondary,
    onSecondary: _darkOnSecondary,
    muted: _darkMuted,
    border: _darkBorder,
    destructive: _darkDestructive,
  );

  static ThemeData _build({
    required Brightness brightness,
    required Color primary,
    required Color onPrimary,
    required Color background,
    required Color surface,
    required Color onSurface,
    required Color secondary,
    required Color onSecondary,
    required Color muted,
    required Color border,
    required Color destructive,
  }) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: primary,
      onPrimary: onPrimary,
      secondary: secondary,
      onSecondary: onSecondary,
      error: destructive,
      onError: onPrimary,
      surface: surface,
      onSurface: onSurface,
      surfaceContainerHighest: secondary,
      onSurfaceVariant: muted,
      outline: border,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: onSurface,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: primary, width: 2),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: border),
        ),
      ),
    );
  }
}
