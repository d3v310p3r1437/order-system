import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/providers.dart';
import '../data/order_events_client.dart';
import '../domain/checkout_result.dart';
import 'checkout_providers.dart';

/// Checkout-ийн төлбөрийн дэлгэц (route: `/orders/:id/payment`). QR
/// код/банкны deeplink-үүд ЗӨВХӨН `POST /orders`-ийн шууд хариунаас
/// (`checkoutResult`, `state.extra`-аар дамжсан) ирдэг — `GET /orders/:id`-д
/// ДАХИН ирдэггүй тул энэ дэлгэц дахин ачаалагдвал (жиш: deep link) QR
/// харагдахгүй, зөвхөн бодит цагийн хүлээлт л ажиллана.
///
/// WebSocket-оор `order:${orderId}` room-д нэгдэж `order.payment_confirmed`
/// хүлээнэ (backend: `apps/api/src/realtime/order-events.gateway.ts`).
class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key, required this.orderId, this.checkoutResult});

  final String orderId;
  final CheckoutResult? checkoutResult;

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  late final OrderEventsClient _eventsClient;
  bool _simulating = false;
  String _connectionHint = 'Холбогдож байна...';

  @override
  void initState() {
    super.initState();
    _eventsClient = OrderEventsClient(
      tokenStorage: ref.read(secureTokenStorageProvider),
    );
    _connect();
  }

  Future<void> _connect() async {
    final socket = await _eventsClient.connect();
    socket.on('connect', (_) {
      _eventsClient.subscribeToOrder(widget.orderId);
      if (mounted) {
        setState(() => _connectionHint = 'Төлбөр хүлээгдэж байна...');
      }
    });
    socket.on('connect_error', (_) {
      if (mounted) {
        setState(
          () => _connectionHint =
              'Холболт тасарсан — интернэт холболтоо шалгана уу',
        );
      }
    });
    socket.on('order.payment_confirmed', (data) {
      if (!mounted) {
        return;
      }
      final payload = (data as Map).cast<String, dynamic>();
      if (payload['orderId'] != widget.orderId) {
        return;
      }
      context.go('/orders/${widget.orderId}/success');
    });
  }

  Future<void> _simulatePaid() async {
    final providerInvoiceId = widget.checkoutResult?.providerInvoiceId;
    if (providerInvoiceId == null) {
      return;
    }
    setState(() => _simulating = true);
    try {
      await ref
          .read(checkoutRepositoryProvider)
          .simulatePaid(
            orderId: widget.orderId,
            providerInvoiceId: providerInvoiceId,
          );
    } finally {
      if (mounted) {
        setState(() => _simulating = false);
      }
    }
  }

  @override
  void dispose() {
    _eventsClient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final result = widget.checkoutResult;

    return Scaffold(
      appBar: AppBar(title: const Text('Төлбөр төлөх')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (result?.qrText != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: QrImageView(
                      key: const Key('payment_qr_code'),
                      data: result!.qrText!,
                      size: 220,
                    ),
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: Icon(
                    Icons.qr_code_2,
                    size: 96,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              const SizedBox(height: 24),
              if (result != null && result.bankDeeplinks.isNotEmpty) ...[
                Text(
                  'Банкны апп-аар шууд төлөх',
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: result.bankDeeplinks
                      .map(
                        (deeplink) => OutlinedButton(
                          onPressed: () => launchUrl(Uri.parse(deeplink.link)),
                          child: Text(deeplink.bankName),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 24),
              ],
              // Мөнгөтэй холбоотой дэлгэц тул яаруу/түгшүүртэй БИШ, тайван
              // итгэлтэй мэдрэмж өгсөн ачааллын индикатор (жиш: bounce
              // маягийн жижиг цэг биш, энгийн тогтмол spinner + текст).
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(height: 12),
              Text(
                _connectionHint,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              if (kDebugMode && result?.providerInvoiceId != null) ...[
                const SizedBox(height: 32),
                OutlinedButton.icon(
                  key: const Key('debug_simulate_paid_button'),
                  onPressed: _simulating ? null : _simulatePaid,
                  icon: const Icon(Icons.bug_report_outlined),
                  label: const Text('Mock төлбөр симуляц хийх (debug)'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
