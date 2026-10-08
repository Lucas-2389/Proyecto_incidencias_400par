import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/core/config.dart';

void main() {
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
