import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/api.dart';
import 'core/config.dart';
import 'core/pending.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  late final String apiBaseUrl;
  try {
    apiBaseUrl = AppConfig.apiBaseUrl;
  } on FormatException catch (issue) {
    runApp(MaterialApp(home: Scaffold(body: Center(child: Text(
      'Configuración de API inválida. ${issue.message}', textAlign: TextAlign.center,
    )))));
    return;
  }
  final api = ApiClient(baseUrl: apiBaseUrl);
  final preferences = await SharedPreferences.getInstance();
  final pending = SharedPendingRepository(preferences);
  runApp(IncidenciasApp(api: api, pending: pending));
  WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(api.restore()));
}
