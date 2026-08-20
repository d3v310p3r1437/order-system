import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/auth_provider.dart';
import '../features/auth/domain/auth_state.dart';

/// Каталог руу орох цэг — сагс/захиалга дараагийн Phase-д нэмэгдэх хүртэл
/// нүүр дэлгэц зөвхөн энэ ганц навигацийн зорилготой хэвээр байна.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final phone = switch (authState.value) {
      AuthAuthenticated(:final phone) => phone,
      _ => '',
    };
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Нүүр'),
        actions: [
          IconButton(
            key: const Key('settings_button'),
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Тохиргоо',
            onPressed: () => context.push('/settings'),
          ),
          IconButton(
            key: const Key('logout_button'),
            icon: const Icon(Icons.logout),
            tooltip: 'Гарах',
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Тавтай морил, $phone',
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 24),
            Material(
              color: theme.colorScheme.primary,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                key: const Key('open_catalog_button'),
                borderRadius: BorderRadius.circular(16),
                onTap: () => context.push('/catalog'),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: theme.colorScheme.onPrimary.withValues(
                            alpha: 0.15,
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.storefront_outlined,
                          color: theme.colorScheme.onPrimary,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Каталог үзэх',
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: theme.colorScheme.onPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Бүтээгдэхүүн хайх, ангилалаар шүүх',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onPrimary.withValues(
                                  alpha: 0.85,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_rounded,
                        color: theme.colorScheme.onPrimary,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
