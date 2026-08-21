import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/currency.dart';
import '../../../core/network/api_exception.dart';
import '../../branch/presentation/branch_providers.dart';
import '../../cart/presentation/cart_providers.dart';
import 'checkout_draft.dart';
import 'checkout_providers.dart';

const _checkoutErrorMessages = {
  'CART_EMPTY': 'Сагс хоосон байна',
  'OUT_OF_STOCK': 'Сонгосон бараа нөөцөд хүрэлцэхгүй байна',
  'BRANCH_NOT_FOUND': 'Заасан салбар олдсонгүй',
};

/// Checkout-ийн сүүлчийн алхам: сагсны жагсаалт, хүргэлт/PICKUP-ийн
/// мэдээлэл, эцсийн (branchPrice override-той) нийт дүн (`cartBranchValidationProvider`
/// — `CartItem.estimatedLineTotal` зөвхөн ойролцоо тооцоо, эцсийн дүн БИШ,
/// `apps/mobile/lib/features/cart/domain/cart_item.dart`-ийн тайлбарыг үз).
/// "Захиалах" товч дарахад `POST /orders`-ийг дуудна.
class OrderReviewScreen extends ConsumerStatefulWidget {
  const OrderReviewScreen({super.key});

  @override
  ConsumerState<OrderReviewScreen> createState() => _OrderReviewScreenState();
}

class _OrderReviewScreenState extends ConsumerState<OrderReviewScreen> {
  bool _submitting = false;

  Future<void> _submit(CheckoutDraft draft) async {
    setState(() => _submitting = true);
    try {
      final result = await ref
          .read(checkoutRepositoryProvider)
          .checkout(
            branchId: draft.branchId,
            deliveryMethod: draft.deliveryMethod,
            deliveryAddress: draft.deliveryAddress,
            deliveryLatitude: draft.deliveryLatitude,
            deliveryLongitude: draft.deliveryLongitude,
          );
      if (!mounted) {
        return;
      }
      ref.read(checkoutDraftProvider.notifier).reset();
      // Redis сагс backend талд аль хэдийн (checkout амжилттай commit
      // хийгдсэний дараа) цэвэрлэгдсэн тул CartScreen дахин нээгдэхэд шинэ
      // (хоосон) сагстай тааруулж, локал кэшийг ч дахин уншуулна.
      ref.invalidate(cartProvider);
      context.go('/orders/${result.orderId}/payment', extra: result);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _checkoutErrorMessages[error.code] ?? error.message,
          ),
        ),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Захиалга үүсгэхэд алдаа гарлаа')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(checkoutDraftProvider);
    if (draft == null) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (context.canPop()) {
          context.pop();
        }
      });
      return const Scaffold(body: SizedBox.shrink());
    }

    final theme = Theme.of(context);
    final validationAsync = ref.watch(
      cartBranchValidationProvider(draft.branchId),
    );
    final branchesAsync = ref.watch(branchesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Захиалгын тойм')),
      body: Column(
        children: [
          Expanded(
            child: validationAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text(
                  'Сагс шалгахад алдаа гарлаа',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
              data: (validation) {
                final branchName = branchesAsync.maybeWhen(
                  data: (branches) {
                    for (final branch in branches) {
                      if (branch.id == draft.branchId) {
                        return branch.name;
                      }
                    }
                    return null;
                  },
                  orElse: () => null,
                );
                return ListView(
                  key: const Key('order_review_list'),
                  padding: const EdgeInsets.all(16),
                  children: [
                    _DeliveryInfoCard(draft: draft, branchName: branchName),
                    const SizedBox(height: 16),
                    Text('Захиалгын жагсаалт', style: theme.textTheme.titleSmall),
                    const SizedBox(height: 8),
                    ...validation.items.map(
                      (line) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${line.productName ?? line.variantId} × ${line.quantity}',
                                style: theme.textTheme.bodyMedium,
                              ),
                            ),
                            Text(
                              line.effectivePrice != null
                                  ? formatTugrik(
                                      (double.parse(line.effectivePrice!) *
                                              line.quantity)
                                          .toStringAsFixed(0),
                                    )
                                  : '—',
                              style: theme.textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Divider(height: 32),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Нийт дүн', style: theme.textTheme.titleMedium),
                        Text(
                          formatTugrik(validation.totalAmount),
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
          SafeArea(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(top: BorderSide(color: theme.colorScheme.outline)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  key: const Key('submit_checkout_button'),
                  onPressed: _submitting ? null : () => _submit(draft),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Захиалах'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeliveryInfoCard extends StatelessWidget {
  const _DeliveryInfoCard({required this.draft, required this.branchName});

  final CheckoutDraft draft;
  final String? branchName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              draft.isDelivery
                  ? Icons.local_shipping_outlined
                  : Icons.storefront_outlined,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    draft.isDelivery ? 'Хүргэлт' : 'Очиж авах',
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    draft.isDelivery
                        ? (draft.deliveryAddress ?? '')
                        : (branchName ?? ''),
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
