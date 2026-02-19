enum CardSuit { hearts, diamonds, clubs, spades }

enum CardRank { seven, eight, nine, ten, jack, queen, king, ace }

class PlayingCard {
  final CardSuit suit;
  final CardRank rank;

  const PlayingCard({required this.suit, required this.rank});

  factory PlayingCard.fromJson(Map<String, dynamic> json) {
    return PlayingCard(
      suit: CardSuit.values.firstWhere((s) => s.name == json['suit']),
      rank: _parseRank(json['rank'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
    'suit': suit.name,
    'rank': _rankToString(rank),
  };

  static CardRank _parseRank(String value) {
    switch (value) {
      case '7': return CardRank.seven;
      case '8': return CardRank.eight;
      case '9': return CardRank.nine;
      case '10': return CardRank.ten;
      case 'jack': return CardRank.jack;
      case 'queen': return CardRank.queen;
      case 'king': return CardRank.king;
      case 'ace': return CardRank.ace;
      default: throw ArgumentError('Unknown rank: $value');
    }
  }

  static String _rankToString(CardRank rank) {
    switch (rank) {
      case CardRank.seven: return '7';
      case CardRank.eight: return '8';
      case CardRank.nine: return '9';
      case CardRank.ten: return '10';
      case CardRank.jack: return 'jack';
      case CardRank.queen: return 'queen';
      case CardRank.king: return 'king';
      case CardRank.ace: return 'ace';
    }
  }

  String get displayRank {
    switch (rank) {
      case CardRank.seven: return '7';
      case CardRank.eight: return '8';
      case CardRank.nine: return '9';
      case CardRank.ten: return '10';
      case CardRank.jack: return 'V';
      case CardRank.queen: return 'D';
      case CardRank.king: return 'R';
      case CardRank.ace: return 'A';
    }
  }

  String get suitSymbol {
    switch (suit) {
      case CardSuit.hearts: return '\u2665';
      case CardSuit.diamonds: return '\u2666';
      case CardSuit.clubs: return '\u2663';
      case CardSuit.spades: return '\u2660';
    }
  }

  bool get isRedSuit => suit == CardSuit.hearts || suit == CardSuit.diamonds;

  @override
  bool operator ==(Object other) =>
      other is PlayingCard && suit == other.suit && rank == other.rank;

  @override
  int get hashCode => suit.hashCode ^ rank.hashCode;

  @override
  String toString() => '$displayRank$suitSymbol';
}
