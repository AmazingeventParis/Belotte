import 'card_model.dart';

class PlayerInfo {
  final int seatIndex;
  final String username;
  final bool isBot;
  final int teamIndex;
  final int cardCount;
  final bool isDisconnected;

  PlayerInfo({
    required this.seatIndex,
    required this.username,
    required this.isBot,
    required this.teamIndex,
    this.cardCount = 8,
    this.isDisconnected = false,
  });

  factory PlayerInfo.fromJson(Map<String, dynamic> json) {
    return PlayerInfo(
      seatIndex: json['seatIndex'] as int,
      username: json['username'] as String,
      isBot: json['isBot'] as bool? ?? false,
      teamIndex: json['teamIndex'] as int? ?? (json['seatIndex'] as int) % 2,
      cardCount: json['cardCount'] as int? ?? 8,
      isDisconnected: json['isDisconnected'] as bool? ?? false,
    );
  }
}

class ContractInfo {
  final int value;
  final String suit;
  final int teamIndex;
  final int multiplier;

  ContractInfo({
    required this.value,
    required this.suit,
    required this.teamIndex,
    required this.multiplier,
  });

  factory ContractInfo.fromJson(Map<String, dynamic> json) {
    return ContractInfo(
      value: json['value'] as int,
      suit: json['suit'] as String,
      teamIndex: json['teamIndex'] as int,
      multiplier: json['multiplier'] as int,
    );
  }

  String get suitSymbol {
    switch (suit) {
      case 'hearts': return '\u2665';
      case 'diamonds': return '\u2666';
      case 'clubs': return '\u2663';
      case 'spades': return '\u2660';
      default: return '?';
    }
  }

  String get multiplierText {
    if (multiplier == 4) return 'Surcoinche';
    if (multiplier == 2) return 'Coinche';
    return '';
  }
}

class TrickCard {
  final int seatIndex;
  final PlayingCard card;

  TrickCard({required this.seatIndex, required this.card});

  factory TrickCard.fromJson(Map<String, dynamic> json) {
    return TrickCard(
      seatIndex: json['seatIndex'] as int,
      card: PlayingCard.fromJson(json['card'] as Map<String, dynamic>),
    );
  }
}

class GameState {
  final String gameId;
  final int mySeat;
  final List<PlayerInfo> players;
  final List<PlayingCard> myCards;
  final List<PlayingCard> legalCards;
  final List<TrickCard> currentTrick;
  final ContractInfo? contract;
  final List<int> teamScores;
  final String phase; // bidding, playing, scoring, finished
  final int dealerSeat;
  final int currentPlayerSeat;
  final int handNumber;
  final List<int> tricksWon;

  GameState({
    required this.gameId,
    required this.mySeat,
    required this.players,
    required this.myCards,
    this.legalCards = const [],
    this.currentTrick = const [],
    this.contract,
    required this.teamScores,
    required this.phase,
    required this.dealerSeat,
    required this.currentPlayerSeat,
    required this.handNumber,
    this.tricksWon = const [0, 0],
  });

  int get myTeam => mySeat % 2;
  bool get isMyTurn => currentPlayerSeat == mySeat;

  PlayerInfo? getPlayerBySeat(int seat) {
    try {
      return players.firstWhere((p) => p.seatIndex == seat);
    } catch (_) {
      return null;
    }
  }

  GameState copyWith({
    List<PlayingCard>? myCards,
    List<PlayingCard>? legalCards,
    List<TrickCard>? currentTrick,
    ContractInfo? contract,
    List<int>? teamScores,
    String? phase,
    int? currentPlayerSeat,
    int? handNumber,
    List<int>? tricksWon,
    List<PlayerInfo>? players,
  }) {
    return GameState(
      gameId: gameId,
      mySeat: mySeat,
      players: players ?? this.players,
      myCards: myCards ?? this.myCards,
      legalCards: legalCards ?? this.legalCards,
      currentTrick: currentTrick ?? this.currentTrick,
      contract: contract ?? this.contract,
      teamScores: teamScores ?? this.teamScores,
      phase: phase ?? this.phase,
      dealerSeat: dealerSeat,
      currentPlayerSeat: currentPlayerSeat ?? this.currentPlayerSeat,
      handNumber: handNumber ?? this.handNumber,
      tricksWon: tricksWon ?? this.tricksWon,
    );
  }
}
