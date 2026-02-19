import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/app_config.dart';

class WebSocketService {
  WebSocketChannel? _channel;
  final StreamController<Map<String, dynamic>> _messageController =
      StreamController<Map<String, dynamic>>.broadcast();
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  String? _token;
  bool _isConnected = false;
  int _reconnectAttempts = 0;

  // Buffer last game messages so late subscribers don't miss them
  final List<Map<String, dynamic>> _pendingGameMessages = [];
  bool _gameStartReceived = false;

  Stream<Map<String, dynamic>> get messages => _messageController.stream;
  bool get isConnected => _isConnected;

  /// Get any buffered game messages and clear the buffer
  List<Map<String, dynamic>> consumePendingMessages() {
    final messages = List<Map<String, dynamic>>.from(_pendingGameMessages);
    _pendingGameMessages.clear();
    return messages;
  }

  Future<void> connect(String token) async {
    _token = token;
    _reconnectAttempts = 0;
    await _doConnect();
  }

  Future<void> _doConnect() async {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(AppConfig.wsUrl));

      _channel!.stream.listen(
        _onMessage,
        onDone: _onDisconnected,
        onError: (error) => _onDisconnected(),
      );

      // Send auth
      send({'type': 'auth', 'token': _token});

      // Start ping
      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
        send({'type': 'ping'});
      });

      _isConnected = true;
      _reconnectAttempts = 0;
    } catch (e) {
      _onDisconnected();
    }
  }

  void send(Map<String, dynamic> message) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode(message));
    }
  }

  void _onMessage(dynamic data) {
    try {
      final message = jsonDecode(data.toString()) as Map<String, dynamic>;

      // Buffer game-critical messages so late subscribers can catch up
      final type = message['type'];
      if (type == 'game_start' || type == 'game_state') {
        _gameStartReceived = true;
        _pendingGameMessages.clear();
        _pendingGameMessages.add(message);
      } else if (_gameStartReceived &&
          (type == 'deal' || type == 'bidding_turn' || type == 'play_turn' ||
           type == 'contract_set' || type == 'new_hand')) {
        _pendingGameMessages.add(message);
      }

      _messageController.add(message);
    } catch (_) {}
  }

  void _onDisconnected() {
    _isConnected = false;
    _pingTimer?.cancel();

    if (_token != null && _reconnectAttempts < AppConfig.reconnectMaxAttempts) {
      final delay = Duration(
        milliseconds: (1000 * (1 << _reconnectAttempts)).clamp(1000, 16000),
      );
      _reconnectAttempts++;
      _reconnectTimer = Timer(delay, _doConnect);
    }
  }

  void leaveGame() => send({'type': 'leave_game'});
  void joinQueue() {
    // Leave any existing game first, then join queue
    leaveGame();
    send({'type': 'join_queue'});
  }
  void cancelQueue() => send({'type': 'cancel_queue'});

  void placeBid(int value, String suit) =>
      send({'type': 'place_bid', 'value': value, 'suit': suit});

  void passBid() => send({'type': 'pass_bid'});
  void coinche() => send({'type': 'coinche'});
  void surcoinche() => send({'type': 'surcoinche'});

  void playCard(String suit, String rank) =>
      send({'type': 'play_card', 'suit': suit, 'rank': rank});

  void reconnectToGame(String gameId) =>
      send({'type': 'reconnect', 'gameId': gameId, 'token': _token ?? ''});

  Future<void> disconnect() async {
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    _token = null;
    _isConnected = false;
    await _channel?.sink.close();
    _channel = null;
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}
