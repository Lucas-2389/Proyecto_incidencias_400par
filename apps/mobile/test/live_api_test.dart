import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/config.dart';
import 'package:uuid/uuid.dart';

class _RealHttpOverrides extends HttpOverrides {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const enabled = bool.fromEnvironment('RUN_LIVE_API');
  test('Render real: login ciudadano, información pública, reporte y foto', () => HttpOverrides.runWithHttpOverrides(() async {
    final password = Platform.environment['MOBILE_DEMO_PASSWORD'];
    if (password == null || password.isEmpty) throw StateError('Falta credencial privada de prueba');
    FlutterSecureStorage.setMockInitialValues({});
    final api = ApiClient(baseUrl: AppConfig.apiBaseUrl);
    final temporary = await Directory.systemTemp.createTemp('incidencias-live-');
    try {
      await api.login('citizen@demo.invalid', password);
      expect(api.signedIn, isTrue);
      final categories = await api.list('/catalog/categories');
      expect(categories, isNotEmpty);
      await api.list('/public/alerts');
      await api.list('/public/directory');
      final to = DateTime.now().toUtc();
      final from = to.subtract(const Duration(days: 7));
      await api.list('/public/heatmap?from=${Uri.encodeQueryComponent(from.toIso8601String())}&to=${Uri.encodeQueryComponent(to.toIso8601String())}');
      final key = const Uuid().v4();
      final report = await api.submitReport({
        'categoryId': categories.first['id'],
        'description': 'DEMO: prueba técnica Flutter contra Render. No es una emergencia real.',
        'location': {'latitude': -13.16, 'longitude': -74.22, 'reference': 'DEMO técnico Ayacucho'},
      }, key);
      final id = report['id'] as String;
      expect((await api.list('/incidents/mine', auth: true)).any((item) => item['id'] == id), isTrue);
      final recorder = ui.PictureRecorder();
      ui.Canvas(recorder).drawColor(const ui.Color(0xFF168577), ui.BlendMode.src);
      final picture = recorder.endRecording();
      final image = await picture.toImage(16, 16);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final photo = File('${temporary.path}/technical-test.png');
      await photo.writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
      picture.dispose();
      await api.uploadPhoto(id, photo.path);
      final detail = await api.request('GET', '/incidents/$id') as Map;
      expect((detail['evidence'] as List), hasLength(1));
      // Keep the clearly labeled technical report for review; never delete domain data here.
      await api.logout();
      expect(api.signedIn, isFalse);
    } finally {
      api.dispose();
      await temporary.delete(recursive: true);
    }
  }, _RealHttpOverrides()), skip: !enabled, timeout: const Timeout(Duration(minutes: 4)));
}
