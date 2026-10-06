import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/api.dart';
import 'core/config.dart';
import 'core/pending.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (AppConfig.apiBaseUrl.isEmpty) {
    runApp(const MaterialApp(home: Scaffold(body: Center(child: Text(
      'Configura API_BASE_URL con --dart-define antes de ejecutar la app.', textAlign: TextAlign.center,
    )))));
    return;
  }
  final api = ApiClient(baseUrl: AppConfig.apiBaseUrl);
  await api.restore();
  final preferences = await SharedPreferences.getInstance();
  final pending = SharedPendingRepository(preferences);
  runApp(IncidenciasApp(api: api, pending: pending));
}
