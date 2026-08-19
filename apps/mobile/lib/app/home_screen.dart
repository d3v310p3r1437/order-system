import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/presentation/auth_provider.dart';
import '../features/auth/domain/auth_state.dart';

/// Placeholder — зөвхөн нэвтрэлт бүрэн ажиллаж байгааг харуулах
/// зорилготой (каталог/сагс/захиалга дараагийн Phase-д). §7-ийн
/// модулиуд эхлэхэд энэ дэлгэц бодит HomeScreen-ээр солигдоно.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final phone = switch (authState.value) {
      AuthAuthenticated(:final phone) => phone,
      _ => '',
    };

    return Scaffold(
      appBar: AppBar(title: const Text('Нүүр')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Тавтай морил, $phone',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              key: const Key('logout_button'),
              onPressed: () => ref.read(authProvider.notifier).logout(),
              child: const Text('Гарах'),
            ),
          ],
        ),
      ),
    );
  }
}
