import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/currency.dart';
import '../../../core/network/api_exception.dart';
import '../../branch/presentation/branch_providers.dart';
import '../../cart/presentation/cart_providers.dart';
import '../../coupons/domain/coupon_validation.dart';
import '../../coupons/presentation/coupon_providers.dart';
import 'checkout_draft.dart';
import 'checkout_providers.dart';

const _checkoutErrorMessages = {
  'CART_EMPTY': 'Сагс хоосон байна',
  'OUT_OF_STOCK': 'Сонгосон бараа нөөцөд хүрэлцэхгүй байна',
  'BRANCH_NOT_FOUND': 'Заасан салбар олдсонгүй',
  'COUPON_NOT_FOUND': 'Купон олдсонгүй',
  'COUPON_ALREADY_USED': 'Та энэ купоныг аль хэдийн ашигласан байна',
  'COUPON_USAGE_LIMIT_REACHED': 'Купоны ашиглалтын хязгаар дууссан байна',
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
  final _couponController = TextEditingController();
  bool _submitting = false;
  bool _couponValidating = false;
  CouponValidation? _appliedCoupon;
  String? _couponError;

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _applyCoupon(String orderAmount) async {
    final code = _couponController.text.trim();
    if (code.isEmpty) {
      return;
    }
    setState(() {
      _couponValidating = true;
      _couponError = null;
    });
    try {
      final result = await ref
          .read(couponRepositoryProvider)
          .validate(code: code, orderAmount: orderAmount);
      if (!mounted) {
        return;
      }
      setState(() {
        _appliedCoupon = result;
        _couponValidating = false;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _appliedCoupon = null;
        _couponValidating = false;
        _couponError = _checkoutErrorMessages[error.code] ?? error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _appliedCoupon = null;
        _couponValidating = false;
        _couponError = 'Купон шалгахад алдаа гарлаа';
      });
    }
  }

  void _removeCoupon() {
    setState(() {
      _appliedCoupon = null;
      _couponError = null;
      _couponController.clear();
    });
  }

  // Зөвхөн харуулах зорилготой ойролцоо тооцоо (`cartBranchValidationProvider`-ийн
  // `estimatedLineTotal`-тэй ижил зарчим) — эцсийн жинхэнэ totalAmount-ыг
  // ГАНЦ газар (backend, `OrderService.checkout()`) л шийднэ, checkout
  // амжилттай болмогц `CheckoutResult.discountAmount`-аас бодит утгыг харна.
  String _discountedTotal(String orderAmount) {
    final coupon = _appliedCoupon;
    if (coupon == null) {
      return orderAmount;
    }
    final total = double.tryParse(orderAmount) ?? 0;
    final discount = double.tryParse(coupon.discountAmount) ?? 0;
    return (total - discount).clamp(0, double.infinity).toStringAsFixed(2);
  }

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
            couponCode: _appliedCoupon?.couponCode,
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
                    _CouponSection(
                      controller: _couponController,
                      validating: _couponValidating,
                      applied: _appliedCoupon,
                      error: _couponError,
                      onApply: () => _applyCoupon(validation.totalAmount),
                      onRemove: _removeCoupon,
                    ),
                    const SizedBox(height: 16),
                    if (_appliedCoupon != null) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Дэд дүн',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                          Text(
                            formatTugrik(validation.totalAmount),
                            style: theme.textTheme.bodyMedium?.copyWith(
                              decoration: TextDecoration.lineThrough,
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Хямдрал (${_appliedCoupon!.couponCode})',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.primary,
                            ),
                          ),
                          Text(
                            '−${formatTugrik(_appliedCoupon!.discountAmount)}',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                    ],
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Нийт дүн', style: theme.textTheme.titleMedium),
                        Text(
                          formatTugrik(_discountedTotal(validation.totalAmount)),
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

/// §7 модуль #10: "Купон код" оруулах талбар + "Ашиглах" товч. Амжилттай
/// баталгаажвал (`applied != null`) талбарыг `readOnly` болгож, "Хасах"
/// товчоор л буцааж засварлах боломжтой болгодог — давхар "Ашиглах" дарж
/// давхар `GET /coupons/validate` дуудахаас сэргийлнэ (backend талд ч мөн
/// atomic хамгаалалттай ч, UI-ийн хувьд илүү тодорхой урсгал).
class _CouponSection extends StatelessWidget {
  const _CouponSection({
    required this.controller,
    required this.validating,
    required this.applied,
    required this.error,
    required this.onApply,
    required this.onRemove,
  });

  final TextEditingController controller;
  final bool validating;
  final CouponValidation? applied;
  final String? error;
  final VoidCallback onApply;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Купон код', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                key: const Key('coupon_code_field'),
                controller: controller,
                readOnly: applied != null,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'жиш: SALE2026',
                  isDense: true,
                  border: const OutlineInputBorder(),
                  errorText: error,
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (applied == null)
              FilledButton.tonal(
                key: const Key('apply_coupon_button'),
                onPressed: validating ? null : onApply,
                child: validating
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Ашиглах'),
              )
            else
              OutlinedButton(
                key: const Key('remove_coupon_button'),
                onPressed: onRemove,
                child: const Text('Хасах'),
              ),
          ],
        ),
      ],
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
