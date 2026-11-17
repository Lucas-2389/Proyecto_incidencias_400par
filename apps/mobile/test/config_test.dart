import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/core/config.dart';

void main() {
  test('USB local acepta loopback y rechaza la dirección de ejemplo', () {
    expect(AppConfig.resolveApiBaseUrl('development', 'http://127.0.0.1:3000/api/v1'),
      'http://127.0.0.1:3000/api/v1');
    expect(() => AppConfig.resolveApiBaseUrl('development', 'http://192.168.1.x:300/api/v1'),
      throwsA(isA<FormatException>().having((error) => error.message, 'message', contains('dirección de ejemplo'))));
    expect(() => AppConfig.resolveApiBaseUrl('development', 'http://:3000/api/v1'), throwsFormatException);
  });
  test('producción resuelve la API pública centralizada sin parámetros locales', () {
    expect(AppConfig.resolveApiBaseUrl('production', ''), AppConfig.productionApiUrl);
    expect(Uri.parse(AppConfig.productionApiUrl).scheme, 'https');
  });
  test('desarrollo exige URL explícita y normaliza la barra final', () {
    expect(() => AppConfig.resolveApiBaseUrl('development', ''), throwsFormatException);
    expect(AppConfig.resolveApiBaseUrl('development', 'http://dev.example.invalid/api/v1/'),
        'http://dev.example.invalid/api/v1');
  });
  test('rechaza secretos en URI, URL inválida y HTTP en producción', () {
    for (final value in ['http://example.invalid/api/v1', 'https://user:pass@example.invalid/api/v1',
      'https://example.invalid/api/v1?secret=value', 'https://example.invalid/wrong']) {
      expect(() => AppConfig.resolveApiBaseUrl('production', value), throwsFormatException);
    }
    expect(() => AppConfig.resolveApiBaseUrl('unknown', ''), throwsFormatException);
  });
}
