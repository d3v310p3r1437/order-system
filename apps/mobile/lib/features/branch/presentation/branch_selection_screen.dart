import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/currency.dart';
import '../../catalog/domain/availability.dart';
import '../../catalog/presentation/widgets/availability_badge.dart';
import '../../checkout/presentation/checkout_draft.dart';
import '../domain/branch.dart';
import 'branch_providers.dart';

/// Салбар сонгох дэлгэц (docs/plan.md §7 модуль #5) — салбар сонгоход
/// `/cart/validate-branch` дуудаж тухайн салбарт сагсны хэдэн зүйл бэлэн
/// байгааг тодорхой (нэр + status badge-ээр) харуулна. "Үргэлжлүүлэх" товч
/// `CheckoutDraft`-ыг эхлүүлж (§8 Cart→Checkout→QPay) checkout урсгал руу
/// шилжинэ.
class BranchSelectionScreen extends ConsumerStatefulWidget {
  const BranchSelectionScreen({super.key});

  @override
  ConsumerState<BranchSelectionScreen> createState() =>
      _BranchSelectionScreenState();
}

class _BranchSelectionScreenState
    extends ConsumerState<BranchSelectionScreen> {
  String? _selectedBranchId;

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(branchesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Салбар сонгох')),
      body: branchesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Салбарын жагсаалт ачаалахад алдаа гарлаа',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
        data: (branches) {
          if (branches.isEmpty) {
            return const Center(child: Text('Салбар олдсонгүй'));
          }
          return ListView.separated(
            key: const Key('branch_list'),
            padding: const EdgeInsets.all(16),
            itemCount: branches.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final branch = branches[index];
              return _BranchTile(
                branch: branch,
                selected: branch.id == _selectedBranchId,
                onTap: () => setState(() => _selectedBranchId = branch.id),
              );
            },
          );
        },
      ),
      bottomNavigationBar: _selectedBranchId == null
          ? null
          : _ValidationPanel(branchId: _selectedBranchId!),
    );
  }
}

class _BranchTile extends StatelessWidget {
  const _BranchTile({
    required this.branch,
    required this.selected,
    required this.onTap,
  });

  final Branch branch;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: selected
          ? theme.colorScheme.primaryContainer
          : theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        key: Key('branch_tile_${branch.id}'),
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected
                  ? theme.colorScheme.primary
                  : theme.colorScheme.outline,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: selected
                    ? theme.colorScheme.primary
                    : theme.colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      branch.name,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (branch.address != null) ...[
                      const SizedBox(height: 2),
                      Text(branch.address!, style: theme.textTheme.bodySmall),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ValidationPanel extends ConsumerWidget {
  const _ValidationPanel({required this.branchId});

  final String branchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final validationAsync = ref.watch(cartBranchValidationProvider(branchId));

    return SafeArea(
      child: Container(
        key: const Key('branch_validation_panel'),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          border: Border(top: BorderSide(color: theme.colorScheme.outline)),
        ),
        child: validationAsync.when(
          loading: () => const SizedBox(
            height: 48,
            child: Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
          error: (error, _) => Text(
            'Бэлэн байдал шалгахад алдаа гарлаа',
            style: theme.textTheme.bodyMedium,
          ),
          data: (validation) {
            final total = validation.items.length;
            final availableCount = validation.availableCount;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$total-аас $availableCount бэлэн',
                  key: const Key('branch_availability_summary'),
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (availableCount < total) ...[
                  const SizedBox(height: 8),
                  ...validation.items
                      .where((line) => !line.available)
                      .map(
                        (line) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  line.productName ?? line.variantId,
                                  style: theme.textTheme.bodySmall,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              AvailabilityBadge(
                                result: AvailabilityResult(
                                  status: line.status,
                                  leadDays: line.leadDays,
                                ),
                                dense: true,
                              ),
                            ],
                          ),
                        ),
                      ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text('Нийт:', style: theme.textTheme.bodyMedium),
                    const SizedBox(width: 8),
                    Text(
                      formatTugrik(validation.totalAmount),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: const Key('continue_to_checkout_button'),
                    onPressed: availableCount == 0
                        ? null
                        : () {
                            ref
                                .read(checkoutDraftProvider.notifier)
                                .start(branchId);
                            context.push('/checkout/delivery-method');
                          },
                    child: const Text('Үргэлжлүүлэх'),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
