import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/game_state.dart';
import '../providers/game_provider.dart';
import '../widgets/cards/card_widget.dart';
import '../config/theme.dart';

class GameScreen extends ConsumerWidget {
  const GameScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final game = ref.watch(gameProvider);

    if (game == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (game.phase == 'finished') {
      return _GameOverOverlay(game: game);
    }

    return Scaffold(
      backgroundColor: AppTheme.feltGreen,
      body: SafeArea(
        child: Column(
          children: [
            // Score bar
            _ScoreBar(game: game),

            // Game table
            Expanded(
              child: Stack(
                children: [
                  // Opponent top
                  Positioned(
                    top: 8,
                    left: 0,
                    right: 0,
                    child: _OpponentHand(
                      game: game,
                      relativePosition: 2, // across
                    ),
                  ),

                  // Opponent left
                  Positioned(
                    left: 8,
                    top: 60,
                    bottom: 60,
                    child: _OpponentSide(
                      game: game,
                      relativePosition: 1, // left
                    ),
                  ),

                  // Opponent right
                  Positioned(
                    right: 8,
                    top: 60,
                    bottom: 60,
                    child: _OpponentSide(
                      game: game,
                      relativePosition: 3, // right
                    ),
                  ),

                  // Center: current trick
                  Center(
                    child: _TrickArea(game: game),
                  ),

                  // Bidding panel (overlay)
                  if (game.phase == 'bidding')
                    Positioned(
                      bottom: 120,
                      left: 16,
                      right: 16,
                      child: _BiddingPanel(game: game),
                    ),
                ],
              ),
            ),

            // My hand
            _PlayerHand(game: game),
          ],
        ),
      ),
    );
  }
}

class _ScoreBar extends StatelessWidget {
  final GameState game;
  const _ScoreBar({required this.game});

  @override
  Widget build(BuildContext context) {
    final myTeam = game.myTeam;
    final contract = game.contract;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.black26,
      child: Row(
        children: [
          // My team score
          _TeamScore(
            label: 'Nous',
            score: game.teamScores[myTeam],
            isMyTeam: true,
          ),
          const Spacer(),
          // Contract info
          if (contract != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black38,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${contract.value} ${contract.suitSymbol} ${contract.multiplierText}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            )
          else
            Text(
              'Manche ${game.handNumber}',
              style: const TextStyle(color: Colors.white70),
            ),
          const Spacer(),
          // Opponent team score
          _TeamScore(
            label: 'Eux',
            score: game.teamScores[myTeam == 0 ? 1 : 0],
            isMyTeam: false,
          ),
        ],
      ),
    );
  }
}

class _TeamScore extends StatelessWidget {
  final String label;
  final int score;
  final bool isMyTeam;
  const _TeamScore({required this.label, required this.score, required this.isMyTeam});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(color: isMyTeam ? AppTheme.goldAccent : Colors.white70, fontSize: 12)),
        Text(
          '$score',
          style: TextStyle(
            color: isMyTeam ? AppTheme.goldAccent : Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}

class _OpponentHand extends StatelessWidget {
  final GameState game;
  final int relativePosition;
  const _OpponentHand({required this.game, required this.relativePosition});

  @override
  Widget build(BuildContext context) {
    final seat = (game.mySeat + relativePosition) % 4;
    final player = game.getPlayerBySeat(seat);
    if (player == null) return const SizedBox();

    return Column(
      children: [
        Text(
          player.username,
          style: TextStyle(
            color: Colors.white,
            fontWeight: game.currentPlayerSeat == seat ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            player.cardCount.clamp(0, 8),
            (_) => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 1),
              child: CardBackWidget(width: 30, height: 44),
            ),
          ),
        ),
        if (game.currentPlayerSeat == seat)
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppTheme.goldAccent,
              shape: BoxShape.circle,
            ),
          ),
      ],
    );
  }
}

class _OpponentSide extends StatelessWidget {
  final GameState game;
  final int relativePosition;
  const _OpponentSide({required this.game, required this.relativePosition});

  @override
  Widget build(BuildContext context) {
    final seat = (game.mySeat + relativePosition) % 4;
    final player = game.getPlayerBySeat(seat);
    if (player == null) return const SizedBox();

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (game.currentPlayerSeat == seat)
          Container(
            margin: const EdgeInsets.only(bottom: 4),
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppTheme.goldAccent,
              shape: BoxShape.circle,
            ),
          ),
        Text(
          player.username,
          style: TextStyle(
            color: Colors.white,
            fontSize: 11,
            fontWeight: game.currentPlayerSeat == seat ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        const SizedBox(height: 4),
        Column(
          children: List.generate(
            player.cardCount.clamp(0, 8),
            (_) => const Padding(
              padding: EdgeInsets.symmetric(vertical: 1),
              child: CardBackWidget(width: 28, height: 18),
            ),
          ),
        ),
      ],
    );
  }
}

