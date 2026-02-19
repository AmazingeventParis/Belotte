import 'package:flutter/material.dart';
import '../../models/card_model.dart';
import '../../config/theme.dart';

class CardWidget extends StatelessWidget {
  final PlayingCard card;
  final bool isPlayable;
  final bool isHighlighted;
  final VoidCallback? onTap;
  final double width;
  final double height;

  const CardWidget({
    super.key,
    required this.card,
    this.isPlayable = false,
    this.isHighlighted = false,
    this.onTap,
    this.width = 65,
    this.height = 95,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isPlayable ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: width,
        height: height,
        transform: isHighlighted
            ? (Matrix4.identity()..translateByDouble(0.0, -10.0, 0.0, 0.0))
            : Matrix4.identity(),
        decoration: BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isPlayable
                ? AppTheme.primaryGreen
                : isHighlighted
                    ? AppTheme.goldAccent
                    : Colors.grey.shade400,
            width: isPlayable ? 2.5 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isPlayable
                  ? AppTheme.primaryGreen.withValues(alpha: 0.3)
                  : Colors.black.withValues(alpha: 0.2),
              blurRadius: isPlayable ? 8 : 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Opacity(
          opacity: isPlayable || isHighlighted ? 1.0 : 0.6,
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card.displayRank,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: card.isRedSuit ? AppTheme.redSuit : AppTheme.blackSuit,
                  ),
                ),
                Text(
                  card.suitSymbol,
                  style: TextStyle(
                    fontSize: 14,
                    color: card.isRedSuit ? AppTheme.redSuit : AppTheme.blackSuit,
                  ),
                ),
                const Spacer(),
                Center(
                  child: Text(
                    card.suitSymbol,
                    style: TextStyle(
                      fontSize: 28,
                      color: card.isRedSuit ? AppTheme.redSuit : AppTheme.blackSuit,
                    ),
                  ),
                ),
                const Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CardBackWidget extends StatelessWidget {
  final double width;
  final double height;

  const CardBackWidget({super.key, this.width = 50, this.height = 72});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFF1565C0),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1565C0), Color(0xFF0D47A1)],
        ),
      ),
      child: Center(
        child: Container(
          width: width * 0.7,
          height: height * 0.7,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: Colors.white24),
          ),
          child: const Center(
            child: Text(
              'B',
              style: TextStyle(
                color: Colors.white30,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
