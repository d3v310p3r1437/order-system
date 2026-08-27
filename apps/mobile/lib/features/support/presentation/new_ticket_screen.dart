import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../domain/support_labels.dart';
import 'support_providers.dart';

/// §7 модуль #13, 9: "NewTicketScreen (subject, category dropdown, эхний
/// мессеж)". [initialOrderId]/[initialCategory] — OrderTrackingScreen-ийн
/// "Тусламж хүсэх" товчноос (§7 модуль #13, 11) урьдчилан бөглөгдөж ирнэ.
class NewTicketScreen extends ConsumerStatefulWidget {
  const NewTicketScreen({super.key, this.initialOrderId, this.initialCategory});

  final String? initialOrderId;
  final String? initialCategory;

  @override
  ConsumerState<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState extends ConsumerState<NewTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  late String _category = widget.initialCategory ?? supportCategoryLabels.keys.first;
  bool _submitting = false;

  @override
  void dispose() {
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _submitting) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final repository = ref.read(supportRepositoryProvider);
      final ticket = await repository.createTicket(
        subject: _subjectController.text.trim(),
        category: _category,
        orderId: widget.initialOrderId,
      );
      final message = _messageController.text.trim();
      if (message.isNotEmpty) {
        await repository.addMessage(ticket.id, message);
      }
      if (!mounted) {
        return;
      }
      ref.invalidate(supportTicketListProvider);
      context.pushReplacement('/support/${ticket.id}');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Шинэ тасалбар')),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (widget.initialOrderId != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.secondaryContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Захиалга №${widget.initialOrderId!.substring(0, 8)}-тай холбоотой',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                      ),
                    TextFormField(
                      key: const Key('new_ticket_subject_field'),
                      controller: _subjectController,
                      maxLength: 200,
                      decoration: const InputDecoration(
                        labelText: 'Гарчиг',
                        hintText: 'Асуудлаа товч бичнэ үү',
                      ),
                      validator: (value) => (value == null || value.trim().isEmpty)
                          ? 'Гарчиг заавал бөглөнө'
                          : null,
                    ),
                    DropdownButtonFormField<String>(
                      key: const Key('new_ticket_category_dropdown'),
                      initialValue: _category,
                      decoration: const InputDecoration(labelText: 'Ангилал'),
                      items: [
                        for (final entry in supportCategoryLabels.entries)
                          DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _category = value);
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: const Key('new_ticket_message_field'),
                      controller: _messageController,
                      minLines: 3,
                      maxLines: 6,
                      maxLength: 5000,
                      decoration: const InputDecoration(
                        labelText: 'Эхний мессеж',
                        hintText: 'Асуудлаа дэлгэрэнгүй тайлбарлана уу...',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(top: BorderSide(color: theme.colorScheme.outline)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  key: const Key('submit_new_ticket_button'),
                  onPressed: _submitting ? null : _submit,
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
      ),
    );
  }
}
