import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:incidencias_mobile/core/api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('el reporte ignora una sesión antigua y guarda el permiso separado del comprobante', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final api = ApiClient(baseUrl: 'https://example.invalid/api/v1', client: MockClient((request) async {
      if (request.url.path.endsWith('/auth/login')) {
        return http.Response(jsonEncode({'accessToken': 'old-test-access', 'refreshToken': 'old-test-refresh'}), 200);
      }
      expect(request.url.path, '/api/v1/incidents');
      expect(request.headers.containsKey('Authorization'), isFalse);
      expect(request.headers.containsKey('authorization'), isFalse);
      expect(request.headers['Idempotency-Key'], 'test-request');
      return http.Response(jsonEncode({'id': 'report-1', 'reference': 'TEST-1', 'guestEvidenceToken': 'scoped-test-permission'}), 201);
    }));
    try {
      await api.login('test@example.invalid', 'test-only-password');
      expect(api.signedIn, isTrue);
      final receipt = await api.submitReport({'description': 'Prueba'}, 'test-request');
      expect(receipt['reference'], 'TEST-1');
      expect(receipt.containsKey('guestEvidenceToken'), isFalse);
      expect(await const FlutterSecureStorage().read(key: 'guestEvidence:report-1'), 'scoped-test-permission');
    } finally { api.dispose(); }
  });
}
