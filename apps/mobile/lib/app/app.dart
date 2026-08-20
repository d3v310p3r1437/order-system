import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_theme.dart';
import 'router.dart';
import 'theme_mode_provider.dart';

class OrderSystemApp extends ConsumerWidget {
  const OrderSystemApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    // build() ачаалж дуусаагүй мөчид ThemeMode.system ЯГ анхны утгатай
    // ижил тул (theme_mode_provider.dart-ийн тайлбарыг үз) flash үүсэхгүй.
    final themeMode = ref.watch(themeModeProvider).value ?? ThemeMode.system;

    return MaterialApp.router(
      title: 'Захиалгын систем',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