class _TrickArea extends StatelessWidget {
  final GameState game;
  const _TrickArea({required this.game});

  Offset _getCardOffset(int seatIndex) {
    final relative = (seatIndex - game.mySeat + 4) % 4;
    switch (relative) {
      case 0: return const Offset(0, 40); // bottom (me)
      case 1: return const Offset(-60, 0); // left
      case 2: return const Offset(0, -40); // top
      case 3: return const Offset(60, 0); // right
      default: return Offset.zero;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      height: 160,
      child: Stack(
        alignment: Alignment.center,
        children: game.currentTrick.map((tc) {
          final offset = _getCardOffset(tc.seatIndex);
          return Transform.translate(
            offset: offset,
            child: CardWidget(
              card: tc.card,
              width: 55,
              height: 80,
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _BiddingPanel extends ConsumerStatefulWidget {
  final GameState game;
  const _BiddingPanel({required this.game});

  @override
  ConsumerState<_BiddingPanel> createState() => _BiddingPanelState();
}

class _BiddingPanelState extends ConsumerState<_BiddingPanel> {
  int _selectedValue = 80;
  String _selectedSuit = 'hearts';

  final _suits = [
    {'name': 'hearts', 'symbol': '\u2665', 'color': Colors.red},
    {'name': 'diamonds', 'symbol': '\u2666', 'color': Colors.red},
    {'name': 'clubs', 'symbol': '\u2663', 'color': Colors.black},
    {'name': 'spades', 'symbol': '\u2660', 'color': Colors.black},
  ];

  @override
  Widget build(BuildContext context) {
    final isMyTurn = widget.game.isMyTurn;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            isMyTurn ? 'A vous d\'encherer !' : 'En attente...',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          if (isMyTurn) ...[
            const SizedBox(height: 12),
            // Suit selection
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: _suits.map((s) {
                final isSelected = _selectedSuit == s['name'];
                return GestureDetector(
                  onTap: () => setState(() => _selectedSuit = s['name'] as String),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 6),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primaryGreen : Colors.white12,
                      borderRadius: BorderRadius.circular(8),
                      border: isSelected ? Border.all(color: AppTheme.goldAccent, width: 2) : null,
                    ),
                    child: Text(
                      s['symbol'] as String,
                      style: TextStyle(
                        fontSize: 24,
                        color: s['color'] as Color == Colors.red ? Colors.red : Colors.white,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            // Value slider
            Row(
              children: [
                IconButton(
                  onPressed: _selectedValue > 80
                      ? () => setState(() => _selectedValue -= 10)
                      : null,
                  icon: const Icon(Icons.remove, color: Colors.white),
                ),
                Expanded(
                  child: Center(
                    child: Text(
                      '$_selectedValue',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _selectedValue < 250
                      ? () => setState(() => _selectedValue += 10)
                      : null,
                  icon: const Icon(Icons.add, color: Colors.white),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      ref.read(wsServiceProvider).passBid();
                    },
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
                    child: const Text('Passer'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      ref.read(wsServiceProvider).placeBid(_selectedValue, _selectedSuit);
                    },
                    child: const Text('Encherer'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _PlayerHand extends ConsumerWidget {
  final GameState game;
  const _PlayerHand({required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      color: Colors.black26,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: game.myCards.map((card) {
            final isLegal = game.legalCards.contains(card);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: CardWidget(
                card: card,
                isPlayable: isLegal && game.isMyTurn && game.phase == 'playing',
                isHighlighted: isLegal && game.isMyTurn,
                onTap: () {
                  ref.read(wsServiceProvider).playCard(card.suit.name, card.toJson()['rank']);
                },
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _GameOverOverlay extends StatelessWidget {
  final GameState game;
  const _GameOverOverlay({required this.game});

  @override
  Widget build(BuildContext context) {
    final myTeam = game.myTeam;
    final won = game.teamScores[myTeam] > game.teamScores[myTeam == 0 ? 1 : 0];

    return Scaffold(
      backgroundColor: Colors.black87,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              won ? Icons.emoji_events : Icons.sentiment_dissatisfied,
              size: 80,
              color: won ? AppTheme.goldAccent : Colors.grey,
            ),
            const SizedBox(height: 24),
            Text(
              won ? 'Victoire !' : 'Defaite',
              style: Theme.of(context).textTheme.displaySmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: won ? AppTheme.goldAccent : Colors.white,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${game.teamScores[myTeam]} - ${game.teamScores[myTeam == 0 ? 1 : 0]}',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white),
            ),
            const SizedBox(height: 48),
            ElevatedButton(
              onPressed: () => context.go('/home'),
              child: const Text('Retour au menu'),
            ),
          ],
        ),
      ),
    );
  }
}
