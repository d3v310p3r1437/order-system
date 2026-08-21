import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/currency.dart';
import '../../../core/network/api_exception.dart';
import '../../checkout/domain/order_detail.dart';
import '../../checkout/presentation/checkout_providers.dart';
import 'return_providers.dart';
import 'widgets/return_status_badge.dart';

/// COMPLETED захиалгын item-үүдээс сонгож буцаалт хүсэх дэлгэц (docs/plan.md
/// §7 модуль #9 2) — `POST /returns` нь `orderItemId` (нэг мөр)-ээр л
/// хүлээн авдаг тул олон item сонгосон бол дараалан (item тус бүрд нэг)
/// дуудна.
class ReturnRequestScreen extends ConsumerStatefulWidget {
  const ReturnRequestScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<ReturnRequestScreen> createState() =>
      _ReturnRequestScreenState();
}

class _ReturnRequestScreenState extends ConsumerState<ReturnRequestScreen> {
  final _reasonController = TextEditingController();
  final Set<String> _selectedItemIds = {};
  bool _submitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    if (_selectedItemIds.isEmpty || reason.isEmpty) {
      return;
    }
    setState(() => _submitting = true);
    final repository = ref.read(returnRepositoryProvider);
    var successCount = 0;
    ApiException? lastError;
    for (final itemId in _selectedItemIds) {
      try {
        await repository.create(orderItemId: itemId, reason: reason);
        successCount++;
      } on ApiException catch (error) {
        lastError = error;
      }
    }
    if (!mounted) {
      return;
    }
    setState(() => _submitting = false);
    ref.invalidate(orderReturnsProvider(widget.orderId));
    if (successCount > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            successCount == _selectedItemIds.length
                ? 'Буцаалтын хүсэлт илгээгдлээ'
                : '$successCount/${_selectedItemIds.length} барааны хүсэлт илгээгдлээ',
          ),
        ),
      );
      context.pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(lastError?.message ?? 'Хүсэлт илгээхэд алдаа гарлаа')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final orderAsync = ref.watch(orderDetailProvider(widget.orderId));
    final returnsAsync = ref.watch(orderReturnsProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Буцаалт хүсэх')),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            'Захиалга ачаалахад алдаа гарлаа',
            style: theme.textTheme.bodyMedium,
          ),
        ),
        data: (order) {
          final existingStatusByItemId = <String, String>{};
          for (final r in returnsAsync.value ?? const []) {
            existingStatusByItemId[r.orderItemId] = r.status;
          }

          return Column(
            children: [
              Expanded(
                child: ListView(
                  key: const Key('return_item_list'),
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      'Буцаах барааг сонгоно уу',
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    for (final item in order.items)
                      _ReturnItemTile(
                        item: item,
                        existingStatus: existingStatusByItemId[item.id],
                        selected: _selectedItemIds.contains(item.id),
                        onChanged: (checked) {
                          setState(() {
                            if (checked) {
                              _selectedItemIds.add(item.id);
                            } else {
                              _selectedItemIds.remove(item.id);
                            }
                          });
                        },
                      ),
                    const SizedBox(height: 16),
                    Text('Шалтгаан', style: theme.textTheme.titleSmall),
                    const SizedBox(height: 8),
                    TextField(
                      key: const Key('return_reason_field'),
                      controller: _reasonController,
                      minLines: 3,
                      maxLines: 5,
                      maxLength: 1000,
                      decoration: const InputDecoration(
                        hintText: 'Буцаах шалтгаанаа бичнэ үү...',
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ],
                ),
              ),
              SafeArea(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surface,
                    border: Border(
                      top: BorderSide(color: theme.colorScheme.outline),
                    ),
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      key: const Key('submit_return_request_button'),
                      onPressed:
                          (_submitting ||
                              _selectedItemIds.isEmpty ||
                              _reasonController.text.trim().isEmpty)
                          ? null
                          : _submit,
                      child: _submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Илгээх'),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ReturnItemTile extends StatelessWidget {
  const _ReturnItemTile({
    required this.item,
    required this.existingStatus,
    required this.selected,
    required this.onChanged,
  });

  final OrderItemLine item;
  final String? existingStatus;
  final bool selected;
  final ValueChanged<bool> onChanged;

  bool get _blocked =>
      existingStatus == 'REQUESTED' ||
      existingStatus == 'APPROVED' ||
      existingStatus == 'REFUNDED';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      key: Key('return_item_tile_${item.id}'),
      margin: const EdgeInsets.only(bottom: 8),
      child: CheckboxListTile(
        value: selected,
        onChanged: _blocked ? null : (v) => onChanged(v ?? false),
        title: Text('${item.displayName} ×${item.quantity}'),
        subtitle: Row(
          children: [
            Text(
              formatTugrik(item.unitPriceSnapshot),
              style: theme.textTheme.bodySmall,
            ),
            if (existingStatus != null) ...[
              const SizedBox(width: 8),
              ReturnStatusBadge(status: existingStatus!),
            ],
          ],
        ),
        controlAffinity: ListTileControlAffinity.leading,
      ),
    );
  }
}
