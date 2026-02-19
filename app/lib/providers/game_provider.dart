import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/card_model.dart';
import '../models/game_state.dart';
import '../services/websocket_service.dart';

final wsServiceProvider = Provider((ref) => WebSocketService());

class GameNotifier extends StateNotifier<GameState?> {
  final WebSocketService _ws;
  StreamSubscription? _subscription;

  GameNotifier(this._ws) : super(null) {
    _subscription = _ws.messages.listen(_handleMessage);
  }

  void _handleMessage(Map<String, dynamic> msg) {
    switch (msg['type']) {
      case 'game_start':
        _handleGameStart(msg);
        break;
      case 'deal':
        _handleDeal(msg);
        break;
      case 'bidding_turn':
        _handleBiddingTurn(msg);
        break;
      case 'bid_placed':
      case 'bid_passed':
      case 'coinched':
      case 'surcoinched':
        _handleBidEvent(msg);
        break;
      case 'contract_set':
        _handleContractSet(msg);
        break;
      case 'play_turn':
        _handlePlayTurn(msg);
        break;
      case 'card_played':
        _handleCardPlayed(msg);
        break;
      case 'trick_won':
        _handleTrickWon(msg);
        break;
      case 'hand_result':
        _handleHandResult(msg);
        break;
      case 'game_over':
        _handleGameOver(msg);
        break;
      case 'all_passed':
        // Re-deal will come as new deal event
        break;
      case 'game_state':
        _handleFullState(msg);
        break;
    }
  }

  void _handleGameStart(Map<String, dynamic> msg) {
    final players = (msg['players'] as List)
        .map((p) => PlayerInfo.fromJson(p as Map<String, dynamic>))
        .toList();

    state = GameState(
      gameId: msg['gameId'] as String,
      mySeat: msg['yourSeat'] as int,
      players: players,
      myCards: [],
      teamScores: [0, 0],
      phase: 'bidding',
      dealerSeat: msg['dealerSeat'] as int,
      currentPlayerSeat: ((msg['dealerSeat'] as int) + 1) % 4,
      handNumber: 1,
    );
  }

  void _handleDeal(Map<String, dynamic> msg) {
    if (state == null) return;
    final cards = (msg['cards'] as List)
        .map((c) => PlayingCard.fromJson(c as Map<String, dynamic>))
        .toList();
    state = state!.copyWith(myCards: cards, legalCards: [], currentTrick: []);
  }

  void _handleBiddingTurn(Map<String, dynamic> msg) {
    if (state == null) return;
    state = state!.copyWith(
      currentPlayerSeat: msg['seatIndex'] as int,
      phase: 'bidding',
    );
  }

  void _handleBidEvent(Map<String, dynamic> msg) {
    // Bidding UI updates handled via bidding_turn
  }

  void _handleContractSet(Map<String, dynamic> msg) {
    if (state == null) return;
    state = state!.copyWith(
      contract: ContractInfo.fromJson(msg),
      phase: 'playing',
    );
  }

  void _handlePlayTurn(Map<String, dynamic> msg) {
    if (state == null) return;
    final legalCards = msg['legalCards'] != null
        ? (msg['legalCards'] as List)
            .map((c) => PlayingCard.fromJson(c as Map<String, dynamic>))
            .toList()
        : <PlayingCard>[];

    state = state!.copyWith(
      currentPlayerSeat: msg['seatIndex'] as int,
      legalCards: legalCards,
      phase: 'playing',
    );
  }

  void _handleCardPlayed(Map<String, dynamic> msg) {
    if (state == null) return;
    final card = PlayingCard.fromJson(msg['card'] as Map<String, dynamic>);
    final seat = msg['seatIndex'] as int;

    final newTrick = [...state!.currentTrick, TrickCard(seatIndex: seat, card: card)];

    // Remove card from my hand if I played it
    List<PlayingCard> myCards = state!.myCards;
    if (seat == state!.mySeat) {
      myCards = myCards.where((c) => c != card).toList();
    }

    state = state!.copyWith(currentTrick: newTrick, myCards: myCards, legalCards: []);
  }

  void _handleTrickWon(Map<String, dynamic> msg) {
    if (state == null) return;
    // Clear trick after a short delay (animation time)
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (state != null) {
        state = state!.copyWith(currentTrick: []);
      }
    });
  }

  void _handleHandResult(Map<String, dynamic> msg) {
    if (state == null) return;
    final scores = (msg['teamScores'] as List).cast<int>();
    state = state!.copyWith(
      teamScores: scores,
      phase: 'scoring',
    );
  }

  void _handleGameOver(Map<String, dynamic> msg) {
    if (state == null) return;
    final scores = (msg['teamScores'] as List).cast<int>();
    state = state!.copyWith(
      teamScores: scores,
      phase: 'finished',
    );
  }

  void _handleFullState(Map<String, dynamic> msg) {
    // Full state sync on reconnection
    final players = (msg['opponents'] as List?)
        ?.map((p) => PlayerInfo.fromJson(p as Map<String, dynamic>))
        .toList() ?? [];

    final myCards = (msg['yourCards'] as List?)
        ?.map((c) => PlayingCard.fromJson(c as Map<String, dynamic>))
        .toList() ?? [];

    final trickCards = msg['currentTrick'] != null
        ? (msg['currentTrick']['cardsPlayed'] as List?)
            ?.map((c) => TrickCard.fromJson(c as Map<String, dynamic>))
            .toList() ?? []
        : <TrickCard>[];

    state = GameState(
      gameId: msg['gameId'] as String,
      mySeat: msg['yourSeat'] as int,
      players: players,
      myCards: myCards,
      currentTrick: trickCards,
      contract: msg['contract'] != null
          ? ContractInfo.fromJson(msg['contract'] as Map<String, dynamic>)
          : null,
      teamScores: (msg['teamScores'] as List).cast<int>(),
      phase: msg['phase'] as String,
      dealerSeat: msg['dealerSeat'] as int,
      currentPlayerSeat: msg['currentPlayerSeat'] as int,
      handNumber: msg['handNumber'] as int,
    );
  }

  void reset() {
    state = null;
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

final gameProvider = StateNotifierProvider<GameNotifier, GameState?>((ref) {
  final ws = ref.read(wsServiceProvider);
  return GameNotifier(ws);
});
