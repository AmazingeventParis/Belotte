import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../providers/game_provider.dart';

class MatchmakingScreen extends ConsumerStatefulWidget {
  const MatchmakingScreen({super.key});

  @override
  ConsumerState<MatchmakingScreen> createState() => _MatchmakingScreenState();
}

class _MatchmakingScreenState extends ConsumerState<MatchmakingScreen> {
  int _elapsedSeconds = 0;
  Timer? _timer;
  StreamSubscription? _subscription;

  @override
  void initState() {
    super.initState();
    _startMatchmaking();
  }

  void _startMatchmaking() {
    final ws = ref.read(wsServiceProvider);
    final auth = ref.read(authProvider);

    // Reset game state for new game
    ref.read(gameProvider.notifier).reset();

    // Connect and join queue
    if (!ws.isConnected && auth.token != null) {
      ws.connect(auth.token!);
    }

    // Listen for game start
    _subscription = ws.messages.listen((msg) {
      if (msg['type'] == 'auth_ok') {
        ws.joinQueue();
      }
      if (msg['type'] == 'game_left') {
        // Previous game cleared, now join queue
        ws.send({'type': 'join_queue'});
      }
      if ((msg['type'] == 'game_start' || msg['type'] == 'game_state') && mounted) {
        // Small delay to let GameNotifier process buffered messages
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted) context.go('/game');
        });
      }
    });

    // If already connected
    if (ws.isConnected) {
      ws.joinQueue();
    }

    // Timer
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsedSeconds++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _subscription?.cancel();
    super.dispose();
  }

  void _cancel() {
    ref.read(wsServiceProvider).cancelQueue();
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(
                width: 80,
                height: 80,
                child: CircularProgressIndicator(strokeWidth: 4),
              ),
              const SizedBox(height: 32),
              Text(
                'Recherche d\'une partie...',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              Text(
                '${_elapsedSeconds}s',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _elapsedSeconds >= 8
                    ? 'Ajout de bots pour completer...'
                    : 'En attente de joueurs...',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 48),
              OutlinedButton(
                onPressed: _cancel,
                child: const Text('Annuler'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
