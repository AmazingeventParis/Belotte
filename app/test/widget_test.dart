import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:belotte/main.dart';

void main() {
  testWidgets('App launches without errors', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: BelotteApp()));
    expect(find.text('Belote Contree'), findsOneWidget);
  });
}
