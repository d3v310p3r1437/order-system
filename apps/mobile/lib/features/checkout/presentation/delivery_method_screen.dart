import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'checkout_draft.dart';

/// Checkout-ийн 1-р алхам: PICKUP/DELIVERY сонголт (docs/plan.md §8
/// Cart→Checkout→QPay). `CheckoutDraft` ноорог `BranchSelectionScreen`-ийн
/// "Үргэлжлүүлэх" товчоор аль хэдийн `start(branchId)`-ээр эхэлсэн байх
/// ёстой.
class DeliveryMethodScreen extends ConsumerWidget {
  const DeliveryMethodScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(checkoutDraftProvider);
    if (draft == null) {
      // Ноорог эхлээгүй байхад (жиш: deep link, hot restart) энэ дэлгэц рүү
      // шууд орсон бол буцаана — checkout зөвхөн BranchSelectionScreen-ээс
      // эхэлдэг байх ёстой.
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (context.canPop()) {
          context.pop();
        }
      });
      return const Scaffold(body: SizedBox.shrink());
    }

    final notifier = ref.read(checkoutDraftProvider.notifier);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Хүргэлтийн арга')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<String>(
              key: const Key('delivery_method_segmented_button'),
              segments: const [
                ButtonSegment(
                  value: 'PICKUP',
                  label: Text('Очиж авах'),
                  icon: Icon(Icons.storefront_outlined),
                ),
                ButtonSegment(
                  value: 'DELIVERY',
                  label: Text('Хүргэлт'),
                  icon: Icon(Icons.local_shipping_outlined),
                ),
              ],
              selected: {draft.deliveryMethod},
              onSelectionChanged: (selection) =>
                  notifier.setDeliveryMethod(selection.first),
            ),
            const SizedBox(height: 24),
            Text(
              draft.deliveryMethod == 'PICKUP'
                  ? 'Та сонгосон салбар дээрээ өөрөө очиж захиалгаа авна.'
                  : 'Манай хүргэлтийн ажилтан таны заасан хаягт хүргэж өгнө.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const Spacer(),
            FilledButton(
              key: const Key('delivery_method_continue_button'),
              onPressed: () {
                if (draft.deliveryMethod == 'DELIVERY') {
                  context.push('/checkout/address');
                } else {
                  context.push('/checkout/review');
                }
              },
              child: const Text('Үргэлжлүүлэх'),
            ),
          ],
        ),
      ),
    );
  }
}
