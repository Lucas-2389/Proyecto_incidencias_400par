import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:incidencias_mobile/core/api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final authenticated in [false, true]) {
    test('reporte con sesión $authenticated conserva identidad y comprobante', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = ApiClient(baseUrl: 'https://example.invalid/api/v1', client: MockClient((request) async {
        if (request.url.path.endsWith('/auth/me')) return http.Response('{"id":"citizen","name":"Test","email":"test@example.invalid","phone":null}', 200);
        if (request.url.path.endsWith('/auth/login')) {
          return http.Response(jsonEncode({'accessToken': 'test-access', 'refreshToken': 'test-refresh'}), 200);
        }
        expect(request.url.path, '/api/v1/incidents');
        expect(request.headers['Authorization'], authenticated ? 'Bearer test-access' : isNull);
        expect(request.headers['Idempotency-Key'], 'test-request');
        expect(jsonDecode(request.body)['clientRequestId'], 'test-request');
        return http.Response(jsonEncode({'id': 'report-1', 'reference': 'TEST-1',
          if (!authenticated) 'guestEvidenceToken': 'scoped-test-permission'}), 201);
      }));
      try {
        if (authenticated) await api.login('test@example.invalid', 'test-only-password');
        final receipt = await api.submitReport({'description': 'Prueba'}, 'test-request');
        expect(receipt['reference'], 'TEST-1');
        expect(receipt.containsKey('guestEvidenceToken'), isFalse);
        expect(await const FlutterSecureStorage().read(key: 'guestEvidence:report-1'),
          authenticated ? isNull : 'scoped-test-permission');
      } finally { api.dispose(); }
    });
  }
  test('credenciales inválidas no reenvían el reporte como invitado', () async {
    FlutterSecureStorage.setMockInitialValues({});
    var submissions = 0;
    final api = ApiClient(baseUrl: 'https://example.invalid/api/v1', client: MockClient((request) async {
      if (request.url.path.endsWith('/auth/me')) return http.Response('{"id":"citizen","name":"Test","email":"test@example.invalid","phone":null}', 200);
      if (request.url.path.endsWith('/auth/login')) {
        return http.Response(jsonEncode({'accessToken': 'test-access', 'refreshToken': 'test-refresh'}), 200);
      }
      if (request.url.path.endsWith('/incidents')) {
        submissions++;
        expect(request.headers['Authorization'], 'Bearer test-access');
      }
      return http.Response('{"message":"Sesión vencida"}', 401);
    }));
    await api.login('test@example.invalid', 'test-password');
    await expectLater(api.submitReport({}, 'retry-id'), throwsA(isA<ApiException>()));
    expect(submissions, 1);
    expect(api.signedIn, isFalse);
    api.dispose();
  });
}
