class AppConfig {
  static const String apiBaseUrl = 'https://belotte-api.swipego.app';
  static const String wsUrl = 'wss://belotte-api.swipego.app/ws';
  static const String appName = 'Belote Contrée';
  static const int reconnectMaxAttempts = 10;
  static const Duration reconnectInitialDelay = Duration(seconds: 1);
}
