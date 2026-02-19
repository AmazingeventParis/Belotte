import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';

final authServiceProvider = Provider((ref) => AuthService());

class AuthState {
  final bool isLoggedIn;
  final String? token;
  final String? username;
  final bool isLoading;
  final String? error;

  AuthState({
    this.isLoggedIn = false,
    this.token,
    this.username,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isLoggedIn,
    String? token,
    String? username,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isLoggedIn: isLoggedIn ?? this.isLoggedIn,
      token: token ?? this.token,
      username: username ?? this.username,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(AuthState());

  Future<void> checkAuth() async {
    final token = await _authService.getToken();
    final username = await _authService.getUsername();
    if (token != null) {
      state = state.copyWith(isLoggedIn: true, token: token, username: username);
    }
  }

  Future<bool> login(String username, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    final result = await _authService.login(username, password);
    if (result != null) {
      state = state.copyWith(
        isLoggedIn: true,
        token: result['token'],
        username: result['username'],
        isLoading: false,
      );
      return true;
    }
    state = state.copyWith(isLoading: false, error: 'Identifiants incorrects');
    return false;
  }

  Future<bool> register(String username, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    final result = await _authService.register(username, password);
    if (result != null) {
      state = state.copyWith(
        isLoggedIn: true,
        token: result['token'],
        username: result['username'],
        isLoading: false,
      );
      return true;
    }
    state = state.copyWith(isLoading: false, error: 'Nom d\'utilisateur deja pris');
    return false;
  }

  Future<bool> loginAsGuest() async {
    state = state.copyWith(isLoading: true, error: null);
    final result = await _authService.loginAsGuest();
    if (result != null) {
      state = state.copyWith(
        isLoggedIn: true,
        token: result['token'],
        username: result['username'],
        isLoading: false,
      );
      return true;
    }
    state = state.copyWith(isLoading: false, error: 'Erreur de connexion');
    return false;
  }

  Future<void> logout() async {
    await _authService.logout();
    state = AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authServiceProvider));
});
