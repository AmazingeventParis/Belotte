import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Parametres')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Sons'),
            subtitle: const Text('Activer les effets sonores'),
            value: true,
            onChanged: (_) {}, // V2
          ),
          SwitchListTile(
            title: const Text('Vibrations'),
            subtitle: const Text('Vibrer quand c\'est votre tour'),
            value: true,
            onChanged: (_) {}, // V2
          ),
          const Divider(),
          ListTile(
            title: const Text('Version'),
            subtitle: const Text('1.0.0'),
          ),
        ],
      ),
    );
  }
}
