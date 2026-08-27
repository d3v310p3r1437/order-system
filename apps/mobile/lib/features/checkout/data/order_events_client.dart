import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import '../../../core/network/api_base_url.dart';
import '../../../core/storage/secure_token_storage.dart';

/// `apps/api/src/realtime/order-events.gateway.ts`-той (namespace
/// `/ws/orders`) холбогдоно. Access token хугацаа дуусах/буруу байвал
/// сервэр тал `namespace.use()` middleware-ээр татгалзаж 'connect_error'
/// event явуулна (backend талын толгой тайлбарыг үз) — 'disconnect' биш.
class OrderEventsClient {
  OrderEventsClient({required SecureTokenStorage tokenStorage})
    : _tokenStorage = tokenStorage;

  final SecureTokenStorage _tokenStorage;
  socket_io.Socket? _socket;

  Future<socket_io.Socket> connect() async {
    final token = await _tokenStorage.readAccessToken();
    final socket = socket_io.io(
      '${resolveApiBaseUrl()}/ws/orders',
      socket_io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );
    _socket = socket;
    socket.connect();
    return socket;
  }

  /// `orders_select` RLS-ээр (эсвэл staff-ийн branch эрхээр) харагдвал л
  /// сервэр тал room-д нэгдүүлнэ — татгалзвал ямар ч event ирэхгүй, алдаа ч
  /// шидэхгүй (чимээгүй).
  void subscribeToOrder(String orderId) {
    _socket?.emit('subscribe:order', orderId);
  }

  /// §7 модуль #13: `support_tickets_select` RLS-ээр (харилцагч: өөрийнх)
  /// харагдвал л сервэр тал `ticket:${ticketId}` room-д нэгдүүлнэ —
  /// `subscribeToOrder`-тэй ЯГ ижил зарчим.
  void subscribeToTicket(String ticketId) {
    _socket?.emit('subscribe:ticket', ticketId);
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
  }
}
